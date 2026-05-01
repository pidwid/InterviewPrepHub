# Edge Computing — From CDN to Compute at the PoP

> A modernization of the classic CDN topic. Edge computing means **running your code** at the CDN PoP, not just caching static assets.
>
> By 2026, edge functions have moved from experimental to mainstream. This note covers the architecture, the limits, the use cases, and where edge breaks down.

---

## Table of Contents

1. [The Three Layers of "Edge"](#the-three-layers-of-edge)
2. [Why Edge Functions Got Fast: V8 Isolates](#why-edge-functions-got-fast-v8-isolates)
3. [Major Platforms Compared](#major-platforms-compared)
4. [The Hard Limits](#the-hard-limits)
5. [Edge Storage Primitives](#edge-storage-primitives)
6. [Use Cases — When to Use the Edge](#use-cases--when-to-use-the-edge)
7. [When NOT to Use the Edge](#when-not-to-use-the-edge)
8. [The Hybrid Pattern (Most Production Systems)](#the-hybrid-pattern-most-production-systems)
9. [What Could Bite You In an Interview](#what-could-bite-you-in-an-interview)

---

## The Three Layers of "Edge"

The word "edge" is overloaded. In modern web infrastructure there are three distinct concepts:

| Layer | What it does | Example |
|---|---|---|
| **Traditional CDN** | Caches static assets at PoPs | Akamai, classic CloudFront |
| **Edge functions** | Runs JavaScript / WASM in response to requests | Cloudflare Workers, Lambda@Edge, Vercel Edge Functions |
| **Edge state** | Stores data close to the user | Cloudflare KV / Durable Objects, AWS DynamoDB Global Tables |

A modern "edge platform" combines all three. Cloudflare Workers + R2 + KV + D1 + Durable Objects is the canonical example.

---

## Why Edge Functions Got Fast: V8 Isolates

The defining performance advantage of modern edge runtimes is the use of **V8 isolates** instead of containers/microVMs.

### The Cold-Start Problem

Lambda's traditional model:
1. Receive request
2. **Provision a microVM** (Firecracker)
3. **Load the language runtime** (Node, Python, JVM, …)
4. **Initialize your code** (load deps, run startup hooks)
5. Run handler

Cold-start budget: **100ms to 3 seconds** depending on language. JVM is the worst (~1-3s), Python is moderate (~200-800ms), Node is best (~100-300ms).

### Cloudflare Workers' Trick

Workers don't spin up a VM per request. Instead:
- A **single V8 process** runs continuously on each edge server
- Each tenant gets a **V8 isolate** — a sandboxed JavaScript heap inside the shared process
- Isolates start in **<5 ms** (some sources cite **<1 ms**)
- The cost of running an isolate is fractions of the cost of running a container

The trade-off: you can only run **JavaScript / TypeScript / WebAssembly** (no native binaries, no Linux processes). For most web/API workloads, this is fine.

### Measured Performance Difference

Per Cloudflare's own published benchmarks:
- Workers p50: ~13ms (worldwide)
- Lambda@Edge p50: ~50ms
- Lambda (us-east-1): ~100-300ms
- At p95, Workers were ~441% faster than regional Lambda and ~192% faster than Lambda@Edge

These numbers are vendor-published and biased toward the simplest possible function (return current time), but the **architectural advantage is real** and reproduced by independent benchmarks.

---

## Major Platforms Compared

| Platform | Runtime | PoPs | Cold start | Memory | CPU time | Notes |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | V8 isolates (JS / TS / WASM) | 300+ | <1 ms | 128 MB | 30s (paid), 50ms (free CPU-time) | Most mature edge platform; full storage stack (KV, R2, D1, Durable Objects) |
| **AWS Lambda@Edge** | Node.js / Python in microVMs | ~450 CloudFront PoPs | 100-1000 ms | 128 MB-10 GB | 5s | Slower cold starts; deep AWS integration |
| **AWS CloudFront Functions** | Lightweight V8-style | All CloudFront PoPs | <1 ms | Limited | <1 ms | Header rewriting only; no body access |
| **Vercel Edge Functions** | V8 isolates | ~18 (some via Lambda@Edge) | <1 ms | 128 MB | 30s | Tight Next.js integration |
| **Deno Deploy** | V8 isolates with Deno runtime | 35+ regions | <1 ms | 128 MB | 50ms (free) / 200ms (paid) | Strong Web standards story |
| **Fastly Compute@Edge** | WebAssembly | Fastly PoPs | <1 ms | Limited | Configurable | WASM-first; multi-language via WASM |

**Important nuance**: Cloudflare bills CPU time only (sleeping/waiting on I/O is free). Lambda bills wall-clock time. This makes Workers dramatically cheaper for I/O-bound workloads (which is most APIs).

---

## The Hard Limits

These are the **defining constraints** of edge runtimes — design around them:

### 1. Memory Cap (~128 MB)

Most edge platforms cap at 128 MB per isolate. You cannot:
- Run image processing on multi-MB inputs
- Hold ML model weights in memory
- Parse multi-hundred-MB JSON

### 2. CPU Time Cap

Cloudflare: **30 seconds** of CPU on paid (50 ms on free). Vercel: 30s. Deno: 200ms.

Note: this is **CPU time**, not wall-clock. A function that awaits a slow API call for 10 seconds while doing 5ms of CPU is fine.

### 3. No Persistent Filesystem

Edge isolates are ephemeral. You cannot write a file and read it back later. Use:
- **Edge KV** for read-heavy small values (Cloudflare KV is eventually consistent — propagation up to **60 seconds**)
- **Object storage** (R2, S3) for large blobs
- **Durable Objects** for strongly-consistent stateful coordination
- **D1 / edge SQLite** for relational data

### 4. No TCP / Raw Socket Connections

You usually cannot open a raw TCP connection to your Postgres or Redis instance. This kills traditional database drivers.

Workarounds:
- HTTP-based DB layers (PlanetScale's HTTP driver, Neon serverless driver, Supabase REST/PostgREST)
- Edge-native databases (D1, Turso, PlanetScale)
- Push DB calls to a regional backend; let the edge handle only edge-appropriate work

### 5. No Long-Lived Connections (Mostly)

WebSockets and long-polling are restricted on most platforms. Cloudflare Durable Objects support WebSockets, but it's a different model from a typical Node.js server. Plan accordingly for streaming use cases.

### 6. Subset of Standard APIs

Edge runtimes implement **Web Standard APIs** (`fetch`, `Request`, `Response`, `crypto.subtle`, `URL`) — not Node.js. Many npm packages won't work without polyfills or alternatives.

---

## Edge Storage Primitives

Edge compute is only useful if you have **state at the edge**. Modern platforms ship a stack:

| Primitive | Type | Consistency | Use case |
|---|---|---|---|
| **Cloudflare KV** | Eventually-consistent KV | Up to 60s propagation | Config, feature flags, session data — read-heavy with tolerance for staleness |
| **Cloudflare R2 / S3** | Object storage | Strong (within region) | Static files, large blobs |
| **Cloudflare D1** | SQLite at the edge | Strong (single-leader per DB) | Read-heavy small relational workloads |
| **Cloudflare Durable Objects** | Stateful single-instance JS objects | Strong (serial per object) | Coordination, counters, chat rooms — anywhere you need a "serialization point" at the edge |
| **DynamoDB Global Tables** | Multi-region eventually-consistent | Eventual cross-region | AWS-native global state |

**The pattern that's emerged**: KV for cache, R2 for blobs, D1 for relational, Durable Objects for coordination. Equivalent stacks exist on AWS / Vercel; the names differ but the concepts are the same.

---

## Use Cases — When to Use the Edge

Edge functions are ideal for **stateless, latency-sensitive, low-CPU operations** that benefit from being close to the user:

### Excellent Fits

- **Authentication & authorization** — verify JWT, look up session, return 401 fast — without a round-trip to the origin
- **A/B test variant assignment** — bucket the user, serve the right version of a page
- **Geo-routing & personalization** — read `cf-ipcountry` / region headers and rewrite responses
- **Bot detection / WAF rules** — classify and block before traffic hits the origin
- **Header manipulation / URL rewriting** — strip query params, normalize paths
- **API gateway functions** — request validation, response shaping, rate limiting
- **Image transformation requests** — accept query params, hand off to a regional service for the actual processing
- **Webhook ingestion** — accept the webhook payload, validate signature, ACK 200, push to a queue (good fit for Cloudflare Queues)

### Real Numbers Most Commonly Cited

- **60-80% reduction in TTFB** when moving from regional serverless to the edge for global users
- **<50 ms TTFB worldwide** is achievable with 300+ PoPs

---

## When NOT to Use the Edge

Edge is not a backend replacement. Avoid for:

- **CPU-intensive work** — image resizing, video encoding, ML inference, big crypto. The 30s CPU cap (and the cost-per-CPU model) makes this impractical.
- **Large in-memory state** — anything >128 MB per request
- **Heavy database access** — multiple round-trips to a regional DB; edge → regional DB latency offsets the edge advantage
- **Long-running workflows** — multi-step orchestration with retries; use Step Functions or a dedicated workflow engine
- **WebSockets at scale** with complex state — Durable Objects help but it's a different programming model
- **Tight integration with cloud services in a single region** (S3 events, DynamoDB streams, EventBridge — Lambda is the native glue)

---

## The Hybrid Pattern (Most Production Systems)

The 2026 best-practice architecture is **edge for the hot path + regional cloud for the heavy lifting**:

```
                          ┌──────────────────────────┐
                          │  Edge (Cloudflare        │
   User request ─────────▶│  Workers / Vercel Edge)  │
                          │                          │
                          │  - Auth check            │
                          │  - Rate limit            │
                          │  - Geo-routing           │
                          │  - Cache lookup          │
                          │  - Personalization       │
                          │  - WAF / bot detection   │
                          └────────────┬─────────────┘
                                       │
                            cache hit  │  cache miss
                            (most reqs)│
                                       ▼
                          ┌──────────────────────────┐
                          │  Regional backend        │
                          │  (Lambda / EC2 / GKE)    │
                          │                          │
                          │  - Business logic        │
                          │  - DB transactions       │
                          │  - Long-running tasks    │
                          │  - Heavy compute         │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │  Regional databases      │
                          │  (RDS, DynamoDB, etc.)   │
                          └──────────────────────────┘
```

This pattern delivers:
- **Sub-5ms response for cached or edge-handled requests** (the majority)
- **Origin shield**: rate limiting + auth at edge protects the regional backend
- **Cost reduction**: most requests don't hit your expensive Lambda/RDS infrastructure

---

## What Could Bite You In an Interview

- **"What about cold starts?"** — V8 isolates have effectively zero cold start (<1 ms). Containers/microVMs (Lambda) have 100ms-3s. This is **the** structural advantage of modern edge runtimes.
- **"Why can't I just use Lambda@Edge for everything?"** — Lambda@Edge runs containers, has slower cold starts, has a 5s timeout, has a 1MB response body limit. Fewer PoPs than Cloudflare. Fine for incremental request processing tied to CloudFront, but not a full edge platform.
- **"How do I handle a database at the edge?"** — Use HTTP-based serverless DB drivers (Neon, PlanetScale), edge-native DBs (D1, Turso), or push DB work back to a regional backend. Don't try to run a TCP Postgres driver from a Worker.
- **"What's the consistency model of edge KV?"** — Eventually consistent, propagation up to 60s for Cloudflare KV. Use Durable Objects (or push to a regional store) when you need strong consistency.
- **"What about regional regulations / data residency?"** — Edge functions complicate compliance. Some platforms allow you to constrain code/data to specific regions (Cloudflare's regional services, AWS's region-pinned Lambdas). Read the platform docs carefully if GDPR / data residency matters.
- **"How do you debug edge failures?"** — Tail-logging APIs (Cloudflare `wrangler tail`, Vercel logs) for live tail; structured logs forwarded to your regional log store; distributed tracing with OpenTelemetry SDKs that work in V8 isolates.

---

## Quick Mental Model

> The CDN became programmable. Anything that can be expressed as a stateless or read-mostly transformation of a request, in <30 ms of CPU and <128 MB of RAM, belongs at the edge. Everything else still belongs in your regional backend.

---

> **Sources for this note.** Cloudflare Workers official docs and "Serverless Performance" blog post (the original Workers vs. Lambda benchmark). Independent benchmarks from ZeonEdge, DigitalApplied, and Postry (2026). Vercel and AWS Lambda@Edge documentation. Specific cold-start numbers and PoP counts vary slightly across sources — they reflect a moving target as platforms expand. The 60-80% TTFB improvement and 300+ PoPs figures for Cloudflare are widely-cited industry numbers.
