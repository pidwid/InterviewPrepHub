# Design a Rate Limiter

A rate limiter controls the rate of traffic a client or service can send. It prevents resource starvation from DoS attacks, reduces cost by limiting excess requests, and prevents server overload. Almost every large-scale API uses some form of rate limiting.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Is this a client-side or server-side rate limiter?
**Interviewer:** Server-side API rate limiter.

**Candidate:** Does it throttle based on IP, user ID, or other properties?
**Interviewer:** It should be flexible — support different throttle rules.

**Candidate:** What is the scale of the system?
**Interviewer:** It must handle a large number of requests.

**Candidate:** Will it work in a distributed environment?
**Interviewer:** Yes, across multiple servers.

**Candidate:** Is it a separate service or built into application code?
**Interviewer:** That is a design decision up to you.

**Candidate:** Do we need to inform throttled users?
**Interviewer:** Yes.

### Functional Requirements

- Accurately limit excessive requests based on configurable rules
- Support multiple throttling rules (per user, per IP, per API endpoint)
- Return clear error responses (HTTP 429) when throttled
- Configurable via rules (not hardcoded)

### Non-Functional Requirements

- **Low latency** — Must not slow down HTTP response time
- **Memory efficient** — Use as little memory as possible
- **Distributed** — Shared across multiple servers/processes
- **High fault tolerance** — Rate limiter failure should not bring down the entire system
- **Exception handling** — Clear feedback to throttled users

### Back-of-the-Envelope Estimation

- Assume 10 million users, each making 10 requests/minute at peak
- ~1.67 million requests/second
- If we store a counter per user: 10M × 8 bytes (userId) + 4 bytes (counter) + 8 bytes (timestamp) = ~200 MB → fits in memory

---

## Step 2 — High-Level Design

### Where to Put the Rate Limiter?

| Option | Pros | Cons |
|--------|------|------|
| **Client-side** | Reduces server load | Easily bypassed; you don't control client code |
| **Server-side** (in app code) | Full algorithm control | Tight coupling; harder to update |
| **Middleware / API Gateway** | Decoupled; managed service available | Less control over algorithm |

**Recommendation:** Use a rate limiter **middleware** (or API Gateway) that sits between clients and API servers. Cloud providers (AWS API Gateway, Kong, Envoy) offer built-in rate limiting.

```
Client ──▶ Rate Limiter Middleware ──▶ API Servers
              │
              ▼
          Redis (counters)
```

### Rate Limiting Algorithms

#### 1. Token Bucket

- A bucket holds tokens (max = bucket size)
- Tokens are added at a fixed refill rate
- Each request consumes one token
- If no tokens → request rejected

```
Bucket: [●●●●] capacity=4, refill=2/sec
Request arrives:
  tokens > 0 → consume token, allow request
  tokens = 0 → reject (429)
```

**Pros:** Simple, memory efficient, allows bursts
**Cons:** Two parameters to tune (bucket size, refill rate)

**Used by:** Amazon, Stripe

#### 2. Leaking Bucket

- Requests enter a FIFO queue
- Processed at a fixed rate
- Queue full → request dropped

**Pros:** Smooth, stable output rate
**Cons:** Bursts fill queue with old requests; new requests get dropped

**Used by:** Shopify

#### 3. Fixed Window Counter

- Divide time into fixed windows (e.g., 1-second windows)
- Counter per window; reset at window boundary
- Counter ≥ threshold → reject

**Pros:** Simple, memory efficient
**Cons:** Burst at window edges → up to 2× allowed traffic

#### 4. Sliding Window Log

- Store timestamp of every request in a sorted set
- On new request: remove timestamps older than window; count remaining
- Count ≥ threshold → reject

**Pros:** Very accurate
**Cons:** High memory (stores every timestamp)

#### 5. Sliding Window Counter (Recommended)

- Hybrid of fixed window + sliding window
- Formula: `requests in current window + requests in previous window × overlap %`

```
Window size: 1 min, Limit: 7 req/min
Previous window: 5 requests
Current window: 3 requests
Current position: 30% into current window

Estimated count = 3 + 5 × 0.7 = 6.5 → round down to 6 → allow
```

**Pros:** Memory efficient, smooths spikes, accurate enough (99.997% per Cloudflare)
**Cons:** Approximation (assumes even distribution in previous window)

### Algorithm Comparison

| Algorithm | Memory | Accuracy | Burst Handling |
|-----------|--------|----------|---------------|
| Token Bucket | Low | Good | Allows controlled bursts |
| Leaking Bucket | Low | Good | No bursts (smooth output) |
| Fixed Window | Low | Approximate | Edge burst problem |
| Sliding Window Log | High | Exact | No burst issue |
| Sliding Window Counter | Low | ~99.997% | Smooth |

### High-Level Architecture

```
Client
  │
  ▼
Rate Limiter Middleware
  │
  ├── Fetch rules from Cache
  ├── Fetch counter from Redis
  │
  ├── Under limit?
  │     └── YES → Forward to API Servers
  │
  └── Over limit?
        └── Return HTTP 429 + Retry-After header
```

