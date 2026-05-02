# Design Twitter Timeline & Search

Twitter (now X) is a social media platform where users post short messages (tweets), follow other users, and view a personalized timeline. The system handles real-time tweet ingestion, fan-out to followers, timeline generation, and full-text search across billions of tweets.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we designing the entire Twitter platform or specific features?  
**Interviewer:** Focus on two features: (1) home timeline generation and (2) tweet search.

**Candidate:** What's on the home timeline?  
**Interviewer:** Tweets from people the user follows, in reverse chronological order.

**Candidate:** Do we need to support trends, hashtags, or notifications?  
**Interviewer:** Mention them but focus on timeline and search.

**Candidate:** What are the scale numbers?  
**Interviewer:** 300M monthly active users, 600 tweets/sec average, 600K search queries/sec.

### Functional Requirements

- Users can post tweets (140/280 characters + optional media)
- Users can follow/unfollow other users
- Home timeline: aggregated feed of tweets from followed users
- Search: full-text search across recent tweets (last 7 days)

### Non-Functional Requirements

- Timeline should load in < 500 ms
- Search results in < 1 second
- High availability (99.99%)
- Tweets should appear in followers' timelines within 5 seconds
- Handle celebrity accounts (100M+ followers) gracefully

### Back-of-the-Envelope Estimation

- 300M MAU, ~150M DAU
- Average user follows 200 people
- 600 tweets/sec × 86400 sec = ~50M tweets/day
- Average tweet: 300 bytes (text + metadata) → 15 GB/day new tweet data
- Timeline reads: 150M users × 5 timeline loads/day = 750M/day ≈ 8,700 QPS
- Search: 600K QPS peak

---

## Step 2 — High-Level Design

### Two Subsystems

```
┌─────────────────────────────────────────────┐
│                 Twitter                      │
│                                              │
│   ┌──────────────┐    ┌──────────────────┐  │
│   │   Timeline   │    │   Search         │  │
│   │   System     │    │   System         │  │
│   └──────────────┘    └──────────────────┘  │
│          ▲                     ▲              │
│          │                     │              │
│   ┌──────┴──────┐    ┌───────┴───────┐      │
│   │ Tweet Store │    │ Search Index  │      │
│   │ + Fan-out   │    │ (Inverted)    │      │
│   └─────────────┘    └───────────────┘      │
└─────────────────────────────────────────────┘
```

### API Design

```
-- Post a tweet --
POST /api/v1/tweets
  Body: { "text": "Hello Twitter!", "mediaIds": [] }
  Response: { "tweetId": "1234567890", "createdAt": "..." }

-- Get home timeline --
GET /api/v1/timeline?cursor={tweetId}&count=20
  Response: { "tweets": [...], "nextCursor": "..." }

-- Search tweets --
GET /api/v1/search?q=system+design&count=20&cursor={offset}
  Response: { "tweets": [...], "nextCursor": "..." }

-- Follow a user --
POST /api/v1/users/{userId}/follow
  Response: 200 OK
```

### High-Level Architecture

```
                    ┌─────────┐
                    │  Client │
                    └────┬────┘
                         │
                    Load Balancer
                    ┌────┴────┐
              ┌─────┤ API GW  ├──────┐
              │     └─────────┘      │
         ┌────▼────┐          ┌──────▼──────┐
         │ Tweet   │          │  Timeline   │
         │ Service │          │  Service    │
         └────┬────┘          └──────┬──────┘
              │                      │
    ┌─────────┼──────────┐    ┌──────▼──────┐
    ▼         ▼          ▼    │ Timeline    │
  Tweet DB  Media CDN  Kafka  │ Cache       │
              │          │    │ (Redis)     │
              │     Fan-out   └─────────────┘
              │     Service
              │         │
              │    Social Graph DB
              │
         ┌────▼────┐
         │ Search  │
         │ Index   │
         │(Lucene) │
         └─────────┘
```

---

## Step 3 — Design Deep Dive

### Part A: Timeline System

#### Fan-out Strategy (Same Hybrid as News Feed)

