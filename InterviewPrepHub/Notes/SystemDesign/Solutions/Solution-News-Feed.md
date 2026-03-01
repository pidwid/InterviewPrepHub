# Design a News Feed System

A news feed is the constantly updating list of stories on a user's home page. It aggregates posts from friends, pages, and groups, ranked by relevance. Facebook, Twitter, Instagram, and LinkedIn all have news feed systems that serve billions of personalized feeds daily.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Is this a mobile app, web app, or both?
**Interviewer:** Both.

**Candidate:** What are the important features?
**Interviewer:** A user can publish a post and see friends' posts in their news feed, sorted by reverse chronological order.

**Candidate:** How many friends can a user have?
**Interviewer:** Up to 5,000.

**Candidate:** What is the traffic volume?
**Interviewer:** 10 million DAU.

**Candidate:** Can the feed contain images, videos, or just text?
**Interviewer:** It can contain media (images, videos), but focus on the feed generation logic.

### Functional Requirements

- Users can create posts (text, images, videos)
- Users can see a personalized news feed of friends' posts
- Feed is sorted by reverse chronological order (simplified; ranking can be added later)
- Support for pagination (infinite scroll)

### Non-Functional Requirements

- Feed generation should be fast (< 1 second)
- High availability
- A new post should appear in friends' feeds within a few seconds
- Support 10M DAU, 5K friends per user

### Back-of-the-Envelope Estimation

- 10M DAU, each user fetches feed 10 times/day → 100M feed requests/day → ~1,160 QPS (avg), ~2,300 QPS (peak)
- Each user posts 2 times/day → 20M posts/day → ~230 writes/sec
- Average post size: 1 KB → 20M × 1 KB = 20 GB/day new data
- Feed: top 500 posts per user → 500 × 1 KB = 500 KB per feed response

---

## Step 2 — High-Level Design

### Two Core Flows

The news feed system has two main flows:

1. **Feed Publishing** — User creates a post, which is stored and propagated to friends' feeds
2. **Feed Retrieval** — User requests their feed, which aggregates and returns ranked posts

### API Design

```
-- Feed Publishing --
POST /api/v1/feed
  Headers: Authorization: Bearer {token}
  Body: { "content": "Hello world", "mediaIds": ["img_123"] }
  Response: { "postId": "post_789", "createdAt": "..." }

-- Feed Retrieval --
GET /api/v1/feed?cursor={lastPostId}&limit=20
  Headers: Authorization: Bearer {token}
  Response: { "posts": [...], "nextCursor": "post_xxx" }
```

### High-Level Architecture

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐
│  Client  │────▶│ Feed Publish  │────▶│  Post DB     │
│          │     │ Service       │     │  (Write)     │
└──────────┘     └───────┬───────┘     └──────────────┘
                         │
                    Fan-out Service
                         │
                    ┌────┴────┐
                    ▼         ▼
              Feed Cache   Notification
              (per user)   Service

┌──────────┐     ┌───────────────┐     ┌──────────────┐
│  Client  │────▶│ Feed Read     │────▶│  Feed Cache  │
│          │     │ Service       │     │  (Redis)     │
└──────────┘     └───────────────┘     └──────────────┘
```

---

## Step 3 — Design Deep Dive

### Fan-out Models: Push vs Pull

This is the **most critical design decision** for a news feed system.

#### Fan-out on Write (Push Model)

When a user publishes a post, the system immediately pushes it to all friends' feed caches.

```
User A posts →
  Get A's friend list: [B, C, D, ... 5000 friends]
  For each friend:
    Append post to friend's feed cache (Redis sorted set)
```

**Pros:**
- Feed is pre-computed; retrieval is O(1) — just read from cache
- Fast feed loading for consumers

**Cons:**
- **Hotkey / Celebrity problem:** If a user has 10M followers, one post triggers 10M writes
- Wasted work for inactive users who never check their feed
- Slow write path for popular users

#### Fan-out on Read (Pull Model)

When a user loads their feed, the system fetches recent posts from all friends on the fly.

```
User B loads feed →
  Get B's friend list: [A, C, D, ...]
  For each friend:
    Fetch their recent posts
  Merge, sort by time → return top N
```

**Pros:**
- No wasted work — only computed when someone reads
- No hotkey problem on write
  
**Cons:**
- Slow feed loading (fan-out at read time)
- Heavy read path

#### Hybrid Approach (Recommended)

Use different strategies for different users:

```
Regular users (< 5K followers): Fan-out on write (push)
Celebrities (> 5K followers):   Fan-out on read (pull)
```

When generating a feed:
1. Fetch pre-computed feed entries from cache (pushed by regular friends)
2. Fetch recent posts from followed celebrities on-demand
3. Merge and rank

### Feed Publishing: Detailed Flow

```
1. Client POST /feed → Web Server → Post Service
2. Post Service:
   a. Validate content (text length, media)
   b. Store post in Posts DB
   c. Upload media to CDN (if any)
   d. Send message to Fan-out Service (via Message Queue)

