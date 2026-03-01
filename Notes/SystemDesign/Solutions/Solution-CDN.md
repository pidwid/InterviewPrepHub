# Design a Content Delivery Network (CDN)

A Content Delivery Network is a geographically distributed network of proxy servers that caches and serves content from locations closer to the end user. CDNs serve over 50% of all internet traffic today. Major providers include Cloudflare, Akamai, AWS CloudFront, and Fastly. This design covers building the core architecture of a CDN from scratch.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we designing a CDN for static content only (images, CSS, JS) or also dynamic content?
**Interviewer:** Primarily static content, but discuss how dynamic content acceleration works.

**Candidate:** What's the geographic scope?
**Interviewer:** Global — edge servers on every continent.

**Candidate:** What's the expected traffic scale?
**Interviewer:** Millions of requests per second globally.

**Candidate:** Do we need to support HTTPS termination at the edge?
**Interviewer:** Yes, that's essential.

### Functional Requirements

- Serve cached static content (images, videos, CSS, JS, HTML) from edge servers closest to the user
- Cache invalidation — origin can purge specific content
- HTTPS termination at the edge
- Custom domain support (customers map their domain to the CDN)
- Origin shielding — reduce load on the customer's origin server

### Non-Functional Requirements

- **Ultra-low latency** — Content served in < 50ms from edge
- **High availability** — 99.99% uptime, survive entire PoP (Point of Presence) failures
- **Massive throughput** — Handle millions of RPS globally
- **Global coverage** — Edge servers on every continent, in major metros
- **Consistency** — Cache invalidation propagates within seconds

### Back-of-the-Envelope Estimation

- 200 PoPs globally, each with 10–100 edge servers
- 5 million requests/sec globally at peak
- Average object size: 100 KB
- Cache hit ratio target: 95%+
- Bandwidth: 5M × 100KB × 0.95 (cache hits) = ~475 GB/s served from edge

---

## Step 2 — High-Level Design

```
                         ┌──────────────────┐
                         │   DNS Resolver   │
                         │  (GeoDNS / Anycast)│
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │  PoP: US-East │   │ PoP: Europe  │   │ PoP: Asia    │
     │               │   │              │   │              │
     │ ┌──────────┐  │   │ ┌──────────┐ │   │ ┌──────────┐ │
     │ │Edge Srv 1│  │   │ │Edge Srv 1│ │   │ │Edge Srv 1│ │
     │ │Edge Srv 2│  │   │ │Edge Srv 2│ │   │ │Edge Srv 2│ │
     │ │Edge Srv N│  │   │ │Edge Srv N│ │   │ │Edge Srv N│ │
     │ └──────────┘  │   │ └──────────┘ │   │ └──────────┘ │
     └──────┬────────┘   └──────┬───────┘   └──────┬───────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                       ┌────────┴────────┐
                       │  Origin Shield  │
                       │  (Mid-tier cache)│
                       └────────┬────────┘
                                │
                       ┌────────┴────────┐
                       │  Origin Server  │
                       │  (Customer's)   │
                       └─────────────────┘
```

### Request Flow

```
1. User requests https://cdn.example.com/image.jpg

2. DNS resolution (GeoDNS or Anycast):
   DNS resolves to the nearest PoP's IP address based on
   user's geographic location.

3. Edge server cache lookup:
   HIT  → Return cached content immediately (< 5ms)
   MISS → Continue to step 4

4. Origin shield cache lookup:
   HIT  → Return to edge, edge caches it, returns to user
   MISS → Continue to step 5

5. Fetch from origin:
   Origin shield fetches from customer's origin server.
   Response flows back: Origin → Shield → Edge → User.
   Each layer caches the content.
```

---

## Step 3 — Design Deep Dive

### 1. Request Routing (How Users Reach the Nearest Edge)

#### GeoDNS

```
Traditional DNS returns the same IP for everyone.
GeoDNS returns different IPs based on the requester's location.

User in Tokyo:
  dig cdn.example.com → 103.21.244.5 (Asia PoP)

User in New York:
  dig cdn.example.com → 198.41.128.3 (US-East PoP)

Implementation:
  DNS server has a GeoIP database (MaxMind).
  Maps client IP → country/region → nearest PoP IP.

Pros: Simple, works with all clients.
Cons: DNS caching causes stale routing, user's DNS resolver
      location ≠ user's actual location (e.g., Google Public DNS).
```

#### Anycast

```
Multiple PoPs advertise the SAME IP address via BGP.
Internet routing naturally sends packets to the nearest PoP.

All PoPs announce: 198.41.128.0/24
BGP routing ensures: shortest AS path = nearest PoP.

User in Tokyo → routed to Asia PoP (same IP)
User in New York → routed to US-East PoP (same IP)

Pros: No DNS tricks needed, automatic failover (BGP withdraws
      route if PoP goes down), handles DNS resolver mismatch.
Cons: More complex network setup, TCP session issues during
      route changes (mitigated by keeping PoPs stable).

Used by: Cloudflare (primary), Google Cloud CDN.
```

### 2. Edge Server Architecture

