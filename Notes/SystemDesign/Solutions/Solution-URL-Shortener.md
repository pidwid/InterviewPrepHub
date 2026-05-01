# Design a URL Shortening Service (TinyURL)

A URL shortening service creates short aliases for long URLs. When users click the short link, they are redirected to the original URL. Services like TinyURL, bit.ly, and goo.gl handle billions of redirections daily.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What is the expected traffic volume?
**Interviewer:** 100 million URLs are generated per day.

**Candidate:** How long should the shortened URL be?
**Interviewer:** As short as possible.

**Candidate:** What characters are allowed in the short URL?
**Interviewer:** Alphanumeric characters (0-9, a-z, A-Z).

**Candidate:** Can shortened URLs be deleted or updated?
**Interviewer:** For simplicity, let's say they cannot be updated or deleted.

**Candidate:** What is the expected URL lifetime?
**Interviewer:** 10 years by default.

### Functional Requirements

- Given a URL, generate a shorter and unique alias (short link)
- When users access the short link, redirect them to the original URL
- Users can optionally pick a custom short link
- Links expire after a default time span; users can specify custom expiration

### Non-Functional Requirements

- **High availability** — The service should be always reachable
- **Low latency** — URL redirection should happen in real-time
- **Short links should not be guessable** — Cannot be predictable/sequential

### Back-of-the-Envelope Estimation

- **Write operations:** 100 million URLs/day → ~1160 writes/sec
- **Read operations:** Assuming 10:1 read-to-write ratio → 11,600 reads/sec
- **Records over 10 years:** 100M × 365 × 10 = 365 billion records
- **Storage per record:** assume average long URL = 100 bytes, short URL = 7 bytes + metadata ≈ 500 bytes
- **Total storage:** 365 billion × 500 bytes = ~182 TB

### Short URL length calculation

- Using [0-9, a-z, A-Z] = 62 characters
- 62^6 = 56.8 billion (not enough for 365 billion)
- 62^7 = 3.5 trillion ✅ (enough)
- **Use 7-character short URLs**

---

## Step 2 — High-Level Design

### API Design

```
POST /api/v1/shorten
  Request: { "longUrl": "https://...", "customAlias": "abc" (optional), "expireAt": "2027-01-01" (optional) }
  Response: { "shortUrl": "https://tinyurl.com/abc1234" }

GET /{shortUrl}
  Response: HTTP 301 redirect to the original long URL
```

**301 vs 302 redirect:**
- **301 (Permanent Redirect)** — Browser caches the redirect. Reduces server load but makes analytics harder.
- **302 (Temporary Redirect)** — Browser doesn't cache. Better for analytics (every click hits the server).
- **Typically use 302** to track click analytics.

### Database Schema

**URL Table:**

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Primary key (auto-increment) |
| shortUrl | VARCHAR(7) | Indexed, unique |
| longUrl | TEXT | The original URL |
| userId | BIGINT | Optional, who created it |
| createdAt | DATETIME | Timestamp |
| expireAt | DATETIME | Expiration time |

**Storage choice:** A relational database (MySQL/PostgreSQL) or a NoSQL store (DynamoDB, Cassandra) both work. Given the simplicity of the schema and the heavy read workload, NoSQL with good partitioning is a strong fit.

### High-Level Architecture

```
Client
  │
  ▼
Load Balancer
  │
  ├── Write Path (POST /shorten)
  │     │
  │     ▼
  │   Web Server ──▶ ID Generator ──▶ Database
  │
  └── Read Path (GET /{shortUrl})
        │
        ▼
      Web Server ──▶ Cache (Redis) ──▶ Database
        │
        ▼
      301/302 Redirect
```

---

## Step 3 — Design Deep Dive

### URL Shortening: Hash vs Counter

There are two main approaches to generating short URLs:

#### Approach 1: Hash Function

- Apply a hash function (MD5, SHA-256) to the long URL
- Take the first 7 characters of the hash (Base62 encoded)
- **Collision problem:** Two different long URLs might produce the same 7 characters
- **Resolution:** Check for collision; if found, append a predefined string and re-hash

