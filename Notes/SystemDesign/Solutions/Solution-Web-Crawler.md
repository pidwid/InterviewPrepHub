# Design a Web Crawler

A web crawler (spider/bot) systematically browses the internet, downloading web pages for purposes like search engine indexing, web archiving, data mining, or monitoring. Google's crawler (Googlebot) indexes billions of pages. The design focuses on scalability, politeness, robustness, and extensibility.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What is the main purpose of this crawler?  
**Interviewer:** Search engine indexing — crawl the web and store page content for later indexing.

**Candidate:** How many pages should we crawl per month?  
**Interviewer:** 1 billion pages per month.

**Candidate:** What content types do we handle?  
**Interviewer:** HTML only. Ignore images, videos, PDFs for now.

**Candidate:** Do we need to handle JavaScript-rendered pages?  
**Interviewer:** No, just static HTML.

**Candidate:** Should we respect robots.txt?  
**Interviewer:** Yes, and be polite — don't overload servers.

**Candidate:** How do we handle duplicate content?  
**Interviewer:** Detect and skip duplicates.

### Functional Requirements

- Given a set of seed URLs, crawl all reachable web pages
- Download and store HTML content
- Extract URLs from pages and add them to the crawl queue
- Handle duplicates (same URL or same content)
- Respect robots.txt rules

### Non-Functional Requirements

- **Scalability:** 1 billion pages/month
- **Politeness:** Don't overwhelm any single web server
- **Robustness:** Handle malformed HTML, server errors, traps (infinite loops)
- **Extensibility:** Easy to add new content types, processing steps
- **Priority:** Important pages should be crawled first

### Back-of-the-Envelope Estimation

- **Pages:** 1B pages/month = ~400 pages/sec
- **Peak:** 2× = ~800 pages/sec
- **Average page size:** 500 KB (HTML)
- **Storage:** 1B × 500 KB = 500 TB/month
- **Network:** 400 × 500 KB = 200 MB/s sustained bandwidth
- **URLs to store:** ~10B unique URLs (many discovered, not all crawled)
- **URL storage:** 10B × 100 bytes/URL = 1 TB for URL frontier

---

## Step 2 — High-Level Design

### Crawler Workflow

The classic web crawler follows a loop:

```
1. Pick URL from frontier (priority queue)
2. Check if URL was already crawled (URL dedup)
3. Fetch robots.txt for the domain (cached)
4. Check if URL is allowed by robots.txt
5. Download the HTML page (HTTP GET)
6. Detect if content is duplicate (content dedup)
7. Parse HTML, extract new URLs
8. Add new URLs to frontier
9. Store page content
10. Repeat
```

### High-Level Architecture

```
                    Seed URLs
                        │
                        ▼
                ┌───────────────┐
                │  URL Frontier │  (Priority Queue)
                │  (To Crawl)   │
                └───────┬───────┘
                        │
                   ┌────▼────┐
                   │  URL    │
                   │  Dedup  │◀── URL Store (Bloom Filter + DB)
                   └────┬────┘
                        │ (new URLs only)
                   ┌────▼────────────┐
                   │  Robots.txt    │
                   │  Filter        │◀── robots.txt Cache
                   └────┬───────────┘
                        │ (allowed URLs only)
                   ┌────▼────┐
                   │  HTML   │
                   │ Fetcher │──── DNS Resolver (cached)
                   └────┬────┘
                        │
                   ┌────▼──────┐
                   │  Content  │
                   │  Dedup    │◀── Content Fingerprint Store
                   └────┬──────┘
                        │ (unique content only)
                   ┌────▼────┐     ┌────────────┐
                   │  HTML   │────▶│  URL       │──▶ back to Frontier
                   │  Parser │     │  Extractor │
                   └────┬────┘     └────────────┘
                        │
                   ┌────▼──────┐
                   │  Content  │
                   │  Store    │ (S3 / HDFS)
                   └───────────┘
```

---

## Step 3 — Design Deep Dive

### URL Frontier (Priority Queue)

The frontier is the most critical component. It's not just a simple queue — it must handle **prioritization** and **politeness**.

