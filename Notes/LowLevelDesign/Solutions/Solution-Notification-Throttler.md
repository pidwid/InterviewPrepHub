# Design a Notification Throttler (LLD)

> A service that decides — *before* a push/email/SMS is sent — whether to send it, suppress it, or defer it. Solves the problem of users being spammed when many events happen quickly (10 likes in 30 seconds → one digest, not ten pushes).
> Tests rate-limiter algorithms, sliding-window state design, deduplication patterns, and user-centric trade-offs (latency vs. annoyance).

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Problem Vocabulary](#2-problem-vocabulary)
3. [Architecture](#3-architecture)
4. [Throttling Algorithms](#4-throttling-algorithms)
5. [Deduplication](#5-deduplication)
6. [Aggregation / Digesting](#6-aggregation--digesting)
7. [Storage Schema](#7-storage-schema)
8. [Per-Channel and Per-Type Policies](#8-per-channel-and-per-type-policies)
9. [Quiet Hours and DND](#9-quiet-hours-and-dnd)
10. [Operational Concerns](#10-operational-concerns)
11. [Common Follow-ups](#11-common-follow-up-questions)
12. [Sources](#12-sources)

---

## 1. Requirements

### Functional
- Accept a notification request `(user_id, type, channel, payload, key?)` and decide:
  - **Send now** — passes all caps and dedup checks
  - **Suppress** — duplicate of a recently-sent notification
  - **Defer** — would exceed a rate cap; queue for later
  - **Drop** — TTL expired or hard-cap exceeded
- Per-user, per-channel, per-type rate caps (configurable)
- Aggregate similar notifications into a single digest after a window
- Honor quiet hours / Do-Not-Disturb (DND)

### Non-Functional
- **Decision latency p99 < 10ms** (sits in the hot path of every send)
- Throughput in the **millions of decisions/sec** at scale
- Eventually consistent — a slightly stale rate counter is acceptable; never silently exceed cap by 10×

### Scope
This is the **decision layer**. The actual delivery (FCM, APNs, SMTP, Twilio) is downstream and out of scope.

---

## 2. Problem Vocabulary

> "While rate limiting, throttling, and debouncing control frequency and timing, Singleton Functions ensure mutual exclusion — only one run per key executes at a time."

| Concept | What it does | When |
|---|---|---|
| **Rate limit** | Hard cap: ≤ N events per window. Excess **rejected**. | Anti-abuse (login attempts, API quotas) |
| **Throttle** | Smooth: ≤ N events per window. Excess **queued / delayed**. | External provider rate (Twilio, SES) |
| **Debounce** | Wait for activity to stop, then act once. | "User stopped typing for 2s — send draft" |
| **Dedup** | Drop duplicates with the same key within a window. | Same alert fires twice for one incident |
| **Digest / Aggregate** | Coalesce many events in a window into one summary. | "5 new likes" instead of 5 pushes |

A real notification throttler combines all five.

---

## 3. Architecture

```
                  ┌──────────────┐
producer (any) ──►│ Notification │
                  │   Service    │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐         ┌─────────────┐
                  │  Throttler   │◄───────►│   Redis     │  ← per-user counters,
                  │  (decision)  │         │  (state)    │    dedup keys, digest buckets
                  └──────┬───────┘         └─────────────┘
                         │ allow / suppress / defer
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────────┐
       │  Sender  │ │  /dev/   │ │  Defer queue │
       │ (FCM/    │ │  null    │ │ (delayed)    │
       │  APNs)   │ │ (drop)   │ └──────┬───────┘
       └──────────┘ └──────────┘        │
                                         ▼
                                   ┌──────────┐
                                   │  Sender  │ (after delay)
                                   └──────────┘
```

> Per the Medium reference design used at scale: "The throttler system ensures that notifications are throttled at the user level, limiting the number of notifications a user receives within a specific time period. The consumer in the throttler system reads all messages from the master topic for a defined throttle duration (e.g., y minutes). It stores metadata about the number of messages per user in an in-memory database like Redis."

---

## 4. Throttling Algorithms

### 4.1 Token Bucket
> "The token bucket algorithm is one of the most widely adopted approaches due to its flexibility and ability to handle controlled bursts. It models capacity as a bucket that accumulates tokens at a constant refill rate up to a maximum capacity."

```
state per (user, channel):
    tokens     : float
    capacity   : int     # max burst, e.g., 5
    refill_per_sec : float  # e.g., 0.1 = 1 every 10 sec
    last_refill_ts : float

on event:
    now = time.now()
    elapsed = now - state.last_refill_ts
    state.tokens = min(capacity, tokens + elapsed * refill_per_sec)
    state.last_refill_ts = now
    if state.tokens >= 1:
        state.tokens -= 1
        return ALLOW
    return DEFER
```

**Pros**: handles bursts naturally, low memory (one struct per key), well-understood.
**Cons**: burst+sustained semantics can be confusing for users to configure.
**Use when**: external API limits, third-party providers.

### 4.2 Sliding Window Log
Store the timestamps of recent events; count those within the window.

```
state per (user, channel):
    log : sorted set of timestamps   (Redis ZSET)

on event:
    now = time.now()
    ZREMRANGEBYSCORE log -inf (now - window)
    count = ZCARD log
    if count >= cap:
        return DEFER
    ZADD log now {unique-id}
    EXPIRE log window
    return ALLOW
```

**Pros**: precise — no edge effects.
**Cons**: O(events-in-window) memory per user; overkill for high cap counts.
**Use when**: small caps (≤ 100), strong fairness required.

### 4.3 Sliding Window Counter (Approximate)
Two counters: current window + previous window. Estimate the recent rate as a weighted blend.

```
window_size = 60s
key_curr = "rate:{user}:{floor(now/60)}"
key_prev = "rate:{user}:{floor(now/60) - 1}"
elapsed_in_curr = now % 60
weight_prev = (60 - elapsed_in_curr) / 60

count = INCR key_curr
EXPIRE key_curr 120
prev_count = GET key_prev or 0

estimated = count + prev_count * weight_prev
if estimated > cap:
    DECR key_curr   # roll back
    return DEFER
return ALLOW
```

**Pros**: O(1) memory per user, no ZSET overhead, approximation accurate within 0.003% in tests.
**Cons**: assumes uniform distribution within window.
**Use when**: production default for high-throughput per-user caps.

### 4.4 Atomic implementation in Redis (Lua)
> "Use Redis with Lua scripts for atomicity in distributed setups."

The check-and-increment **must** be a single atomic operation; otherwise two concurrent requests both see "9 < 10" and both succeed, exceeding the cap.

```lua
-- KEYS[1] = "rate:user:123"
-- ARGV[1] = cap, ARGV[2] = window_seconds
local n = redis.call("INCR", KEYS[1])
if n == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[2])
end
if n > tonumber(ARGV[1]) then
    return 0   -- DENY
end
return 1   -- ALLOW
```

This is the atomic primitive that nearly every production rate-limiter is built on.

---

## 5. Deduplication

### Goal
The same logical notification must not be delivered twice. Different from rate-limiting: dedup uses an **explicit key** chosen by the producer; rate-limit uses the (user, channel) tuple.

### Pattern: SETNX with TTL
```
fingerprint = sha256(user_id + type + payload-canonical)
SET dedup:{fingerprint} 1 NX EX 300
  → if "OK"  : new — proceed
  → if nil   : duplicate within 5 min — drop
```

### Producer-supplied key (preferred)
Let the producer pass an explicit `dedup_key`. This avoids accidental matches when payloads differ in non-meaningful ways (timestamp, counter snapshot).

```
{
  "user_id": "u_123",
  "type":    "incident_alert",
  "dedup_key": "incident:42:fired",
  "payload": { ... }
}
```

### TTL choice
- Push to apps: **5–15 min** (people pull out their phone in this window)
- Email digest: **1–6 hr**
- Critical (security alerts): **30 sec or less**, or no dedup at all

### Caveats
- Dedup key TTL too long → user genuinely missing important update
- Dedup key TTL too short → spamming
- Dedup must happen **before** rate limit increment, or you "spend" tokens on duplicates

---

## 6. Aggregation / Digesting

When **many events** occur quickly, the right answer often isn't suppression but **summarization**.

### Pattern: time-window collector
```
on event(user, type, item_id):
    bucket_key = "agg:{user}:{type}:{floor(now / 60)}"
    SADD bucket_key item_id
    EXPIRE bucket_key 120
    
    -- If first item in this bucket, schedule the digest
    if SCARD == 1:
        publish to delayed-queue at (now + 60s) with key bucket_key

on digest_due(bucket_key):
    items = SMEMBERS bucket_key
    DEL bucket_key
    if len(items) == 1:
        send_normal_notification(items[0])
    else:
        send_digest_notification("You have N updates", items)
```

### Digest window choices
| Notification type | Window |
|---|---|
| Live chat | 5 sec |
| Likes on a post | 1–5 min |
| Daily activity summary | 24 hr (with quiet-hours offset) |
| Marketing campaign | configurable per-campaign |

### Smart suppression rules
- If a digest already exists for this user+type, append; don't fire a new one
- If the user opens the app, **immediately deliver** all pending digests (event-driven flush)

---

## 7. Storage Schema

### Hot path (Redis)
```
rate:{user_id}:{type}:{channel}:{minute}      # sliding-window counter
dedup:{fingerprint}                            # SETNX-based dedup
agg:{user_id}:{type}:{minute}                  # SET of item ids for digest
defer:{user_id}                                # ZSET of (timestamp, payload) defer queue
```

### Configuration store (PostgreSQL or KV)
```sql
CREATE TABLE notification_policies (
  type        TEXT,           -- "like", "follow", "incident_alert"
  channel     TEXT,           -- "push", "email", "sms"
  cap         INT,            -- e.g., 5
  window_sec  INT,            -- e.g., 3600
  algorithm   TEXT,           -- "token_bucket" | "sliding_window"
  digest_window_sec INT,      -- 0 = no digest
  dedup_window_sec  INT,      -- 0 = no dedup
  priority    INT             -- 0=critical, 5=marketing
);

CREATE TABLE user_preferences (
  user_id     UUID,
  type        TEXT,
  channel     TEXT,
  enabled     BOOL,
  quiet_hours TSRANGE
);
```

### Audit log (durable)
Every decision (allow/suppress/defer/drop) appended to a Kafka topic for analysis. Lets product look at "why did Alice only get 1 of 10 pushes?"

---

## 8. Per-Channel and Per-Type Policies

> "Channel-level throttle limits are not applied [for transactional campaigns]."

Real systems must distinguish:

| Class | Rate-limit? | Dedup? | Quiet-hours? |
|---|---|---|---|
| **Critical / Security** ("Your password was changed") | No | No | No |
| **Transactional** ("Your order shipped") | Loose (per channel) | Yes | No |
| **Behavioral** ("Alice liked your post") | Strict per-user | Yes (digest) | Yes |
| **Marketing** ("New feature!") | Strictest per-user-per-day | Yes | Yes |
| **System / Operational** (PagerDuty alert) | Per-incident, not per-user | Yes (incident-key) | No (override) |

The **policy is the product feature** — engineering provides the levers, product configures them.

---

## 9. Quiet Hours and DND

### Pattern: defer to next allowed window
```
on event(user, type, channel):
    if is_critical(type): bypass DND
    
    user_tz   = user.timezone
    local_now = now_in_tz(user_tz)
    if user.quiet_hours.contains(local_now):
        defer_until = next_allowed(user.quiet_hours, local_now)
        ZADD defer:{user_id} defer_until payload
        return DEFERRED
    
    proceed_with_throttle_check(...)
```

### Failure mode
> "By limiting the number of messages sent per minute, a few users will receive the message a few hours after the campaign is triggered/launched. This raises the risk of engaging users during odd hours, such as when users may be asleep."

Set a **TTL on deferred messages** (`queueing_duration`). If the defer queue fires it after the relevant moment passed, drop with a "DND Queue Drop" reason — don't wake the user up at 3 AM with stale info.

---

## 10. Operational Concerns

### Capacity planning
- N users × M types × K channels × 2 (curr+prev) windows = redis keys at peak
- Token-bucket state: ~50 bytes/user × 10 types × 3 channels = 1.5KB/user. 100M users = 150GB Redis. Shard accordingly.

### Hot keys
Per-user counter — no hot-key problem.
Per-incident dedup key for system alerts — can be very hot. Use the sharded-counter pattern for high-volume incidents.

### Observability
- **Decisions/sec** by outcome (allow / suppress / defer / drop)
- **Suppression rate by type** — sudden change indicates upstream bug or policy misconfiguration
- **Digest fan-in** distribution — average events per digest
- **Defer queue depth** — growing unbounded means you're throttling tighter than incoming rate
- **Cap-exceeded errors** (via the audit log) — should never happen if limiter is correct

### Failure modes
| Failure | Behavior |
|---|---|
| Redis unavailable | Fail-open (allow everything) for non-critical, fail-closed for marketing |
| Lua script timeout | Treat as failure; log and decide per fail-mode policy |
| Defer queue worker down | Backlog grows; alerts at >10× normal depth |
| Clock skew between throttler nodes | Sliding-window counter slightly off; bound by NTP precision (~1ms) |

### Backpressure
If the downstream sender (FCM/SES) starts returning 429, the throttler must adapt — increase `defer` rate, push back on producers via a circuit breaker. Without this the defer queue becomes a black hole.

---

## 11. Common Follow-up Questions

**Q: How do you handle multi-device push (one user, three devices)?**
- Throttling key includes `device_id` for true per-device fairness, but caps still applied per-user (sum across devices). Avoid spamming Alice's tablet just because her phone is off.

**Q: A user reports "I'm getting too many notifications." How do you investigate?**
- Pull from audit log: every decision keyed by user_id. Reconstruct the timeline. Common causes: missing dedup_key from producer; type-level cap too high; digest window misconfigured.

**Q: How would you A/B test notification frequency?**
- Policy lookup is keyed by `(user_id, type)`. Inject experiment variant into the policy resolution: experiment service returns variant; policy table has rows per variant. All decisions logged with variant tag for analysis.

**Q: What about cross-service ordering — a `welcome_email` should send before a `tutorial_email`?**
- Throttler is order-agnostic. Order is the producer's responsibility — use a workflow engine (Temporal, Step Functions) to sequence. Throttler is a layer below.

**Q: How would you prevent a buggy producer from bypassing throttling by passing different keys for the same content?**
- Server-side fingerprinting alongside producer keys. A `dedup_key` is a hint; the system also computes `fingerprint = sha256(user + type + canonicalized-payload)`. If producer's key changes but fingerprint matches → log and apply hidden dedup (still send, but flag for follow-up).

**Q: Real-time vs. batch — when should the throttler be inline vs. async?**
- Inline (synchronous) for: alerting, transactional, security. The producer waits ≤ 10 ms for a decision.
- Async (over Kafka) for: marketing, social-graph events. Producer fires-and-forgets; throttler processes from topic. Adds latency but decouples.

**Q: Singleton mode — when do you use it?**
- "Live dashboards that need latest data; real-time sync operations; deduplication of rapid user actions." Cancel-on-newer-event pattern. E.g., user types "search:bar" then "search:bart" — cancel the first request entirely.

---

## 12. Sources

- **Inngest blog — "Differences Between Rate Limiting, Debouncing, and Throttling"** — definitions used in §2; "Singleton Function" cancel/skip modes from §11
- **Medium (Abhishek Raviprasad) — "User Notification Throttling System with Confluent Kafka"** — Kafka-based architecture pattern in §3
- **dev.to — "Rate Limiting and Throttling in System Design"** — Lua atomicity recommendation, sliding-window-counter approximation accuracy
- **enjoyalgorithms — "Throttling and Rate Limiting"** — sliding-window timing semantics in §4.2
- **WebEngage docs — "Throttling (Message Rate-Limiting)"** — transactional bypass pattern in §8; DND queue-drop reason in §9
- **OneUptime — "Configure Alert Throttling"** — Alertmanager `repeat_interval` / `group_interval` patterns informing §8 priority table
- **Designgurus — "Designing a Notification System"** — graceful degradation, dedup with at-least-once delivery