```
longUrl → MD5 hash → Base62 encode → take first 7 chars
                                      ↓
                               Check DB for collision
                               ├── No collision → save
                               └── Collision → rehash with salt
```

**Pros:** No need for a separate ID generator
**Cons:** Collision resolution adds complexity; same long URL always produces same hash (could be a feature or bug)

#### Approach 2: Base62 Conversion (Preferred)

- Use a unique ID generator (auto-increment, Snowflake, etc.)
- Convert the ID to Base62

```
ID = 11157 (decimal)
11157 ÷ 62 = 179 remainder 59 → 'X'
179 ÷ 62 = 2 remainder 55 → 'T'
2 ÷ 62 = 0 remainder 2 → '2'
Result: "2TX" (padded to 7 characters)
```

**Pros:** No collisions guaranteed; short URLs grow with IDs
**Cons:** Predictable next URL (security concern); need a distributed unique ID generator

#### Distributed ID Generation

In a multi-server environment, we need globally unique IDs:

| Approach | Pros | Cons |
|----------|------|------|
| **Multi-master replication** (auto-increment by N) | Simple | Hard to scale; IDs not monotonic across servers |
| **UUID** | No coordination needed | 128 bits = too long; not sortable |
| **Twitter Snowflake** | Distributed, time-sortable, 64-bit | Requires clock sync |
| **Centralized ID service** (Zookeeper ranges) | Simple logic | Single point of failure |

**Recommended:** Pre-allocate ID ranges. Each web server gets a range (e.g., Server 1: 1-1M, Server 2: 1M-2M). No coordination needed during normal operation. When range is exhausted, fetch a new range from ZooKeeper/etcd.

### Read Path: Caching for Performance

Since reads are 10× more than writes, we cache aggressively:

```
GET /abc1234
  │
  ▼
Web Server
  │
  ├── Cache hit? (Redis)
  │     └── YES → return longUrl → 302 redirect
  │
  └── Cache miss?
        └── Query DB → store in cache → 302 redirect
```

- **Cache eviction:** LRU (Least Recently Used)
- **Cache size:** Top 20% of URLs handle 80% of traffic. If we have 11,600 reads/sec, caching the hot URLs significantly reduces DB load.
- **Cache memory:** 11,600 req/s × 86,400 sec × 20% × 500 bytes ≈ ~100 GB (spread across Redis cluster)

### URL Redirection Flow (Detailed)

```
1. User clicks https://tinyurl.com/abc1234
2. DNS resolves to load balancer
3. Load balancer routes to a web server
4. Web server checks Redis cache
   ├── Cache hit → return 302 + longUrl
   └── Cache miss → query DB
       ├── Found → update cache, return 302 + longUrl
       └── Not found → return 404
5. Browser follows the redirect to the original URL
```

### Handling Custom Aliases

- When user provides a custom alias, check uniqueness in DB
- Enforce length limits (e.g., max 16 characters)
- Rate-limit custom alias creation to prevent squatting

### Analytics (Optional)

Store click events in a separate analytics table/stream:

```
Click Event: { shortUrl, timestamp, userAgent, ip, referer, country }
```

Use a message queue (Kafka) to decouple click tracking from the redirect path:

```
Web Server ──▶ Kafka ──▶ Analytics Consumer ──▶ Analytics DB (ClickHouse/BigQuery)
```

### URL Expiration