```
URL Frontier
├── Priority Module (what to crawl first)
│   ├── Queue 1: High priority (popular domains, frequently updated)
│   ├── Queue 2: Medium priority
│   └── Queue 3: Low priority
│
└── Politeness Module (how to crawl without overwhelming hosts)
    ├── Per-domain queue: example.com → [url1, url2, url3]
    ├── Per-domain queue: github.com → [url4, url5]
    └── Rate limiter: max 1 request/sec per domain
```

#### Priority Assignment

```
Priority factors:
  - PageRank of the URL (link analysis)
  - Domain authority (alexa rank, backlinks)
  - Page freshness (how often it changes)
  - Content type (homepage > deep pages)
  - Update frequency (news sites > static sites)

Implementation:
  - Multiple priority queues (high, medium, low)
  - Prioritizer assigns each URL to a queue
  - Workers pull from high-priority queue first
```

#### Politeness (Per-Host Rate Limiting)

```
Problem: Crawling 100 URLs from example.com in 1 second = DDoS
Solution: Per-host queues with rate limiting

┌─────────────────────────────────────────┐
│  Politeness Module                       │
│                                          │
│  example.com  → [url1, url2, url3]      │
│                  rate: 1 req / 2 sec     │
│                                          │
│  github.com   → [url4, url5]            │
│                  rate: 1 req / 1 sec     │
│                                          │
│  news.com     → [url6]                  │
│                  rate: 1 req / 5 sec     │
│                                          │
│  Worker picks next available domain     │
│  that hasn't been hit recently          │
└─────────────────────────────────────────┘
```

### HTML Fetcher

```
For each URL:
1. Resolve DNS (use DNS cache — TTL ~1 hour)
2. Establish TCP connection (connection pooling per host)
3. Send HTTP GET request
   - Set User-Agent: "MyBot/1.0 (+http://mybot.com/info)"
   - Set Accept: text/html
   - Handle redirects (max 5 hops)
4. Read response
   - Timeout: 30 seconds
   - Max size: 10 MB (drop if larger)
5. Handle errors:
   - 2xx → process content
   - 301/302 → follow redirect, add new URL to frontier
   - 403 → skip (blocked by server)
   - 404 → skip (not found)
   - 429 → back off, re-queue with delay
   - 5xx → retry with exponential backoff (max 3 retries)
```

**DNS Caching:**
```
DNS resolution is a bottleneck (each lookup ~10-200ms)
Solution:
  - Local DNS cache (in-memory, TTL-based)
  - DNS prefetching for queued URLs
  - Custom DNS resolver with caching layer
```

### URL Deduplication

We must avoid crawling the same URL twice:

```
Approach 1: Hash Set (Exact Match)
  - SHA-256 hash of normalized URL
  - Store in disk-backed hash table
  - 10B URLs × 32 bytes = 320 GB → fits in distributed hash table

Approach 2: Bloom Filter (Probabilistic)
  - Space-efficient: 10B URLs at 1% FPR ≈ 12 GB
  - False positive = skip a URL we haven't seen (acceptable)
  - False negative = impossible (never crawl a seen URL twice)
  - Combine with exact check on match for critical URLs

URL Normalization (before hashing):
  1. Lowercase the scheme and host: HTTP://Example.COM → http://example.com
  2. Remove default port: http://example.com:80 → http://example.com
  3. Remove fragment: http://example.com/page#section → http://example.com/page
  4. Sort query parameters: ?b=2&a=1 → ?a=1&b=2
  5. Remove trailing slash: http://example.com/path/ → http://example.com/path
  6. Decode percent-encoding: %7E → ~
```

### Content Deduplication

Different URLs can serve the same content (mirrors, syndication, URL variations):

```
Approach: SimHash / MinHash (Locality-Sensitive Hashing)

For each page:
1. Extract text content (strip HTML tags)
2. Compute SimHash (64-bit fingerprint)
3. Compare with existing fingerprints:
   - Hamming distance ≤ 3 → duplicate → skip
   - Hamming distance > 3 → unique → store

SimHash properties:
  - Similar documents → similar hashes
  - Unlike cryptographic hashes where 1-bit change = completely different hash
  - Can detect near-duplicates (not just exact matches)

Storage: 10B × 8 bytes = 80 GB → fits in memory across cluster
```

### Crawler Trap Detection

Web crawlers can get stuck in infinite loops:

```
Traps:
  - Infinite calendars: /calendar?date=2024-01-01, /calendar?date=2024-01-02, ...
  - Session IDs in URLs: /page?sid=abc123, /page?sid=def456
  - Dynamic content: infinite pagination
  - Symbolic link loops in directory listings

Defenses:
  1. Max URL length: ignore URLs > 2000 characters
  2. Max depth: stop following links after depth 15 from seed
  3. Max pages per domain: cap at 100K pages per domain per crawl cycle
  4. URL pattern detection: detect repeating path segments
  5. Manual blacklist: known trap domains
```

### Distributed Crawler Architecture

A single machine can't crawl 1B pages/month. We need a distributed system:

```
┌────────────────────────────────────────────┐
│              Coordinator                    │
│   (Assigns URL batches to workers)         │
└─────────────────┬──────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Worker 1 │ │Worker 2 │ │Worker N │  (100+ workers)
│         │ │         │ │         │
│ Fetcher │ │ Fetcher │ │ Fetcher │
│ Parser  │ │ Parser  │ │ Parser  │
│ Dedup   │ │ Dedup   │ │ Dedup   │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     ▼           ▼           ▼
┌──────────────────────────────────┐
│  Shared Services                  │
│  - URL Frontier (Redis/Kafka)     │
│  - URL Store (Cassandra)          │
│  - Content Store (S3/HDFS)        │
│  - Bloom Filter (Redis)           │
│  - DNS Cache (local + shared)     │
└──────────────────────────────────┘
```

**Domain-based partitioning:**
- Assign domains to workers: Worker 1 handles *.com domains A-F, etc.
- This ensures per-domain queuing and politeness happens within one worker
- Use consistent hashing to distribute domains to workers

### Robots.txt Handling

```
Before crawling any URL on a domain:
1. Check if robots.txt for that domain is cached
2. If not cached → fetch http://domain.com/robots.txt
3. Parse rules:
   User-agent: *
   Disallow: /admin/
   Disallow: /private/
   Crawl-delay: 10

4. Cache the parsed rules (TTL: 24 hours)
5. For each URL, check against rules before fetching

Storage: ~500M domains × 1 KB avg rules = 500 GB
Cache: top 10M domains in Redis = 10 GB
```

### Re-crawling Strategy

The web changes constantly — we need to re-crawl pages:

```
Strategy: Adaptive recrawl frequency
  - Track change rate per URL (compare content hashes)
  - Frequently changing pages (news) → recrawl every hour
  - Rarely changing pages (static) → recrawl every month
  - Use exponential backoff for unchanged pages

Prioritize recrawling:
  - High PageRank pages
  - Pages that change frequently
  - Pages with many inbound links
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
Seeds → URL Frontier (Priority + Politeness)
           │
     URL Dedup (Bloom Filter)
           │
     Robots.txt Check (Cached)
           │
     DNS Resolution (Cached)
           │
     HTTP Fetcher (Connection Pooling, Retries)
           │
     Content Dedup (SimHash)
           │
     ┌─────┴─────┐
     ▼           ▼
  HTML Parser  Content Store (S3)
     │
  URL Extractor → Normalize → back to Frontier
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL dedup | Bloom filter + DB | Space-efficient, no false negatives |
| Content dedup | SimHash | Detects near-duplicates, not just exact |
| Frontier | Priority + politeness queues | Crawl important pages first, don't DDoS |
| Distribution | Domain-based partitioning | Natural politeness boundary |
| Storage | S3/HDFS for content | Cheap, durable, handles 500 TB/month |
| Re-crawl | Adaptive frequency | Save resources on static pages |

### Additional Talking Points

- **Multi-region crawling** — Deploy crawlers close to target servers (US crawler for .com, EU crawler for .eu)
- **JavaScript rendering** — Use headless Chrome/Puppeteer for JS-heavy sites (10× slower, use selectively)
- **Deep web crawling** — Form submission, API crawling for content behind search forms
- **Link analysis** — Compute PageRank from crawled link graph for search ranking
- **Legal compliance** — Respect robots.txt, handle DMCA takedowns, GDPR considerations
- **Monitoring** — Track crawl rate, error rate, queue depth, content freshness metrics
- **Checkpointing** — Snapshot frontier state periodically for crash recovery