The timeline problem is fundamentally the same as the news feed problem, but at Twitter's scale, the celebrity problem is more severe.

```
Regular users (< 5K followers):
  → Fan-out on WRITE (push model)
  → When they tweet, append to all followers' timelines in Redis

Celebrities (> 5K followers, e.g., @BarackObama with 130M followers):
  → Fan-out on READ (pull model)
  → Their tweets are NOT pushed
  → When a follower loads timeline, fetch celebrity tweets on-demand
```

#### Timeline Generation Flow

```
User loads timeline:
1. Fetch pre-computed timeline entries from Redis
   - ZREVRANGE timeline:{userId} 0 19
   - These are postIds from pushed (regular user) tweets

2. Get list of followed celebrities
   - Query social graph: SELECT followee_id FROM follows
                          WHERE follower_id = ? AND is_celebrity = true

3. For each celebrity, fetch their recent tweets
   - Multi-GET from Tweet cache/DB
   - Filter to last 24-48 hours

4. Merge pushed timeline + pulled celebrity tweets
   - Sort by timestamp (or ranking score)
   - Take top N

5. Hydrate tweet objects (author info, media URLs, engagement counts)

6. Return paginated response
```

#### Timeline Cache Structure

```
Redis Sorted Set per user:
  Key:    timeline:{userId}
  Member: tweetId
  Score:  timestamp

Size per user: 800 entries × 8 bytes ≈ 6.4 KB
Total: 150M DAU × 6.4 KB = ~960 GB → Redis Cluster (sharded)
```

#### Social Graph Storage

```
┌──────────────────────────────────┐
│ Follows Table (Adjacency List)   │
│──────────────────────────────────│
│ follower_id  │ followee_id      │
│ user_123     │ user_456         │
│ user_123     │ celeb_789        │
└──────────────────────────────────┘

Index: (follower_id) for "who do I follow?"
Index: (followee_id) for "who follows me?" (fan-out)

Storage: Redis or graph DB for hot path
         MySQL/Cassandra for persistence
```

### Part B: Search System

#### Search Architecture

Twitter search indexes ~500M tweets/day and serves 600K QPS. This requires a distributed search engine.

```
┌──────────┐     ┌──────────────┐     ┌──────────────────────┐
│  Client  │────▶│ Search API   │────▶│  Search Cluster       │
│          │     │ Server       │     │  (Distributed Lucene) │
└──────────┘     └──────────────┘     │                       │
                                      │  ┌─────┐ ┌─────┐     │
   Tweet ──▶ Kafka ──▶ Indexer ──────▶│  │Shard│ │Shard│ ... │
                                      │  │  1  │ │  2  │     │
                                      │  └─────┘ └─────┘     │
                                      └───────────────────────┘
```

#### Inverted Index

The core of search is an **inverted index** — mapping from words to tweet IDs:

```
Word         → Tweet IDs (sorted by timestamp desc)
─────────────────────────────────────
"system"     → [tweet_999, tweet_987, tweet_954, ...]
"design"     → [tweet_999, tweet_960, tweet_942, ...]
"interview"  → [tweet_995, tweet_960, tweet_920, ...]

Query: "system design"
  → Intersect posting lists for "system" AND "design"
  → Result: [tweet_999, tweet_960, ...]
```

#### Index Sharding

With billions of tweets, the index must be sharded:

```
Strategy 1: Shard by Time
  - Shard 1: Jan 1-7, Shard 2: Jan 8-14, ...
  - Pro: Old shards become read-only, easy to archive
  - Con: Recent shards get all the write traffic

Strategy 2: Shard by Tweet ID (hash)
  - Distribute tweets across shards using hash(tweetId) % N
  - Pro: Even write distribution
  - Con: Every search must query ALL shards (scatter-gather)

Chosen: Time-based sharding (Twitter's actual approach)
  - Only search last 7 days (7-14 shards active)
  - Each shard fits in memory for fast queries
  - Old shards archived to cheaper storage
```

#### Search Query Flow