- Background job runs periodically to delete expired URLs
- On read: if `expireAt < now`, return 404 and optionally lazy-delete
- Expired IDs can be recycled (but usually don't bother)

### Data Partitioning

With 365 billion records, we need to shard the database:

| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| **Hash-based** (on shortUrl) | Consistent hashing | Even distribution | Range queries difficult |
| **Range-based** (on first char) | A-M on shard 1, N-Z on shard 2 | Simple | Uneven distribution |

**Recommended:** Consistent hashing on the shortUrl. Use a ring of virtual nodes for even distribution.

### Preventing Abuse

- **Rate limiting:** Limit URL creation per user/IP (e.g., 100/day)
- **Blocklist:** Check long URLs against known malicious sites
- **CAPTCHA:** For unauthenticated users

---

## Step 4 — Wrap Up

### Architecture Summary

```
Client ──▶ DNS ──▶ Load Balancer
                       │
            ┌──────────┴──────────┐
          Write                  Read
            │                      │
        Web Server            Web Server
            │                      │
     ID Generator              Redis Cache
            │                   │       │
            ▼                  hit    miss
       Database ◀──────────────┘       │
       (sharded)◀──────────────────────┘
            │
    Analytics Kafka ──▶ ClickHouse
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ID generation | Pre-allocated ranges | No coordination, fast, no collisions |
| Short URL length | 7 characters (Base62) | 3.5 trillion unique URLs |
| Redirect type | 302 | Enables analytics |
| Cache | Redis cluster, LRU | 10:1 read-write ratio |
| Database | Cassandra/DynamoDB | High write throughput, partition-friendly |
| Partitioning | Consistent hashing | Even distribution |

### Additional Talking Points

- **Rate limiting** on the creation endpoint
- **Purging expired links** — lazy deletion on read + batch job
- **High availability** — multi-region deployment with data replication
- **Telemetry & monitoring** — track creation rate, redirect latency, cache hit ratio
- **Compliance** — GDPR: ability to delete URLs and their analytics on request

---

## 🔬 Operational Depth — Real-World Numbers & Trade-offs

This section grounds the design in publicly-documented numbers and decisions from large-scale URL shortener operators. Most of these come from interview-prep references and Bitly's own engineering blog.

### Capacity Math (referenced in industry write-ups)

A common interview-prep target is **100M new URLs/month and a 100:1 read/write ratio**, which yields:
- **~40 writes/sec** (100M ÷ 30 d ÷ 86 400 s)
- **~8 000 reads/sec** sustained, with bursty 100× spikes during viral events
- **~3 TB raw storage over 5 years** (assuming ~500 B per record incl. analytics metadata)
- **~70 GB working set** under an 80/20 cache rule

These numbers track with what mid-to-large URL shorteners report; Bitly itself has publicly described **processing on the order of 10 billion clicks per month**, with redirect events flowing through Kafka-based pipelines.

### Storage Choice: Why Bitly Moved Off MySQL

Bitly's engineering team has documented their migration **off a single MySQL primary toward a distributed key-value store**. The driver was operational, not theoretical:
- A monotonically-growing primary key plus the analytics write pattern produced **row-locking contention** on hot links — a viral URL could effectively freeze the database.
- **Sharded MySQL with custom routing** added cross-shard query and schema-migration complexity that smaller teams couldn't absorb.
- The mapping table is a textbook **key-value workload**: lookup by short code, no JOINs, no range queries on URL text.

This is why almost every modern interview answer recommends **Cassandra or DynamoDB** here:
- Linear horizontal scale by adding nodes
- Configurable replication across AZs (`RF=3` is the typical default)
- **Hashed partitioning by short code** distributes load evenly — no hot partition unless one URL itself is hot (a separate problem solved at the cache layer)
- Eventual consistency is acceptable: a URL mapping is **immutable after creation**, so stale reads simply don't exist as a concept

### Cassandra Schema (concrete)

```cql
CREATE TABLE urls (
  short_code text PRIMARY KEY,        -- partition key, hashed
  long_url   text,
  created_at timestamp,
  creator_id text,
  expires_at timestamp,
  flags      int                      -- bitfield: deleted/banned/private
) WITH compaction = {'class': 'LeveledCompactionStrategy'};
```

**Why this layout:**
- **Single-row PK lookup** is Cassandra's strongest case (~1 ms p50)
- **Leveled compaction** keeps read amplification low for a read-heavy workload
- No secondary index on `long_url` — dedup (if needed) goes through a **separate** `long_url → short_code` table or a **Bloom filter**

For analytics, store events in a separate column family or — much more common at scale — **stream them through Kafka** to ClickHouse/Druid for OLAP queries. **Don't write analytics counters synchronously into Cassandra during the redirect path**; row-locking and write-amplification will degrade redirects under viral load.

### Why 302 (Found) and Not 301 (Moved Permanently)

A frequently-tested detail. Both work for redirection, but:
- **301 Moved Permanently** is cached by browsers and intermediate proxies — sometimes for the lifetime of the browser cache. The redirect service **never sees the second hit**, so analytics counts and operational visibility are lost.
- **302 Found** (or **307 Temporary Redirect**) tells the browser "ask again next time," preserving every redirect for analytics.

Bitly serves **302** for exactly this reason. The cost is negligible bandwidth; the gain is per-click telemetry.

### Code-Generation Strategy: KGS Beats Hashing at Scale

The interview default of "MD5 the long URL and take 7 chars" works at small scale but breaks operationally:
- **Collision handling** requires a DB read on every create (latency + cost)
- **Same long URL → same short code** is sometimes desired (dedup), sometimes not (per-user analytics)

The **Key Generation Service (KGS)** pattern is what most production systems use:
1. A background service pre-generates batches of unique 7-char Base62 codes into a `keys_unused` table
2. App servers atomically claim a batch (e.g., 1 000 codes) into local memory
3. Hand them out per shortening request — **zero collision checks at request time**
4. KGS replenishes the pool when usage crosses a watermark

Pros: O(1) creation latency, no collisions ever, easy to shard the KGS itself.  
Cons: Pre-generation wastes a few codes if servers crash (acceptable — Base62 with 7 chars yields 62⁷ ≈ **3.5 trillion** keys).

### Cache Strategy: Two Layers

The redirect path is the hot path; cache aggressively:

| Layer | Tech | Hit-rate target | Purpose |
|---|---|---|---|
| **Edge / CDN** | Cloudflare, Fastly | 60-80% for popular links | Absorbs traffic spikes (Super Bowl, viral tweets) |
| **App-tier cache** | Redis cluster, LRU eviction | >95% on origin hits | Sub-ms lookups; survives CDN cache misses |

Use **read-through caching with TTL** (24h is typical): on cache miss, load from Cassandra, populate cache. Eviction tied to memory pressure, not freshness — mappings rarely change. **Consider negative caching** (cache 404s for ~1 min) to absorb scanner traffic looking for valid codes.

### The Analytics Pipeline: Decouple via Kafka

Bitly's published architecture uses **Kafka as the spine** for click events. The flow:

1. Redirect handler writes to Cassandra (mapping lookup) and **publishes a click event to Kafka** before responding with the 302
2. Stream processors (Spark / Flink / custom Go consumers) aggregate per-link, per-geo, per-time
3. Aggregates land in an OLAP store (ClickHouse, Druid) for the dashboard
4. Raw events optionally land in S3 for reprocessing

This decoupling is why a viral link can hammer the redirect path at millions of req/min without touching the analytics store directly. Synchronous writes to MySQL during redirects is the **classic anti-pattern** that scaling-stage URL shorteners run into and rip out.

### Latency SLOs Worth Knowing

A useful rule of thumb for senior interviews:
- **Redirect p50: <10 ms** (cache hit + 302 response)
- **Redirect p99: <100 ms** (cold-cache lookup)
- **Create p50: <50 ms** (KGS allocation + Cassandra write)
- **Availability target: 99.99%** for redirects (52 min/year), **99.9%** for create (8.76 h/year — reasonable since create is a less-critical path)

> **Sources for this section.** Bitly's engineering blog (architecture & Kafka pipeline references), Hello Interview "Design a URL Shortener Like Bitly" breakdown, Designgurus / SystemDesignSchool / GeeksForGeeks URL-shortener guides. Specific numbers (3 TB / 70 GB / 8K rps) are illustrative interview targets — not Bitly internal figures, which are not publicly disclosed beyond the **~10B clicks/month** figure.
