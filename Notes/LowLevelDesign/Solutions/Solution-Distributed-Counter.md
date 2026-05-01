# Design a Distributed Counter (LLD)

> A counter that survives a single key being incremented millions of times per second from clients all over the world. Used for view counts, likes, ad-impressions, rate-limit buckets, billing meters, and inventory.
> Tests understanding of write contention, sharding, idempotency, and the consistency-vs-latency trade-off (CAP/PACELC).

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Why It's Hard](#2-why-its-hard)
3. [Design Spectrum](#3-design-spectrum)
4. [Approach 1: Single Atomic Key (Redis INCR)](#4-approach-1-single-atomic-key-redis-incr)
5. [Approach 2: Sharded Counter](#5-approach-2-sharded-counter)
6. [Approach 3: CRDT (PN-Counter)](#6-approach-3-crdt-pn-counter)
7. [Approach 4: Batched Local Aggregation](#7-approach-4-batched-local-aggregation)
8. [Idempotency Layer](#8-idempotency-layer)
9. [Time-Bucketed Counters](#9-time-bucketed-counters)
10. [Common Follow-ups](#10-common-follow-up-questions)
11. [Sources](#11-sources)

---

## 1. Requirements

### Functional
- `increment(key, delta)` — supports `delta = 1` or arbitrary positive/negative integers
- `get(key)` — current value
- Counters identified by string keys (e.g., `post:1234:likes`)
- Optional: time-bucketed views (per-minute / per-hour rates)

### Non-Functional
- Sustain **millions of increments per second** for a single hot key (think Super Bowl ad)
- Read latency: **single-digit ms** at the p99
- **Eventual consistency** acceptable for most use cases (likes, view counts)
- **Strong consistency** required for some (inventory, billing meter, rate-limiter quota)
- Data must survive node crashes — no silent count loss

---

## 2. Why It's Hard

A counter is a single shared variable. The classic concurrency problem at planetary scale.

### The two enemies
1. **Write contention on a single row** — every increment serializes through the row lock or the leader. NoSQL stores typically peak around hundreds of thousands of ops/sec to a single key. A viral video gets 10× that.
2. **Network partitions** — when nodes can't communicate, do you reject writes (CP) or accept and reconcile later (AP)?

### The Two Generals problem applies
Network failures make `INCR` non-idempotent: did the server apply my increment before the connection dropped? If I retry, do I double-count?

> "Repeatedly executing INCR on the same key will always increment the value, even if the same request is sent multiple times. This lack of idempotency can lead to over-counting or under-counting in certain scenarios."

---

## 3. Design Spectrum

| Approach | Single-key throughput | Consistency | Best for |
|---|---|---|---|
| **Single atomic key** (Redis INCR) | ~100k–500k ops/s | Strong (single node) | Small systems, rate-limit buckets |
| **Sharded counter** | Linear in N shards | Strong-per-shard, eventual aggregate | High-write hot keys |
| **CRDT (PN-Counter)** | Multi-DC throughput | Eventual (strong eventual consistency) | Geo-distributed, AP requirements |
| **Batched local aggregation** | Effectively unlimited | Eventual (delayed) | Analytics, view counts, ad metrics |

Real systems combine them — e.g., **batched local + sharded + persisted**.

---

## 4. Approach 1: Single Atomic Key (Redis INCR)

### How it works
> "Redis processes commands in a single-threaded event loop, ensuring that each command is executed in the order it's received." `INCR` is atomic by virtue of the single-threaded server.

```
client → INCR post:1234:likes  →  Redis (single instance)
                                      │
                                      ▼
                                  in-memory atomic int64
```

### Pros
- Simple, single network round trip
- Truly atomic — no race conditions
- Sub-millisecond latency

### Cons
- **Single-key throughput cap** — bounded by one core, network IO of one machine, and persistence overhead
- **No durability without `appendfsync always`** — and that destroys throughput
- **Replication is async** — a primary failure can lose the most recent N increments

### When to choose it
- Counter throughput < ~100k/s
- Eventual durability is acceptable (with AOF + RDB snapshots, lag ≤ 1 sec)
- E.g., per-user rate-limit token buckets, queue depth metrics

### Persistence pattern
- **Write-behind to RDBMS** — Redis serves the live counter; an async worker periodically `GET` and writes to Postgres. RDBMS is the source of truth for analytics; Redis is the source of truth for "now".

---

## 5. Approach 2: Sharded Counter

### Idea
One logical counter = sum of N physical counters. Increments are distributed; reads sum.

```
post:1234:likes              =     post:1234:likes:0
                                 + post:1234:likes:1
                                 + ...
                                 + post:1234:likes:N-1
```

### Code skeleton
```python
class ShardedCounter:
    def __init__(self, redis, key, num_shards=16):
        self.redis = redis
        self.shards = [f"{key}:{i}" for i in range(num_shards)]
    
    def increment(self):
        # Pick a shard at random — spreads contention uniformly
        shard = random.choice(self.shards)
        return self.redis.incr(shard)
    
    def get(self):
        # Sum across all shards in one MGET
        values = self.redis.mget(self.shards)
        return sum(int(v or 0) for v in values)
    
    def reset(self):
        # Atomic across shards via Lua
        return self.redis.eval("""
            local total = 0
            for i, key in ipairs(KEYS) do
                local v = redis.call('GETSET', key, 0)
                if v then total = total + tonumber(v) end
            end
            return total
        """, len(self.shards), *self.shards)
```

### Trade-offs
| Property | Single-key | Sharded (N=16) |
|---|---|---|
| Write throughput | 1× | ~16× |
| Read cost | 1 op | N ops (or aggregated approximation) |
| Hot-key risk | High | Mitigated proportional to N |
| Result accuracy | Exact | Exact (when all shards reachable) |

### Approximate read (for very high N)
Sample K random shards, extrapolate: `sample_total × N / K`. Trades accuracy for read latency.

### Choosing N
- Match to expected concurrent writers per logical counter
- Doubling N halves contention; diminishing returns past N = (peak write rate / single-key cap)
- Common values: 10, 16, 32, 64

### Sharding pitfall
> "If clustering is used, counter keys should be kept on a single shard to maintain atomicity."

If you use **Redis Cluster** with Lua scripts, all keys touched by one script must hash to the same slot — use `{tag}` syntax: `post:{1234}:likes:0`. The `{1234}` ensures all shards live on the same node.

---

## 6. Approach 3: CRDT (PN-Counter)

### Idea
A **Conflict-free Replicated Data Type** lets every node accept writes locally, and merging always converges to the same correct value — no coordination needed.

> "A CRDT allows multiple copies of a dataset to exist across various nodes in a network, and these copies can be updated independently and concurrently. The key feature of CRDTs is the ability to merge divergent copies in a way that ensures the final state is uniformly consistent across all nodes, without requiring coordination or locking."

### G-Counter (grow-only)
Each replica maintains its own slot:
```
node_A:  5
node_B:  3
node_C:  7
total = max-merge across replicas, then sum = 15
```
Increment: `node.slot += delta` locally.
Merge two replicas: `for each node_id: result[id] = max(a[id], b[id])`.
Read: `sum(slot.values())`.

The `max` ensures **idempotent merges** — receiving the same gossip twice is harmless.

### PN-Counter (positive-negative)
Two G-Counters: one for increments, one for decrements. `value = sum(P) - sum(N)`. Supports both `+1` and `-1`.

### Real-world deployments
> "The NoSQL distributed databases Redis, Riak and Cosmos DB have CRDT data types. League of Legends uses the Riak CRDT implementation for its in-game chat system, which handles 7.5 million concurrent users and 11,000 messages per second."

> "Redis Enterprise natively supports CRDTs via Active-Active geo-distribution."

### When to choose it
- Multi-region active-active deployment
- Cannot afford cross-region writes blocking on a single leader
- Eventual convergence is acceptable (typically < 1 sec across regions)

### Operational notes
- Writes never block on cross-region replication — local is local
- Reads return *local* state; cross-region propagation lag is the convergence window
- Storage cost: O(N) per counter where N = number of replicas

---

## 7. Approach 4: Batched Local Aggregation

### Idea
Aggregate increments **in-process** at every app server, flush periodically to a durable store.

```
                 1000 requests/sec → app server 1 → +1000 every 5s → Kafka → Aggregator → DB
                 1500 requests/sec → app server 2 → +1500 every 5s ┘
                 800  requests/sec → app server 3 → +800  every 5s ┘
                 ...
                                                    backend handles ~3 increments/sec instead of 3300
```

### Pros
- **Effectively unlimited write throughput** — backend sees only N `IncrBy(K)` per flush interval where N = number of app servers
- App server crash loses at most one flush interval of data
- Combined with sharded keys → handles any volume

### Cons
- **Eventual consistency window = flush interval** (typically 1–10 sec)
- App server is a stateful component now (memory only, but accumulates)
- A long GC pause delays the count

### Pipeline pattern
```
app server (in-memory map)  →  Kafka (durable buffer)  →  Stream processor  →  Counter store
       │                              │                         │                    │
       │  flush every 5s              │ partitioned by counter  │ aggregates by key  │ atomic INCRBY
       │                              │                         │
       └─ at-least-once delivery; ────┘                         └─ exactly-once via offsets + idempotent INCRBY
```

This is the standard pattern at Twitter, LinkedIn, and Facebook for like counts and view counts.

---

## 8. Idempotency Layer

For correctness under client retries, the counter API must accept an **idempotency key** per increment:

```
POST /counters/post:1234:likes/increment
  Headers: Idempotency-Key: <uuid>
  Body: { delta: 1 }
```

### Storage
```
SET seen:{idempotency-key} 1 NX EX 86400
  → if "OK"  : new request, apply increment
  → if null  : already applied, return cached prior value
```

The `NX EX 86400` is atomic in Redis: set-if-not-exists with 24-hour TTL. The TTL bounds storage growth.

### Cost
One extra round-trip per increment. For high-throughput counters, can co-locate idempotency table with the counter shard.

### When to skip
For non-critical analytics counters (page views, impressions), idempotency may be skipped — duplicate counts within a tolerance are acceptable.

---

## 9. Time-Bucketed Counters

For "likes per minute over the last 24h" or "ad impressions in the last hour":

### Pattern (Redis hash per granularity)
```
HINCRBY count:post:1234:5sec   <bucket-timestamp> 1   # 5-second buckets
HINCRBY count:post:1234:1min   <bucket-timestamp> 1   # 1-minute buckets
HINCRBY count:post:1234:1hour  <bucket-timestamp> 1   # 1-hour buckets
```

Each granularity is its own hash; flush to one of them rounds the timestamp to that bucket.

### Cleanup
A periodic janitor scans a `ZSET` of "known counter keys" and `HDEL` buckets older than the retention window. Retention varies by granularity (e.g., keep 5-sec buckets for 1 hour, 1-hour buckets for 30 days).

This is the standard approach published in the Redis canonical examples for time-series counters.

### Alternatives
- **Redis Streams** — append-only log of increments; aggregate at read time
- **TimescaleDB** / **InfluxDB** — purpose-built TSDB; better long-term storage, slower writes
- **ClickHouse** — columnar; great for high-cardinality queries on bucketed counts

---

## 10. Common Follow-up Questions

**Q: How would you build a global "Like" button at Facebook scale?**
- Edge: per-app-server in-memory aggregation (5-sec flush)
- Transport: Kafka, partitioned by post_id (so all increments for one post land on one consumer)
- Store: sharded counter in Redis (N=64 per post for hot posts)
- Persistence: write-behind to Cassandra every 30 sec for durability
- Read: serve from Redis; fall back to Cassandra on miss
- Cross-region: each region has its own counter; a daily job reconciles to a global value

**Q: What about decrement (unlike)?**
- Use `INCRBY -1` on a single key; or use a PN-Counter (separate +/− buckets); or use 2 sharded counters (positive + negative) and subtract on read

**Q: How would you implement strict bound enforcement (e.g., "max 100 likes per second per user")?**
- Token bucket — `INCR` followed by `EXPIRE` on first increment. The check + increment must be atomic — use a Lua script:
```lua
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if c > tonumber(ARGV[2]) then return -1 end
return c
```

**Q: What if we need exact monotonic counts despite network failures?**
- Two-phase: client allocates a unique `seq` per increment, server stores the seq in a set, applies only if not already present. Trade write throughput for exact correctness.

**Q: What's the lower bound on counter latency for a global system?**
- Fundamentally limited by **speed of light**. London ↔ Sydney ≈ 130 ms one-way over fiber. So a strongly-consistent global counter cannot have p99 < 260 ms cross-region. CRDTs sidestep by accepting eventual consistency, paying with reads-may-lag.

**Q: How would you debug a count that "looks wrong"?**
- Sharded counter? Check each shard individually for stale shards (an offline replica missed gossip)
- Idempotency table? Check key collisions, TTL premature expiry
- Batched aggregation? Check Kafka lag and consumer-group offsets — a stuck consumer means missing counts
- Multi-region CRDT? Check replication lag between sites; convergence may simply be in progress

---

## 11. Sources

- **systemdesign.one — "Distributed Counter System Design"** — sharding patterns, Redis active-active CRDT details, drawbacks of native data types under network failure
- **Wikipedia — Conflict-free Replicated Data Type** — formal definition (Shapiro et al., 2011); production users (Riak, Redis, Cosmos DB, Facebook Apollo); League of Legends scale numbers
- **Wikipedia — CRDT, Counter section** — G-Counter, PN-Counter merge semantics
- **Synadia blog — "Distributed Counters in NATS JetStream"** — addition/subtraction commutativity → CRDT-safe; per-region edge counter pattern
- **OneUptime — "How to Build Distributed Counters with Redis"** — sharded counter implementation, sampled approximate reads, atomic Lua reset
- **OneUptime — "How to Implement CRDTs with Redis"** — G-Counter slot pattern
- **haveyoutriedrestarting.com — "Building Atomic Counters with Elasticache Redis"** — Redis single-thread atomicity, cluster-slot constraint for Lua
- **Redis canonical examples (storing counters)** — multi-precision time-bucketed counter pattern in §9
