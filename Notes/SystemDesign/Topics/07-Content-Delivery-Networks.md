# Content Delivery Networks (CDN)

> CDNs are how the modern web delivers content fast. They are essential for any system that serves users globally.

---

## Table of Contents

1. [What is a CDN?](#1-what-is-a-cdn)
2. [How a CDN Works](#2-how-a-cdn-works)
3. [Push CDNs](#3-push-cdns)
4. [Pull CDNs](#4-pull-cdns)
5. [Push vs Pull: When to Use Which](#5-push-vs-pull-when-to-use-which)
6. [CDN Architecture](#6-cdn-architecture)
7. [Cache Invalidation in CDNs](#7-cache-invalidation-in-cdns)
8. [CDN in System Design](#8-cdn-in-system-design)
9. [Major CDN Providers](#9-major-cdn-providers)
10. [Disadvantages of CDNs](#10-disadvantages-of-cdns)
11. [Key Takeaways](#11-key-takeaways)

---

## 1. What is a CDN?

A CDN is a **globally distributed network of proxy servers** that serve content from locations geographically **close to the user.**

```
Without CDN:
  User in Tokyo → request travels to server in Virginia
  Latency: ~200ms round trip

With CDN:
  User in Tokyo → request goes to CDN edge server in Tokyo
  Latency: ~20ms round trip

10x improvement just by proximity!
```

### What CDNs Serve

- **Static content:** HTML, CSS, JavaScript, images, videos, fonts, PDFs
- **Dynamic content:** Some CDNs (e.g., CloudFront, CloudFlare) can cache API responses and dynamic pages
- **Streaming media:** Video on demand (Netflix), live streaming

---

## 2. How a CDN Works

```
Step-by-step: First request (cache miss)

1. User requests https://cdn.example.com/logo.png
2. DNS resolves cdn.example.com to the nearest CDN edge server
3. Edge server checks its cache → MISS (doesn't have it)
4. Edge server fetches logo.png from the origin server
5. Edge server caches logo.png and returns it to the user
6. Future requests from nearby users are served from the edge cache

┌──────────┐     DNS     ┌──────────────┐
│  User    │ ──────────→ │  CDN Edge    │
│ (Tokyo)  │             │  (Tokyo)     │
└──────────┘     ←────── │              │
              logo.png   │  Cache: MISS │
                         │     │        │
                         │     ▼        │
                         │  Origin      │
                         │  Server      │
                         │  (Virginia)  │
                         └──────────────┘

Subsequent requests from Tokyo users:
  CDN Edge (Tokyo) → Cache: HIT → return immediately
  No round trip to Virginia. No load on origin server.
```

### The Two Performance Benefits

1. **Users receive content from servers close to them** → lower latency
2. **Your origin servers don't have to serve cached requests** → reduced load

---

## 3. Push CDNs

You **push content to the CDN** whenever you create or update it. You're responsible for uploading content and managing what's on the CDN.

```
Your deployment pipeline:
  1. Build application
  2. Upload static assets to CDN
  3. Update HTML to reference CDN URLs
  4. Deploy

┌──────────┐    push     ┌──────────────┐
│  Origin  │ ──────────→ │  CDN Edge    │
│  Server  │  upload     │  Servers     │
│          │  assets     │  (worldwide) │
└──────────┘             └──────────────┘
```

### How It Works

- You upload content directly to the CDN (via API or CLI)
- You configure expiration rules (when content is removed/updated)
- You rewrite URLs in your application to point to CDN URLs
- Content sits on the CDN until you explicitly update or remove it

### Advantages

- You control exactly what's on the CDN
- Content is available immediately (no "first request" cold start)
- Minimal redundant traffic between origin and CDN

### Disadvantages

- You're responsible for uploading every change
- Storage costs (CDN stores everything you push)
- More complex deployment pipeline
- Must manually invalidate/update stale content

### Best For

- **Small to medium sites** with content that changes infrequently
- **Known content sets** (e.g., product images, video files)
- Sites where you want fine-grained control over what's cached

---

## 4. Pull CDNs

The CDN **pulls content from your origin server** the first time a user requests it. You point your CDN at your origin, and it fetches and caches content automatically.

```
First request (cache miss):
  User → CDN Edge → MISS → fetch from origin → cache → return to user

Subsequent requests (cache hit):
  User → CDN Edge → HIT → return cached content

┌──────────┐             ┌──────────────┐    pull    ┌──────────┐
│  User    │ ──────────→ │  CDN Edge    │ ─────────→ │  Origin  │
│          │     ←────── │  (auto-pull) │     ←───── │  Server  │
│          │   content   │              │   content  │          │
└──────────┘             └──────────────┘            └──────────┘
```

### How It Works

- You configure the CDN with your origin server's address
- You rewrite URLs to point to the CDN (`cdn.example.com`)
- When a request comes in, the CDN checks its cache:
  - **HIT:** Serve directly from edge (fast)
  - **MISS:** Fetch from origin, cache it, serve to user (slower first time)
- Content expires based on **TTL** (HTTP Cache-Control headers or CDN config)

### Advantages

- Minimal setup — just point CDN at your origin
- No need to upload content manually
- Only caches content that's actually requested (efficient storage)
- Simpler deployment — you deploy to your origin, CDN auto-updates

### Disadvantages

- **Cold start:** First request for content is slow (must fetch from origin)
- **Redundant pulls:** If TTL expires, content is re-fetched even if it hasn't changed
- **TTL management:** Stale content if TTL is too long; too many origin requests if TTL is too short

### Best For

- **High-traffic sites** where most content is frequently accessed
- Sites with **lots of dynamic or frequently updated content**
- When you want minimal CDN management overhead

---

## 5. Push vs Pull: When to Use Which

| Factor | Push CDN | Pull CDN |
|--------|----------|----------|
| **Traffic volume** | Low to medium | Medium to high |
| **Content change frequency** | Infrequent | Frequent |
| **Content size** | Known, limited set | Large, growing set |
| **Control needed** | High | Low |
| **Setup complexity** | Higher | Lower |
| **First-request latency** | None (content already there) | Higher (cold start) |
| **Storage efficiency** | Lower (everything stored) | Higher (only requested content cached) |

### Real-World Example

```
Push CDN use case: A software company pushing release binaries
  - Known set of files (~100 files per release)
  - Files never change once published
  - Files must be immediately available worldwide

Pull CDN use case: An e-commerce site with millions of product images
  - New products added daily
  - Only popular products need fast access
  - Unpopular product images don't need to be cached
```

---

## 6. CDN Architecture

### Multi-Tier CDN

Large CDNs often have two tiers of servers:

```
               User
                │
         ┌──────▼──────┐
         │  Edge Server │  ← Closest to user, small cache
         │  (PoP)       │     Cache HIT? → Return immediately
         └──────┬───────┘
                │ Cache MISS
         ┌──────▼──────┐
         │  Shield/    │  ← Regional, larger cache
         │  Mid-tier   │     Cache HIT? → Return to edge
         └──────┬───────┘
                │ Cache MISS
         ┌──────▼──────┐
         │  Origin     │  ← Your actual server
         │  Server     │
         └─────────────┘

Benefits:
  - Edge servers have the hottest content
  - Shield servers reduce load on origin
  - Origin only gets requests for truly uncached content
```

### <abbr title="PoP (Point of Presence): a physical data center location where CDN servers are installed. The more PoPs a CDN has, the closer it can be to users worldwide.">PoP (Point of Presence)</abbr>

A PoP is a physical location where the CDN has servers. Major CDNs have 200+ PoPs worldwide.

```
Example: CloudFlare has PoPs in:
  - 330+ cities in 120+ countries
  - Within 50ms of 95% of internet users
```

---

## 7. Cache Invalidation in CDNs

When your content changes, you need to update the CDN. Several strategies:

### 1. URL Versioning (Recommended)

```
Old: /static/app.js      → cached forever
New: /static/app.v2.js   → new URL, no cache conflict

Or with hash:
Old: /static/app.abc123.js
New: /static/app.def456.js

Why this is best:
- No need to invalidate anything
- Old and new versions can coexist
- Users get the new version immediately
- Build tools (webpack, vite) do this automatically
```

### 2. Cache-Control Headers

```
Mutable content (might change):
  Cache-Control: public, max-age=300   (5-minute cache)

Immutable content (versioned filename):
  Cache-Control: public, max-age=31536000, immutable   (1 year)

No cache:
  Cache-Control: no-cache, no-store, must-revalidate
```

### 3. CDN Purge/Invalidation API

```
Force the CDN to drop cached versions:

AWS CloudFront:
  aws cloudfront create-invalidation --distribution-id EDFDVBD6EXAMPLE \
    --paths "/images/*" "/css/style.css"

CloudFlare:
  curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
    -d '{"files":["https://example.com/style.css"]}'

Drawback: Invalidation takes time to propagate across all edge servers
          (usually seconds to minutes)
```

---

## 8. CDN in System Design

### Typical Architecture

```
┌──────────────────────────────────────────────────────┐
│                    DNS (Route 53)                     │
│   static.example.com → CDN                           │
│   api.example.com    → Load Balancer                 │
└──────────────┬────────────────────┬───────────────────┘
               │                    │
        ┌──────▼──────┐     ┌──────▼──────┐
        │    CDN      │     │    Load     │
        │ (CloudFront)│     │  Balancer   │
        │             │     │             │
        │  Serves:    │     │  Routes to: │
        │  - Images   │     │  - App 1    │
        │  - CSS/JS   │     │  - App 2    │
        │  - Videos   │     │  - App 3    │
        │  - Fonts    │     │             │
        └──────┬──────┘     └─────────────┘
               │ (cache miss only)
        ┌──────▼──────┐
        │  Origin     │
        │  (S3 bucket │
        │   or server)│
        └─────────────┘
```

### When to Use a CDN in Your Design

- **Always** for static assets (images, CSS, JS, videos)
- For **read-heavy** APIs where responses can be cached
- For **live streaming** or video on demand
- For **globally distributed users** to reduce latency
- For **DDoS protection** (CDN absorbs attack traffic)

---

## 9. Major CDN Providers

| Provider | Key Strength | Pricing Model |
|----------|-------------|--------------|
| **CloudFront** (AWS) | Tight AWS integration, <abbr title="Lambda@Edge: run AWS Lambda functions at CDN edge locations, allowing you to customize content, add auth headers, or redirect requests without sending traffic to your origin server">Lambda@Edge</abbr> for edge computing | Pay per GB transferred + requests |
| **CloudFlare** | Free tier, built-in DDoS/<abbr title="WAF (Web Application Firewall): filters and monitors HTTP traffic to block common attacks like SQL injection, XSS, and DDoS before they reach your servers">WAF</abbr>, Workers for edge compute | Free tier available, paid plans for enterprise |
| **Akamai** | Largest network (350K+ servers), enterprise-grade | Custom pricing |
| **Fastly** | Real-time purging (< 150ms), edge computing (Compute@Edge) | Pay per GB + requests |
| **Azure CDN** | Azure integration, multiple CDN providers (Verizon, Akamai) | Pay per GB |
| **Google Cloud CDN** | GCP integration, HTTP/2 push | Pay per GB |

---

## 10. Disadvantages of CDNs

| Disadvantage | Explanation |
|-------------|-------------|
| **Cost** | CDN bandwidth costs can be significant for high-traffic sites |
| **Stale content** | Cached content might be outdated if TTL hasn't expired |
| **Debugging difficulty** | Cache-related bugs are hard to reproduce (it works in one location but not another) |
| **Vendor lock-in** | Switching CDN providers requires DNS changes and testing |
| **URL changes** | Static content URLs must point to the CDN, not your origin |
| **Complex invalidation** | Purging cached content across all edge servers takes time |
| **Cold start penalty** | First request to an edge location is slower (must fetch from origin) |

---

## 11. Key Takeaways

1. **CDN = globally distributed cache** that serves content from locations close to users. Two benefits: faster for users, less load on your servers.

2. **Push CDN:** You upload content to the CDN. Best for small, infrequent content. More control, more work.

3. **Pull CDN:** CDN fetches content from your origin on first request. Best for large, frequently accessed content. Simpler, but has cold starts.

4. **Use URL versioning** (not cache invalidation) for updating cached content. It's simpler and more reliable.

5. **Cache-Control headers** determine how long content is cached. Set `immutable` + long max-age for versioned assets.

6. **In system design interviews,** always put static content on a CDN. It's one of the easiest wins for performance and scalability.

7. **CDNs also provide security** — DDoS protection, WAF, and <abbr title="SSL termination: the CDN handles the HTTPS encryption/decryption at the edge server, so traffic between the CDN and your origin can optionally use plain HTTP internally, reducing CPU load on your servers">SSL termination</abbr> at the edge.

---

## 🔥 Senior Interview Questions

1. You're designing an image-heavy social media app serving users globally. Walk through your CDN strategy — would you use push or pull? How would you handle dynamic content like personalized feeds? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

2. A Pull CDN causes a <abbr title="Thundering herd: when many requests simultaneously trigger a cache miss (e.g., after cache expiry), flooding the origin server with identical requests at once — potentially overwhelming it">thundering herd</abbr> problem when a popular item's cache expires and thousands of requests hit your origin simultaneously. How do you prevent this? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

3. Your CDN cache hit ratio is only 40%. What are the common causes, and how would you systematically improve it to 90%+? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

4. An interviewer asks: "Can you put API responses on a CDN?" Discuss when this makes sense, how you'd handle authentication, personalization, and cache invalidation for dynamic content at the edge. [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

5. Compare CloudFront, Cloudflare, and Akamai. If you were picking a CDN for a video streaming platform serving 50 million users globally, what criteria would you evaluate? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

6. You deploy a bug to production and need to invalidate all cached assets on your CDN immediately. Walk through the trade-offs between cache invalidation, URL versioning (fingerprinting), and short TTLs. [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

7. Your company operates in China, where most Western CDNs don't have PoPs. How do you serve low-latency content to Chinese users while complying with local regulations? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

8. Explain how a CDN edge server decides whether to serve a cached response or fetch from the origin. Walk through the role of Cache-Control headers, <abbr title="ETag (Entity Tag): a unique identifier the server assigns to a specific version of a resource. The client sends it back on the next request; if the content hasn't changed, the server replies with 304 Not Modified (no body needed), saving bandwidth.">ETags</abbr>, and <abbr title="If-Modified-Since: an HTTP header the client sends with the date of the cached version. The server only sends the full content if it has changed since that date; otherwise it returns 304 Not Modified.">If-Modified-Since</abbr>. [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

9. You're using a CDN for both static assets AND as a DDoS shield. The CDN provider has an outage. What happens to your traffic, and how do you design for CDN failure? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

10. Your startup is debating whether to build their own CDN using multi-region object storage (S3 + CloudFront in each region) vs using a third-party CDN. What are the trade-offs in cost, complexity, control, and performance? [Answer](QnA-Answer-Key.md#7-content-delivery-networks)

---

## 📚 Further Reading

- [CDN Architecture & How CDNs Work — Cloudflare Learning](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/) — Comprehensive overview with diagrams.
- [Globally Distributed Content Delivery (Research Paper)](https://figshare.com/articles/Globally_distributed_content_delivery/6605972) — Academic perspective on CDN design.
- [How Netflix Serves Content Globally (YouTube)](https://www.youtube.com/watch?v=tbqcsHg-Q_o) — Netflix's Open Connect CDN architecture explained.
