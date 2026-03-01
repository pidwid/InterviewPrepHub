# Rate Limiting

## Table of Contents

1. [Overview](#1-overview)
2. [Why Rate Limit?](#2-why-rate-limit)
3. [Rate Limiting Algorithms](#3-rate-limiting-algorithms)
4. [Distributed Rate Limiting](#4-distributed-rate-limiting)
5. [Rate Limiting Strategies](#5-rate-limiting-strategies)
6. [Client-Side Handling](#6-client-side-handling)
7. [Implementation Examples](#7-implementation-examples)
8. [Key Takeaways](#8-key-takeaways)

---

## 1. Overview

Rate limiting controls how many requests a client can make to an API within
a given time window. It protects services from abuse, ensures fair usage,
and prevents cascading failures.

```
Without rate limiting:             With rate limiting:
                                   
Client ──► 10,000 req/sec ──► API  Client ──► 10,000 req/sec ──► Rate Limiter ──► API
                     │                                    │              │
                     ▼                                    ▼              │
                API crashes                          9,900 rejected     100 req/sec
                                                    (429 Too Many)      (healthy)
```

---

## 2. Why Rate Limit?

| Reason                  | Description                                              |
|-------------------------|----------------------------------------------------------|
| Prevent abuse           | Stop malicious users or bots from overwhelming the system|
| Ensure fair usage       | No single user consumes all resources                    |
| Cost control            | Limit expensive operations (API calls to third-parties)  |
| Prevent cascading failure| Protect downstream services from traffic spikes         |
| DDoS mitigation         | First line of defense against denial-of-service         |
| Revenue (tiers)         | Free: 100 req/min, Pro: 1000 req/min, Enterprise: 10000 |

---

## 3. Rate Limiting Algorithms

### 3.1 Fixed Window Counter

Divide time into fixed windows and count requests per window.

```
Window: 60 seconds, Limit: 10 requests

  0:00          1:00          2:00
    |───────────--|───────────--|
    |  count = 7  |  count = 0  |
    |  (< 10, OK) |  (reset)    |
    
Problem — Boundary Burst:
  0:50  0:59  1:00  1:10
    |─────|─────|─────|
    | 10  |     | 10  |
    requests    requests
    
  20 requests in 20 seconds! Exceeds the intended rate.
```

**Pros**: Simple, O(1) memory per key.
**Cons**: Burst at window boundaries, allows 2x rate briefly.

### 3.2 Sliding Window Log

Store the timestamp of every request. Count timestamps within the window.

```
Window: 60 seconds, Limit: 10 requests
Current time: T = 120

Log: [65, 70, 75, 80, 85, 90, 95, 100, 105, 110]

Count timestamps > (120 - 60) = 60:
  All 10 timestamps are > 60 → count = 10 → REJECT next request

New request at T=121:
  Remove timestamps ≤ 61 → remove nothing
  Count = 10 → REJECT
  
At T=126:
  Remove timestamps ≤ 66 → remove [65]
  Count = 9 → ALLOW
```

**Pros**: Accurate, no boundary burst problem.
**Cons**: Memory-intensive (stores every timestamp), O(n) cleanup.

### 3.3 Sliding Window Counter

Approximation that combines fixed window counts with a weighted average.

```
Window: 60 seconds, Limit: 10 requests
Previous window count: 8
Current window count: 3
Current position in window: 25% (15 seconds into 60-second window)

Weighted count = 8 × (1 - 0.25) + 3 = 6 + 3 = 9
9 < 10 → ALLOW

If weighted count ≥ 10 → REJECT
```

**Pros**: Low memory (2 counters per key), reasonable accuracy.
**Cons**: Approximation (not exact).

### 3.4 Token Bucket

Tokens accumulate at a fixed rate. Each request costs one token.
Allows controlled bursts up to bucket capacity.

```
Bucket capacity: 10 tokens
Refill rate: 1 token/second

Time  Tokens  Action
0     10      Request → 9 tokens (allow)
0     9       Request → 8 tokens (allow)
0     8       Burst of 8 → 0 tokens (allow all)
0     0       Request → REJECT (empty bucket)
1     1       1 token refilled → Request → 0 tokens (allow)
2     1       1 token refilled
10    10      Bucket full (capped at capacity)

             ┌────────────────┐
             │  Token Bucket  │
  Refill ───►│  ○ ○ ○ ○ ○ ○  │───► Request (consume token)
  (1/sec)    │  capacity: 10  │
             └────────────────┘
             If empty → 429
```

**Pros**: Allows controlled bursts, smooth rate limiting.
**Cons**: Slightly more complex to implement.
**Used by**: AWS API Gateway, Stripe, many production systems.

### 3.5 Leaky Bucket

Requests enter a queue processed at a fixed rate. Queue overflow → reject.

```
             ┌────────────────┐
  Request ──►│    Queue       │──► Process at fixed rate (1/sec)
             │  [R5][R4][R3]  │
             │  capacity: 5   │
             └────────────────┘
             If full → 429

Unlike token bucket:
  Token bucket allows bursts.
  Leaky bucket smooths traffic to a constant rate.
```

**Pros**: Smooth, predictable output rate.
**Cons**: Bursts are queued, not served quickly. Higher latency during spikes.

### Algorithm Comparison

| Algorithm              | Burst   | Accuracy | Memory    | Complexity |
|------------------------|---------|----------|-----------|------------|
| Fixed Window           | Allows  | Low      | O(1)      | Simple     |
| Sliding Window Log     | Prevents| High     | O(n)      | Moderate   |
| Sliding Window Counter | Limits  | Medium   | O(1)      | Simple     |
| Token Bucket           | Allows  | High     | O(1)      | Moderate   |
| Leaky Bucket           | Prevents| High     | O(queue)  | Moderate   |

---

## 4. Distributed Rate Limiting

With multiple API servers, rate limits must be enforced centrally.

### Architecture

```
Without central store:              With central store:

Server A: user_123 = 50 req        Server A ──► Redis ── user_123 = 100 req
Server B: user_123 = 50 req             ▲         │
                                    Server B ──┘
Total: 100 but each thinks 50!                Total: 100 (accurate!)
```

### Redis-Based Implementation

```python
import redis
import time

r = redis.Redis()

def is_rate_limited(user_id, limit=100, window=60):
    """Fixed window counter using Redis."""
    window_key = int(time.time()) // window
    key = f"rate:{user_id}:{window_key}"
    
    # Atomic increment + TTL
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    count, _ = pipe.execute()
    
    return count > limit

def is_rate_limited_token_bucket(user_id, capacity=10, refill_rate=1):
    """Token bucket using Redis + Lua for atomicity."""
    lua_script = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    
    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now
    
    -- Refill tokens
    local elapsed = now - last_refill
    tokens = math.min(capacity, tokens + elapsed * refill_rate)
    
    if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, capacity / refill_rate * 2)
        return 1  -- allowed
    else
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, capacity / refill_rate * 2)
        return 0  -- rejected
    end
    """
    result = r.eval(lua_script, 1, f"bucket:{user_id}", capacity, refill_rate, time.time())
    return result == 0  # True if rate limited
```

### Race Conditions

Without atomicity, concurrent requests can bypass rate limits:

```
Thread A: GET count → 99       Thread B: GET count → 99
Thread A: count < 100 → allow  Thread B: count < 100 → allow
Thread A: SET count = 100      Thread B: SET count = 100

Both allowed! Should have rejected Thread B.

Solution: Use atomic operations
  - Redis INCR (atomic)
  - Lua scripts (atomic across multiple operations)
  - Redis MULTI/EXEC (transaction)
```

---

## 5. Rate Limiting Strategies

### By Key

| Strategy          | Key                        | Use Case                        |
|-------------------|----------------------------|---------------------------------|
| Per user          | `rate:user_123`            | Limit individual users          |
| Per API key       | `rate:apikey_abc`          | Limit per API consumer          |
| Per IP            | `rate:ip_1.2.3.4`         | Limit anonymous traffic         |
| Per endpoint      | `rate:user_123:/api/search`| Different limits per endpoint   |
| Per tenant        | `rate:tenant_acme`         | Multi-tenant SaaS               |
| Global            | `rate:global`              | Overall system protection       |

### Tiered Rate Limits

```
Free tier:
  100 requests/minute
  1,000 requests/day

Pro tier:
  1,000 requests/minute
  100,000 requests/day

Enterprise tier:
  10,000 requests/minute
  Unlimited daily
  Dedicated rate limit
```

### Different Limits per Endpoint

```
Endpoint              Limit               Reason
GET  /api/users       100 req/min         Read, inexpensive
POST /api/users       10 req/min          Write, moderate
POST /api/search      20 req/min          Expensive query
POST /api/login       5 req/min           Brute force protection
POST /api/payments    2 req/sec           Critical, fraud prevention
```

---

## 6. Client-Side Handling

### Rate Limit Response Headers

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000060
Retry-After: 30

Body:
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "retry_after": 30
  }
}
```

### Exponential Backoff with Jitter

```python
import time
import random

def request_with_retry(url, max_retries=5):
    for attempt in range(max_retries):
        response = http.get(url)
        
        if response.status_code == 429:
            # Exponential backoff: 1s, 2s, 4s, 8s, 16s
            base_delay = 2 ** attempt
            
            # Add jitter to prevent thundering herd
            jitter = random.uniform(0, base_delay * 0.5)
            delay = base_delay + jitter
            
            # Respect Retry-After header if present
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                delay = max(delay, int(retry_after))
            
            time.sleep(delay)
            continue
        
        return response
    
    raise Exception("Max retries exceeded")
```

---

## 7. Implementation Examples

### Nginx Rate Limiting

```nginx
http {
    # Define rate limit zone: 10 requests/second per IP
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    server {
        location /api/ {
            # Allow burst of 20 with no delay for first 10
            limit_req zone=api burst=20 nodelay;
            limit_req_status 429;
            
            proxy_pass http://backend;
        }
    }
}
```

### API Gateway (AWS)

```
API Gateway throttling:
  Account-level:  10,000 requests/second
  Stage-level:    1,000 requests/second
  Method-level:   100 requests/second per user
  
  Usage plans:
    Free:       100 requests/day,     10 req/sec burst
    Pro:        10,000 requests/day,  100 req/sec burst
    Enterprise: 1,000,000 requests/day, 1000 req/sec burst
```

### Application-Level Middleware

```python
from functools import wraps
from flask import request, jsonify
import redis

r = redis.Redis()

def rate_limit(limit=100, window=60):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # Use API key, user ID, or IP as identifier
            key = request.headers.get("X-API-Key") or request.remote_addr
            rate_key = f"rate:{key}:{request.path}:{int(time.time()) // window}"
            
            count = r.incr(rate_key)
            if count == 1:
                r.expire(rate_key, window)
            
            # Set rate limit headers
            remaining = max(0, limit - count)
            headers = {
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str((int(time.time()) // window + 1) * window),
            }
            
            if count > limit:
                return jsonify({"error": "Rate limited"}), 429, headers
            
            response = f(*args, **kwargs)
            return response, 200, headers
        return wrapped
    return decorator

@app.route("/api/search")
@rate_limit(limit=20, window=60)
def search():
    # ... handle search
    pass
```

---

## 8. Key Takeaways

### Decision Guide

```
Which algorithm?
  │
  ├── Simple, acceptable accuracy → Fixed Window Counter
  │
  ├── Need burst control + smooth rate → Token Bucket (most popular)
  │
  ├── Need smooth, constant output rate → Leaky Bucket
  │
  ├── High accuracy, memory OK → Sliding Window Log
  │
  └── Good accuracy, low memory → Sliding Window Counter
```

### Golden Rules

1. **Token bucket** is the most common choice for production rate limiting.
2. **Always use Redis** (or similar) for distributed rate limiting — local counters
   don't work with multiple servers.
3. **Use Lua scripts** for atomic rate limit operations in Redis.
4. **Always return rate limit headers** so clients can self-throttle.
5. **Respect Retry-After** on the client side. Use exponential backoff + jitter.
6. **Rate limit at multiple levels**: IP, user, API key, and endpoint.
7. **Different limits for different endpoints** — login should be stricter than reads.
8. **Monitor rate limit rejections** — a spike might indicate an attack or a
   legitimate client that needs a higher limit.

---

## 🔥 Senior Interview Questions

1. You need to rate limit an API with 100,000 concurrent users across 50 application servers. A local in-memory counter won't work. Design a distributed rate limiter using Redis. Walk through the data structure, Lua script for atomicity, and failure modes (what happens if Redis goes down?). [Answer](QnA-Answer-Key.md#17-rate-limiting)

2. Compare token bucket, leaky bucket, fixed window, sliding window log, and sliding window counter algorithms. Your API needs to allow short bursts but enforce a steady average rate. Which algorithm do you pick and how do you configure it? [Answer](QnA-Answer-Key.md#17-rate-limiting)

3. An attacker creates 10,000 accounts to bypass per-user rate limits. How do you defend against this? Discuss fingerprinting, IP-based limits, behavioral analysis, and CAPTCHA integration. [Answer](QnA-Answer-Key.md#17-rate-limiting)

4. Your rate limiter returns 429 Too Many Requests, but the client doesn't back off — it retries immediately in a tight loop, making the problem worse. How do you handle abusive clients? Discuss Retry-After headers, exponential backoff enforcement, and progressive penalties. [Answer](QnA-Answer-Key.md#17-rate-limiting)

5. You have a tiered pricing model: free users get 100 req/min, paid users get 10,000, and enterprise gets unlimited. How do you implement this in a distributed system? Where do you store tier information, and how do you handle plan upgrades in real-time? [Answer](QnA-Answer-Key.md#17-rate-limiting)

6. An interviewer asks: "Should rate limiting be done at the API gateway or at each service?" Walk through the pros and cons of each approach and when you'd use both (defense in depth). [Answer](QnA-Answer-Key.md#17-rate-limiting)

7. Your rate limiter uses a fixed time window, and clients exploit the boundary — sending 100 requests at 11:59:59 and 100 more at 12:00:00. How does the sliding window counter algorithm fix this, and what's the memory/accuracy trade-off? [Answer](QnA-Answer-Key.md#17-rate-limiting)

8. You're designing a rate limiter for a webhook delivery system that sends events to customer endpoints. Different customers have different rate limit agreements. How do you implement per-customer outbound rate limiting with fair queuing? [Answer](QnA-Answer-Key.md#17-rate-limiting)

9. Your distributed rate limiter adds 2-3ms of latency per request (Redis round trip). For a low-latency trading API, this is unacceptable. How do you reduce latency? Discuss local caches, token bucket pre-fetching, and approximate counters. [Answer](QnA-Answer-Key.md#17-rate-limiting)

10. Explain rate limiting vs throttling vs load shedding vs circuit breaking. When would you use each, and how do they work together in a production system? [Answer](QnA-Answer-Key.md#17-rate-limiting)

---

## 📚 Further Reading

- [Rate Limiting Strategies and Techniques (Stripe Blog)](https://stripe.com/blog/rate-limiters) — How Stripe implements rate limiting at scale.
- [System Design: Rate Limiter (ByteByteGo, YouTube)](https://www.youtube.com/watch?v=FU4WlwfS3G0) — Visual walkthrough of rate limiter design.
- [An Alternative Approach to Rate Limiting (Figma Engineering)](https://www.figma.com/blog/an-alternative-approach-to-rate-limiting/) — Figma's creative approach to fair rate limiting.