3. Fan-out Service:
   a. Fetch friend list from Social Graph DB
   b. Filter: exclude user's muted/blocked friends
   c. For each eligible friend:
      - Insert (postId, timestamp) into their feed cache
      - Feed cache: Redis Sorted Set, score = timestamp
      - Trim cache to max 500 entries per user
   d. For celebrity posts: DON'T fan out (mark for pull)

4. Notification Service:
   - Send push notification to close friends (optional)
```

### Feed Retrieval: Detailed Flow

```
1. Client GET /feed → Web Server → Feed Service
2. Feed Service:
   a. Fetch pre-computed feed IDs from Redis cache
      - ZREVRANGE feed:{userId} 0 19 (top 20 posts by timestamp)
   b. For followed celebrities:
      - Fetch their recent posts from Posts DB
      - Merge with cached feed
   c. Hydrate: For each postId, fetch full post data
      - Post content, author info, likes count, comments count
      - Use batch queries or multi-get
   d. Apply ranking (if applicable)
   e. Return paginated response with cursor

3. Client renders the feed
```

### Feed Cache Structure

```
Redis Sorted Set:
  Key: feed:{userId}
  Members: postId
  Score: timestamp (for chronological ordering)

Operations:
  ZADD feed:user123 1700000000 post_abc    (add post to feed)
  ZREVRANGE feed:user123 0 19              (get top 20 posts)
  ZREMRANGEBYRANK feed:user123 0 -501      (trim to 500 entries)
```

### Database Schema

**Posts Table:**

| Column | Type | Notes |
|--------|------|-------|
| post_id | BIGINT | Primary key (Snowflake) |
| user_id | BIGINT | Author |
| content | TEXT | Post text |
| media_urls | JSON | Array of CDN URLs |
| created_at | DATETIME | Indexed |

**Friendships Table:**

| Column | Type |
|--------|------|
| user_id | BIGINT |
| friend_id | BIGINT |
| created_at | DATETIME |

Index on `user_id` for "get all friends" queries.

**Feed Cache (Redis):** As described above — sorted sets keyed by user_id.

### Post Storage: SQL vs NoSQL

| Consideration | SQL (PostgreSQL) | NoSQL (Cassandra) |
|---------------|-----------------|-------------------|
| Schema | Structured, JOIN-friendly | Flexible |
| Read pattern | Random reads by post_id | Sequential writes |
| Scale | Vertical + read replicas | Horizontal sharding |
| Recommendation | Posts + user data | Feed cache, activity logs |

**Hybrid:** Use PostgreSQL for posts/users (relational data) and Redis for feed caches.

### Ranking (Beyond Chronological)

For a production feed, posts are ranked by relevance:

```
Score = f(affinity, post_type, recency, engagement)

Where:
  affinity    = closeness to author (interaction frequency)
  post_type   = photo > status > share (engagement weights)
  recency     = time decay function
  engagement  = likes, comments, shares (social proof)
```

ML-based ranking pipeline:
```
Candidate Generation → Feature Extraction → ML Model → Re-ranking → Feed
```

This is a deep topic — mention it but don't implement in a 45-min interview.

### Scaling Considerations

**Web Tier:**
- Stateless servers behind a load balancer
- Auto-scale based on QPS

**Fan-out Service:**
- Process fan-out asynchronously via message queue (Kafka)
- Scale workers independently from web servers
- Use circuit breakers for celebrity fan-out

**Cache:**
- Redis Cluster for feed caches
- Cache size: 10M users × 500 entries × 8 bytes/entry ≈ 40 GB
- Use consistent hashing for key distribution

**Database:**
- Read replicas for Posts DB
- Shard friendships by user_id
- Archive old posts to cold storage (S3) after 1 year

---

## Step 4 — Wrap Up

### Architecture Summary

```
                    ┌─────────────┐
                    │ CDN (media) │
                    └──────▲──────┘
                           │
Client ──▶ LB ──▶ Web Servers
                    │            │
              POST /feed    GET /feed
                    │            │
              Post Service  Feed Service
                    │            │
              Posts DB      Redis Cache ◀── merge celebrity posts
                    │
              Kafka Queue
                    │
              Fan-out Workers ──▶ Redis feed:{userId}
                    │
              Notification Service ──▶ Push (APNs/FCM)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fan-out model | Hybrid (push + pull) | Push for regular users, pull for celebrities |
| Feed cache | Redis sorted sets | O(log N) insert, O(1) range query |
| Fan-out execution | Async via Kafka | Decouple from write path |
| Post storage | PostgreSQL | Relational data, ACID guarantees |
| Media storage | S3 + CDN | Cost-effective, globally distributed |

### Additional Talking Points

- **Feed invalidation** — When a post is deleted, remove from all affected feed caches (or lazy-delete on read)
- **Privacy changes** — If user unfriends someone, eventually remove posts from feed
- **Content moderation** — Filter harmful content before fan-out
- **Pagination** — Cursor-based (not offset-based) for consistency during concurrent writes
- **A/B testing** — Serve different ranking models to different users
- **Feed diversity** — Avoid showing too many posts from the same author
