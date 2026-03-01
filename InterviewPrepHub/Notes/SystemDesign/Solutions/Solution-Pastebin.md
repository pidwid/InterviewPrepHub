# Design Pastebin

Pastebin is a web service where users can store and share plain text. Users paste text, get a unique URL, and anyone with the URL can view the content. Similar services include GitHub Gist, Hastebin, and Ghostbin. The system must handle high read traffic with relatively fewer writes.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Is this a basic text-paste service, or does it support syntax highlighting, expiration, etc.?  
**Interviewer:** Support plain text with optional expiration. Syntax highlighting is nice-to-have but not core.

**Candidate:** What is the maximum paste size?  
**Interviewer:** 10 MB.

**Candidate:** Do we need user accounts?  
**Interviewer:** Optional — support both anonymous and registered pastes.

**Candidate:** What's the expected traffic?  
**Interviewer:** 5 million new pastes/day, 5:1 read-to-write ratio.

**Candidate:** How long should pastes be retained?  
**Interviewer:** Default 10 years. Users can set custom expiration (10 min, 1 hour, 1 day, 1 month, never).

### Functional Requirements

- Users can create a paste (text content) and receive a unique URL
- Users can retrieve a paste by its unique URL
- Pastes can have a custom or default expiration time
- Optional: user accounts, edit, delete

### Non-Functional Requirements

- High availability (reads)
- Low latency for read operations (< 200 ms)
- Paste URLs should not be guessable (security)
- System should be highly reliable — pastes should not be lost

### Back-of-the-Envelope Estimation

- **Writes:** 5M pastes/day ≈ 58 pastes/sec
- **Reads:** 25M/day ≈ 290 reads/sec (5:1 ratio)
- **Storage:** Average paste = 10 KB; 5M × 10 KB = 50 GB/day → 18 TB/year → 180 TB in 10 years
- **Bandwidth:**
  - Write: 58 × 10 KB = 580 KB/s
  - Read: 290 × 10 KB = 2.9 MB/s

---

## Step 2 — High-Level Design

### API Design

```
POST /api/v1/paste
  Body: {
    "content": "print('hello world')",
    "expiration": "1d",          // optional: 10m, 1h, 1d, 1M, never
    "title": "My Python Script"  // optional
  }
  Response: {
    "pasteId": "abc12345",
    "url": "https://pastebin.com/abc12345",
    "expiresAt": "2024-01-21T00:00:00Z"
  }

GET /api/v1/paste/{pasteId}
  Response: {
    "pasteId": "abc12345",
    "content": "print('hello world')",
    "title": "My Python Script",
    "createdAt": "2024-01-20T10:00:00Z",
    "expiresAt": "2024-01-21T00:00:00Z"
  }

DELETE /api/v1/paste/{pasteId}
  Headers: Authorization: Bearer {token}
  Response: 204 No Content
```

### Unique Key Generation

The paste URL key (e.g., `abc12345`) is the most critical design element.

**Option A — Hash-based:**
- MD5(content + timestamp) → take first 8 characters (Base62)
- Collision risk: 62⁸ = 218 trillion combinations → negligible for our scale

**Option B — Pre-generated Key Service (KGS):**
- Pre-generate random 8-character Base62 keys and store in a database
- KGS hands out keys on demand
- Two tables: `unused_keys` and `used_keys`
- Eliminates collision entirely

**Option C — Auto-increment + Base62 encode:**
- Use distributed counter (e.g., Snowflake) → Base62 encode the ID
- Simple but IDs are sequential (guessable)

**Chosen: KGS** — guarantees uniqueness, fast (pre-computed), no collisions.

### High-Level Architecture

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────▶│  API Server  │────▶│  Metadata DB │
│          │     │  (Stateless) │     │  (MySQL)     │
└──────────┘     └──────┬───────┘     └──────────────┘
                        │
                   ┌────┴────┐
                   ▼         ▼
             Object Store   KGS
             (S3)          (Key Gen)
```

### Why Object Storage for Content?

- Paste content can be up to 10 MB — too large for a typical DB column
- S3/Blob storage is optimized for this: cheap, durable (11 nines), scales infinitely
- Metadata DB stores: pasteId, title, userId, createdAt, expiresAt, s3Key
- Object store stores: actual text content keyed by pasteId

---

## Step 3 — Design Deep Dive

### Write Path (Detailed)

```
1. Client sends POST /paste with content
2. API server requests a unique key from KGS
   - KGS picks from unused_keys table, moves to used_keys
   - KGS keeps a batch in memory for speed (e.g., 1000 keys at a time)
3. API server uploads content to S3:
   - Key: pastes/{pasteId}
   - Content-Type: text/plain
4. API server writes metadata to MySQL:
   - INSERT INTO pastes(paste_id, title, user_id, s3_key, created_at, expires_at)
5. Return unique URL to client
```

### Read Path (Detailed)

```
1. Client requests GET /paste/abc12345
2. API server checks cache (Redis):
   - Cache hit → return content from cache
   - Cache miss → continue
