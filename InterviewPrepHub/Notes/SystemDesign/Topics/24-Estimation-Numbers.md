# Estimation & Back-of-the-Envelope Numbers

## Table of Contents

- [Estimation \& Back-of-the-Envelope Numbers](#estimation--back-of-the-envelope-numbers)
  - [Table of Contents](#table-of-contents)
  - [1. Overview](#1-overview)
  - [2. Powers of Two](#2-powers-of-two)
  - [3. Latency Numbers Every Programmer Should Know](#3-latency-numbers-every-programmer-should-know)
    - [Visual Scale](#visual-scale)
  - [4. Storage and Bandwidth Estimates](#4-storage-and-bandwidth-estimates)
    - [Common Data Sizes](#common-data-sizes)
    - [Time Conversions for Estimation](#time-conversions-for-estimation)
    - [QPS to Machine Requirements](#qps-to-machine-requirements)
  - [5. Availability Numbers](#5-availability-numbers)
  - [6. Common System Estimation Formulas](#6-common-system-estimation-formulas)
    - [Storage Estimation](#storage-estimation)
    - [Bandwidth Estimation](#bandwidth-estimation)
    - [QPS Estimation](#qps-estimation)
  - [7. Estimation Walk-Through Examples](#7-estimation-walk-through-examples)
    - [Example 1: URL Shortener](#example-1-url-shortener)
    - [Example 2: Chat Messaging System](#example-2-chat-messaging-system)
    - [Example 3: Video Streaming (YouTube-like)](#example-3-video-streaming-youtube-like)
  - [8. Quick Reference Tables](#8-quick-reference-tables)
    - [Data Size Rules of Thumb](#data-size-rules-of-thumb)
    - [Scale Reference Points (Approximate)](#scale-reference-points-approximate)
  - [9. Key Takeaways](#9-key-takeaways)
    - [Estimation Process for Interviews](#estimation-process-for-interviews)
    - [Golden Rules](#golden-rules)

---

## 1. Overview

Back-of-the-envelope estimation is a critical skill for system design interviews.
You need to quickly estimate scale, storage, bandwidth, and capacity to justify
your design decisions.

The goal is NOT precision — it's getting in the right **order of magnitude**.
Being off by 2x is fine; being off by 100x means your design is wrong.

```
Interviewer: "Design a URL shortener."

Bad answer: "We'll use a database." (No sense of scale.)

Good answer: "If we have 100M URLs created per month, that's ~40 URLs/sec.
             Reads are maybe 100:1, so ~4000 reads/sec. Each URL record
             is about 500 bytes, so 100M × 500 bytes = 50 GB/month of storage.
             Over 5 years, that's ~3 TB. A single PostgreSQL server can handle
             this, but we'd want a read replica for the read load."
```

---

## 2. Powers of Two

Memorize these. They come up constantly in estimation.

```
Power   │ Exact Value        │ Approx.      │ Name        │ Symbol
────────┼────────────────────┼──────────────┼─────────────┼────────
2^10    │ 1,024              │ ~1 Thousand  │ Kilobyte    │ KB
2^20    │ 1,048,576          │ ~1 Million   │ Megabyte    │ MB
2^30    │ 1,073,741,824      │ ~1 Billion   │ Gigabyte    │ GB
2^40    │ 1,099,511,627,776  │ ~1 Trillion  │ Terabyte    │ TB
2^50    │                    │ ~1 Quadrillion│ Petabyte   │ PB

Handy shortcuts:
  2^10 ≈ 10^3  (Thousand)
  2^20 ≈ 10^6  (Million)
  2^30 ≈ 10^9  (Billion)
  2^40 ≈ 10^12 (Trillion)

Character encoding:
  ASCII character  = 1 byte
  UTF-8 character  = 1-4 bytes (English = 1 byte)
  
  UUID (36 chars)  = 36 bytes
  Typical URL      = ~100 bytes
  Typical tweet    = ~300 bytes (with metadata)
  Typical JSON API response = 1-10 KB
  Typical image    = 200 KB - 5 MB
  Typical video (1 min, 720p) = ~50 MB
```

---

## 3. Latency Numbers Every Programmer Should Know

Originally from Jeff Dean (Google), updated for modern hardware (~2024):

```
Operation                                        │ Time          │ Order of Magnitude
─────────────────────────────────────────────────┼───────────────┼──────────────
L1 cache reference                               │ 1 ns          │ nanoseconds
Branch mispredict                                │ 3 ns          │
L2 cache reference                               │ 4 ns          │
Mutex lock/unlock                                │ 17 ns         │
Main memory reference (RAM)                      │ 100 ns        │
─────────────────────────────────────────────────┼───────────────┼──────────────
Compress 1 KB with Snappy                        │ 2,000 ns      │ microseconds
Read 1 MB sequentially from memory               │ 3,000 ns      │ (3 μs)
─────────────────────────────────────────────────┼───────────────┼──────────────
SSD random read                                  │ 16,000 ns     │ (16 μs)
Read 1 MB sequentially from SSD                  │ 49,000 ns     │ (49 μs)
─────────────────────────────────────────────────┼───────────────┼──────────────
Round trip within same datacenter                │ 500,000 ns    │ (0.5 ms)
Read 1 MB sequentially from disk (HDD)           │ 825,000 ns    │ (0.8 ms)
─────────────────────────────────────────────────┼───────────────┼──────────────
Disk seek (HDD)                                  │ 2,000,000 ns  │ milliseconds
                                                 │               │ (2 ms)
─────────────────────────────────────────────────┼───────────────┼──────────────
Send packet CA → Netherlands → CA                │ 150,000,000 ns│ (150 ms)
─────────────────────────────────────────────────┴───────────────┴──────────────

Key insights:
  1. Memory is 100x faster than SSD.
  2. SSD is 50x faster than HDD.
  3. Local network (datacenter) is 300x faster than cross-continent.
  4. Disk seek is 200x slower than sending 1 MB from SSD.
  5. Avoid network calls when you can use local cache.
```

### Visual Scale

```
1 ns   ───│ L1 cache
           │
10 ns  ───│ L2 cache, mutex
           │
100 ns ───│ RAM
           │                    10x slower than RAM
1 μs   ───│
           │
10 μs  ───│ SSD random read    100x slower than RAM
           │
100 μs ───│ SSD sequential MB
           │
1 ms   ───│ Datacenter RTT     10,000x slower than RAM
           │ HDD sequential MB
10 ms  ───│ HDD seek
           │
100 ms ───│ Cross-continent    100,000x slower than RAM
```

---

## 4. Storage and Bandwidth Estimates

### Common Data Sizes

```
Text:
  Tweet (280 chars + metadata)           ≈ 300 bytes
  Email (average, no attachments)        ≈ 50 KB
  Web page (HTML + CSS + JS)             ≈ 2-5 MB
  Book (plain text)                      ≈ 1 MB

Images:
  Thumbnail (100x100)                    ≈ 10 KB
  Photo (compressed JPEG, 1080p)         ≈ 200 KB - 1 MB
  Photo (high-res JPEG)                  ≈ 2-5 MB

Video:
  1 minute, 720p                         ≈ 50 MB
  1 minute, 1080p                        ≈ 130 MB
  1 minute, 4K                           ≈ 350 MB
  1 hour movie (compressed, 1080p)       ≈ 3-5 GB

Audio:
  1 minute, MP3 (128 kbps)              ≈ 1 MB
  1 minute, high quality (320 kbps)     ≈ 2.5 MB

Database rows:
  Simple record (id, name, email)        ≈ 200 bytes
  Rich record (with metadata, JSON)      ≈ 1-5 KB
```

### Time Conversions for Estimation

```
Seconds in a day:    86,400    ≈ ~100K (easy math)
Seconds in a month:  2,592,000 ≈ ~2.5M
Seconds in a year:   31,536,000 ≈ ~30M

Quick conversions:
  1 request/sec   = ~2.5M requests/month
  1000 req/sec    = ~2.5B requests/month
  100 req/sec     = ~250M requests/month
  
  Inverse: X million requests/month ÷ 2.5M ≈ X/2.5 req/sec
    500M requests/month ≈ 200 req/sec
    10B requests/month  ≈ 4,000 req/sec
```

### QPS to Machine Requirements

```
Rough per-server capacity (modern servers):
  Web server (Nginx):          10,000-50,000 req/sec (static)
  Application server:          1,000-10,000 req/sec (depends on logic)
  Database:
    Simple queries:            10,000-50,000 QPS
    Complex queries:           100-1,000 QPS
  Redis (cache):               100,000+ operations/sec
  Kafka (single broker):       100,000+ messages/sec
  Elasticsearch:               1,000-10,000 queries/sec

Example: "We need 10,000 API req/sec for our service."
  If each app server handles ~2,000 req/sec → need ~5 servers.
  Add 2x headroom → 10 servers.
  With an auto-scaler: min=5, max=20.
```

---

## 5. Availability Numbers

```
Nines   │ Availability │ Downtime/Year     │ Downtime/Month   │ Downtime/Day
────────┼──────────────┼───────────────────┼──────────────────┼──────────────
2 nines │ 99%          │ 3.65 days         │ 7.31 hours       │ 14.4 min
3 nines │ 99.9%        │ 8.77 hours        │ 43.83 min        │ 1.44 min
4 nines │ 99.99%       │ 52.60 min         │ 4.38 min         │ 8.64 sec
5 nines │ 99.999%      │ 5.26 min          │ 26.30 sec        │ 864 ms
6 nines │ 99.9999%     │ 31.56 sec         │ 2.63 sec         │ 86.4 ms

Typical targets:
  Internal tools:       99% (2 nines)
  Regular web app:      99.9% (3 nines)
  E-commerce, banking:  99.99% (4 nines)
  Infrastructure (DNS, CDN): 99.999% (5 nines)

Availability math:
  Serial (both must work):   A_total = A_1 × A_2
    99.9% × 99.9% = 99.8%
  
  Parallel (either works):   A_total = 1 - (1 - A_1)(1 - A_2)
    1 - (1 - 0.999)(1 - 0.999) = 1 - 0.000001 = 99.9999%
```

---

## 6. Common System Estimation Formulas

### Storage Estimation

```
Formula: Daily data = Daily active users × Actions per user × Data per action

Example: Instagram-like service
  - 500M daily active users
  - 10% upload a photo per day = 50M photos/day
  - Average photo size = 500 KB
  
  Daily storage = 50M × 500 KB = 25 TB/day
  Monthly = 25 TB × 30 = 750 TB/month
  Yearly = 750 TB × 12 = 9 PB/year
  5-year projection = ~45 PB
  
  With 3x replication = ~135 PB
  This is a LOT → need distributed storage (S3, HDFS)
```

### Bandwidth Estimation

```
Formula: Bandwidth = Data per second = Total daily data ÷ 86,400

Example (continuing Instagram):
  Upload bandwidth = 25 TB/day ÷ 86,400 sec = ~300 MB/sec
  
  Reads are 100:1 → Read bandwidth = 300 MB/sec × 100 = 30 GB/sec
  
  That's 30 GB/sec × 8 = 240 Gbps of read bandwidth.
  A CDN would handle most of this, not your origin servers.
```

### QPS Estimation

```
Formula: QPS = (DAU × Queries per user per day) ÷ 86,400

Example: Twitter-like service
  - 300M DAU
  - Each user views 100 tweets/day (read-heavy)
  
  Read QPS = 300M × 100 ÷ 86,400 ≈ 350,000 req/sec
  Peak QPS = 2-5x average = ~1M req/sec
  
  Write QPS (tweets created):
  - 5% of users tweet, averaging 2 tweets/day
  - 300M × 0.05 × 2 ÷ 86,400 ≈ 350 tweets/sec
  
  Read:Write ratio = 350,000:350 = 1000:1
  → This is extremely read-heavy → heavy caching, CDN, read replicas
```

---

## 7. Estimation Walk-Through Examples

### Example 1: URL Shortener

```
Requirements:
  - 100M new short URLs per month
  - 10:1 read-to-write ratio

Write QPS:
  100M ÷ (30 × 86,400) ≈ 40 writes/sec
  Peak: ~80 writes/sec

Read QPS:
  40 × 10 = 400 reads/sec
  Peak: ~800 reads/sec

Storage (per URL record):
  short_url (7 chars):  7 bytes
  long_url (avg 200):   200 bytes
  created_at:           8 bytes
  user_id:              8 bytes
  Total per record:     ~250 bytes
  
  Monthly: 100M × 250 bytes = 25 GB/month
  5 years: 25 GB × 60 = 1.5 TB
  
  → Single PostgreSQL can handle this easily.

Cache:
  Follow 80-20 rule (20% of URLs get 80% of traffic).
  Cache top 20%: 100M × 0.2 × 250 bytes = 5 GB
  → Fits in a single Redis instance.

Conclusion: A URL shortener is NOT a scale problem.
  1 app server + 1 database + 1 Redis cache is sufficient.
  Add replicas for availability, not for scale.
```

### Example 2: Chat Messaging System

```
Requirements:
  - 50M daily active users
  - Each user sends 40 messages/day
  - Average message size: 200 bytes

Messages per day:
  50M × 40 = 2B messages/day

Write QPS:
  2B ÷ 86,400 ≈ 23,000 messages/sec
  Peak: ~70,000/sec
  → Need a distributed database (Cassandra, ScyllaDB)

Storage per day:
  2B × 200 bytes = 400 GB/day
  Monthly: 12 TB
  Yearly: 144 TB
  With metadata + indexes: ~200 TB/year
  
  → Need distributed storage and data tiering
    (hot data in fast storage, old messages in cold storage)

Concurrent WebSocket connections:
  50M DAU, maybe 30% online at peak = 15M connections
  Each WebSocket server handles ~50K connections
  Need: 15M ÷ 50K = 300 WebSocket servers
  
  → This is the real challenge: managing millions of persistent connections
```

### Example 3: Video Streaming (YouTube-like)

```
Requirements:
  - 1B DAU
  - Average user watches 5 videos/day
  - Average video length: 5 minutes
  - Average video size (compressed, 720p): 50 MB/min

Total daily video views:
  1B × 5 = 5B views/day

Total daily data served:
  5B × 5 min × 50 MB/min = wait, not all are 720p.
  Average served size per view ≈ 100 MB (mixed quality)
  5B × 100 MB = 500 PB/day = ~5.8 GB/sec
  
  Peak: ~15 GB/sec = 120 Gbps
  → Must use CDN. No way to serve this from origin.

Video uploads:
  0.01% of users upload 1 video/day = 100K videos/day
  Average raw upload: 500 MB
  Daily upload: 100K × 500 MB = 50 TB/day
  Need to transcode each video to 5 resolutions → 250 TB/day after processing
  
  Yearly storage: 250 TB × 365 = ~91 PB/year
  → Object storage (S3) with CDN distribution

Upload QPS:
  100K ÷ 86,400 ≈ 1.2 uploads/sec (not a QPS problem)
  But each upload triggers transcoding (CPU-intensive, minutes per video)
  100K videos × 5 resolutions = 500K transcoding jobs/day
  → Need a task queue (SQS, Kafka) + auto-scaling transcoding workers
```

---

## 8. Quick Reference Tables

### Data Size Rules of Thumb

```
1 character (ASCII)            = 1 byte
1 integer (32-bit)             = 4 bytes
1 long integer (64-bit)        = 8 bytes
1 timestamp (64-bit)           = 8 bytes
1 UUID                         = 16 bytes (binary) / 36 bytes (string)
Average URL                    = 100 bytes
Average tweet                  = 300 bytes
Average database row           = 200 bytes - 1 KB
Average JSON API response      = 1-10 KB
Average compressed image       = 200 KB - 1 MB
1 minute video (720p)          = 50 MB
```

### Scale Reference Points (Approximate)

```
Service      │ DAU       │ Requests/day │ Storage
─────────────┼───────────┼──────────────┼────────────
Small app    │ 10K       │ 1M           │ 10 GB
Medium app   │ 1M        │ 100M         │ 1 TB
Large app    │ 100M      │ 10B          │ 100 TB
Massive      │ 1B+       │ 1T           │ PB scale

Server limits (rough, per machine):
  Memory:      64 - 512 GB
  SSD:         1 - 10 TB
  CPU cores:   8 - 128
  Network:     10 - 100 Gbps
  
  Web server (static):    10K - 50K req/sec
  App server (dynamic):   1K - 10K req/sec
  DB server (simple):     10K - 50K QPS
  DB server (complex):    100 - 1K QPS
  Redis:                  100K+ ops/sec
  Kafka broker:           100K+ msgs/sec
```

---

## 9. Key Takeaways

### Estimation Process for Interviews

```
Step 1: Clarify requirements
  "How many users? How many requests per day?"

Step 2: Define the scale
  DAU → QPS (÷ 86,400) → Peak QPS (×2-5)
  
Step 3: Estimate storage
  Users × Data per user × Retention period
  
Step 4: Estimate bandwidth
  Storage per day ÷ 86,400 = bandwidth per second
  
Step 5: Determine machines needed
  QPS ÷ per-server capacity = number of servers
  
Step 6: Sanity check
  "Does this number make sense? Is this a TB or PB problem?"
```

### Golden Rules

1. **Round aggressively.** Use 10^3, 10^6, 10^9. Nobody cares about 2.592M vs 2.5M.
2. **Know the key conversions.** Seconds in a day ≈ 100K. Seconds in a month ≈ 2.5M.
3. **Memorize latency numbers.** RAM = 100ns, SSD = 16μs, datacenter = 500μs, cross-continent = 150ms.
4. **2x-5x for peaks.** Always estimate peak as 2-5x the average.
5. **80/20 rule for caching.** 20% of data serves 80% of traffic.
6. **3x for replication.** Storage usually needs 3x for redundancy.
7. **Read:write ratio drives architecture.** 100:1 = caching + read replicas.
   1:1 = distributed writes. Know your ratio.
8. **Show your work.** The process matters more than the answer.

---

## 🔥 Senior Interview Questions

1. Estimate the storage needed for Twitter: 500 million tweets/day, average tweet = 280 chars + metadata (user ID, timestamp, location). Include media storage (10% of tweets have images, 1% have video). Calculate daily, monthly, and 5-year storage. [Answer](QnA-Answer-Key.md#24-estimation--numbers)

2. An interviewer asks: "How many servers do you need to serve 1 billion daily active users?" Walk through the estimation: average requests per user, peak QPS (2-5x average), QPS per server, and the impact of caching on reducing server count. [Answer](QnA-Answer-Key.md#24-estimation--numbers)

3. Estimate the bandwidth required for YouTube: 1 billion video views per day, average video = 5 minutes at 720p (~50MB). What's the peak bandwidth in Gbps? How does a CDN reduce origin bandwidth? [Answer](QnA-Answer-Key.md#24-estimation--numbers)

4. Your interviewer asks: "Design the cache for Instagram's home feed." Estimate: 500 million DAU, each feed = 50 posts, each post = 1KB metadata. How much memory do you need? Should you cache everyone's feed or only active users? [Answer](QnA-Answer-Key.md#24-estimation--numbers)

5. You're designing a URL shortener that needs to generate 1 billion unique short URLs over 10 years. How many characters do you need if using Base62 (a-z, A-Z, 0-9)? Calculate the keyspace and discuss collision probability. [Answer](QnA-Answer-Key.md#24-estimation--numbers)

6. Estimate the QPS for a payment processing system during Black Friday: 100 million transactions in 24 hours, but 50% happen in a 2-hour window. What's the peak QPS? How does this inform your database choice and scaling strategy? [Answer](QnA-Answer-Key.md#24-estimation--numbers)

7. Your chat application needs to store message history. 100 million users send an average of 40 messages/day, average message size = 100 bytes. How much storage per day, per year? Compare storing in Cassandra vs PostgreSQL at this scale. [Answer](QnA-Answer-Key.md#24-estimation--numbers)

8. An interviewer shows you that a system has 10ms average latency, 100ms P99 latency, and 10,000 QPS. Using Little's Law, how many requests are in-flight at any time on average? At P99? How does this inform your thread pool sizing? [Answer](QnA-Answer-Key.md#24-estimation--numbers)

9. Estimate how much RAM you need for a Redis cache that stores 100 million user profiles, each ~500 bytes. Account for Redis overhead (pointers, metadata — roughly 2x raw data size). Would you use a single instance or a cluster? [Answer](QnA-Answer-Key.md#24-estimation--numbers)

10. You're told: "Our system handles 1 million events per second." Is this impressive? Put it in context — compare it to Kafka's throughput limits per partition (~10K-100K msg/sec), and calculate how many partitions and brokers you'd need. [Answer](QnA-Answer-Key.md#24-estimation--numbers)

---

## 📚 Further Reading

- [Back-of-the-Envelope Estimation (ByteByteGo, YouTube)](https://www.youtube.com/watch?v=UC5xf8FbdJc) — Step-by-step walkthrough of estimation in system design interviews.
- [Google Pro Tip: Use Back-of-the-Envelope Calculations (High Scalability)](http://highscalability.com/blog/2011/1/26/google-pro-tip-use-back-of-the-envelope-calculations-to-choo.html) — Jeff Dean's approach to estimation.
- [Latency Numbers Every Programmer Should Know (Jeff Dean)](https://gist.github.com/jboner/2841832) — The famous latency numbers reference card.