```
Each edge server handles:

┌─────────────────────────────────────────────┐
│              Edge Server                    │
│                                             │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ TLS          │  │ HTTP/2 + HTTP/3    │   │
│  │ Termination  │  │ (QUIC) Server      │   │
│  │ (with cert)  │  │                    │   │
│  └──────────────┘  └────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │         Cache Layer                  │   │
│  │                                      │   │
│  │  L1: Hot cache (RAM) — top 1% keys   │   │
│  │  L2: Warm cache (SSD) — next 20%     │   │
│  │  L3: Cold cache (HDD) — long tail    │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ Cache Key    │  │ Compression        │   │
│  │ Generation   │  │ (Brotli, gzip)     │   │
│  └──────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────┘

Cache key = hash(URL + Vary headers + query params + config)
```

### 3. Caching Strategy

```
Cache-Control headers from origin dictate behavior:

  Cache-Control: public, max-age=86400
  → Cache for 24 hours, serve to anyone.

  Cache-Control: private, no-cache
  → Don't cache on CDN (only browser cache).

  Cache-Control: s-maxage=3600
  → CDN-specific: cache for 1 hour on shared (CDN) cache.

Stale-While-Revalidate:
  Cache-Control: max-age=3600, stale-while-revalidate=60

  After 1 hour: content is "stale."
  For the next 60 seconds: serve stale content AND
  asynchronously fetch fresh content from origin.
  User gets instant response, cache refreshes in background.

Conditional Requests (Revalidation):
  Edge → Origin: GET /image.jpg
                  If-None-Match: "etag-abc123"
  
  Origin: 304 Not Modified (content hasn't changed, no body sent)
  or
  Origin: 200 OK + new content (content changed)
```

### 4. Origin Shield (Mid-Tier Cache)

```
Without origin shield:             With origin shield:

  200 PoPs all fetch from          200 PoPs fetch from 5 shields.
  origin on cache miss.            Only shields fetch from origin.
  
  Cache miss storm:                Cache miss storm:
  200 requests → Origin            200 → 5 shields → 1 request → Origin
  
  Origin sees 200 requests         Origin sees 1 request (per shield)
  for the same object.             per unique object.

Shield placement:
  Place shields in 3-5 major regions (US, EU, Asia).
  Each shield serves 40-60 PoPs in its region.
  Shield has a much larger cache (TB-scale SSD).
```

### 5. Cache Invalidation (Purge)

```
When a customer updates content, old cached versions must be purged.

Purge approaches:

1. URL-based purge:
   POST /purge { "urls": ["https://cdn.example.com/image.jpg"] }
   → Propagate to ALL PoPs → each PoP deletes the cache entry.

2. Tag-based purge (Surrogate Keys):
   Origin sets header: Surrogate-Key: product-123 homepage
   Purge by tag: POST /purge { "tag": "product-123" }
   → All objects tagged "product-123" are purged across all PoPs.

3. Prefix-based purge:
   POST /purge { "prefix": "/static/v2/" }
   → All URLs starting with /static/v2/ are purged.

Propagation:
  Central purge service → publishes to message queue (Kafka) →
  each PoP subscribes and purges locally.
  Target: propagation to all 200 PoPs < 5 seconds.
```

### 6. TLS & Custom Domains

```
Customer wants: https://static.customer.com served by CDN.

Setup:
  1. Customer creates CNAME: static.customer.com → cdn-customer.example-cdn.com
  2. CDN provisions a TLS certificate for static.customer.com
     (via Let's Encrypt or customer-provided cert)
  3. Edge servers use SNI (Server Name Indication) to pick the right cert:
     One edge server handles thousands of customer domains.

Certificate storage:
  Cert store (replicated) → edge servers fetch certs on startup.
  Hot certs cached in memory; cold certs loaded on-demand.
```

---

## Step 4 — Wrap Up

### Push CDN vs Pull CDN

```
Pull CDN (most common):
  Content is fetched from origin on first request (cache miss).
  Subsequent requests served from cache.
  Pros: Simple, no upfront cost, origin stays the source of truth.
  Cons: First request is slow (origin fetch).

Push CDN:
  Origin proactively pushes content to all edge servers.
  Used for content that's known in advance (software updates, video).
  Pros: No cold-start latency.
  Cons: Requires more storage, wastes space if content isn't popular
        in all regions, origin must manage push logic.
```

### Handling Edge Cases

- **Thundering herd (cache stampede):** Popular content expires simultaneously. 1000 requests hit origin for the same object. Fix: request collapsing — only the first request fetches from origin; others wait for that response.

- **Large file delivery (video):** Use byte-range requests. Client requests chunks. Edge caches individual byte ranges. Supports seeking in video without downloading entire file.

- **DDoS protection:** CDN is naturally a DDoS absorber — attack traffic is distributed across 200 PoPs instead of hitting one origin. Add rate limiting, bot detection, and WAF rules at the edge.

### Architecture Summary

1. **Anycast or GeoDNS** routes users to the geographically nearest PoP, minimizing round-trip latency.
2. **Multi-tier caching** (RAM → SSD → HDD at edge, plus origin shield) achieves 95%+ cache hit ratios while protecting the origin from traffic spikes.
3. **Cache-Control headers** and **stale-while-revalidate** enable fine-grained caching policies without CDN configuration changes.
4. **Purge propagation** via a message queue ensures cache invalidation reaches all 200+ PoPs within seconds.
5. **Origin shielding** collapses cache misses from hundreds of PoPs into a handful of requests to the origin, reducing origin load by orders of magnitude.