3. API server queries metadata from MySQL
   - Check if paste exists and not expired
   - If expired → return 404 (or 410 Gone)
4. API server fetches content from S3
5. Store in Redis cache (TTL = min(paste_expiration, 24 hours))
6. Return to client
```

### Key Generation Service (KGS) Deep Dive

```
┌─────────────┐     ┌──────────────────────────┐
│   KGS       │     │  Keys DB                 │
│  Server(s)  │────▶│  unused_keys: 100M rows  │
│             │     │  used_keys: growing       │
└─────────────┘     └──────────────────────────┘

Workflow:
1. Pre-generate 100M unique 8-char Base62 keys offline
2. Store in unused_keys table
3. KGS loads a batch (e.g., 1000) into memory
4. On request: pop from in-memory batch
5. When batch depleted: load next batch → mark as used in DB
6. If KGS crashes: at most 1000 keys lost (acceptable)
```

**Concurrency handling:**
- Multiple KGS instances each load exclusive batches (SELECT ... FOR UPDATE with LIMIT)
- No two servers get the same keys

**Key space math:**
- 62⁸ = ~218 trillion possible keys
- At 5M keys/day: lasts 119,000+ years → no concern

### Caching Strategy

```
Redis Cache:
  Key: paste:{pasteId}
  Value: { content, title, createdAt, expiresAt }
  TTL: min(paste_expiry, 24 hours)

Cache Eviction: LRU
Cache Size: Top 20% of pastes (hot data)
  - 80/20 rule: 20% of pastes get 80% of reads
  - 5M × 0.2 × 10 KB = 10 GB/day → manageable
```

### Expiration & Cleanup

Pastes expire based on user-set or default expiration:

```
Approach 1: Lazy Deletion
  - On read, check if expires_at < now()
  - If expired → return 404, mark for deletion
  - Pro: no background job needed
  - Con: expired data sits in storage until accessed

Approach 2: Active Cleanup (Background Job)
  - Cron job runs every hour
  - Query: SELECT paste_id FROM pastes WHERE expires_at < NOW() LIMIT 10000
  - Delete from S3, then delete from MySQL, then invalidate cache
  - Pro: reclaims storage proactively
  - Con: extra system complexity

Best: Use BOTH — lazy deletion for instant UX + background cleanup for storage reclamation
```

### Database Schema

**Pastes Table (MySQL):**

| Column | Type | Notes |
|--------|------|-------|
| paste_id | CHAR(8) | Primary key (from KGS) |
| title | VARCHAR(255) | Optional |
| user_id | BIGINT | Nullable (anonymous pastes) |
| s3_key | VARCHAR(255) | S3 object key |
| content_size | INT | Bytes |
| created_at | DATETIME | Indexed |
| expires_at | DATETIME | Indexed, nullable (never expires) |
| is_private | BOOLEAN | Default false |

**Users Table (MySQL):**

| Column | Type |
|--------|------|
| user_id | BIGINT |
| username | VARCHAR(50) |
| email | VARCHAR(255) |
| api_key | CHAR(32) |
| created_at | DATETIME |

### Analytics & Rate Limiting

- Track view count per paste (Redis INCR, batch flush to DB)
- Rate limiting: 20 pastes/hour per IP for anonymous, 100/hour for registered
- Use token bucket algorithm at API gateway level

### Scaling

**Read-heavy system (5:1):**
- Multiple read replicas for MySQL
- CDN for frequently accessed pastes (optional)
- Redis cluster for caching hot pastes

**Storage scaling:**
- S3 handles storage scaling transparently
- Shard metadata DB by paste_id hash if needed

**Availability:**
- Multi-AZ deployment for API servers
- S3 cross-region replication for disaster recovery
- Redis Sentinel for cache high availability

---

## Step 4 — Wrap Up

### Architecture Summary

```
Client ──▶ CDN (cache popular pastes)
  │
  ▼
Load Balancer ──▶ API Servers (stateless, auto-scaled)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
      KGS       Redis Cache   MySQL (metadata)
   (unique       (hot pastes)  │
    keys)                   Read Replicas
                               │
                            S3 (content storage)
                               │
                         Cleanup Worker (cron)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content storage | S3 (Object Store) | Cheap, durable, scales to 180 TB+ |
| Key generation | Pre-generated KGS | No collisions, fast, simple |
| Key format | 8-char Base62 | 218T combinations, not guessable |
| Caching | Redis with LRU | Read-heavy, 20% hot data |
| Expiration | Lazy + Active cleanup | Best of both worlds |

### Additional Talking Points

- **Paste privacy** — private pastes require authentication; unlisted pastes are accessible but not indexed
- **Syntax highlighting** — store language hint in metadata; render client-side with Prism.js or highlight.js
- **Paste versioning** — store version history in S3 (enable S3 versioning)
- **Search** — if paste titles are searchable, use Elasticsearch for full-text search
- **Abuse prevention** — content scanning for malware/spam, CAPTCHA for anonymous users
- **API rate limiting** — protect against bulk paste creation attacks