```
1. Client sends: GET /search?q=system+design
2. Search API parses query → tokenize, stem, remove stop words
3. Fan out query to all active shards (scatter)
4. Each shard:
   a. Look up each token in inverted index
   b. Intersect posting lists
   c. Rank results (relevance + recency + engagement)
   d. Return top K results
5. Search API merges results from all shards (gather)
6. Re-rank, deduplicate
7. Hydrate tweet objects
8. Return to client
```

#### Search Ranking

```
Score = α × relevance + β × recency + γ × engagement + δ × user_authority

Where:
  relevance     = TF-IDF or BM25 score
  recency       = exponential decay from tweet timestamp
  engagement    = log(likes + 2×retweets + 3×replies)
  user_authority = follower count, verified status
```

#### Near Real-Time Indexing

```
Tweet created → Kafka topic "tweets"
  → Search Indexer consumer group
  → Tokenize tweet text
  → Update inverted index in the appropriate time shard
  → Latency: tweet searchable within 10-30 seconds
```

### Database Schema

**Tweets Table (Sharded by tweet_id):**

| Column | Type | Notes |
|--------|------|-------|
| tweet_id | BIGINT | Snowflake ID (encodes timestamp) |
| user_id | BIGINT | Author |
| text | VARCHAR(280) | Tweet content |
| media_urls | JSON | Optional |
| reply_to | BIGINT | Nullable |
| retweet_of | BIGINT | Nullable |
| created_at | DATETIME | Indexed |

**Engagement Counters (Redis):**

```
tweet:{tweetId}:likes    → counter
tweet:{tweetId}:retweets → counter
tweet:{tweetId}:replies  → counter
```

### Scaling Considerations

| Component | Strategy |
|-----------|----------|
| Tweet writes (600/sec) | Kafka for async processing, MySQL sharded by user_id |
| Timeline reads (8.7K QPS) | Redis cluster, CDN for popular content |
| Search reads (600K QPS) | Distributed Lucene shards, in-memory indices |
| Fan-out (celebrity tweet → 100M followers) | Skip push for celebrities, pull on read |
| Storage growth (15 GB/day tweets) | Time-based partitioning, archive old data |

---

## Step 4 — Wrap Up

### Architecture Summary

