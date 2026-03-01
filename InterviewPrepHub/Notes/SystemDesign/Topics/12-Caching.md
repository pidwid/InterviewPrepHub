# Caching

## Table of Contents

1. [Overview](#1-overview)
2. [Where to Cache](#2-where-to-cache)
3. [Application-Level Caching Strategies](#3-application-level-caching-strategies)
4. [Cache Eviction Policies](#4-cache-eviction-policies)
5. [Cache Invalidation](#5-cache-invalidation)
6. [Distributed Caching](#6-distributed-caching)
7. [Cache Stampede (Thundering Herd)](#7-cache-stampede-thundering-herd)
8. [Redis Deep Dive](#8-redis-deep-dive)
9. [Caching Patterns in Practice](#9-caching-patterns-in-practice)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Caching stores a copy of frequently accessed data in a **faster storage layer** so
subsequent requests can be served without hitting the slower, authoritative source.

The fundamental insight: **reads are almost always more frequent than writes**.
If your data is read 100x for every write, caching it can eliminate 99% of database hits.

### The Cache Hit/Miss Flow

```
Client Request
      │
      ▼
┌────────────┐     Cache Hit (fast)
│   Cache    │────────────────────────► Return Data
│ (Redis,    │
│  Memcached)│
└─────┬──────┘
      │ Cache Miss
      ▼
┌────────────┐
│  Database  │────► Store in Cache ────► Return Data
│ (PostgreSQL│
│  MongoDB)  │
└────────────┘
```

### Why Caching Works: The Pareto Principle

In most applications, **20% of the data** is responsible for **80% of the reads**.
Caching that hot 20% eliminates the majority of database load.

### Cache Hit Ratio

```
Hit Ratio = Cache Hits / (Cache Hits + Cache Misses)

Target ratios:
  > 95% — Excellent
  > 90% — Good
  > 80% — Acceptable
  < 80% — Investigate (cache too small? wrong eviction policy? bad TTLs?)
```

---

## 2. Where to Cache

Caching can happen at every level of the stack.

```
┌──────────────┐
│   Browser    │  ← Client-side cache (Local Storage, Service Worker)
└──────┬───────┘
       │
┌──────▼───────┐
│     CDN      │  ← Edge cache (static assets, API responses)
└──────┬───────┘
       │
┌──────▼───────┐
│  API Gateway │  ← Response cache (full API responses)
│  / LB        │
└──────┬───────┘
       │
┌──────▼───────┐
│  Web Server  │  ← HTTP cache (reverse proxy like Nginx or Varnish)
└──────┬───────┘
       │
┌──────▼───────┐
│ Application  │  ← Application cache (Redis, Memcached, in-process)
└──────┬───────┘
       │
┌──────▼───────┐
│  Database    │  ← Query cache, buffer pool, materialized views
└──────────────┘
```

### Level-by-Level Breakdown

| Level            | What's Cached                  | TTL Range      | Tools                          |
|------------------|--------------------------------|----------------|--------------------------------|
| Client/Browser   | Static assets, API responses   | Seconds–Days   | HTTP headers, localStorage     |
| CDN              | Static files, dynamic content  | Minutes–Days   | CloudFront, Cloudflare, Akamai |
| API Gateway      | Full API responses             | Seconds–Minutes| Kong, AWS API Gateway          |
| Web Server       | Rendered pages, static files   | Seconds–Hours  | Nginx, Varnish                 |
| Application      | DB results, computed values    | Seconds–Hours  | Redis, Memcached, Caffeine     |
| Database         | Query results, buffer pages    | Auto-managed   | MySQL Query Cache, PG buffer pool|

### Client-Side Caching (HTTP Cache Headers)

```
HTTP/1.1 200 OK
Cache-Control: public, max-age=3600           ← Cache for 1 hour
ETag: "abc123"                                ← Fingerprint for conditional requests
Last-Modified: Wed, 15 Jan 2024 10:00:00 GMT  ← For conditional requests

On next request:
  Client sends:  If-None-Match: "abc123"
  Server replies: 304 Not Modified  (no body sent → saves bandwidth)
```

**Cache-Control Directives:**

| Directive     | Meaning                                                |
|---------------|--------------------------------------------------------|
| public        | Can be cached by any intermediate (CDN, proxy)         |
| private       | Only the browser can cache (not CDNs)                  |
| no-cache      | Must revalidate with server before using cached copy   |
| no-store      | Don't cache at all (sensitive data)                    |
| max-age=N     | Cache for N seconds                                    |
| s-maxage=N    | Override max-age for shared caches (CDN/proxy)         |
| stale-while-revalidate=N | Serve stale while fetching fresh in background|

### Database-Level Caching

Most databases have built-in caching:

- **Buffer Pool** (InnoDB, PostgreSQL): Caches frequently-accessed data pages in memory.
  Usually set to 70-80% of available RAM on a dedicated database server.
- **Query Cache** (deprecated in MySQL 8.0): Cached query results. Invalidated on any
  write to the table, so it was only useful for read-heavy, rarely-updated tables.
- **Prepared Statement Cache**: Caches parsed and optimized query plans.

---

## 3. Application-Level Caching Strategies

These are the caching patterns you'll implement in your application code.

### 3.1 Cache-Aside (Lazy Loading)

The **most common** pattern. The application manages both the cache and the database.

```
Read Path:
  1. App checks cache
  2. Cache hit → return cached data
  3. Cache miss → query database
  4. Store result in cache (with TTL)
  5. Return data

Write Path:
  1. App writes to database
  2. App invalidates (deletes) the cache key
  
     ┌─────────────┐
     │ Application  │
     └──┬───────┬───┘
        │       │
   ┌────▼──┐ ┌──▼────────┐
   │ Cache │ │ Database   │
   └───────┘ └────────────┘
   App manages both independently
```

```python
def get_user(user_id):
    # 1. Check cache
    cached = redis.get(f"user:{user_id}")
    if cached:
        return json.loads(cached)  # Cache hit
    
    # 2. Cache miss → query DB
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    
    # 3. Store in cache with TTL
    redis.setex(f"user:{user_id}", 3600, json.dumps(user))
    
    return user

def update_user(user_id, data):
    # 1. Update database
    db.execute("UPDATE users SET ... WHERE id = %s", user_id)
    
    # 2. Invalidate cache
    redis.delete(f"user:{user_id}")
```

**Advantages:**
- Only cache data that's actually requested (no wasted memory)
- Cache failure doesn't break the system (just slower)
- Simple to implement

**Disadvantages:**
- First request for each item is always a cache miss (cold start)
- Stale data is possible if cache isn't invalidated properly
- Three round trips on cache miss (check cache, query DB, write cache)

### 3.2 Write-Through

Every write goes to both the cache **and** the database, **synchronously**.

```
Write Path:
  1. App writes to cache
  2. Cache writes to database (synchronously)
  3. Acknowledge to app only after both succeed

     ┌─────────────┐
     │ Application  │
     └──────┬───────┘
            │ Write
     ┌──────▼──────┐     Synchronous
     │    Cache    │────────────────► Database
     └─────────────┘
```

**Advantages:**
- Cache is always up-to-date with the database
- No stale data
- Reads are always cache hits (data is always in cache)

**Disadvantages:**
- Higher write latency (must write to both synchronously)
- Cache may fill up with data that's never read
- If cache goes down, writes fail (cache is in the critical path)

### 3.3 Write-Behind (Write-Back)

Writes go to the cache, and the cache **asynchronously** flushes to the database.

```
Write Path:
  1. App writes to cache (acknowledged immediately)
  2. Cache queues the write
  3. Cache flushes to database asynchronously (batched)

     ┌─────────────┐
     │ Application  │
     └──────┬───────┘
            │ Write (fast)
     ┌──────▼──────┐     Async (batched)
     │    Cache    │ ─ ─ ─ ─ ─ ─ ─ ─ ─► Database
     └─────────────┘
```

**Advantages:**
- Lowest write latency (write to memory only)
- Batch writes to database (more efficient)
- Absorbs write spikes

**Disadvantages:**
- **Data loss risk**: If cache crashes before flushing, writes are lost
- Complex implementation
- Eventually consistent (DB may lag behind cache)
- Harder to debug and reason about

### 3.4 Read-Through

Similar to cache-aside, but the **cache itself** is responsible for loading data
from the database on a miss (not the application).

```
Read Path:
  1. App reads from cache
  2. Cache miss → cache queries database
  3. Cache stores the data
  4. Cache returns data to app

     ┌─────────────┐
     │ Application  │
     └──────┬───────┘
            │ Read
     ┌──────▼──────┐     On Miss
     │    Cache    │────────────────► Database
     └─────────────┘
   (Cache loads data itself)
```

**Advantages:**
- Application code is simpler (just talks to cache)
- Cache manages its own data loading logic

**Disadvantages:**
- Requires a cache library that supports data loading callbacks
- First access is still a cache miss

### 3.5 Refresh-Ahead

The cache proactively refreshes entries **before** they expire, based on the assumption
that recently-accessed items will be accessed again.

```
Entry TTL = 60 seconds
Refresh window = last 10 seconds (50-60s mark)

If an entry is accessed between 50-60s:
  → Return cached value immediately
  → Trigger async refresh in background
  → Next access gets fresh data

If an entry is NOT accessed between 50-60s:
  → Let it expire normally
  → Next access is a cache miss
```

**Advantages:**
- Eliminates cache miss latency for hot data
- Users always see cached data (never wait for DB)

**Disadvantages:**
- Complexity in predicting which items to refresh
- Wastes resources if predictions are wrong
- Not all cache libraries support this natively

### Strategy Comparison

| Strategy      | Read Latency | Write Latency | Data Freshness | Complexity | Data Loss Risk |
|---------------|-------------|---------------|----------------|------------|----------------|
| Cache-Aside   | Miss: High  | Low           | May be stale    | Low        | None           |
| Write-Through | Always Low  | High          | Always fresh    | Medium     | None           |
| Write-Behind  | Always Low  | Very Low      | Eventually      | High       | **Yes**        |
| Read-Through  | Miss: High  | Low           | May be stale    | Medium     | None           |
| Refresh-Ahead | Always Low  | Low           | Usually fresh   | High       | None           |

---

## 4. Cache Eviction Policies

When the cache is full, which entry do you remove to make room?

### Common Eviction Policies

| Policy | Name                    | How It Works                               | Best For                        |
|--------|-------------------------|--------------------------------------------|---------------------------------|
| LRU    | Least Recently Used     | Evict the item accessed longest ago         | General purpose (most popular)  |
| LFU    | Least Frequently Used   | Evict the item accessed fewest times        | Stable hot-set workloads        |
| FIFO   | First In, First Out     | Evict oldest inserted item                  | Simple, time-based data         |
| TTL    | Time To Live            | Evict after a set time period               | Time-sensitive data             |
| Random | Random Eviction         | Evict a random item                         | Surprisingly close to LRU       |

### LRU vs LFU

```
Access pattern: A A A B B C C C C D D

LRU (if cache size = 3):
  Cache after each access: [A] → [A] → [A] → [A,B] → [A,B] → [A,B,C] → ...
  If D arrives and cache is full, evict A (least recently used)
  Problem: A was actually very popular! It just wasn't accessed recently.

LFU (if cache size = 3):
  Tracks count: A=3, B=2, C=4
  If D arrives, evict B (lowest frequency = 2)
  Problem: Items that were popular long ago but aren't anymore stay cached.
```

**Redis uses an approximation of LRU** (samples a few keys and evicts the oldest among
them). Redis 4+ also supports **LFU**.

### TTL Strategy

Set appropriate TTLs based on data characteristics:

| Data Type          | Suggested TTL     | Reasoning                          |
|--------------------|-------------------|------------------------------------|
| User session       | 30 min – 24 hours| Security + freshness               |
| User profile       | 5 – 60 minutes   | Rarely changes but should be fresh |
| Product catalog    | 1 – 24 hours     | Changes infrequently               |
| Configuration      | 5 – 30 minutes   | May change during deploys          |
| Search results     | 1 – 5 minutes    | Needs to reflect new content       |
| Rate limit counter | 1 – 60 seconds   | Must expire quickly                |

---

## 5. Cache Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things."
> — Phil Karlton

### Invalidation Strategies

#### 1. TTL-Based Expiration (Passive)

Simply let entries expire after a set time. Simplest approach.

```
redis.setex("user:123", 3600, serialized_user)  # Expires in 1 hour
```

**Pros**: Simple, predictable, no custom invalidation logic.
**Cons**: Data can be stale for up to TTL duration.

#### 2. Event-Based Invalidation (Active)

Invalidate the cache whenever the underlying data changes.

```python
def update_user(user_id, data):
    db.update(user_id, data)      # Update database
    redis.delete(f"user:{user_id}")  # Immediately invalidate cache

# Or publish an event:
def update_user(user_id, data):
    db.update(user_id, data)
    event_bus.publish("user.updated", {"user_id": user_id})

# Subscriber invalidates cache:
@subscribe("user.updated")
def on_user_updated(event):
    redis.delete(f"user:{event['user_id']}")
```

#### 3. Version-Based Invalidation

Include a version number in the cache key. Increment on write.

```python
# Write
version = db.increment_version("user:123")
redis.set(f"user:123:v{version}", serialized_data)

# Read
version = db.get_version("user:123")
data = redis.get(f"user:123:v{version}")
```

Old versions are simply abandoned and eventually evicted by LRU.

### Delete vs Update the Cache?

**Delete** (preferred):
```python
db.update(user_id, data)
redis.delete(f"user:{user_id}")  # Next read will cache fresh data
```

**Update** (risky):
```python
db.update(user_id, data)
redis.set(f"user:{user_id}", updated_data)
# Problem: race condition between two concurrent updates
```

**Why DELETE is safer:**

```
Thread A                          Thread B
  │                                 │
  │ UPDATE db SET name='Alice'      │
  │ SET cache user:123 {Alice}      │ UPDATE db SET name='Bob'
  │                                 │ SET cache user:123 {Bob}
  │                                 │
  
DB has: Bob  ✓
Cache has: Bob  ✓  (happens to be correct this time)

But what if Thread B's DB write happens first, but Thread A's cache SET happens last?
DB has: Alice
Cache has: Alice  ← WRONG! DB actually has Bob's update as final.
```

With DELETE, the next read always fetches the correct value from the database.

---

## 6. Distributed Caching

### Single-Node vs Distributed Cache

```
Single Node:                    Distributed:
┌─────────────┐                ┌──────────┐ ┌──────────┐ ┌──────────┐
│    Redis     │                │ Redis #1 │ │ Redis #2 │ │ Redis #3 │
│    (all     │                │ keys:    │ │ keys:    │ │ keys:    │
│    data)    │                │ A-F      │ │ G-N      │ │ O-Z      │
└─────────────┘                └──────────┘ └──────────┘ └──────────┘

Scaling limit: ~25GB RAM         Data distributed via consistent hashing
```

### Redis Cluster

Redis Cluster automatically shards data across multiple Redis nodes.

```
┌─────────────────────────────────────────────────┐
│                 Redis Cluster                    │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Node 1   │    │ Node 2   │    │ Node 3   │  │
│  │ Slots    │    │ Slots    │    │ Slots    │  │
│  │ 0-5460   │    │ 5461-10922│   │10923-16383│ │
│  │          │    │          │    │          │  │
│  │ Replica  │    │ Replica  │    │ Replica  │  │
│  │ Node 4   │    │ Node 5   │    │ Node 6   │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│                                                  │
│  16384 hash slots distributed across nodes       │
└─────────────────────────────────────────────────┘
```

### Memcached vs Redis

| Feature          | Redis                              | Memcached                       |
|------------------|------------------------------------|---------------------------------|
| Data structures  | Rich (strings, lists, sets, hashes, sorted sets, streams) | Strings only |
| Persistence      | RDB snapshots + AOF                | None (pure cache)               |
| Replication      | Master-Replica                     | None (client-side)              |
| Clustering       | Redis Cluster (built-in)           | Client-side consistent hashing  |
| Lua scripting    | Yes                                | No                              |
| Pub/Sub          | Yes                                | No                              |
| Max value size   | 512 MB                             | 1 MB                            |
| Threading        | Single-threaded (+ I/O threads)    | Multi-threaded                  |
| Memory efficiency| Higher overhead per key            | More efficient per key          |

**When to use Memcached**: Simple key-value caching where you need multi-threaded
performance and don't need persistence or complex data structures.

**When to use Redis**: Almost everything else. The richer feature set makes it
far more versatile.

---

## 7. Cache Stampede (Thundering Herd)

When a popular cache entry expires, hundreds of concurrent requests all get a cache
miss simultaneously and all hit the database at once.

```
Cache expires for "popular_product"

Request 1 ──────► Cache MISS ──────► Database ──────┐
Request 2 ──────► Cache MISS ──────► Database ──────┤
Request 3 ──────► Cache MISS ──────► Database ──────┤  100 identical queries!
  ...                                                │
Request 100 ────► Cache MISS ──────► Database ──────┘
```

### Solutions

#### 1. Locking (Mutex)

Only one request fetches from the database; others wait for the cache to be populated.

```python
def get_product(product_id):
    data = redis.get(f"product:{product_id}")
    if data:
        return json.loads(data)
    
    # Try to acquire lock
    lock_key = f"lock:product:{product_id}"
    if redis.set(lock_key, "1", ex=10, nx=True):  # SET if Not eXists
        try:
            # Winner: fetch from DB and populate cache
            data = db.query("SELECT * FROM products WHERE id = %s", product_id)
            redis.setex(f"product:{product_id}", 3600, json.dumps(data))
            return data
        finally:
            redis.delete(lock_key)
    else:
        # Loser: wait and retry
        time.sleep(0.1)
        return get_product(product_id)  # Retry (cache should be populated now)
```

#### 2. Stale-While-Revalidate

Return stale data immediately while refreshing in the background.

```python
def get_product(product_id):
    key = f"product:{product_id}"
    data = redis.get(key)
    ttl = redis.ttl(key)
    
    if data:
        parsed = json.loads(data)
        
        # If TTL is in the "refresh window" (e.g., < 60s remaining)
        if 0 < ttl < 60:
            # Trigger async refresh
            background_refresh.delay(product_id)
        
        return parsed  # Return (possibly stale) data immediately
    
    # Full cache miss — must wait for DB
    return fetch_and_cache(product_id)
```

#### 3. Jittered TTLs

Add randomness to TTL so entries don't all expire at the same time.

```python
import random

base_ttl = 3600  # 1 hour
jitter = random.randint(-300, 300)  # ±5 minutes
redis.setex(key, base_ttl + jitter, value)
```

#### 4. Early Expiration (Probabilistic)

Each request has a small probability of refreshing the cache before it actually expires.
The closer to expiration, the higher the probability.

```python
import math, random

def should_refresh(ttl, delta=10):
    """XFetch algorithm: probability increases as TTL decreases"""
    if random.random() < delta * math.log(random.random()) * -1 / ttl:
        return True
    return False
```

---

## 8. Redis Deep Dive

Redis is the most popular caching solution and is used far beyond simple caching.

### Data Structures and Use Cases

| Structure    | Commands                    | Use Case                              |
|-------------|----------------------------|---------------------------------------|
| String      | GET, SET, INCR, DECR       | Caching, counters, rate limiting      |
| Hash        | HGET, HSET, HMGET, HGETALL | Object storage (user profiles)        |
| List        | LPUSH, RPUSH, LPOP, LRANGE | Message queues, activity feeds        |
| Set         | SADD, SMEMBERS, SINTER     | Tags, unique visitors, mutual friends |
| Sorted Set  | ZADD, ZRANGE, ZRANGEBYSCORE| Leaderboards, priority queues         |
| Stream      | XADD, XREAD, XREADGROUP   | Event streaming, activity logs        |
| HyperLogLog | PFADD, PFCOUNT             | Unique count estimation (12 KB mem)   |
| Bitmap      | SETBIT, GETBIT, BITCOUNT   | Feature flags, daily active users     |

### Redis Persistence

Redis offers two persistence options:

**RDB (Snapshotting):**
```
Config: save 900 1        # Snapshot if at least 1 key changed in 900 seconds
        save 300 10       # Snapshot if at least 10 keys changed in 300 seconds
        save 60 10000     # Snapshot if at least 10000 keys changed in 60 seconds

Pro: Compact file, fast restart
Con: Data loss between snapshots
```

**AOF (Append Only File):**
```
Config: appendonly yes
        appendfsync everysec   # Flush to disk every second (recommended)
        
Pro: At most 1 second of data loss
Con: Larger file, slower restart
```

**Best practice**: Use both RDB + AOF together.

### Redis Memory Management

```
# Key memory settings
maxmemory 4gb                           # Max memory limit
maxmemory-policy allkeys-lru            # Eviction policy

Available policies:
  noeviction       — Return errors when memory is full
  allkeys-lru      — Evict ANY key using LRU (most common)
  volatile-lru     — Evict only keys with TTL using LRU
  allkeys-lfu      — Evict ANY key using LFU
  volatile-lfu     — Evict only keys with TTL using LFU
  allkeys-random   — Evict random keys
  volatile-random  — Evict random keys with TTL
  volatile-ttl     — Evict keys with shortest TTL
```

---

## 9. Caching Patterns in Practice

### Pattern 1: Cache-Aside with TTL + Event Invalidation

The most practical approach for most applications.

```python
# Read: Cache-Aside
def get_order(order_id):
    cached = redis.get(f"order:{order_id}")
    if cached:
        return json.loads(cached)
    order = db.query_order(order_id)
    redis.setex(f"order:{order_id}", 1800, json.dumps(order))  # 30 min TTL
    return order

# Write: Invalidate
def update_order(order_id, data):
    db.update_order(order_id, data)
    redis.delete(f"order:{order_id}")

# TTL acts as a safety net — even if invalidation fails,
# stale data is automatically removed after 30 minutes.
```

### Pattern 2: Cache Warming (Pre-Population)

```python
# On application startup or after deploy
def warm_cache():
    """Pre-load popular items to avoid cold-start cache misses."""
    popular_products = db.query("SELECT * FROM products ORDER BY view_count DESC LIMIT 1000")
    pipe = redis.pipeline()
    for product in popular_products:
        pipe.setex(f"product:{product['id']}", 3600, json.dumps(product))
    pipe.execute()  # Execute all SETs in one batch
```

### Pattern 3: Multi-Level Caching

```python
# L1: In-process cache (fastest, small)
# L2: Redis (fast, shared across instances)
# L3: Database (authoritative)

from functools import lru_cache

@lru_cache(maxsize=1000)        # L1: In-process (per-instance)
def get_config(key):
    value = redis.get(f"config:{key}")  # L2: Redis (shared)
    if value:
        return value
    value = db.query_config(key)       # L3: Database
    redis.setex(f"config:{key}", 300, value)
    return value
```

### Pattern 4: Computed/Aggregated Cache

```python
# Cache expensive computations, not just raw data
def get_dashboard_stats(user_id):
    cached = redis.get(f"dashboard:{user_id}")
    if cached:
        return json.loads(cached)
    
    # Expensive: multiple queries and aggregation
    stats = {
        "total_orders": db.count_orders(user_id),
        "total_spent": db.sum_order_totals(user_id),
        "favorite_category": db.most_ordered_category(user_id),
        "last_order_date": db.last_order_date(user_id)
    }
    redis.setex(f"dashboard:{user_id}", 600, json.dumps(stats))  # 10 min
    return stats
```

---

## 10. Key Takeaways

### Golden Rules

1. **Cache-aside with TTL** covers 80% of caching use cases. Start there.
2. **DELETE, don't UPDATE** cache entries on writes. It's safer.
3. **Always set a TTL** — even if you actively invalidate. It's your safety net.
4. **Monitor hit ratio** — if it's below 80%, something is wrong.
5. **Use jittered TTLs** to prevent stampedes.
6. **Cache at the right level** — CDN for static content, Redis for dynamic data.
7. **Don't cache what you can compute cheaply** — caching has overhead too.
8. **Warm your cache** after deploys and cold starts for critical data.

### Common Pitfalls

| Pitfall                  | Consequence                           | Solution                          |
|--------------------------|---------------------------------------|-----------------------------------|
| No TTL                   | Stale data forever                    | Always set TTL                    |
| Cache too much           | Memory waste, low hit ratio           | Cache only hot data               |
| Same TTL for everything  | Mass expiration → stampede            | Jittered TTLs                     |
| Caching errors           | Error gets served to all users        | Don't cache error responses       |
| Not monitoring           | Don't know if cache is working        | Track hit ratio, latency, memory  |
| Treating cache as source | Data loss on eviction                 | Database is always the truth      |

### Decision Framework

```
Do I need caching?
  │
  ├── Data is read rarely? ─── No caching needed
  │
  ├── Reads >> Writes (10:1+)? ─── Cache-Aside + TTL
  │
  ├── Write-heavy but latency-sensitive? ─── Write-Behind (if data loss OK)
  │
  ├── Must always be fresh? ─── Write-Through
  │
  ├── Ultra-high traffic popular keys? ─── Refresh-Ahead + Locking
  │
  └── Computed/aggregated data? ─── Cache result + invalidate on input change
```

---

## 🔥 Senior Interview Questions

1. You introduce a Redis cache and get a 99% hit rate, but your P99 latency is worse than before. How is this possible? Discuss cache stampede, hot keys, and connection pool exhaustion. [Answer](QnA-Answer-Key.md#12-caching)

2. Your cache holds user session data. The cache node crashes and 100,000 users are logged out simultaneously. How do you design for cache failure? Compare replication, consistent hashing, and session stores. [Answer](QnA-Answer-Key.md#12-caching)

3. Compare cache-aside, write-through, write-behind, and refresh-ahead with a concrete e-commerce example. Which strategy would you use for: product catalog, shopping cart, inventory count, price display? [Answer](QnA-Answer-Key.md#12-caching)

4. An interviewer says: "Just cache everything and set a 1-hour TTL." What can go wrong? Discuss stale data, memory pressure, cold start after restart, and the difference between TTL-based and event-based invalidation. [Answer](QnA-Answer-Key.md#12-caching)

5. You have a Redis cluster with 6 nodes. One node goes down, causing a cache stampede on 1/6 of your keys. All those requests hit the database, which crashes too. Walk through every layer of defense against this cascade. [Answer](QnA-Answer-Key.md#12-caching)

6. Explain the "dog-pile effect" (cache stampede) in detail. Compare solutions: locking, probabilistic early expiration (XFetch), request coalescing, and pre-warming. [Answer](QnA-Answer-Key.md#12-caching)

7. Your application caches the result of an expensive SQL query. The underlying data changes every 30 seconds, but the cache TTL is 5 minutes. A product manager says users see stale prices. How do you design cache invalidation that's both fresh and efficient? [Answer](QnA-Answer-Key.md#12-caching)

8. Compare Memcached vs Redis for a caching layer. When would you choose each? What features does Redis offer that Memcached doesn't, and when are those features footguns? [Answer](QnA-Answer-Key.md#12-caching)

9. You're caching at 5 different layers: browser, CDN, API gateway, application (Redis), and database query cache. A data update occurs. Walk through how staleness propagates and how you'd architect consistent invalidation across all layers. [Answer](QnA-Answer-Key.md#12-caching)

10. You need to cache 500 million key-value pairs with an average value size of 1KB. Calculate the memory needed. Would you use a single large Redis instance or a cluster? Discuss memory fragmentation, eviction policies (LRU vs LFU), and the trade-offs of Redis Cluster vs client-side sharding. [Answer](QnA-Answer-Key.md#12-caching)

---

## 📚 Further Reading

- [Scaling Memcache at Facebook (Research Paper)](http://www.cs.bu.edu/~jappavoo/jappavoo.github.com/451/papers/memcache-fb.pdf) — How Facebook scaled Memcached to billions of requests.
- [Caching Strategies and How to Choose the Right One — CodeAhoy](https://codeahoy.com/2017/08/11/caching-strategies-and-how-to-choose-the-right-one/) — Practical guide to cache-aside, write-through, and write-behind.
- [Redis Best Practices (YouTube — Tech Dummies)](https://www.youtube.com/watch?v=jgpVdJB2sKQ) — Common Redis pitfalls and how to avoid them in production.