Redis is chosen for counter storage because:
- In-memory → fast
- `INCR` command → atomic counter increment
- `EXPIRE` command → automatic key expiration
- Supports distributed access

---

## Step 3 — Design Deep Dive

### Rate Limiting Rules

Rules are stored as config files (YAML) on disk, loaded by workers into cache:

```yaml
domain: auth
descriptors:
  - key: auth_type
    value: login
    rate_limit:
      unit: minute
      requests_per_unit: 5

domain: messaging
descriptors:
  - key: message_type
    value: marketing
    rate_limit:
      unit: day
      requests_per_unit: 5
```

Workers periodically pull rules from disk/config service and push to in-memory cache for fast access.

### HTTP Response Headers

When rate limited, the server returns:

```
HTTP/1.1 429 Too Many Requests
X-Ratelimit-Remaining: 0
X-Ratelimit-Limit: 100
X-Ratelimit-Retry-After: 30
```

| Header | Purpose |
|--------|---------|
| `X-Ratelimit-Remaining` | Remaining allowed requests in the window |
| `X-Ratelimit-Limit` | Max requests per window |
| `X-Ratelimit-Retry-After` | Seconds to wait before retrying |

### Handling Rate-Limited Requests

Options for what to do with rejected requests:
1. **Drop immediately** — return 429
2. **Queue for later** — enqueue to a message queue for processing when load decreases

```
Rate Limiter
  │
  ├── Under limit → forward to API servers
  └── Over limit
        ├── Option 1: Return 429 (drop)
        └── Option 2: Enqueue → Message Queue → Process later
```

### Detailed Architecture

```
Rules (config files)
      │
   Workers (pull periodically)
      │
      ▼
   Rules Cache
      │
Client ──▶ Rate Limiter Middleware
              │
              ├── Load rules from cache
              ├── Get counter from Redis
              │
              ├── Under limit → API Servers
              │
              └── Over limit → 429 or Message Queue
```

### Distributed Rate Limiting: Race Conditions

**Problem:** With multiple rate limiter instances, concurrent reads/writes to Redis create race conditions.

```
Thread 1: read counter = 3
Thread 2: read counter = 3
Thread 1: counter < 5, increment → write 4
Thread 2: counter < 5, increment → write 4
Result: counter = 4 (should be 5!)
```

**Solutions:**

| Solution | How | Trade-off |
|----------|-----|-----------|
| **Lua script** | Atomic read-check-increment in Redis | Best option; no extra round trips |
| **Redis sorted sets** | Use ZADD with timestamps | More memory but accurate |
| **Optimistic locking** | WATCH/MULTI/EXEC | Retries on contention |

**Recommended:** Use a **Lua script** in Redis for atomic operations:

```lua
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0  -- rate limited
end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1  -- allowed
```

### Distributed Rate Limiting: Synchronization

**Problem:** With multiple rate limiter servers, each needs the same view of counters.

**Solution:** Use centralized Redis — all rate limiters read/write to the same Redis cluster.

```
Client 1 ──▶ Rate Limiter 1 ──┐
                                ├──▶ Redis Cluster (shared)
Client 2 ──▶ Rate Limiter 2 ──┘
```

Avoid sticky sessions (not scalable). Use centralized data store with eventual consistency.

### Performance Optimization

1. **Multi-data-center deployment**
   - Deploy rate limiters at edge locations (CDN PoPs)
   - Route traffic to closest rate limiter to reduce latency
   - Sync counters across data centers with eventual consistency

2. **Eventually consistent counters**
   - Allow slight over-limit in exchange for lower latency
   - Sync counters across regions periodically (e.g., every second)

### Monitoring

After deployment, continuously monitor:
- **Effectiveness:** Are legitimate requests being dropped? (rules too strict)
- **Algorithm fit:** Can the algorithm handle traffic spikes? (switch to token bucket for bursty traffic)
- **Dashboard metrics:** Requests allowed/rejected, top throttled users, cache hit rate

---

## Step 4 — Wrap Up

### Architecture Summary

```
Config Files ──▶ Workers ──▶ Rules Cache
                                  │
Client ──▶ LB ──▶ Rate Limiter Middleware ──▶ API Servers
                        │
                    Redis Cluster
                   (counters/keys)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placement | API Gateway / Middleware | Decoupled, reusable |
| Algorithm | Sliding window counter | Memory efficient, accurate |
| Counter storage | Redis | In-memory, atomic ops, distributed |
| Race condition | Lua scripts | Atomic read-check-increment |
| Synchronization | Centralized Redis | Single source of truth |

### Additional Talking Points

- **Hard vs soft rate limiting** — Hard: strict threshold; Soft: allow brief bursts
- **Rate limiting at different layers** — Layer 3 (IP tables), Layer 7 (application)
- **Client best practices** — Use client cache, add backoff retry logic, handle 429 gracefully
- **Rate limiting by different dimensions** — per user, per IP, per API key, per endpoint, global
- **Graceful degradation** — If Redis goes down, allow all traffic (fail open) vs reject all (fail closed)
