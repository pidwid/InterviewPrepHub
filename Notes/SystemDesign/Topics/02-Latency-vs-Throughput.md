# Latency vs Throughput

> Two of the most fundamental metrics in system design. Understanding their relationship is essential for making informed trade-offs.

---

## Table of Contents

- [Latency vs Throughput](#latency-vs-throughput)
  - [Table of Contents](#table-of-contents)
  - [1. What is Latency?](#1-what-is-latency)
    - [Everyday Analogy](#everyday-analogy)
    - [In Systems](#in-systems)
    - [Types of Latency](#types-of-latency)
  - [2. What is Throughput?](#2-what-is-throughput)
    - [Everyday Analogy](#everyday-analogy-1)
    - [In Systems](#in-systems-1)
    - [Units of Throughput](#units-of-throughput)
  - [3. The Relationship Between Latency and Throughput](#3-the-relationship-between-latency-and-throughput)
    - [They Are Not Simply Inversions of Each Other](#they-are-not-simply-inversions-of-each-other)
    - [The Pipeline Analogy](#the-pipeline-analogy)
    - [The Goal](#the-goal)
    - [How They Interact](#how-they-interact)
  - [4. Latency Breakdown in a Typical Web Request](#4-latency-breakdown-in-a-typical-web-request)
  - [5. Measuring Latency: Averages vs Percentiles](#5-measuring-latency-averages-vs-percentiles)
    - [Why Averages Are Misleading](#why-averages-are-misleading)
    - [Percentiles Matter](#percentiles-matter)
    - [Why P99 Matters So Much](#why-p99-matters-so-much)
  - [6. Common Latency Numbers](#6-common-latency-numbers)
    - [Key Ratios to Remember](#key-ratios-to-remember)
  - [7. Techniques to Improve Latency](#7-techniques-to-improve-latency)
  - [8. Techniques to Improve Throughput](#8-techniques-to-improve-throughput)
  - [9. Real-World Trade-offs](#9-real-world-trade-offs)
    - [Trade-off 1: Batching (Higher Throughput, Higher Latency)](#trade-off-1-batching-higher-throughput-higher-latency)
    - [Trade-off 2: Caching (Lower Latency, Risk of Stale Data)](#trade-off-2-caching-lower-latency-risk-of-stale-data)
    - [Trade-off 3: Synchronous vs Asynchronous](#trade-off-3-synchronous-vs-asynchronous)
  - [10. Key Takeaways](#10-key-takeaways)
  - [🔥 Senior Interview Questions](#-senior-interview-questions)
  - [📚 Further Reading](#-further-reading)

---

## 1. What is Latency?

**Latency** is the time it takes to perform a single action or produce a single result.

Think of it as the "delay" or "wait time."

### Everyday Analogy

```
You order a coffee.
Latency = the time from placing your order to receiving your coffee.

If the barista takes 3 minutes → latency is 3 minutes.
If the barista takes 30 seconds → latency is 30 seconds.
```

### In Systems

| Scenario | Latency |
|----------|---------|
| Reading from L1 cache | 0.5 nanoseconds |
| Reading from RAM | 100 nanoseconds |
| Reading 1 MB from SSD | 1 millisecond |
| Round-trip within same datacenter | 0.5 milliseconds |
| Round-trip from California to Netherlands | 150 milliseconds |
| Reading 1 MB from HDD | 30 milliseconds |

### Types of Latency

- **Network latency:** Time for data to travel across the network (speed of light + routing)
- **Disk latency:** Time to read/write to storage (SSD vs HDD)
- **Processing latency:** Time spent by the CPU computing the result
- **Queuing latency:** Time spent waiting in a queue before being processed

---

## 2. What is Throughput?

**Throughput** is the number of actions or results per unit of time.

Think of it as the "rate" or "capacity."

### Everyday Analogy

```
A coffee shop can serve 60 coffees per hour.
Throughput = 60 coffees/hour (or 1 coffee/minute).

This is independent of how long each coffee takes — it's about
how many the shop can produce in a given time window.
```

### In Systems

| Scenario | Throughput |
|----------|-----------|
| Web server handling requests | 10,000 requests/second (RPS) |
| Database queries | 50,000 queries/second (QPS) |
| Network pipe | 1 Gbps (gigabits per second) |
| Message queue | 100,000 messages/second |
| Disk I/O | 500 MB/s sequential reads |

### Units of Throughput

- **RPS / QPS:** Requests or Queries Per Second
- **TPS:** Transactions Per Second
- **Bandwidth:** Bits per second (bps, Mbps, Gbps)
- **IOPS:** Input/Output Operations Per Second (for storage)

---

## 3. The Relationship Between Latency and Throughput

These two metrics are **related but not the same thing.**

### They Are Not Simply Inversions of Each Other

```
Naive assumption: Throughput = 1 / Latency
If latency is 10ms, throughput is 100 RPS?

Wrong. This only holds for a SINGLE worker doing things sequentially.

With PARALLELISM, you can have low throughput even with low latency,
or high throughput even with high latency.
```

### The Pipeline Analogy

```
Imagine a factory assembly line:

Latency = time for one car to go from start to finish = 5 hours

But if there are 100 stations and a new car enters every 3 minutes:
Throughput = 20 cars/hour

Latency is HIGH (5 hours per car)
Throughput is also HIGH (20 cars/hour)

Key insight: Parallelism and pipelining decouple latency from throughput.
```

### The Goal

> **Aim for maximum throughput with acceptable latency.**

You don't optimize for one at the expense of the other. You need *enough* throughput to handle your load and *low enough* latency that users don't notice delays.

### How They Interact

```
                         ┌──────────────────────────────────┐
                         │                                  │
  Low Load               │  Latency: Low, Throughput: Low   │
  (few requests)         │  System is fast but underutilized │
                         │                                  │
                         ├──────────────────────────────────┤
                         │                                  │
  Moderate Load          │  Latency: Low, Throughput: High  │
  (sweet spot)           │  ✅ This is where you want to be  │
                         │                                  │
                         ├──────────────────────────────────┤
                         │                                  │
  High Load              │  Latency: HIGH, Throughput: Max  │
  (near capacity)        │  ⚠️ Users start feeling delays    │
                         │                                  │
                         ├──────────────────────────────────┤
                         │                                  │
  Overloaded             │  Latency: VERY HIGH, Throughput  │
                         │  DROPS (queueing, timeouts)      │
                         │  ❌ System is degraded            │
                         └──────────────────────────────────┘
```

The key insight: **as load approaches capacity, latency spikes non-linearly.** This is described by queuing theory (Little's Law).

---

## 4. Latency Breakdown in a Typical Web Request

```
User clicks a button
    │
    ▼  ~1-5ms    DNS lookup (cached)
    │
    ▼  ~10-50ms  TCP connection + TLS handshake
    │
    ▼  ~1-5ms    Request travels over the network
    │
    ▼  ~1-2ms    Load balancer routes request
    │
    ▼  ~5-50ms   Application server processes request
    │  │
    │  ├── ~1ms    Read from cache (Redis)
    │  ├── ~5-50ms Database query
    │  └── ~10ms   Call to external service
    │
    ▼  ~1-5ms    Response travels over the network
    │
    ▼  ~10-200ms Browser renders the page
    │
    Total: ~50-350ms for a typical web page

    User perception:
      < 100ms  → "Instant"
      100-300ms → "Slight delay"
      300ms-1s  → "Noticeable"
      > 1s      → "Slow"
      > 3s      → "User leaves"
```

---

## 5. Measuring Latency: Averages vs Percentiles

### Why Averages Are Misleading

```
10 requests with these latencies:
  50ms, 55ms, 48ms, 52ms, 51ms, 49ms, 53ms, 50ms, 47ms, 5000ms

Average: 545ms  ← Massively skewed by one slow request!
Median (P50): 50.5ms ← What most users experience
P99: 5000ms ← What your slowest 1% of users experience
```

### Percentiles Matter

| Percentile | Meaning | Why It Matters |
|-----------|---------|----------------|
| **P50 (Median)** | Half of requests are faster than this | "Typical" user experience |
| **P90** | 90% of requests are faster | Most users' experience |
| **P95** | 95% of requests are faster | Important for SLAs |
| **P99** | 99% of requests are faster | Your "worst case" for most users |
| **P99.9** | 999 out of 1000 are faster | Critical for high-traffic systems |

### Why P99 Matters So Much

```
If you have 1 million requests/day and your P99 is 5 seconds:
  → 10,000 users PER DAY have a terrible experience.
  → Those users are often your most valuable (heavy users, power users)

Amazon found that every 100ms of latency cost them 1% in sales.
Google found that an extra 500ms in search latency dropped traffic by 20%.
```

---

## 6. Common Latency Numbers

These numbers are essential for back-of-the-envelope calculations:

```
Operation                                    Time
─────────────────────────────────────────────────────
L1 cache reference                           0.5 ns
Branch mispredict                              5 ns
L2 cache reference                             7 ns
Mutex lock/unlock                             25 ns
Main memory (RAM) reference                  100 ns
Compress 1 KB with Zippy/Snappy           10,000 ns      = 10 µs
Send 1 KB over 1 Gbps network             10,000 ns      = 10 µs
Read 4 KB randomly from SSD              150,000 ns      = 150 µs
Read 1 MB sequentially from RAM          250,000 ns      = 250 µs
Round-trip within same datacenter        500,000 ns      = 500 µs
Read 1 MB sequentially from SSD       1,000,000 ns      = 1 ms
HDD seek                             10,000,000 ns      = 10 ms
Read 1 MB sequentially from HDD      30,000,000 ns      = 30 ms
CA → Netherlands → CA round-trip    150,000,000 ns      = 150 ms
```

### Key Ratios to Remember

```
RAM is ~100x faster than SSD for random reads
SSD is ~30x faster than HDD for sequential reads
RAM is ~1000x faster than HDD
Network within datacenter is ~300x faster than cross-continent
```

---

## 7. Techniques to Improve Latency

| Technique | How It Helps | Example |
|-----------|-------------|---------|
| **Caching** | Avoid slow operations by storing results | Redis cache for DB queries |
| **CDN** | Serve content from closer locations | CloudFront for static assets |
| **Connection pooling** | Avoid repeated connection setup | HikariCP for database connections |
| **Async processing** | Don't make the user wait for slow operations | Send email asynchronously |
| **Indexing** | Speed up database lookups | B-tree index on frequently queried columns |
| **Data locality** | Keep related data close together | Co-locate services in same datacenter |
| **Compression** | Reduce amount of data transferred | gzip HTTP responses |
| **Prefetching** | Load data before it's needed | Predictive prefetch in mobile apps |
| **Protocol optimization** | Use faster protocols | HTTP/2 multiplexing, gRPC over REST |

---

## 8. Techniques to Improve Throughput

| Technique | How It Helps | Example |
|-----------|-------------|---------|
| **Horizontal scaling** | More machines = more parallel processing | Add web server instances |
| **Load balancing** | Distribute requests evenly | Nginx, HAProxy, ALB |
| **Batch processing** | Process many items at once | Batch DB inserts instead of one-by-one |
| **Asynchronous processing** | Don't block on slow operations | Message queues (Kafka, SQS) |
| **Database read replicas** | Spread read load across copies | PostgreSQL read replicas |
| **Sharding** | Split data across multiple databases | Shard by user_id |
| **Caching** | Serve more requests from fast storage | Memcached for hot data |
| **Connection multiplexing** | Share connections efficiently | HTTP/2, connection pools |

---

## 9. Real-World Trade-offs

### Trade-off 1: Batching (Higher Throughput, Higher Latency)

```
Without batching:
  Each message sent immediately → Latency: 1ms, Throughput: 1,000 msg/s

With batching (batch of 100):
  Wait until 100 messages accumulate → Latency: 50ms, Throughput: 50,000 msg/s

Kafka uses this approach: it batches messages for higher throughput
at the cost of slightly higher latency.
```

### Trade-off 2: Caching (Lower Latency, Risk of Stale Data)

```
Without cache:
  Every request hits the database → Latency: 50ms, always fresh data

With cache:
  Most requests served from Redis → Latency: 2ms, but data might be
  up to 5 minutes stale (depending on TTL)
```

### Trade-off 3: Synchronous vs Asynchronous

```
Synchronous (user waits):
  User uploads image → resize → store → respond
  Latency: 3 seconds (user waits)
  Throughput: Limited (server is busy for 3s per request)

Asynchronous (user doesn't wait):
  User uploads image → queue resize job → respond immediately
  Latency: 100ms (user sees "processing...")
  Throughput: Much higher (server is free after 100ms)
  Trade-off: Eventual completion, more complex error handling
```

---

## 10. Key Takeaways

1. **Latency** = how long one operation takes. **Throughput** = how many operations per second.

2. **They are related but not inversions:** With parallelism, you can have high throughput AND high latency (assembly line effect).

3. **Goal:** Maximize throughput while keeping latency acceptable. The "acceptable" threshold depends on your use case.

4. **Measure in percentiles (P50, P95, P99),** not averages. Averages hide outliers and give a false sense of your system's behavior.

5. **Under heavy load, latency spikes non-linearly.** Your system might be fine at 70% capacity but fall apart at 85%.

6. **Know your latency numbers.** Memorize the ballpark figures for RAM, SSD, HDD, network. They are essential for back-of-the-envelope estimation in interviews.

7. **Most techniques trade one for the other:** Batching increases throughput but hurts latency. Caching improves latency but risks staleness. Know these trade-offs.

---

## 🔥 Senior Interview Questions

1. Your API has a P50 latency of 50ms but a P99 of 2 seconds. The PM says "average latency is fine." How do you convince them this is a serious problem, and what would you investigate? [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

2. You're choosing between two designs: one optimizes for latency (single powerful node) and the other for throughput (many small workers). How do you decide, and can you have both? [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

3. An upstream team added a synchronous call to another microservice, increasing your tail latency by 200ms. They argue "it's just one call." Explain the compounding effect in a distributed system. [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

4. You're designing a video transcoding pipeline. Should you optimize for latency or throughput? What if the same system must handle both live streams and batch uploads? [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

5. Your database can handle 5,000 QPS, but the application needs 50,000 QPS. Walk through every technique you'd use, and in what order, to bridge that gap. [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

6. How does Little's Law (L = λW) apply to system design? If your service has an average of 100 concurrent requests and each takes 200ms, what is your throughput? What happens if latency doubles? [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

7. An interviewer claims that "adding a cache always improves latency." Present a scenario where adding a cache actually worsens latency or overall system behavior. [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

8. You have two services: Service A has 10ms latency and 10,000 req/s throughput, Service B has 100ms latency and 100,000 req/s. If A calls B for every request, what's the effective latency and throughput of the combined system? [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

9. Your team wants to batch database writes to increase throughput. What impact does this have on latency, durability, and failure recovery? How do you mitigate the downsides? [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

10. Explain the relationship between latency, throughput, and utilization. Why does latency spike exponentially as utilization approaches 100%? Draw the curve and explain the math behind it. [Answer](QnA-Answer-Key.md#2-latency-vs-throughput)

---

## 📚 Further Reading

- [Understanding Latency vs Throughput — Cadence Blog](https://community.cadence.com/cadence_blogs_8/b/fv/posts/understanding-latency-vs-throughput) — Clear breakdown of the fundamental distinction.
- [Latency Numbers Every Programmer Should Know (Interactive)](https://colin-scott.github.io/personal_website/research/interactive_latency.html) — Visualize how latency numbers have changed year over year.
- [Gil Tene: How NOT to Measure Latency (YouTube)](https://www.youtube.com/watch?v=lJ8ydIuPFeU) — Deep dive into why averages lie and why you must measure in percentiles.