```
                ┌────────────┐
                │   Client   │
                └─────┬──────┘
                      │
                 Load Balancer
                ┌─────┴──────┐
          ┌─────┤   API GW   ├──────┐
          │     └────────────┘      │
    ┌─────▼─────┐           ┌──────▼──────┐
    │  Tweet    │           │  Timeline   │
    │  Service  │           │  Service    │
    └─────┬─────┘           └──────┬──────┘
          │                        │
    ┌─────▼─────┐           ┌──────▼──────┐
    │  Tweet DB │           │ Redis Cache │
    │  (MySQL)  │           │ (Timeline)  │
    └─────┬─────┘           └─────────────┘
          │
    ┌─────▼──────┐     ┌──────────────┐
    │   Kafka    │────▶│  Fan-out     │──▶ Redis timelines
    │            │     │  Service     │
    │            │────▶│  Search      │──▶ Lucene Shards
    │            │     │  Indexer     │
    └────────────┘     └──────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Timeline model | Hybrid push/pull | Push for regular users, pull for celebrities |
| Timeline cache | Redis sorted sets | Sub-millisecond reads, sorted by time |
| Search engine | Distributed Lucene | Time-sharded, in-memory for speed |
| Index sharding | Time-based | Natural for recency-biased search |
| Tweet ID | Snowflake | Encodes timestamp, globally unique, sortable |
| Async processing | Kafka | Decouple tweet ingestion from fan-out and indexing |

### Additional Talking Points

- **Trends detection** — Count hashtag frequency in sliding windows (Apache Storm / Flink)
- **Spam detection** — ML classifier on tweet content, account age, posting frequency
- **Retweet/Quote tweet** — Store as separate tweet with pointer to original
- **Thread support** — Linked list of tweet IDs via `reply_to` field
- **Geo-search** — Geospatial index for "tweets near me" (R-tree or geohash)
- **Real-time streaming** — WebSocket/SSE for live timeline updates
- **Content moderation** — Async pipeline: tweet → ML classifier → human review queue

---

## 🔬 Operational Depth — Real Twitter Numbers & Decisions

This section is grounded in publicly-disclosed details from Yao Yue's "Scaling Redis at Twitter" talk, the Twitter Engineering blog, and follow-up analyses by High Scalability and Stackbit.

### The Public Numbers

From Twitter Engineering presentations and analyses:
- Twitter cache fleet was sized at the order of **105 TB of RAM across ~10,000 Redis instances** at peak (per the Yao Yue / High Scalability writeup)
- Reported throughput for the timeline cache reached **~39 million QPS**
- The service handled roughly **6,000 tweets/sec on average** with **~600,000 timeline reads/sec**, giving a **~1000:1 read-to-write ratio**
- Each user's home timeline cache holds **~800 tweet IDs** (a product decision; users rarely scroll farther)

These numbers anchor every architectural choice that follows.

### Why Fanout-on-Write Won (For Most Accounts)

Twitter's read:write ratio is so skewed that **paying ~5,000 small writes per tweet** to make every read O(1) is a clear win. Specifically:
- Reads are millions per second, latency-sensitive (homepage load), uncached → catastrophic
- Writes are thousands per second, latency-insensitive (post-tweet ack), can be async
- Once the timeline is materialized in Redis, a home-timeline read is a **single ZREVRANGE** on a sorted set — sub-millisecond

Fanout-on-write is the **default** for accounts under a follower threshold (commonly cited around **10,000 followers**, though Twitter has not published a single canonical number).

### Why Pure Fanout-on-Write Breaks: The Celebrity Problem

A user with **30M followers** posting one tweet generates **30M Redis writes**. This is "the celebrity problem":
- Workers can't keep up — fanout lag stretches into hours
- Memory pressure: many small timelines get evicted to make room for one celebrity's tweet propagating across millions of timeline ziplists (per Yao Yue's talk, ziplist resizing under memory pressure is the dominant source of write-latency variability)
- Cascading failure: if the fanout queue backs up, every user's tweet is delayed — not just the celebrity's

### The Hybrid Solution (What Twitter Actually Does)

The production approach combines both strategies based on a **per-account policy**:

| Account type | Strategy | Why |
|---|---|---|
| Regular (< ~10K followers) | **Fanout-on-write** | Cheap writes; O(1) reads dominate the workload |
| High-volume (>~10K followers) | **No fanout; pull at read** | Avoids the write storm; their tweets are fetched per-request and merged into the reader's timeline |

On read, the Timeline Service:
1. Fetches the precomputed sorted set from Redis (regular followees)
2. Identifies the user's celebrity followees (small list)
3. Fetches each celebrity's recent tweets from a **per-celebrity cache** (one cache entry serves millions of readers)
4. Merge-sorts by timestamp and returns the top N

This adds a few ms to read latency but caps the fanout cost at the threshold. **One cache entry per celebrity vs. one timeline write per follower** is the central trade.

### Two Other Optimizations Worth Naming

**1. Active-user fanout filtering.** Twitter only fans tweets out to **users who logged in within the last 30 days** (sometimes called "active users"). Inactive users get their timeline computed lazily on next login. This typically removes 80–90% of the write load.

**2. Hybrid List in Redis (Twitter's custom data structure).** Stock Redis stores lists as either ziplists (compact but slow at scale) or linked lists (fast but memory-heavy). Twitter built a **Hybrid List** — a linked list of bounded ziplists — to get the memory efficiency of ziplists with predictable resize behavior. This was part of Twitter's forked, internal Redis (later succeeded by **Pelikan**, their open-source cache server in C/Rust).

### The Tweet ID Choice: Snowflake

Tweet IDs use Twitter's **Snowflake** scheme: `[timestamp][datacenter][machine][sequence]`. Two consequences:
- **Sortable by ID** is equivalent to **sorted by time** — no separate `ORDER BY created_at` needed
- **No central counter** means tweet creation is fully horizontal-scale; each Snowflake worker is independent
- IDs fit in 64 bits, which is what Redis sorted-set members and most cache layers want anyway

### Storage Layout

| Data | Storage | Why |
|---|---|---|
| Tweets (durable) | Sharded MySQL (T-bird, originally via Gizzard) | Durability for the tweet text itself |
| User profiles | Gizmoduck service backed by MySQL | Profile reads cached aggressively at edge |
| Social graph (follows) | Flock service over MySQL (originally) | Bidirectional adjacency lists; sharded by user_id |
| Home timeline cache | Redis sorted sets, 3× replicated, ~800 IDs/user | The hot read path |
| Tweet detail cache | Memcached | Memcached is great at small-object GET, no fanout structure needed |

The split between **Memcached for tweet bodies** and **Redis for timelines** is intentional — different access patterns deserve different tools. (Recent migration efforts toward **Pelikan** target both.)

### The Read Pipeline Step-By-Step

When you open the Twitter app:

```
1. Timeline Service receives GET /home_timeline
2. ZREVRANGE timeline:{user_id} 0 19   ── Redis, ~1 ms
3. For each tweet_id, fetch tweet body  ── Memcached batch GET, ~1 ms
4. For each author, fetch user profile  ── Gizmoduck, often cached
5. Apply read-time filters:
     - Drop tweets from blocked/muted users
     - Hide @-replies to people you don't follow
     - Apply localization
