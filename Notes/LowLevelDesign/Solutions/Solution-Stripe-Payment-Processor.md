# Design a Stripe-style Payment Processor (LLD)

> Models the API surface and internal state machine of a payment-processing service: charging cards, handling retries, idempotency keys, and webhooks.
> Common at fintechs, marketplaces, and subscription companies. Tests transactional reasoning, distributed-system reliability, and the consequences of "exactly-once" being mathematically impossible.

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Core Domain Model](#2-core-domain-model)
3. [Idempotency: The Heart of the System](#3-idempotency-the-heart-of-the-system)
4. [Charge State Machine](#4-charge-state-machine)
5. [Webhook Delivery](#5-webhook-delivery-pipeline)
6. [API Surface](#6-api-surface)
7. [Concurrency and Locking](#7-concurrency-and-locking)
8. [Error Taxonomy](#8-error-taxonomy)
9. [Operational Concerns](#9-operational-concerns)
10. [Common Follow-ups](#10-common-follow-up-questions)
11. [Sources](#11-sources)

---

## 1. Requirements

### Functional
- Create a **Charge** for a customer × payment-method × amount × currency
- Capture asynchronously (auth → capture flow) or immediately
- Refund (full or partial)
- Notify external systems via **webhooks** when state changes
- Allow clients to **safely retry** any mutating call after a network failure

### Non-Functional
- **No double-charging** — exactly-once *effect* on the customer
- Tolerate network partitions, server crashes, duplicate retries
- Sub-second p99 for the synchronous create path
- Webhook delivery durable for at least 3 days, even if the receiver is down

### Out of scope (would be follow-ups)
- Card-data tokenization (separate PCI-scoped service)
- Multi-currency settlement and FX
- Fraud / risk scoring

---

## 2. Core Domain Model

```
Customer ──< PaymentMethod
              │
              ▼
Charge ──< Refund
   │
   ├── status:        REQUIRES_PAYMENT_METHOD | REQUIRES_CONFIRMATION
   │                  | REQUIRES_ACTION | PROCESSING | SUCCEEDED | CANCELED
   ├── amount, currency, customer_id, payment_method_id
   ├── idempotency_key  (nullable; required for retry safety)
   ├── created_at, updated_at
   └── failure_code, failure_message  (when terminal-failed)

WebhookEvent
   ├── id (evt_xxx)
   ├── type ("charge.succeeded", "charge.refunded", ...)
   ├── data (snapshot of the affected object)
   ├── api_version
   └── created_at

WebhookDelivery
   ├── event_id, endpoint_id
   ├── attempts, last_attempted_at, next_attempt_at
   ├── last_response_status, last_response_body (truncated)
   └── status: PENDING | SUCCEEDED | FAILED_PERMANENTLY
```

The state machine is the central contract: **clients react to events**, never to side effects of the synchronous API call (the call may have timed out).

---

## 3. Idempotency: The Heart of the System

### The Problem (Two Generals)
> "Exactly-once delivery is mathematically impossible — proven by the Two Generals Problem. The practical solution used by Stripe, Kafka, AWS, and virtually every reliable webhook provider is at-least-once delivery combined with idempotent consumers."

This drives every design choice. We cannot prevent retries; we can only make them safe.

### Idempotency-Key Header
Every mutating endpoint accepts an `Idempotency-Key` header. The contract:

| Behavior | Spec |
|---|---|
| **What it stores** | "The resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeds or fails." |
| **Replay** | "Subsequent requests with the same key return the same result, including 500 errors." |
| **Validation** | "The idempotency layer compares incoming parameters to those of the original request and errors if they're not the same." |
| **Length limit** | Up to 255 characters |
| **TTL** | "You can remove keys from the system automatically after they're at least 24 hours old." |
| **Allowed methods** | POST only — GET/DELETE are idempotent by definition |
| **Where generated** | Always **client-side** — UUID v4 / ULID. Server-generated keys defeat retry-safety because timeouts produce a new key. |

### Storage Schema
```sql
CREATE TABLE idempotency_keys (
  key            TEXT      PRIMARY KEY,
  request_hash   TEXT      NOT NULL,    -- SHA-256 of normalized params
  status         TEXT      NOT NULL,    -- 'in_flight' | 'completed'
  response_code  INT,
  response_body  JSONB,
  locked_at      TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON idempotency_keys (expires_at);  -- for TTL sweep
```

### Algorithm
```
function withIdempotency(key, params, handler):
    hash = sha256(canonical(params))
    
    // Atomic insert — wins the race for first-time requests
    inserted = db.insert(idempotency_keys, {
        key, request_hash: hash,
        status: 'in_flight',
        locked_at: now()
    }) ON CONFLICT DO NOTHING
    
    if inserted:
        // First time — execute handler
        try:
            result = handler(params)
            db.update(key, {
                status: 'completed',
                response_code: result.code,
                response_body: result.body,
                completed_at: now()
            })
            return result
        except (e):
            db.update(key, {
                status: 'completed',
                response_code: e.code,
                response_body: e.body,
                completed_at: now()
            })
            return e
    
    // Concurrent / replay path
    row = db.select(key)
    if row.request_hash != hash:
        return 422 "Idempotency key reused with different parameters"
    if row.status == 'completed':
        return row.response_code, row.response_body, header("Idempotency-Replayed", "true")
    // Still in flight — concurrent retry
    return 409 "Original request still in progress; retry later"
```

> **Sources cite an in-flight overhead of "less than 2ms per request — a single indexed lookup".**

### Pitfalls
| Mistake | Consequence |
|---|---|
| Caching only a flag (not the response body) | Retry returns empty result, client treats as new failure |
| Including a timestamp in the key | Defeats deduplication entirely |
| No TTL | Storage grows forever |
| Server-generated keys | Network timeout → new key → bypass dedup → double-charge |
| Forwarding a 4xx-validated request to the gateway before checking dedup | Gateway accepts the same charge twice |

### Caveats Stripe explicitly documents
- A request that's **rate-limited (429)** can produce a different result with the same key, because rate limiters run before the idempotency layer.
- A **401 missing API key** likewise bypasses idempotency.
- "Always generate a fresh idempotency key when modifying the original request."

---

## 4. Charge State Machine

```
                 ┌──────────────────────┐
                 │REQUIRES_PAYMENT_METHOD│
                 └──────────┬───────────┘
                            │ attach pm
                            ▼
                  ┌─────────────────────┐
                  │REQUIRES_CONFIRMATION│
                  └──────────┬──────────┘
                             │ confirm
                             ▼
              ┌─────────────────────────────┐
              │         PROCESSING          │
              └──────┬──────────────┬───────┘
        3DS / SCA    │              │ direct gateway response
                     ▼              ▼
        ┌────────────────────┐   ┌──────────┐
        │  REQUIRES_ACTION   │   │SUCCEEDED │
        │  (return URL)      │   └─────┬────┘
        └─────────┬──────────┘         │ refund
                  │ user completes     ▼
                  ▼                ┌─────────────┐
              SUCCEEDED            │  REFUNDED   │
                                   │ (full/part) │
                                   └─────────────┘
                  │ gateway declines │ user cancels
                  ▼                  ▼
              ┌──────────┐       ┌──────────┐
              │FAILED    │       │ CANCELED │
              └──────────┘       └──────────┘
```

### Why state matters
- The webhook stream **always reflects state transitions**, never the API result of a single call. A client that built business logic on the synchronous response will silently miss state changes that happen after a network timeout.
- All transitions are **append-only** in an audit log table; the `status` column is materialized.

---

## 5. Webhook Delivery Pipeline

### Producer side (charge service)
```
Charge state changes
        │
        ▼
INSERT INTO webhook_events (id, type, data, ...)
        │
        ▼
INSERT INTO webhook_deliveries (event_id, endpoint_id, status='PENDING', next_attempt_at=now())
        │
        ▼
   (commit transaction — outbox pattern)
        │
        ▼
   delivery worker picks up
```

The **outbox pattern** is critical — writing the event and the state transition in the same DB transaction guarantees the event is never lost. Even if the worker crashes immediately after, the row is durable.

### Delivery worker
```
loop:
    rows = SELECT * FROM webhook_deliveries
           WHERE status = 'PENDING' AND next_attempt_at <= now()
           ORDER BY next_attempt_at
           LIMIT 100
           FOR UPDATE SKIP LOCKED      -- multiple workers safe
    
    for row in rows:
        body    = serialize(row.event)
        sig     = hmac_sha256(endpoint.secret, "v1=" + timestamp + "." + body)
        headers = {
            "Stripe-Signature": "t=" + timestamp + ",v1=" + sig,
        }
        try:
            res = http.post(endpoint.url, body, headers, timeout=10s)
            if 200 <= res.status < 300:
                row.status = 'SUCCEEDED'
            else:
                schedule_retry(row, attempts+1)
        except (timeout, network_error):
            schedule_retry(row, attempts+1)
```

### Retry schedule
Stripe's policy (the de-facto industry baseline):

| Property | Value | Source |
|---|---|---|
| Receive timeout | **10 seconds** for a 2xx | docs.stripe.com webhooks |
| Retry duration | **Up to 3 days** in live mode | docs.stripe.com webhooks |
| Backoff | **Exponential** with jitter | docs.stripe.com webhooks |
| Test mode | 3 attempts over a few hours | docs.stripe.com webhooks |
| Auto-disable | Endpoint disabled after ~3 days continuous failures | hookdeck.com |

```python
# Exponential backoff + jitter
def next_delay(attempt):
    base = min(2 ** attempt, 86400)        # cap at 1 day
    jitter = random.uniform(0, base * 0.25) # avoid thundering herd
    return base + jitter
```

### Signature verification (consumer side)
The signature uses HMAC-SHA256 of `"<timestamp>.<raw_body>"` keyed by the endpoint secret. Common pitfall: frameworks parse JSON before verification, so the *raw bytes* must be preserved.

### Ordering
> Stripe explicitly does not guarantee delivery in the order events were created. A `customer.subscription.updated` may arrive before the `customer.subscription.created` retry that triggered it. Handlers must be order-independent.

Two practical solutions:
1. **Reconcile via API**: on receipt of any event, fetch the latest object from the API and act on the canonical state.
2. **Per-entity sequence number**: include a monotonically-increasing version on each object; consumers ignore events with `version <= already_processed_version`.

### Receiver side: idempotency for events
```sql
CREATE TABLE processed_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  processed_at    TIMESTAMPTZ DEFAULT now()
);
```

A canonical handler:
```python
@app.post("/webhooks/stripe")
def handle(request):
    event = stripe.webhooks.construct_event(
        request.body_bytes,                # raw bytes — not parsed JSON
        request.headers["Stripe-Signature"],
        ENDPOINT_SECRET,
    )
    # 1. Acknowledge fast (under 10s timeout)
    enqueue_for_processing(event)
    return 200

def process(event):
    # 2. Dedupe by event id
    inserted = db.insert(processed_webhook_events,
        {"stripe_event_id": event.id, "type": event.type}) \
        .on_conflict_do_nothing()
    if not inserted:
        return  # already handled
    # 3. Real work
    ...
```

The **acknowledge-then-process** split is essential — heavy work in the handler causes timeouts and retry storms.

---

## 6. API Surface

```
POST /v1/charges
  Headers: Idempotency-Key: <uuid>
  Body: { amount, currency, customer, payment_method, capture: bool }
  → 201 { id, status, ... }

POST /v1/charges/:id/capture
  Headers: Idempotency-Key: <uuid>
  → 200 { id, status: 'succeeded', ... }

POST /v1/charges/:id/refund
  Headers: Idempotency-Key: <uuid>
  Body: { amount?: int }   # default = full
  → 201 { id: 're_xxx', amount, charge: 'ch_xxx', ... }

GET  /v1/charges/:id
  → 200 { id, status, ... }

GET  /v1/events
  Query: types[], delivery_success?, ending_before?, limit?
  → 200 { data: [...] }   # used by clients to recover after outages
```

The `/v1/events` endpoint is critical: it lets a client that was offline for hours **pull** missed webhook events instead of relying solely on push.

---

## 7. Concurrency and Locking

### Refund race
Two concurrent refund calls on the same charge could each succeed and over-refund. Solutions:
- **DB row-level lock** — `SELECT ... FROM charges WHERE id = ? FOR UPDATE` inside the refund transaction
- **Optimistic concurrency** — `UPDATE charges SET refunded_amount = ? WHERE id = ? AND version = ?`; retry on conflict
- **Idempotency key** — clients with the same intent generate the same key; dedup catches it

### Worker concurrency
Multiple delivery workers consume the same queue. `FOR UPDATE SKIP LOCKED` (Postgres) or visibility timeouts (SQS) prevent the same delivery from firing twice in parallel.

### Endpoint concurrency
> The `ON CONFLICT DO NOTHING` insert guarantees only one concurrent request acquires the lock. The second request sees `locked_at IS NOT NULL`, `completed_at IS NULL` and receives a 409.

---

## 8. Error Taxonomy

| Stripe class | HTTP | Retry safe? | Idempotency cached? |
|---|---|---|---|
| `card_error` (declined, insufficient funds) | 402 | Yes — but probably same outcome | Yes |
| `invalid_request_error` | 400 | No — fix and use **new** key | Yes (caches the 400) |
| `authentication_error` | 401 | After fixing creds | **No** — runs before idempotency layer |
| `rate_limit_error` | 429 | Yes after backoff | **No** — runs before idempotency layer |
| `api_error` (server) | 500 | Yes — same key | Yes |
| Network / timeout | — | **Yes — same key** | n/a |

Two important quirks from Stripe's docs:
- "A request that's rate-limited with a 429 can produce a different result with the same idempotency key, because rate limiters run before the API's idempotency layer."
- For 500 errors: "We save results only after the execution of an endpoint begins. If the request conflicts with another request that's executing concurrently, we don't save the idempotent result."

---

## 9. Operational Concerns

### Monitoring
- **Webhook lag** — delivery `created_at` vs `last_attempted_at` p95
- **Auto-disabled endpoints** — alert immediately; merchant revenue impact
- **Idempotency-key collision rate** — sudden spike means a client bug
- **Charge state-transition latency** — `created → succeeded` p99
- **In-flight idempotency rows** > N hours — likely orphaned, sweep them

### Storage growth
- `idempotency_keys`: TTL 24h → bounded
- `webhook_events`: keep 30 days hot, archive to S3 (Stripe's `/v1/events` returns last 30 days only)
- `webhook_deliveries`: keep until `SUCCEEDED` + 30 days for audit

### Recovery after outage
- Receivers call `GET /v1/events?delivery_success=false&ending_before=<last_seen>` and replay
- Mark each event's processing in the receiver's `processed_webhook_events` table to stay idempotent

### Security
- Endpoint secret is per-endpoint (rotation supported by allowing two active secrets briefly)
- HMAC signature includes a timestamp; reject replays older than 5 minutes
- Webhook payload includes only IDs and small fields — never card numbers (PCI scope)

---

## 10. Common Follow-up Questions

**Q: How would you support multi-region failover?**
- Active-active for read APIs; active-passive for the charge state machine (single writer per charge). Idempotency table replicated synchronously within region, asynchronously cross-region. On failover, expose a brief window where an in-flight key returns 409.

**Q: How would you scale to 10× the webhook volume?**
- Partition `webhook_deliveries` by `endpoint_id` hash. Each partition has its own pool of workers. Per-endpoint rate limit so one slow merchant doesn't starve others.

**Q: A merchant reports duplicate charges. How do you investigate?**
- Search `charges` by `customer_id + amount + currency` within ±10 s. If two distinct `id`s exist with different idempotency keys → client bug (regenerated key on retry). If two with same key → infrastructure bug (idempotency layer didn't dedup). The metadata field is useful — Stripe explicitly recommends sending a local order id in metadata for cross-referencing during reconciliation.

**Q: How would you implement subscription renewals?**
- Separate scheduler service emits `invoice.created` events on a cron; the charge service receives them, attempts the charge, emits `invoice.payment_succeeded` or `invoice.payment_failed`. Decouples scheduling from payment.

**Q: 3D Secure / Strong Customer Authentication?**
- Adds the `REQUIRES_ACTION` state. Server returns a `next_action.redirect_to_url`; client redirects user; bank confirms; webhook updates state. The synchronous API call and the eventual outcome are now fully decoupled.

---

## 11. Sources

All non-trivial numeric and behavioral claims above come from these primary sources:

- **Stripe API Reference — Idempotent requests** (`docs.stripe.com/api/idempotent_requests`) — key TTL of 24h, 255-char limit, parameter-hash validation, POST-only
- **Stripe Documentation — Webhooks** (`docs.stripe.com/webhooks`) — 10 s receive timeout, 3-day retry window, exponential backoff, no ordering guarantee
- **Stripe Documentation — Advanced error handling** (`docs.stripe.com/error-low-level`) — error taxonomy, 429 / 401 bypassing idempotency layer, 500 reconciliation
- **Stripe Engineering Blog — "Designing robust and predictable APIs with idempotency"** (`stripe.com/blog/idempotency`) — design rationale, Ruby SDK auto-retry behavior
- **Stripe Documentation — Process undelivered events** (`docs.stripe.com/webhooks/process-undelivered-events`) — `/v1/events` recovery API, 30-day window
- **Two Generals Problem** — the impossibility result that drives the at-least-once design