6. Merge in recent celebrity tweets (if any followees are celebrities)
7. Optional: re-rank with ML (post-2016 algorithmic timeline)
8. Return JSON
```

The **read-time filters** (block, mute, reply visibility) are applied at read because the user can change preferences without invalidating millions of timeline entries.

### What Could Bite You In an Interview

- **"Why not just always fanout-on-read?"** — Doesn't survive the read:write skew. Computing 600K reads/sec from cold storage means scanning every followee's recent tweets, joining, and sorting on every page load. Math doesn't work.
- **"What's the consistency model?"** — Eventual. A reply may arrive in some users' timelines before the original tweet ("headless tweet" effect, especially when celebrities are involved). Twitter accepts this; it's a documented trade.
- **"How do you handle a follower deletion (unfollow)?"** — Don't try to scrub the cache. Apply a **read-time filter** that drops tweets whose author no longer in the follow set. The sorted-set entry naturally falls off the 800-tweet cap soon.
- **"What about the new user with zero history?"** — Cold-start path: pull from `tweets WHERE author_id IN (followees) ORDER BY id DESC LIMIT 800`, populate the Redis cache, and serve. A nightly job populates inactive users on demand.

> **Sources for this section.** "How Twitter Uses Redis to Scale - 105TB RAM, 39MM QPS, 10,000+ Instances" (High Scalability summary of Yao Yue's QCon talk, 2014); Stackbit's "How would you build Twitter today" series; SystemDesignHandbook and TechInterview's Twitter breakdowns; "How Twitter caches timelines" (algonote, 2023). Specific thresholds (~10K-follower split) and active-user windows (30 days) are commonly cited in these analyses but Twitter itself has not published a single canonical number.

---

## Sources / Cross-Refs
- Yao Yue (Twitter) — *How Twitter Uses Redis to Scale - 105TB RAM, 39MM QPS, 10,000+ Instances* (QCon 2014, summarized on High Scalability): http://highscalability.com/blog/2014/9/8/how-twitter-uses-redis-to-scale-105tb-ram-39mm-qps-10000-ins.html
- Twitter Engineering — *Timelines at Scale* (multiple posts at blog.twitter.com / engineering).
- Raffi Krikorian — *Timelines at Scale* (QCon 2013 talk, archived).
- *Designing Data-Intensive Applications* (Kleppmann, 2017), Ch. 1 — Twitter is the canonical fan-out-on-write vs read example.
- 12-Caching.md, 13-Asynchronism.md, 45-Read-Heavy-vs-Write-Heavy.md (this repo).
- Solution-News-Feed.md, Solution-Instagram.md (sister feed designs).
