# 🎯 System Design Interview — Q&A Answer Key

> **240 questions across 24 topics with detailed answers.**
> Each question links back to the topic file for context.
> Use this as a self-test: cover the answers, try answering, then check.

---

## Table of Contents

- [🎯 System Design Interview — Q\&A Answer Key](#-system-design-interview--qa-answer-key)
  - [Table of Contents](#table-of-contents)
  - [1. Performance vs Scalability](#1-performance-vs-scalability)
  - [2. Latency vs Throughput](#2-latency-vs-throughput)
  - [3. Availability vs Consistency](#3-availability-vs-consistency)
  - [4. Consistency Patterns](#4-consistency-patterns)
  - [5. Availability Patterns](#5-availability-patterns)
  - [6. Domain Name System](#6-domain-name-system)
  - [7. Content Delivery Networks](#7-content-delivery-networks)
  - [8. Load Balancers](#8-load-balancers)
  - [9. Reverse Proxy](#9-reverse-proxy)
  - [10. Application Layer](#10-application-layer)
  - [11. Databases](#11-databases)
  - [12. Caching](#12-caching)
  - [13. Asynchronism](#13-asynchronism)
  - [14. Communication Protocols](#14-communication-protocols)
  - [15. API Design](#15-api-design)
  - [16. Security](#16-security)
  - [17. Rate Limiting](#17-rate-limiting)
  - [18. Distributed Systems](#18-distributed-systems)
  - [19. Event-Driven Architecture](#19-event-driven-architecture)
  - [20. Observability](#20-observability)
  - [21. Data Pipelines](#21-data-pipelines)
  - [22. Containers \& Orchestration](#22-containers--orchestration)
  - [23. Networking Deep Dive](#23-networking-deep-dive)
  - [24. Estimation \& Numbers](#24-estimation--numbers)

---

## 1. Performance vs Scalability
[← Back to topic](01-Performance-vs-Scalability.md#-senior-interview-questions)

**Q1. Your application is performant for a single user but degrades significantly under load — is this a performance problem or a scalability problem? How would you diagnose and fix it?**

**A:** This is a **scalability problem**, not a performance problem. Performance means single-user speed; scalability means maintaining that performance as load grows.

**Diagnosis:**
- Profile under load (not in isolation) using load testing tools (k6, Locust)
- Check for shared resources becoming bottlenecks: database connections, locks, shared memory
- Look for O(n) or worse algorithms that grow with concurrent users
- Monitor CPU, memory, I/O, and network under increasing load

**Fixes:** Connection pooling, read replicas, caching hot paths, async offloading of heavy work, horizontal scaling of stateless tiers, partitioning stateful tiers.

---

**Q2. A VP argues that the team should scale vertically by buying bigger machines rather than investing in horizontal scaling. What are your counter-arguments, and when might they actually be right?**

**A:** 

**Counter-arguments for horizontal scaling:**
- Vertical has a hard ceiling (biggest machine available)
- Single machine = single point of failure
- Cost scales super-linearly (a 2x bigger machine costs >2x)
- No geographic distribution possible

**When vertical is actually right:**
- Early-stage startup (simpler ops, faster iteration)
- Workloads that are hard to parallelize (single-threaded DB writes)
- When team lacks distributed systems expertise
- When current load fits on one machine with headroom (premature horizontal scaling adds complexity)

**Rule of thumb:** Scale vertically until it hurts, then scale horizontally.

---

**Q3. You have a stateful monolithic application. Walk me through the steps to make it horizontally scalable without a full rewrite.**

**A:**

1. **Externalize session state** — Move sessions from in-memory to Redis/Memcached so any server can handle any user
2. **Externalize file storage** — Move uploaded files from local disk to S3/object storage
3. **Database connection pooling** — Use PgBouncer or similar to share DB connections across instances
4. **Sticky sessions as a bridge** — Use load balancer affinity while migrating state out
5. **Separate read/write paths** — Add read replicas for query-heavy workloads
6. **Extract background jobs** — Move cron/background work to a job queue (Sidekiq, Celery)
7. **Add a load balancer** — Put instances behind an LB, health check each one
8. **Stateless app tier** — Once all state is externalized, add/remove instances freely

---

**Q4. Your service latency is fine at P50 but terrible at P99 under load. Is this a performance issue, a scalability issue, or both? How do you approach it?**

**A:** It's **both**. Good P50 means the common path is fast (performance OK). Bad P99 under load means tail latency degrades with concurrency (scalability problem).

**Common causes of tail latency under load:**
- **GC pauses** — JVM/Go stop-the-world events hit a few requests
- **Lock contention** — Shared resources serialize requests under load
- **Noisy neighbors** — Shared infrastructure (VM, DB) with bursty co-tenants
- **Head-of-line blocking** — A slow request blocks others in a queue
- **Resource exhaustion** — Thread pools, connection pools maxed out → queuing

**Approach:** Measure P99 with distributed tracing. Identify if it's consistent (same endpoint) or random (infrastructure). Use hedged requests, circuit breakers, and isolate slow paths.

---

**Q5. How would you decide between adding more read replicas vs. introducing a caching layer when your database reads are the bottleneck?**

**A:**

| Factor | Read Replicas | Caching (Redis) |
|--------|--------------|-----------------|
| Data freshness | Seconds of lag | TTL-dependent, can be stale |
| Query flexibility | Full SQL support | Key-value lookups |
| Cost | Full DB copies | Just hot data in memory |
| Complexity | Replication lag handling | Cache invalidation |
| Best for | Complex queries, reports | Hot keys, simple lookups |

**Decision framework:**
- **Cache first** if: read pattern has clear hot keys (80/20 rule), data can tolerate staleness, simple lookups
- **Replicas first** if: queries are complex/varied, need full SQL, data must be fresh, analytics workloads
- **Both** if: high scale — cache for hot path, replicas for long-tail queries

---

**Q6. An interviewer says "Just add more servers." Why is that not always the correct answer? What are the hidden costs of horizontal scaling?**

**A:**

**Hidden costs:**
1. **Data consistency** — More nodes = harder to keep data in sync
2. **Operational complexity** — Deployment, monitoring, debugging across N servers
3. **Network overhead** — Inter-node communication adds latency
4. **Stateful services can't just add nodes** — Databases need sharding, which is complex
5. **Diminishing returns** — Amdahl's Law: serial portions limit parallel speedup
6. **Cost isn't linear** — Load balancers, service mesh, more complex CI/CD
7. **Thundering herd** — More servers can amplify downstream pressure on shared resources

**Key insight:** Adding servers only helps if the bottleneck is in the stateless compute layer. If the bottleneck is the database, network, or a shared lock, more app servers just move the problem.

---

**Q7. You're designing a system that must handle 10x traffic spikes during flash sales. Would you pre-provision capacity or use auto-scaling? Discuss the trade-offs.**

**A:**

| Approach | Pros | Cons |
|----------|------|------|
| **Pre-provision** | Instant capacity, no cold start | Expensive idle resources 99% of the time |
| **Auto-scale** | Cost-efficient, pay for what you use | 2-5 min lag to scale up, potential errors during ramp |
| **Hybrid** | Best of both: baseline + elastic | More complex configuration |

**Best approach: Hybrid.**
- Pre-provision baseline capacity for expected peak (e.g., 3x normal)
- Auto-scale for unexpected spikes beyond that
- Use queue-based load leveling to buffer requests during scaling
- Pre-warm caches before the sale
- Load test at 10x to validate the scaling plan

---

**Q8. Your team claims the system "scales linearly." How would you verify this claim, and what factors typically cause sub-linear or even negative scaling?**

**A:**

**Verification:** Run load tests at 1x, 2x, 4x, 8x, 16x load. Plot throughput vs resources. Linear = doubling resources doubles throughput.

**Causes of sub-linear scaling:**
- **Shared resources** — Single database, single lock, shared disk
- **Coordination overhead** — Distributed locks, consensus protocols
- **Serialization points** — Amdahl's Law (if 10% is serial, max speedup = 10x)
- **Network saturation** — More nodes = more cross-node traffic

**Negative scaling (adding resources makes it worse):**
- Lock convoy — More threads contending on the same lock
- Cache thrashing — More nodes invalidating each other's caches
- Connection storm — Too many connections to a database

---

**Q9. A colleague proposes caching everything to solve scalability problems. What are the risks, and how can aggressive caching actually harm scalability?**

**A:**

**Risks of caching everything:**
1. **Stale data** — Users see outdated information, leading to bugs or bad decisions
2. **Memory pressure** — Cache grows unbounded → evictions → cache misses spike
3. **Cold start problem** — After a restart, cache is empty → all traffic hits DB → DB crashes
4. **Cache invalidation complexity** — "Only two hard things in CS…"
5. **Thundering herd** — Popular cached item expires → hundreds of requests hit DB simultaneously
6. **False sense of scale** — Cache masks the real bottleneck. When cache fails, the system fails

**When caching harms scalability:** If cache hit ratio is low (<80%), the overhead of checking cache + miss + DB read is worse than just reading from DB directly.

---

**Q10. You're designing for a startup that currently has 1,000 users but expects to grow to 10 million. How do you balance "build for today" vs "architect for tomorrow"?**

**A:**

**Build for today, architect for tomorrow** means:
- **Today:** Monolith, single DB, simple deployment. Fast iteration wins.
- **Architect:** Make decisions that don't box you in:
  - Stateless app tier (easy to scale later)
  - External session storage from day one
  - Clean API boundaries between modules (easy to split later)
  - Use managed services (RDS, S3) that scale without re-architecture

**Avoid:**
- Premature sharding, microservices for 5 engineers, multi-region before 1 region works
- Building your own infra when cloud services exist

**Key milestones to plan for:**
- 10K users: Single server + CDN is fine
- 100K users: Read replicas + caching
- 1M users: Horizontal app scaling, consider service extraction
- 10M users: Sharding, dedicated services, multi-AZ

---

## 2. Latency vs Throughput
[← Back to topic](02-Latency-vs-Throughput.md#-senior-interview-questions)

**Q1. Your API has a P50 latency of 50ms but a P99 of 2 seconds. The PM says "average latency is fine." How do you convince them this is a serious problem, and what would you investigate?**

**A:**

**Why it matters (business case):**
- P99 = 2s means 1 in 100 requests takes 2+ seconds
- At 1M requests/day, that's 10,000 users with terrible experience daily
- Power users make more requests → they're disproportionately affected
- In a microservices call chain, P99s compound: 5 services each at P99=2s → some requests take 10s

**Investigation:**
1. Check if P99 correlates with specific endpoints, users, or times
2. Look for GC pauses (JVM heap pressure)
3. Database slow queries (missing indexes, lock contention)
4. Connection pool exhaustion (waiting for a connection)
5. External dependency timeouts (third-party APIs)
6. Infrastructure: noisy neighbors, disk I/O spikes

---

**Q2. You're choosing between two designs: one optimizes for latency (single powerful node) and the other for throughput (many small workers). How do you decide, and can you have both?**

**A:**

**Choose latency optimization when:**
- User-facing requests (API responses, page loads)
- Real-time systems (trading, gaming)
- Each request is independent and latency-sensitive

**Choose throughput optimization when:**
- Batch processing (ETL, video transcoding)
- Background jobs (email sending, report generation)
- Total work completed matters more than individual speed

**Having both:** Use a tiered architecture:
- **Hot path** (latency): Optimized single-machine processing, caching, in-memory computation
- **Cold path** (throughput): Worker pools, message queues, batch processing
- Example: Serve search results from cache (low latency) while indexing new documents in batch (high throughput)

---

**Q3. An upstream team added a synchronous call to another microservice, increasing your tail latency by 200ms. They argue "it's just one call." Explain the compounding effect in a distributed system.**

**A:**

**The compounding problem:**
- If your service calls 5 downstream services, total latency = max(all call latencies), not sum — but only if calls are parallel
- If calls are serial: each added call adds directly to latency
- **Fan-out amplification:** If your endpoint serves 1000 req/s, that one "small" call = 1000 additional req/s to the downstream service
- **Tail latency amplification:** At P99, if any one of N calls is slow, the whole request is slow. P(at least one slow) = 1 - (1 - 0.01)^N. With N=5: ~5% of requests hit a slow downstream

**Solutions:**
- Make it async if the result isn't needed for the response
- Set aggressive timeouts with fallback/default values
- Cache the downstream response if it's stable
- Use circuit breakers to prevent cascade failures

---

**Q4. You're designing a video transcoding pipeline. Should you optimize for latency or throughput? What if the same system must handle both live streams and batch uploads?**

**A:**

- **Live streams → Latency.** Users expect <5 second delay. Segment-based transcoding, hardware encoders, prioritized queues.
- **Batch uploads → Throughput.** Process as many videos/hour as cheaply as possible. GPU worker pools, spot instances, larger batches.

**Hybrid design:**
- **Priority queue system:** Two queues — high-priority (live) and low-priority (batch)
- Live streams get dedicated resources with guaranteed capacity
- Batch uploads use remaining capacity + auto-scaling spot instances
- Different pipeline: live uses segment-based streaming transcoding (low latency per segment), batch uses full-file transcoding (higher quality, more efficient)
- Monitor queue depth on both — if live queue grows, steal workers from batch pool

---

**Q5. Your database can handle 5,000 QPS, but the application needs 50,000 QPS. Walk through every technique you'd use, and in what order, to bridge that gap.**

**A:** Order matters — start with cheapest/simplest:

1. **Query optimization** (free) — Indexes, query rewrites, EXPLAIN ANALYZE. Often gets 2-5x improvement
2. **Connection pooling** (hours) — PgBouncer reduces connection overhead. Maybe 1.5x
3. **Application-level caching** (days) — Redis for hot keys. Cache hit redirects 80%+ reads away from DB → effective 5x reduction in DB load
4. **Read replicas** (days) — Route reads to replicas. With 90% reads: 3 replicas = ~4x read capacity
5. **CDN/edge caching** — For cacheable responses, eliminate requests entirely
6. **Sharding** (weeks) — Horizontal partitioning. Each shard handles its slice independently
7. **CQRS** — Separate read-optimized store (Elasticsearch, materialized views) from write store

Combined: 5K × query tuning(3x) = 15K, + cache(5x reduction) = effectively 75K QPS capacity.

---

**Q6. How does Little's Law (L = λW) apply to system design? If your service has an average of 100 concurrent requests and each takes 200ms, what is your throughput? What happens if latency doubles?**

**A:**

**Little's Law:** L = λ × W
- L = concurrent requests (in-flight) = 100
- W = average latency = 0.2s
- λ = throughput = L/W = 100/0.2 = **500 req/s**

**If latency doubles (W = 0.4s):**
- If L stays fixed (e.g., thread pool = 100): λ = 100/0.4 = **250 req/s** — throughput halves
- If λ must stay at 500: L = 500 × 0.4 = 200 concurrent requests needed — need to double thread pool

**System design implications:**
- Thread pool size = target throughput × expected latency
- If a downstream dependency gets slower, your concurrency limit becomes a throughput bottleneck
- This is why timeouts are critical — one slow call consumes a thread/connection for longer

---

**Q7. An interviewer claims that "adding a cache always improves latency." Present a scenario where adding a cache actually worsens latency or overall system behavior.**

**A:**

**Scenarios where cache hurts:**
1. **Low hit rate (< 50%):** Every request checks cache (miss) + goes to DB. Two network hops instead of one. Net: +2-5ms per request
2. **Cache stampede:** Popular key expires → 1000 concurrent requests all miss → all hit DB → DB crashes → latency goes to infinity
3. **Large objects:** Caching a 10MB response means serialization/deserialization overhead exceeds the DB query time
4. **Write-heavy workloads:** If data changes every second, cache invalidation traffic dominates. Cache is always stale or always being refreshed
5. **Cold start:** After cache restart, 100% miss rate → DB overloaded → cascading failure
6. **Added complexity causing bugs:** Cache returns stale data → user frustration → engineers add complex invalidation logic → more latency from invalidation checks

---

**Q8. You have two services: Service A has 10ms latency and 10,000 req/s throughput, Service B has 100ms latency and 100,000 req/s. If A calls B for every request, what's the effective latency and throughput of the combined system?**

**A:**

**Latency:** Sequential call → additive = 10ms + 100ms = **110ms**

**Throughput:** Limited by the bottleneck. 
- A can send 10,000 req/s, each consuming a thread for 110ms (waiting for B)
- By Little's Law: A needs 10,000 × 0.11 = 1,100 concurrent connections to B
- B can handle 100,000 req/s → B is not the bottleneck
- **Effective throughput: 10,000 req/s** (limited by A's capacity)

**But watch out:** If A has only 100 threads and each is blocked for 110ms, A's real throughput = 100/0.11 = ~909 req/s. Thread pool size becomes the real constraint.

**Optimization:** Use async/non-blocking I/O in A so threads aren't blocked waiting for B. Then A's CPU is the limit, not thread count.

---

**Q9. Your team wants to batch database writes to increase throughput. What impact does this have on latency, durability, and failure recovery? How do you mitigate the downsides?**

**A:**

| Dimension | Impact | Mitigation |
|-----------|--------|------------|
| **Latency** | Increases (wait for batch to fill) | Set max wait time (e.g., 50ms or 100 items, whichever first) |
| **Throughput** | Improves dramatically (1 round trip for N writes) | — |
| **Durability** | Risk: in-memory batch lost on crash | WAL (write-ahead log) locally before batching |
| **Failure recovery** | Partial batch failure = complex | Make each item in batch idempotent, retry failed items individually |
| **Ordering** | Items in batch may reorder | Include sequence numbers if ordering matters |

**Best practice:** Buffer writes with a WAL, flush batches on size OR time threshold, make writes idempotent so retries are safe. This is exactly how databases (LSM trees) and Kafka work internally.

---

**Q10. Explain the relationship between latency, throughput, and utilization. Why does latency spike exponentially as utilization approaches 100%? Draw the curve and explain the math behind it.**

**A:**

**The relationship (queueing theory):**

At low utilization, requests flow through immediately. As utilization increases, requests queue behind others.

**M/M/1 queue formula:** Average wait time = service_time / (1 - utilization)

| Utilization | Latency Multiplier |
|-------------|-------------------|
| 50% | 2x |
| 75% | 4x |
| 90% | 10x |
| 95% | 20x |
| 99% | 100x |

**Why exponential:** At 99% utilization, on average 99 requests are ahead of you in the queue. Each takes service_time to process. Your wait = 99 × service_time.

**System design implication:** Never run production systems above 70-80% utilization. Auto-scale triggers should fire at 60-70%. This is why capacity planning targets 2-3x headroom over average load.

---

## 3. Availability vs Consistency
[← Back to topic](03-Availability-vs-Consistency.md#-senior-interview-questions)

**Q1. An interviewer says "CAP theorem means you can only have two out of three." How would you correct or nuance this statement? Why is partition tolerance not really optional?**

**A:** The common "pick 2 of 3" framing is misleading.

**The correction:**
- **Partition tolerance is not optional** in any distributed system. Networks will partition — it's physics, not a choice
- CAP is really: **"During a partition, choose consistency OR availability"**
- When there's no partition (99.99% of the time), you can have both C and A
- This is why PACELC is more useful: it adds "else" — what trade-off do you make during normal operation?

**Nuance:**
- CAP consistency = linearizability (very strong), not just "data is correct"
- CAP availability = every non-failing node responds (very strong), not just "99.9% uptime"
- Real systems make trade-offs on a spectrum, not binary CP vs AP

---

**Q2. You're designing a global e-commerce checkout system. Would you choose CP or AP? What if the interviewer then asks: "What about the product catalog — same choice?"**

**A:**

**Checkout → CP (Consistency-first):**
- Cannot allow double-spending or overselling
- Better to reject a request (temporarily unavailable) than to accept an inconsistent order
- Use synchronous replication for payment and inventory deduction
- Accept higher latency for correctness

**Product catalog → AP (Availability-first):**
- Showing a slightly stale price or description is acceptable
- Better to show the page (even if price is 5 minutes old) than to show an error
- Use eventual consistency with short replication lag
- If price changed, catch it at checkout time (which is CP)

**Key insight:** Different components of the same system should make different CAP trade-offs. This is called "polyglot consistency."

---

**Q3. Explain PACELC with a concrete example. For Cassandra (PA/EL), what does it mean during normal operation vs. during a network partition?**

**A:**

**PACELC:** If **P**artition → trade **A**vailability vs **C**onsistency; **E**lse → trade **L**atency vs **C**onsistency.

**Cassandra = PA/EL:**
- **During partition (PA):** Cassandra chooses Availability. Both sides of the partition accept writes. After partition heals, uses last-write-wins or custom resolution to reconcile
- **During normal operation (EL):** Cassandra chooses Latency. Writes return success after writing to a few replicas (configurable), not all. Reads may return stale data if using consistency level ONE

**Contrast with Google Spanner = PC/EC:**
- During partition: rejects requests (chooses Consistency)
- During normal operation: uses TrueTime + commit-wait (adds latency for consistency)

---

**Q4. A banking system needs strong consistency, but the team wants to use Cassandra for scalability. Is this possible? How would you configure Cassandra's consistency levels?**

**A:**

**Yes, with caveats.** Cassandra can achieve strong consistency per-operation using quorum:

**Configuration:** With replication factor N=3:
- Writes: `QUORUM` (W=2 nodes must acknowledge)
- Reads: `QUORUM` (R=2 nodes must respond)
- R + W > N → 2 + 2 > 3 → guaranteed to read the latest write

**What you sacrifice:**
- **Availability:** If 2 of 3 nodes are down, reads AND writes fail (unlike pure AP configuration)
- **Latency:** Must wait for 2 nodes to respond (slowest of 2 determines latency)
- **Cross-datacenter:** QUORUM is local by default; `EACH_QUORUM` across DCs adds significant latency
- **No multi-row transactions:** Cassandra doesn't support ACID transactions across partitions. Banking needs this (debit A + credit B atomically)

**Verdict:** For a banking core ledger, use a CP database (PostgreSQL, CockroachDB, Spanner). Use Cassandra for high-write auxiliary data (audit logs, notifications).

---

**Q5. Your system experiences a network partition between two DCs. Users in DC-East can still write data. When the partition heals, you discover conflicting writes. How do you resolve them?**

**A:**

**Resolution strategies:**

1. **Last-Write-Wins (LWW):**
   - Use wall-clock timestamp, latest write wins
   - Simple but lossy — silently drops the "older" write
   - Clock skew can cause wrong winner
   - Used by: Cassandra (default)

2. **Vector clocks:**
   - Track causal ordering across nodes
   - Detect true conflicts (concurrent writes) vs ordered writes
   - Present conflicts to application for resolution
   - Used by: Amazon Dynamo (original paper)

3. **Application-level resolution:**
   - Merge conflicting writes using domain logic
   - E.g., shopping cart: union of items from both sides
   - Most correct but requires per-use-case logic
   - Used by: Riak (with CRDTs)

4. **CRDTs (Conflict-free Replicated Data Types):**
   - Data structures that mathematically guarantee merge-ability
   - G-Counter, OR-Set, LWW-Register
   - No conflicts by construction

**Best practice:** Choose based on data semantics. Counter → CRDT. User profile → LWW. Shopping cart → union merge. Financial transaction → don't allow conflicting writes (use CP).

---

**Q6. Why is the CAP theorem often called misleading? Discuss the criticisms by Martin Kleppmann and others.**

**A:**

**Key criticisms:**

1. **"Pick 2 of 3" is wrong** — Partition tolerance isn't a choice. It should be "during a partition, pick C or A"
2. **Definitions are too strong** — CAP's "availability" means every non-failing node must respond. Real systems care about 99.9% availability, not 100%
3. **CAP ignores latency** — A "consistent" system that takes 30 seconds to respond is technically "available" per CAP but useless in practice
4. **Binary framing** — Real systems aren't purely CP or AP. They make different trade-offs per operation, per table, per endpoint
5. **Irrelevant during normal operation** — Partitions are rare. Day-to-day, the latency-consistency trade-off (PACELC's "Else") matters more
6. **Network partitions aren't all-or-nothing** — Partial failures, message delays, and asymmetric partitions are more common than clear splits

**Kleppmann's recommendation:** Stop labeling databases as "CP" or "AP." Instead, understand the specific consistency guarantees each system provides and match them to your requirements.

---

**Q7. Design a shopping cart system that remains available during network partitions but eventually becomes consistent.**

**A:**

**Design:**
- Each DC maintains a local copy of the cart using a CRDT-based data structure (OR-Set: Observed-Remove Set)
- Writes go to the local DC immediately (always available)
- Changes replicate asynchronously to other DCs
- On partition heal, CRDTs merge automatically without conflicts

**How OR-Set works for a cart:**
- Add item → add (item, unique_tag) to the set
- Remove item → remove all (item, *) pairs
- Merge two carts → union of add-sets minus merged remove-sets
- No conflicts because each add has a unique tag

**Edge cases:**
- User adds item in DC-East, removes it in DC-West simultaneously → after merge, the remove wins only for the tags it saw. If the add happened after the remove's snapshot, item stays. This is the correct causal behavior
- Quantity changes: model as "add 1" / "remove 1" events (PN-Counter per item)

---

**Q8. How do you explain to a non-technical stakeholder that a system can't be "always consistent and always available"?**

**A:**

**Simple analogy:** Imagine two bank branches in different cities. The phone line between them goes down.

- **Option A (Consistent):** Both branches stop processing transfers until the line is back. No wrong balances, but customers can't do anything
- **Option B (Available):** Both branches keep processing. Customers are happy. But when the line reconnects, you discover $100 was spent twice from the same account

You can have one or the other during the outage, not both. This is a law of physics for distributed systems, not a software bug.

**Compromise proposal:** "We'll make payments consistent (Option A — users wait briefly) and product browsing available (Option B — might show slightly stale info). Each feature gets the right trade-off."

---

**Q9. Compare how DynamoDB, MongoDB, and CockroachDB handle the availability-consistency spectrum.**

**A:**

| Database | CAP | PACELC | Default Behavior | Tunable? |
|----------|-----|--------|-------------------|----------|
| **DynamoDB** | AP | PA/EL | Eventually consistent reads. Available during partitions | Yes: strongly consistent reads available per-request |
| **MongoDB** | CP | PC/EC | Writes go to primary. If primary is down, no writes until election | Partially: read preferences (secondary OK), write concerns |
| **CockroachDB** | CP | PC/EC | Raft consensus on every write. Rejects writes during partition | Limited: follower reads for stale-tolerant queries |

**Key differences:**
- DynamoDB: Multi-master, built for availability. You opt-in to consistency per read
- MongoDB: Single-primary per replica set. Strong consistency by default, but primary elections cause brief unavailability
- CockroachDB: Raft-based consensus, serializable isolation. Strongest consistency, highest latency during cross-region writes

---

**Q10. An interviewer asks: "If strong consistency is so expensive, why do banks use it?" Then: "Could a bank ever use eventual consistency?"**

**A:**

**Why banks use strong consistency:**
- Regulatory requirement — account balances must be correct at all times
- Double-spending is catastrophic (real money loss)
- Auditors require provable transaction ordering
- The cost of inconsistency (lawsuits, regulatory fines) far exceeds the cost of slower systems

**Where banks DO use eventual consistency:**
- **Notifications:** "Your transaction was processed" email can be delayed
- **Analytics/reporting:** Daily reports computed from replicas are fine with seconds of lag
- **Account statements:** Generated periodically, not real-time
- **Cross-bank transfers (ACH):** Already eventual — take 1-3 business days!
- **Fraud detection:** Can analyze patterns with slight lag

**Key insight:** Banks use strong consistency for the **ledger** (source of truth). Everything else built on top can be eventually consistent. The core is small; the periphery is large.

---

## 4. Consistency Patterns
[← Back to topic](04-Consistency-Patterns.md#-senior-interview-questions)

**Q1. You're designing a social media "like" counter. Do you need strong consistency, eventual consistency, or something else? What if the counter is used for ad billing?**

**A:**

**Like counter (display only) → Eventual consistency:**
- Users don't notice if a like count is off by a few for seconds
- High write throughput required (millions of likes/sec)
- Use: Cassandra counter column or Redis INCR with async persistence
- Approximate counts are fine (show "~1.2M likes")

**Like counter for ad billing → Strong consistency:**
- Billing decisions based on engagement metrics must be accurate
- Advertisers pay per 1000 impressions/engagements — errors = revenue disputes
- Use: ACID database for billing counters, reconcile with eventual counter periodically
- Pattern: Display counter (eventual) + billing counter (strong, separate system)

---

**Q2. Explain the difference between linearizability and serializability. When does each matter?**

**A:**

| Property | Linearizability | Serializability |
|----------|----------------|-----------------|
| **Scope** | Single object/operation | Multiple objects/transactions |
| **Guarantee** | Real-time ordering: if op A completes before op B starts, A is before B | Transactions appear to execute in *some* serial order (not necessarily real-time) |
| **Analogy** | "Latest value guarantee" | "No anomalies from concurrent transactions" |
| **Example DB** | etcd, ZooKeeper | PostgreSQL (serializable isolation) |

**Can have one without the other:**
- **Serializable but not linearizable:** Transactions execute in a serial order that may differ from wall-clock order (e.g., snapshot isolation)
- **Linearizable but not serializable:** Single key-value store that always returns latest write, but doesn't support multi-key transactions

**When each matters:**
- Linearizability: leader election, distributed locks, unique ID generation
- Serializability: bank transfers (debit + credit atomically), inventory management

---

**Q3. A user updates their profile photo and immediately refreshes but sees the old photo. Bug or expected behavior?**

**A:**

**Expected behavior with eventual consistency.** The write went to the primary, but the read was served by a replica that hasn't received the update yet.

**Which consistency model prevents this:** **Read-your-writes consistency** (also called "read-after-write consistency").

**Implementation options:**
1. Route reads for recently-written data to the primary (e.g., for 10 seconds after a write)
2. Include a write timestamp in the session; if replica is behind that timestamp, wait or redirect to primary
3. Client-side: optimistically show the new photo from the local state, regardless of what the server returns
4. Synchronous replication (guarantees replicas are up-to-date, but adds write latency)

**Cost:** All approaches add latency or complexity. For a profile photo, option 3 (client-side optimistic update) is cheapest.

---

**Q4. Your system uses eventual consistency with ~500ms replication lag. A downstream service reads stale data and makes a wrong decision. How do you architect around this?**

**A:**

**Strategies (cheapest to most expensive):**

1. **Tolerate staleness by design** — If possible, make the downstream decision reversible. If a stale read causes a wrong action, compensate later
2. **Causal consistency** — Pass a version token / write timestamp with the event. Downstream service waits until its replica reaches that version before reading
3. **Read from primary** — For critical decisions, route reads to the primary DB. Adds latency but guarantees freshness
4. **Event-carried state transfer** — Don't read from DB at all. Include all necessary data in the event message itself. Consumer never needs to query a replica
5. **Change Data Capture (CDC)** — Use Debezium to stream DB changes. Consumer processes changes in order, building its own local view

**Best approach for most systems:** Option 4 — include the data in the event. Eliminates the staleness problem entirely.

---

**Q5. Compare quorum-based consistency (R + W > N) with synchronous replication. When would you prefer one over the other?**

**A:**

| Factor | Quorum (R+W>N) | Synchronous Replication |
|--------|---------------|----------------------|
| **Write latency** | Wait for W nodes (minority OK) | Wait for ALL replicas |
| **Read latency** | Must read from R nodes (overhead) | Any replica is up-to-date |
| **Availability** | Survives minority failures | Any one replica down = writes blocked |
| **Configuration** | Flexible (tune R,W per operation) | Binary: all-or-nothing |
| **Data model** | Key-value / document oriented | Any (SQL, document, etc.) |

**Prefer quorum when:**
- Multi-datacenter deployment where sync replication adds unacceptable latency
- Need tunable consistency per operation (some reads can be weak)
- Using a system designed for it (Cassandra, DynamoDB)

**Prefer synchronous replication when:**
- Strong consistency required for all operations (banking)
- Few replicas (2-3) so sync overhead is manageable
- Single-region deployment where network latency is low
- Using PostgreSQL/MySQL with synchronous_standby

---

**Q6. You need causal consistency for a messaging app. How would you implement it without strong consistency?**

**A:**

**Why causal consistency:** Messages must appear in cause-effect order. If Alice says "Let's get pizza" and Bob replies "Sure!", everyone must see Alice's message before Bob's.

**Implementation with Lamport timestamps:**
1. Each message carries a logical timestamp (counter)
2. When a user sends a message, timestamp = max(local_counter, last_seen_timestamp) + 1
3. Receivers update their counter to max(local, received) + 1
4. Display messages ordered by timestamp

**Better: Vector clocks or Hybrid Logical Clocks (HLC):**
- Track per-node counters to detect true concurrency vs causality
- HLC combines physical time + logical counter — gives both causal ordering and approximate wall-clock time

**For a messaging app specifically:**
- Each chat channel maintains a monotonic sequence number
- Server assigns sequence numbers on receipt
- Clients request messages by sequence number, showing them in order
- If a message arrives out-of-order, buffer it until the gap is filled

---

**Q7. Design a distributed counter that is strongly consistent at 100,000 increments per second.**

**A:**

**Why it's hard:** A single strongly consistent counter requires serialization — each increment must read, increment, and write atomically. A single node maxes out at ~50K ops/sec.

**Solutions:**

1. **Sharded counters:**
   - Partition into 100 sub-counters (counter_0 through counter_99)
   - Each increment goes to a random shard: `shard = hash(request_id) % 100`
   - Total count = SUM(all shards)
   - Each shard handles 1K/sec — easy
   - Trade-off: reading total requires aggregating all shards

2. **CRDTs (G-Counter) for eventual consistency:**
   - Each node maintains its own local counter
   - Periodically gossip/merge counters
   - Total = sum of all node counters
   - No coordination needed but not strongly consistent

3. **Batched increments:**
   - Batch 100 increments locally, flush one +100 to the central counter
   - Reduces contention by 100x
   - Counter lags by up to batch size

**For true strong consistency at 100K/sec:** Sharded counters with synchronous reads for the total.

---

**Q8. Explain "read-your-writes" consistency. How do you implement it with multiple read replicas?**

**A:**

**Definition:** After a user writes data, subsequent reads by the **same user** are guaranteed to see that write (or a later one). Other users may still see stale data.

**Implementation strategies:**

1. **Session-based routing:**
   - After a write, set a session marker with the write's LSN (log sequence number)
   - On subsequent reads, check if the replica has reached that LSN
   - If not, route to the primary or wait

2. **Timestamp-based:**
   - Client remembers the timestamp of its latest write
   - Sends it with read requests: `If-Read-After: 1709136000`
   - Server picks a replica that's caught up past that timestamp

3. **Sticky sessions to primary (temporarily):**
   - After a write, route all reads from that user to the primary for N seconds
   - Simple but adds primary load

4. **Client-side optimistic update:**
   - Client locally applies the write to its UI immediately
   - Background sync ensures server catches up
   - User always sees their own writes, even if server is lagging

**Cross-device challenge:** If a user writes on phone and reads on laptop, session-based approaches fail. Need a centralized "last write timestamp" per user (stored in a fast KV store like Redis).

---

**Q9. Some operations need strong consistency and others are fine with eventual. How do you architect a single system that supports both?**

**A:**

**Polyglot consistency architecture:**

```
┌─────────────────────────────────────────────────┐
│                  API Gateway                     │
│         (routes based on operation type)         │
├────────────────────┬────────────────────────────┤
│   Strong Path       │   Eventual Path            │
│   (payments,        │   (notifications,           │
│    inventory)       │    recommendations)         │
├────────────────────┼────────────────────────────┤
│   PostgreSQL        │   Cassandra / DynamoDB      │
│   (ACID, single     │   (high throughput,         │
│    primary)         │    multi-region)            │
└────────────────────┴────────────────────────────┘
```

**Approaches:**
1. **Separate databases:** Strong-consistency data in PostgreSQL, eventual in Cassandra. Sync via CDC
2. **Tunable consistency:** Use DynamoDB with `ConsistentRead=true` for critical ops, default eventual for others
3. **CQRS:** Write model uses strong consistency (single source of truth), read model uses eventual consistency (materialized views)
4. **Per-endpoint configuration:** In the service layer, annotate operations as `@StrongConsistency` or `@EventualConsistency`, routing to appropriate storage

---

**Q10. What is "monotonic read consistency" and why is it important?**

**A:**

**Definition:** If a user reads a value at time T, all subsequent reads by that user will return a value at least as new as T. Time never goes backward for a given reader.

**Why it matters — the bug:**
- User reads their order status: "Shipped" (from replica A, which is up-to-date)
- User refreshes: "Processing" (from replica B, which is behind)
- User panics: "My order went backwards!"

**Without monotonic reads:** Users see time travel. Data flips between old and new states randomly depending on which replica serves the request.

**Implementation:**
1. **Sticky sessions:** Route a user to the same replica consistently (hash user_id → replica)
2. **Version tracking:** Client sends last-seen version number. Server ensures it reads from a replica that's at least at that version
3. **Monotonic read token:** Similar to read-your-writes but also covers reads — if you've seen version 5, you'll never see version 4 again

**Why it's weaker than strong consistency:** Different users can still see different versions. It only guarantees individual user experience doesn't go backward.

---

## 5. Availability Patterns
[← Back to topic](05-Availability-Patterns.md#-senior-interview-questions)

**Q1. Your SLA promises 99.99% (four 9s). You have three services in series, each at 99.95%. What's your actual availability? How do you reach four 9s?**

**A:**

**Math:** Services in series: A_total = A1 × A2 × A3 = 0.9995³ = **99.85%** (not even three 9s!)

**To reach 99.99%:**
- Each service at 99.95% can't get you there in series
- **Add redundancy (parallel):** For each service, run 2 instances. Availability of a pair = 1 - (1 - 0.9995)² = 99.99975%
- Three redundant pairs in series: 0.9999975³ = **99.999%** — exceeds four 9s

**Other strategies:**
- Remove services from the critical path (async where possible)
- Circuit breakers with graceful degradation (if service C is down, return cached data)
- Multi-region deployment so a full-region failure doesn't cause total outage

---

**Q2. Active-active vs active-passive failover: when would you choose each? What are the hidden complexities of active-active?**

**A:**

| Factor | Active-Passive | Active-Active |
|--------|---------------|---------------|
| **Usage** | Standby is idle | Both serve traffic |
| **Failover time** | Seconds-minutes (promote standby) | Near-instant (traffic reroutes) |
| **Cost efficiency** | Paying for idle resources | Full utilization |
| **Complexity** | Simple: one-way replication | Complex: bidirectional sync |

**Choose active-passive when:**
- Strong consistency required (one writer)
- Simpler to operate (smaller team)
- Can tolerate seconds of downtime during failover

**Choose active-active when:**
- Low-latency required for global users (serve from nearest DC)
- Zero-downtime requirement
- Workload is read-heavy or partitionable

**Hidden complexities of active-active:**
- **Conflict resolution:** Two DCs write to the same record simultaneously
- **Data divergence:** Split-brain during network partition
- **Replication lag:** Users may see different data depending on which DC they hit
- **Schema migrations:** Must be backward-compatible across both DCs during rollout
- **Debugging:** Issues that only manifest with bidirectional replication are hard to reproduce

---

**Q3. A database failover takes 30 seconds. During that time, all writes are lost. How would you redesign for zero data loss during failover?**

**A:**

**Zero data loss = Recovery Point Objective (RPO) of 0.**

**Approaches:**
1. **Synchronous replication:** Every write is confirmed on primary AND standby before acknowledging to the client. Zero data loss but higher write latency (+5-10ms). PostgreSQL: `synchronous_commit = on`

2. **WAL shipping with synchronous mode:** Primary ships WAL segments to standby synchronously. Standby applies them in real-time. If primary dies, standby has all committed transactions

3. **Shared storage (SAN/EBS):** Primary and standby share the same disk. Failover = start the standby process pointing at the same disk. Zero data loss, fast failover. AWS Aurora uses this approach

4. **Multi-Paxos / Raft-based replication:** CockroachDB, TiDB — every write is committed via consensus across 3+ replicas. No single primary to fail over

**Trade-off:** Zero data loss always costs write latency. The synchronous standby must acknowledge before the client gets a response. If the standby is in another region (100ms away), every write adds 100ms.

---

**Q4. A service responds to health checks but returns incorrect data (a "gray failure"). How do you detect and handle this?**

**A:**

**Why it's dangerous:** Traditional health checks (TCP ping, HTTP 200 from `/health`) pass. Monitors show green. But the service is returning wrong data — corrupting downstream systems silently.

**Detection strategies:**
1. **Deep health checks:** `/health` endpoint should execute a real operation (read from DB, check dependencies), not just return 200
2. **Semantic monitoring:** Synthetic transactions that verify correctness. E.g., write a known value, read it back, verify
3. **Checksums/assertions in responses:** Consumer verifies data integrity (expected fields, ranges, checksums)
4. **Cross-referencing:** Compare outputs of multiple replicas. If one disagrees, it's suspect (Byzantine fault detection lite)
5. **Anomaly detection on metrics:** Sudden drop in response size, change in error distribution, latency pattern shift

**Handling:**
- Automatic quarantine: remove the node from the load balancer pool
- Alert with diagnostic data for human investigation
- Canary comparison: route a small % of traffic to the suspect node and compare outputs with healthy nodes

---

**Q5. Explain the circuit breaker pattern in detail. What are the three states?**

**A:**

**Three states:**

```
     ┌──────────┐   failures > threshold   ┌──────────┐
     │  CLOSED  │ ────────────────────────► │   OPEN   │
     │(normal)  │                           │(reject   │
     └──────────┘                           │ all)     │
          ▲                                 └────┬─────┘
          │                                      │
          │  success                    timeout expires
          │                                      │
     ┌────┴──────┐                               │
     │HALF-OPEN  │ ◄─────────────────────────────┘
     │(test one) │
     └───────────┘
```

- **CLOSED:** Normal operation. Track failure count. If failures exceed threshold (e.g., 5 in 10 seconds), trip to OPEN
- **OPEN:** All requests immediately rejected (fail fast) with a fallback response. Timer starts (e.g., 30 seconds)
- **HALF-OPEN:** After timeout, allow ONE test request through. If it succeeds → CLOSED. If it fails → back to OPEN

**Threshold configuration:**
- Error rate threshold: 50% failures over last 10 requests
- Volume threshold: minimum 20 requests before evaluating (avoid tripping on 1/2 failures)
- Timeout: 30-60 seconds (long enough for downstream to recover)

**In-flight requests when circuit opens:** Already-sent requests are allowed to complete (with timeout). New requests are rejected immediately.

---

**Q6. Designing a system to survive an entire AWS region going down. Walk through the architecture.**

**A:**

**Architecture:**

1. **DNS layer:** Route 53 health checks + failover routing. Primary region = us-east-1, secondary = eu-west-1
2. **Stateless tier:** Identical application deployments in both regions. Auto-scaling in each
3. **Database:** 
   - Aurora Global Database (1-second replication lag) — read replica in secondary region
   - On failover: promote secondary to primary (takes ~1 minute)
   - Accept brief RPO of ~1 second of data loss
4. **Cache:** Independent Redis clusters per region (cache is rebuildable)
5. **Object storage:** S3 Cross-Region Replication (async, minutes of lag)
6. **Message queues:** SQS per region. Unprocessed messages in failed region are lost unless using a cross-region solution (Kafka MirrorMaker)

**Cost implications:** Roughly 2x infrastructure cost. Most companies do active-passive (standby region at reduced capacity) to save ~40%.

**Testing:** Regular DR drills — actually fail over to the secondary region quarterly. If you don't test it, it won't work when you need it.

---

**Q7. "Just add more replicas for higher availability." What are the diminishing returns?**

**A:**

**The math of diminishing returns:**
- 1 replica: availability = 99.9% → downtime = 8.76 hrs/year
- 2 replicas: 1 - (0.001)² = 99.9999% → downtime = 31.5 sec/year
- 3 replicas: 1 - (0.001)³ = 99.9999999% → downtime = 0.03 sec/year

Looks great on paper, but:

**Why more replicas can HURT:**
1. **Coordination overhead:** More replicas = more consensus participants = higher write latency (Raft with 5 nodes vs 3)
2. **Split-brain risk:** More nodes = more complex failure modes and leader elections
3. **Replication lag increases:** More replicas to keep in sync
4. **Operational complexity:** Monitoring, patching, and debugging 7 replicas vs 3
5. **Cost:** Each replica is a full copy of the data
6. **Correlated failures:** If all replicas run the same software/config, a bug crashes all of them simultaneously. More replicas doesn't help against common-mode failures

**Sweet spot:** 3 replicas for most systems (tolerates 1 failure with majority quorum). 5 for critical systems (tolerates 2). Beyond 5 is rarely justified.

---

**Q8. Compare timeout + retry, circuit breaker, bulkhead isolation, and graceful degradation.**

**A:**

| Pattern | What It Does | When to Use |
|---------|-------------|-------------|
| **Timeout + Retry** | Caps wait time, retries on failure | Transient failures (network blip). Always add jitter + exponential backoff |
| **Circuit Breaker** | Stops calling a failing service entirely | Sustained failures. Prevents wasting resources on a dead service |
| **Bulkhead** | Isolates failure to one component | Prevents one slow dependency from consuming all threads/connections |
| **Graceful Degradation** | Returns partial/cached data instead of error | When partial functionality is better than total failure |

**How they combine (defense in depth):**
1. Request comes in → **bulkhead** assigns it to the dependency's isolated thread pool
2. Call downstream with a **timeout** (e.g., 2 seconds)
3. If timeout → **retry** once with backoff
4. If failures accumulate → **circuit breaker** trips, immediately returns fallback
5. Fallback = **graceful degradation** (cached data, default values, reduced feature set)

---

**Q9. Your CDN provider goes down and 40% of your traffic fails. How should your system respond automatically?**

**A:**

**Immediate automated response:**
1. **Health check detection:** Monitor CDN edge responses. When error rate > threshold → trigger failover
2. **DNS-level failover:** Update DNS to bypass CDN, point directly at origin servers (requires pre-configured DNS records with low TTL)
3. **Multi-CDN:** Use a CDN switching layer (Cedexis/Citrix ITM) that routes around the failing CDN to a secondary CDN (Cloudflare → Fastly fallback)

**Origin protection during CDN failover:**
- Origin servers suddenly receive 100% traffic (not 60% as before)
- Auto-scale origin servers aggressively
- Enable server-side caching (Varnish/NGINX cache) to absorb the load
- Activate rate limiting to prevent origin overload
- Return stale-if-error cached responses where possible

**Prevention:**
- Multi-CDN strategy from day one (primary + secondary, with automated switching)
- Cache assets in multiple CDNs actively (not just failover)
- Keep CDN TTLs reasonable — if CDN dies, cached content at client browsers stays valid

---

**Q10. Explain the difference between high availability and disaster recovery.**

**A:**

| Aspect | High Availability (HA) | Disaster Recovery (DR) |
|--------|----------------------|----------------------|
| **Goal** | Minimize downtime during normal failures | Recover from catastrophic events |
| **Scope** | Component/AZ level failures | Region/site level destruction |
| **RTO** | Seconds to minutes | Minutes to hours |
| **RPO** | Zero to seconds | Seconds to hours |
| **Cost** | 1.5-2x (active redundancy) | 1.2-1.5x (standby resources) |
| **Automation** | Fully automatic failover | Often semi-manual (runbook) |
| **Testing** | Continuous (chaos engineering) | Periodic drills (quarterly) |

**Why "we have DR so we're HA" is wrong:**
- DR assumes a major event happens and you recover. There's accepted downtime (RTO)
- HA means the system keeps running through individual failures without any noticeable downtime
- DR is "we can re-open the hospital after an earthquake"
- HA is "the hospital stays open even when a generator fails"

You need BOTH: HA for daily resilience, DR for catastrophic scenarios.

---

## 6. Domain Name System
[← Back to topic](06-Domain-Name-System.md#-senior-interview-questions)

**Q1. Migrate traffic from one data center to another with zero downtime using DNS.**

**A:**

**Step-by-step migration:**

1. **Preparation (days before):**
   - Lower DNS TTL from hours to 60 seconds (do this 48+ hours early so old TTLs expire)
   - Ensure both DCs are fully operational and data is synced

2. **Gradual migration using weighted routing:**
   - Start: DC-old = 100%, DC-new = 0%
   - Move: 95/5 → 90/10 → 75/25 → 50/50 → 25/75 → 0/100
   - Monitor error rates, latency after each shift
   - Each step waits for 2x the TTL period

3. **Health checks:**
   - DNS health checks on both DCs
   - If DC-new starts failing, DNS automatically routes back to DC-old

4. **Cleanup:**
   - Once 100% on DC-new and stable for 24+ hours
   - Raise TTL back to normal (300-3600 seconds)
   - Decommission DC-old

**Risks:** Some resolvers ignore TTL (especially corporate DNS). Use both DNS-based and application-level routing (feature flags) for belt-and-suspenders.

---

**Q2. Walk through the full DNS resolution chain when you type google.com in a browser.**

**A:**

1. **Browser cache** — Check if the IP is already cached (Chrome: `chrome://net-internals/#dns`)
2. **OS cache** — Check the OS resolver cache (macOS: `scutil --dns`)
3. **Hosts file** — Check `/etc/hosts` for manual overrides
4. **Recursive resolver** — Query the ISP's (or configured) recursive resolver (e.g., 8.8.8.8)
5. **Root server** — Resolver asks a root server (13 root server clusters, anycast): "Where is .com?" → Returns TLD nameserver IPs
6. **TLD server** — Resolver asks .com TLD server: "Where is google.com?" → Returns authoritative nameserver IPs (ns1.google.com)
7. **Authoritative server** — Resolver asks Google's nameserver: "What is the A record for google.com?" → Returns IP (e.g., 142.250.80.46)
8. **Resolver caches** the result for TTL duration
9. **OS caches** → **Browser caches** → **TCP connection** to the IP

**Total round trips (cold cache):** 4 DNS queries + TCP handshake + TLS handshake = 6-8 round trips before first byte. With caching, typically 0-1 DNS round trips.

---

**Q3. Your DNS provider (Route 53) experiences an outage. How does this affect your system? What prevents total outage?**

**A:**

**Impact:**
- **New visitors:** Cannot resolve your domain → total failure for them
- **Existing visitors:** If their resolver cached your IP (within TTL), they're unaffected
- **Internal services:** If they use DNS for service discovery, inter-service communication fails

**Prevention architecture:**
1. **Multiple NS records:** Use DNS providers from two different companies (Route 53 + Cloudflare). Both listed as authoritative nameservers. If one fails, resolvers query the other
2. **Long TTL as buffer:** Higher TTLs mean resolvers serve cached results longer during outages (trade-off: slower updates)
3. **Anycast DNS:** Provider uses anycast — outage in one PoP doesn't mean global outage
4. **Application-level fallback:** Hardcode critical IPs in config as DNS fallback (last resort)
5. **Health-checked DNS:** Some providers auto-failover to backup IPs if primary health check fails

**Lesson from Dyn 2016:** Using a single DNS provider is a critical SPOF. Major companies now use multi-provider DNS.

---

**Q4. Explain the differences between A, AAAA, CNAME, MX, NS, TXT, and SRV records.**

**A:**

| Record | Maps | Example | Notes |
|--------|------|---------|-------|
| **A** | Domain → IPv4 | `example.com → 93.184.216.34` | Most common |
| **AAAA** | Domain → IPv6 | `example.com → 2606:2800:220:1:...` | IPv6 equivalent of A |
| **CNAME** | Domain → another domain | `www.example.com → example.com` | Alias; cannot be at zone apex |
| **MX** | Domain → mail server | `example.com → mail.google.com` | Has priority (lower = preferred) |
| **NS** | Domain → nameserver | `example.com → ns1.google.com` | Delegates DNS authority |
| **TXT** | Domain → text string | `example.com → "v=spf1 ..."` | Used for SPF, DKIM, domain verification |
| **SRV** | Service → host:port | `_sip._tcp.example.com → 5060 sip.example.com` | Service discovery (port + priority + weight) |

**ALIAS/ANAME vs CNAME at zone apex:**
- CNAME cannot be used at the zone apex (e.g., `example.com`) because it conflicts with other records (SOA, NS)
- ALIAS/ANAME is a provider-specific record that acts like CNAME but resolves at the DNS server level, returning an A record to the client. Works at the apex.

---

**Q5. You changed a DNS IP, but some users hit the old IP 2 hours later despite a 5-minute TTL. Why?**

**A:**

**Causes of stale DNS beyond TTL:**

1. **Recursive resolver caching:** ISP resolvers may cache longer than TTL (violating the spec but common). Some ISPs enforce minimum TTLs of 30 minutes
2. **Client-side caching:**
   - **Browsers:** Chrome caches DNS for 1 minute regardless of TTL
   - **OS:** macOS, Windows cache independently of browser
   - **Java JVM:** Infamously caches DNS forever by default (`networkaddress.cache.ttl` = -1 in security manager). Must be explicitly set
3. **Library caching:** curl, Node.js `http` module, and connection pools may hold onto resolved IPs
4. **HTTP keep-alive:** Existing TCP connections reuse the old IP as long as the connection is alive (doesn't re-resolve DNS)
5. **Corporate proxies/firewalls:** Enterprise proxies may cache DNS aggressively
6. **Negative caching:** If the new record had a brief propagation failure, resolvers cached the "not found" (NXDOMAIN)

**Mitigation:** Lower TTL well before the change. For critical migrations, use both DNS changes AND application-level routing (load balancer IP swap).

---

**Q6. How would you implement DNS-based Global Server Load Balancing (GSLB)?**

**A:**

**GSLB routing strategies:**

1. **Latency-based routing** (Route 53 Latency Records):
   - Route 53 measures latency from resolver to each region
   - Returns the IP of the lowest-latency region
   - Best for performance optimization

2. **Geolocation routing:**
   - Map resolver IP → country/continent → return region IP
   - EU users → eu-west, US users → us-east
   - Best for data sovereignty / compliance (GDPR)

3. **Weighted routing:**
   - Assign weights: us-east-1 = 70%, eu-west-1 = 30%
   - Useful for gradual traffic shifting during migrations

4. **Failover routing:**
   - Primary + secondary regions
   - Health check on primary; if it fails, DNS returns secondary IP
   - Simple but coarse-grained (entire region fails over)

**How it works together:** Combine strategies. Latency-based routing as primary, with health checks for automatic failover. Add geolocation overrides for compliance.

**Limitation:** DNS GSLB is coarse (resolver location ≠ user location, especially with public DNS like 8.8.8.8). For fine-grained routing, use anycast or application-layer routing.

---

**Q7. An attacker is performing DNS cache poisoning. What's happening and how do DNSSEC and DoH help?**

**A:**

**DNS cache poisoning attack:**
- Attacker sends forged DNS responses to a recursive resolver
- Forged response has the attacker's IP for `bank.com`
- Resolver caches the fake IP → all users of that resolver go to attacker's server
- Exploits: DNS uses UDP (no connection verification), responses only need to match the query ID (16-bit = 65K possibilities)

**DNSSEC (DNS Security Extensions):**
- Adds cryptographic signatures to DNS records
- Each zone signs its records with a private key
- Resolvers verify signatures up the chain (root → TLD → authoritative)
- Prevents tampering: forged responses won't have valid signatures
- Limitation: Doesn't encrypt queries (privacy still exposed)

**DNS-over-HTTPS (DoH) / DNS-over-TLS (DoT):**
- Encrypts DNS queries between client and resolver
- Prevents eavesdropping and man-in-the-middle on the query path
- Doesn't verify the record content (that's DNSSEC's job)
- DoH uses port 443 (blends with HTTPS traffic), DoT uses port 853

**Best protection: DNSSEC + DoH together.** DNSSEC authenticates the data, DoH encrypts the transport.

---

**Q8. Choosing between Route 53, Cloudflare DNS, and running your own BIND servers.**

**A:**

| Factor | Route 53 | Cloudflare DNS | Self-hosted BIND |
|--------|----------|---------------|-----------------|
| **Reliability** | 100% SLA | 100% SLA (free tier too) | Depends on your infra |
| **Latency** | ~20-50ms (anycast) | ~10-20ms (largest anycast network) | Variable |
| **Cost** | $0.50/zone + $0.40/M queries | Free for basic; $5-200/mo advanced | Server costs + ops time |
| **Features** | Integrates with AWS (ALB, S3, etc.) | DDoS protection, CDN integration | Full control |
| **DDoS protection** | AWS Shield | Built-in (industry leading) | You handle it |
| **When to use** | AWS-heavy, need AWS integration | Best free option, security-focused | Regulatory requirement for self-hosted, or extreme customization |

**Recommendation:** Cloudflare for most startups (free, fast, secure). Route 53 if AWS-native. Self-hosted only if regulations demand it (and even then, consider as secondary behind a managed provider).

---

**Q9. Compare DNS-based service discovery vs service registry vs service mesh.**

**A:**

| Approach | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **DNS (Consul DNS)** | Services register in Consul; queries via DNS SRV records | Simple, language-agnostic | TTL-based staleness, no load balancing, no health-aware routing |
| **Service Registry (Eureka)** | Services register/deregister; clients query registry | Real-time updates, rich metadata | Client-side library dependency, registry is a SPOF |
| **Service Mesh (Istio)** | Sidecar proxy handles discovery + routing transparently | Zero application changes, mTLS, traffic control | Complex infrastructure, latency overhead, steep learning curve |

**When DNS falls short:**
- DNS can't handle rapid scaling (instances up/down every second) — TTL makes it stale
- No built-in load balancing intelligence (random resolution order)
- No circuit breaking, retries, or traffic shaping
- Works fine for relatively stable services (databases, external APIs)

---

**Q10. How did the Dyn DDoS attack take down Twitter, GitHub, and Netflix? What's the architectural lesson?**

**A:**

**What happened (Oct 21, 2016):**
- Mirai botnet (100K+ IoT devices) launched a massive DDoS attack against Dyn's DNS infrastructure
- Dyn was the authoritative DNS provider for Twitter, GitHub, Netflix, Airbnb, etc.
- DNS queries for these domains timed out → users couldn't resolve domain names → sites appeared "down"
- The actual applications were fine — the DNS layer was the failure point

**Why it cascaded:**
- These companies used Dyn as their **sole DNS provider** (single point of failure)
- Even though the apps were healthy, no DNS resolution = no way for clients to find them
- Browser DNS caches helped existing users temporarily, but new visitors and expired caches were blocked

**Architectural lessons:**
1. **Multi-provider DNS is essential:** Use at least 2 DNS providers (e.g., Route 53 + Cloudflare)
2. **DNS is Critical Infrastructure:** Treat it like any other SPOF — with redundancy
3. **Anycast helps but isn't enough:** Dyn used anycast but the attack volume overwhelmed it
4. **Monitor DNS independently:** Your app monitoring shows green, but DNS monitoring shows red. Have both
5. **Long TTLs as a buffer:** Higher TTLs give more time for cached records to keep working during DNS outages (trade-off with update speed)

---

## 7. Content Delivery Networks
[← Back to topic](07-Content-Delivery-Networks.md#-senior-interview-questions)

**Q1. You're designing an image-heavy social media app serving users globally. Walk through your CDN strategy — push or pull? How do you handle dynamic content like personalized feeds?**

**A:**

**Static assets (images, CSS, JS) → Pull CDN:**
- Origin stores all content. CDN pulls on first request, caches at edge
- Advantages: No pre-loading needed, CDN manages cache lifecycle, lazy population
- Use far-future `Cache-Control` headers + content hashing in filenames (e.g., `photo_abc123.jpg`)

**User-uploaded images → Hybrid:**
- Upload goes to origin (S3) → CDN URL is generated immediately
- First viewer triggers CDN pull. Subsequent viewers get cached copy
- For viral content, pre-warm popular CDN PoPs

**Personalized feeds → NOT cacheable at CDN:**
- Feeds are unique per user — can't cache
- Use Edge Compute (CloudFlare Workers, Lambda@Edge) to assemble feeds at the edge from cached components
- Cache the individual post data at CDN, but assemble the feed dynamically

---

**Q2. A Pull CDN causes a "thundering herd" when a popular item's cache expires. How do you prevent this?**

**A:**

**The problem:** Cache entry expires → 10,000 simultaneous requests hit origin → origin crashes.

**Solutions:**
1. **Request coalescing (collapse forwarding):** CDN recognizes multiple concurrent requests for the same key. Only forwards ONE to origin. All others wait for that response. NGINX: `proxy_cache_lock on;`
2. **Stale-while-revalidate:** Serve the stale cached response while fetching fresh content in the background. `Cache-Control: max-age=60, stale-while-revalidate=30`
3. **Probabilistic early expiration (XFetch):** Each request has a small probability of refreshing the cache before TTL expires. The busier the key, the more likely it refreshes early
4. **Pre-warming:** Before TTL expires, a background job refreshes popular keys proactively
5. **Shield / origin shield:** Add a mid-tier cache between edge PoPs and origin. Edge misses hit the shield (which may have it cached), not origin directly

---

**Q3. Your CDN cache hit ratio is only 40%. How do you improve it to 90%+?**

**A:**

**Common causes of low hit ratio and fixes:**

1. **Query string variations** — `/image.jpg?v=1` vs `/image.jpg?v=2` treated as different keys. Fix: normalize/ignore irrelevant query params at CDN
2. **Vary header too broad** — `Vary: *` or `Vary: Cookie` makes every user get a unique cache entry. Fix: minimize Vary header, use only `Accept-Encoding`
3. **Short TTLs** — Content expires before getting reused. Fix: increase TTL, use stale-while-revalidate
4. **Low traffic per PoP** — Not enough requests to fill the cache. Fix: reduce PoP count (use shield), or increase TTL
5. **Personalized content mixed with static** — Dynamic content going through CDN with no caching. Fix: separate static and dynamic content paths
6. **No Cache-Control headers** — CDN doesn't know what to cache. Fix: set explicit `Cache-Control: public, max-age=86400` on all cacheable responses

**Quick win:** Add an origin shield (mid-tier cache) — consolidates requests from multiple edge PoPs into one, dramatically increasing hit ratio.

---

**Q4. Can you put API responses on a CDN? When does this make sense?**

**A:**

**Yes, for certain API responses:**
- Product listings that change hourly
- Public search results
- Weather data, stock quotes (with short TTL)
- Any response that is the same for multiple users

**How to handle authentication:**
- Strip auth headers before cache lookup (CDN caches the response, not the auth)
- Use signed URLs / tokens that the CDN validates at the edge
- Edge computing (Lambda@Edge) can validate JWT at CDN, then serve cached response

**How to handle personalization:**
- Use `Vary` header carefully: `Vary: Accept-Language` → cache per language (manageable)
- Don't use `Vary: Cookie` (creates per-user cache = useless)
- For truly personalized data: don't CDN-cache it. Use Edge Compute to merge cached public data with user-specific data

**Cache invalidation:**
- Use content-based cache keys (hash of response) or short TTLs
- Instant invalidation via CDN API (CloudFront invalidation, Fastly instant purge)

---

**Q5. Compare CloudFront, Cloudflare, and Akamai for a video streaming platform serving 50M users globally.**

**A:**

| Factor | CloudFront | Cloudflare | Akamai |
|--------|-----------|------------|--------|
| **PoP count** | 400+ | 310+ | 4,000+ |
| **Video optimization** | Good (S3 origin, Lambda@Edge) | Stream product (newer) | Industry leader (adaptive bitrate, origin offload) |
| **Cost model** | Per-GB egress (can be expensive) | Flat rate (predictable) | Custom contracts (enterprise) |
| **AWS integration** | Native (S3, ALB, WAF) | Separate | Separate |
| **DDoS protection** | AWS Shield | Industry best (free tier included) | Prolexic (add-on) |
| **Edge compute** | Lambda@Edge / CloudFront Functions | Workers (most mature) | EdgeWorkers |
| **Best for** | AWS-native shops | Cost-conscious, security-first | Largest enterprises, broadcast media |

**For 50M video users:** Akamai (most media experience, largest PoP network). Cloudflare if cost-sensitive. CloudFront if already deep in AWS.

---

**Q6. You deploy a bug and need to clear all cached assets on your CDN immediately. Walk through the options.**

**A:**

| Approach | Speed | Cost | Recommendation |
|----------|-------|------|----------------|
| **Cache invalidation API** | Cloudflare: instant. CloudFront: 5-10 min | CloudFront: first 1000 free, then $0.005/path | Good for emergencies |
| **URL versioning / fingerprinting** | Instant (new URL = new cache) | Free | **Best practice — use by default** |
| **Short TTLs** | After TTL expires (minutes) | Higher origin load | Good as safety net |

**URL versioning (fingerprinting):**
- `app.a3f8b2c.js` instead of `app.js`
- New deployment = new hash = new URL = CDN fetches fresh copy
- Old cached version remains valid for users who haven't refreshed
- No invalidation needed — it's a new resource

**For emergencies:** Invalidate via API + deploy with new fingerprinted URLs simultaneously. Belt and suspenders.

---

**Q7. Your company operates in China where most Western CDNs don't have PoPs. How do you serve low-latency content?**

**A:**

**Regulatory context:** China requires ICP (Internet Content Provider) license for domains serving content within mainland China. Most Western CDNs lack PoPs inside the Great Firewall.

**Options:**
1. **Chinese CDN provider:** Alibaba Cloud CDN, Tencent CDN, or Baidu CDN. These have extensive PoPs within China and handle compliance
2. **ChinaCache or ChinaNetCenter:** CDN specialists for foreign companies entering China
3. **Joint venture:** Cloudflare has a partnership with JD Cloud for China. AWS has a separate China region (operated by Sinnet/NWCD)
4. **Multi-CDN:** Use a Chinese CDN inside China + global CDN everywhere else. Route via GeoDNS

**Architecture:** DNS geolocation routing sends Chinese users to the Chinese CDN origin. All others go to the global CDN. Content is replicated to both origins.

**Gotchas:** Content must comply with Chinese regulations (censorship). ICP license process takes weeks-months. Data may need to stay within China (data localization).

---

**Q8. How does a CDN edge server decide whether to serve a cached response or fetch from origin?**

**A:**

**Decision flow:**

1. **Request arrives at edge**
2. **Cache lookup** by key (usually: method + host + path + relevant query params + Vary headers)
3. **If HIT and fresh** (`age < max-age`): serve immediately — origin never contacted
4. **If HIT but stale:**
   - **If `stale-while-revalidate`:** Serve stale response, revalidate in background
   - **Otherwise:** Send conditional request to origin:
     - `If-None-Match: "etag_value"` (ETag-based)
     - `If-Modified-Since: Tue, 01 Jan 2026 00:00:00 GMT` (date-based)
   - Origin responds `304 Not Modified` → edge marks cache as fresh
   - Origin responds `200` with new content → edge updates cache
5. **If MISS:** Fetch from origin, cache the response (if cacheable), serve to client

**Key headers:**
- `Cache-Control: public, max-age=3600` — cache for 1 hour
- `Cache-Control: private` — user-specific, don't cache on CDN
- `Cache-Control: no-store` — never cache
- `ETag` — content fingerprint for conditional requests
- `Vary: Accept-Encoding` — cache separate copies for gzip vs br vs uncompressed

---

**Q9. You're using a CDN for static assets AND as a DDoS shield. The CDN has an outage. What happens?**

**A:**

**What happens:**
- Static assets: Users get errors (images broken, CSS missing, JS fails)
- DDoS protection: Origin is now directly exposed. If under attack, origin goes down too
- Dynamic traffic (if routed through CDN): Complete outage

**Failover design:**
1. **Multi-CDN with automatic switching:** Primary CDN fails → DNS/traffic manager routes to secondary CDN. Both CDNs warm with content
2. **Origin hardening:** Even without CDN, origin should handle some traffic. Auto-scale behind its own load balancer
3. **Separate DDoS from CDN:** Use a dedicated DDoS provider (AWS Shield Advanced, Cloudflare Spectrum) independent of the CDN
4. **DNS TTL:** Keep low enough for fast failover (60-120 seconds)
5. **Client-side resilience:** Service workers can serve cached static assets from browser cache even if CDN is down

---

**Q10. Build your own CDN using multi-region S3 vs use a third-party CDN?**

**A:**

| Factor | DIY (S3 + CloudFront per region) | Third-party CDN |
|--------|----------------------------------|-----------------|
| **PoPs** | Limited to AWS regions (~30) | Hundreds to thousands |
| **Latency** | Higher (fewer edge locations) | Lower (edge close to every user) |
| **Cost at scale** | S3 egress is expensive | Volume discounts, flat rate options |
| **Control** | Full (custom logic, edge compute) | Limited to CDN's features |
| **Ops burden** | High (sync buckets, manage routing, monitor each region) | Low (managed service) |
| **Video/streaming** | Build everything yourself | Built-in adaptive bitrate, HLS/DASH support |

**Verdict:** Use a third-party CDN for content delivery. It's cheaper, faster, and less operational burden. The only reasons to DIY: extreme customization needs, data sovereignty requirements, or you ARE a CDN company.

---

## 8. Load Balancers
[← Back to topic](08-Load-Balancers.md#-senior-interview-questions)

**Q1. 200+ microservices — centralized LB, per-service LB, or client-side load balancing?**

**A:**

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Centralized LB** | Simple ops, single config | SPOF, bottleneck at scale | Small deployments (<20 services) |
| **Per-service LB** | Isolation, independent scaling | Many LBs to manage, cost | Medium deployments on cloud (ALB per service) |
| **Client-side LB** | No LB infrastructure, lowest latency | Client complexity, library maintenance | gRPC, service mesh (Envoy sidecar) |

**For 200+ services:**
- **Kubernetes:** Use client-side load balancing via service mesh (Envoy sidecar / Istio) for east-west traffic. Use an Ingress controller (NGINX/ALB) for north-south (external) traffic
- **Without K8s:** Per-service ALBs with shared configuration management (Terraform). Client-side LB for gRPC services (grpc-lb)

---

**Q2. L4 vs L7 load balancing — differences and when to use each.**

**A:**

| Aspect | L4 (Transport) | L7 (Application) |
|--------|----------------|-------------------|
| **Operates on** | TCP/UDP packets (IP + port) | HTTP requests (URL, headers, cookies) |
| **Speed** | Very fast (no content inspection) | Slower (parses HTTP) |
| **Features** | Basic: round-robin, least connections | Content routing, auth, SSL termination, caching |
| **Use case** | High-throughput TCP (databases, gaming) | HTTP APIs, web apps, path-based routing |
| **SSL** | TCP passthrough or terminates | Always terminates (inspects content) |
| **AWS** | NLB (Network Load Balancer) | ALB (Application Load Balancer) |

**L3 (DSR — Direct Server Return):** Load balancer only handles inbound traffic. Responses go directly from server to client, bypassing the LB. Used for high-bandwidth responses (video streaming) where the LB would be a bandwidth bottleneck.

**When L4 is faster but L7 is necessary:** L4 can't do content-based routing (`/api/v1` → service A, `/api/v2` → service B). If you need smart routing, you need L7.

---

**Q3. Round-robin but one server is consistently slower. How do you detect and fix it?**

**A:**

**Detection:**
- Monitor per-server latency percentiles (P50, P99), not just averages
- Compare response times across all backends
- Check connection queue depth per server
- Track 5xx error rates per server

**The problem with round-robin:** It distributes requests equally regardless of server capacity or current load. A slow server gets the same number of requests as fast ones → requests queue up → cascading delays.

**Better algorithms:**
- **Least connections:** Routes to the server with fewest active connections. Naturally shifts traffic away from slow servers
- **Weighted round-robin:** Assign lower weight to the slower server (manual intervention)
- **Least response time:** Routes to the server with lowest latency. Automatically adapts to speed differences
- **Power of two choices:** Pick 2 random servers, send to the one with fewer connections. Simple and effective

**Best for this scenario:** Least connections or least response time — both are adaptive without manual tuning.

---

**Q4. Serving WebSocket connections for real-time chat. How does this affect load balancing?**

**A:**

**Challenge:** WebSocket connections are long-lived (minutes to hours). This breaks typical LB assumptions:
- **Connection draining takes forever:** Can't drain a server with 10,000 active WebSocket connections
- **Load imbalance:** Early servers accumulate connections over time (connection affinity)
- **L7 inspection limited:** After the WebSocket upgrade, the LB can't inspect individual messages

**Load balancing strategy:**
1. **Use L4 (NLB) or L7 with WebSocket support:** ALB supports WebSocket. NLB works natively (TCP)
2. **Connection-aware balancing:** Track connection count, not request count. Use "least connections"
3. **Sticky sessions NOT needed:** WebSocket is inherently sticky (single TCP connection). The challenge is initial placement, not ongoing routing
4. **Graceful shutdown:** When deploying new versions, signal clients to reconnect (send a "reconnect" message). Stop accepting new connections. Wait for existing connections to reconnect naturally (or force after timeout)

**Scaling architecture:** Don't route messages through the WebSocket server. Use pub/sub (Redis Pub/Sub, Kafka) for message fanout. WebSocket servers are just connection holders.

---

**Q5. "The load balancer itself is a SPOF." How do you make it highly available?**

**A:**

**Layer it:**

1. **DNS round-robin (L1):** Multiple A records pointing to multiple LB IPs. Simple but no health checking
2. **BGP Anycast:** Same IP advertised from multiple locations. Network routes to nearest. Used by Cloudflare, major CDNs
3. **Keepalived / VRRP (on-prem):** Two LB machines share a virtual IP (VIP). Active-passive with automatic failover via heartbeat. If active dies, passive takes over the VIP in <5 seconds
4. **Cloud-native (ALB/NLB):** AWS manages HA for you — ALB runs across multiple AZs automatically. This is the easiest and most common approach

**Defense in depth:** DNS → Global LB (GSLB) → Regional LB (ALB/NLB with multi-AZ) → Per-service LB. Each layer adds redundancy.

---

**Q6. How does the load balancer participate in rolling deployments?**

**A:**

**Rolling deployment flow:**
1. Deploy new version to server N+1 (or in-place on server 1)
2. LB health check detects new instance is healthy → adds to pool
3. LB starts **connection draining** on old server 1: stops sending NEW requests, waits for in-flight requests to complete (drain timeout: 30-60s)
4. Old server 1 removed from pool, shut down
5. Repeat for each server

**LB features used:**
- **Health checks:** `/health` endpoint returns 200 only when fully initialized (DB connected, caches warm)
- **Connection draining:** Graceful shutdown — don't kill mid-request
- **Deregistration delay:** Wait N seconds after removing before killing (ALB: deregistration_delay)

**Advanced patterns:**
- **Blue-green:** Two full environments behind LB. Switch LB from blue to green instantly. Rollback = switch back
- **Canary:** LB sends 5% traffic to new version. Monitor errors. Gradually increase to 100%
- **Weighted target groups (ALB):** Route by percentage — `v1: 90%, v2: 10%`

---

**Q7. Hardware LBs (F5) vs software LBs (HAProxy/NGINX) vs cloud-native (ALB/NLB). When would you still buy hardware?**

**A:**

| Factor | Hardware (F5) | Software (HAProxy/NGINX) | Cloud (ALB/NLB) |
|--------|--------------|-------------------------|-----------------|
| **Throughput** | 100+ Gbps | 10-40 Gbps (depends on server) | Auto-scales |
| **Cost** | $50K-$500K | Free (open source) + server cost | Pay per use |
| **SSL offload** | Hardware ASIC (fastest) | Software (good enough) | Managed |
| **Features** | Proprietary, mature | Highly configurable, scriptable | Limited to provider features |
| **Ops** | Vendor support, appliance | You manage | Fully managed |

**When hardware LBs in 2025:**
- Ultra-low latency requirements (financial trading: hardware SSL is faster)
- On-premise datacenters with no cloud path
- Regulatory requirements mandating physical appliances
- Legacy enterprise environments with existing F5 expertise
- Extremely high throughput needs (100 Gbps+)

**For most companies:** Cloud LBs (ALB/NLB) — zero ops, auto-scales, integrates with cloud ecosystem.

---

**Q8. 10,000 users lose sessions when a server with sticky sessions goes down. How do you fix this?**

**A:**

**Root problem:** Session state stored in the server's memory. Server dies = state lost.

**Solutions (progressively better):**

1. **External session store (Redis/Memcached):**
   - All servers read/write sessions to shared Redis
   - Any server can serve any user
   - If a server dies, users are routed elsewhere — session intact in Redis
   - Add Redis replication for HA

2. **JWT (client-side sessions):**
   - Encode session data in a signed token stored in the client (cookie/header)
   - Server is stateless — no session storage at all
   - Limitation: Can't invalidate easily, size limit (~4KB)
   - Best for: authentication state

3. **Session replication:**
   - Replicate session data across servers (Tomcat cluster, Hazelcast)
   - Any server has a copy
   - Overhead: replication traffic grows with cluster size

**Best practice:** Redis-backed sessions + JWT for authentication state. Remove sticky sessions entirely. Stateless servers are infinitely easier to scale and deploy.

---

**Q9. Global LB vs local LB. Routing US users to us-east and EU users to eu-west.**

**A:**

**Architecture:**

```
User → DNS (Global LB / GSLB)
         ├── US user → us-east Regional LB → us-east servers
         └── EU user → eu-west Regional LB → eu-west servers
```

**Global LB (GSLB) layer:**
- DNS-based: Route 53 geolocation/latency routing, Cloudflare Load Balancing
- Resolves domain to the nearest region's LB IP
- Health checks on each region — if us-east is down, US users go to eu-west

**Regional LB layer:**
- ALB/NLB within each region
- Distributes across multiple AZs within the region
- Handles SSL termination, path routing, health checks

**Combination:**
- GSLB for region selection (coarse-grained, DNS-based)
- Regional ALB for server selection (fine-grained, connection-based)
- Optionally: Service mesh for inter-service LB within a region

---

**Q10. SSL termination consuming significant CPU for 100K concurrent TLS connections. How do you scale?**

**A:**

**Options:**

1. **TLS session resumption:** Clients reuse previous session keys. Eliminates the expensive key exchange on subsequent connections. Reduces CPU by 50%+. Enable `ssl_session_cache` in NGINX

2. **TLS 1.3:** Faster handshake (1-RTT vs 2-RTT). 0-RTT for returning clients. Uses more efficient ciphers. Upgrade if still on TLS 1.2

3. **ECDSA certificates (instead of RSA):** ECDSA signing is 10-20x faster than RSA-2048. Less CPU per handshake. Modern browsers support ECDSA

4. **Hardware acceleration:** AWS NLB/ALB handles TLS natively with custom hardware. On-prem: Intel AES-NI instructions (CPU-level), or F5 with hardware ASIC

5. **Horizontal scaling:** Add more LB instances. Cloud LBs do this automatically. For NGINX: run multiple instances behind a L4 LB

6. **Offload to CDN:** CDN terminates TLS at the edge. Connection between CDN and origin can use simpler TLS or even HTTP (in a trusted network)

**Most effective combination:** TLS 1.3 + ECDSA + session resumption + CDN termination. This handles 100K+ concurrent connections on modest hardware.

---

## 9. Reverse Proxy
[← Back to topic](09-Reverse-Proxy.md#-senior-interview-questions)

**Q1. When do you need a reverse proxy if you already have a load balancer?**

**A:**

A load balancer distributes traffic. A reverse proxy does much more:

**Value beyond load distribution:**
1. **SSL termination** — Offload TLS from application servers
2. **Compression** — gzip/brotli responses before sending to clients, reducing bandwidth
3. **Response caching** — Cache static and semi-static responses at the proxy layer
4. **Request transformation** — Add/remove headers, rewrite URLs, normalize requests
5. **Security** — Hide backend topology, rate limiting, WAF integration
6. **Static file serving** — Serve static assets directly without hitting app servers
7. **Protocol translation** — Accept HTTP/2 from clients, proxy as HTTP/1.1 to backends.
8. **Canary routing** — Route 5% traffic to new version based on headers/cookies

**When you need a reverse proxy + LB:** When you need application-layer intelligence (L7) beyond just distributing connections. Most modern reverse proxies (NGINX, Envoy) include load balancing as one of their features.

---

**Q2. You serve mobile clients (bandwidth-sensitive) and internal services (latency-sensitive). How do you configure a reverse proxy?**

**A:**

**Mobile clients:**
- Enable aggressive compression (Brotli > gzip, response body compression)
- Serve WebP/AVIF images instead of PNG/JPEG (content negotiation via `Accept`)
- Enable HTTP/2 multiplexing (fewer connections over cellular)
- Cache-Control headers with long TTL for static assets
- Minimize response payloads (field filtering, pagination)

**Internal services:**
- Disable compression (CPU cost > bandwidth savings on local network)
- Use HTTP/1.1 with keep-alive or gRPC (HTTP/2) for persistent connections
- Connection pooling to backends (reuse connections)
- Minimal request transformation (avoid unnecessary processing)
- Short timeouts (internal calls should be fast)

**Proxy configuration approach:**
- Two NGINX server blocks (or Envoy filter chains) — one for external (port 443), one for internal (port 8080)
- Different proxy settings per upstream group
- Or: Use an API gateway for external + direct gRPC for internal

---

**Q3. Compare NGINX, HAProxy, Envoy, and Traefik as reverse proxies. Which for Kubernetes?**

**A:**

| Feature | NGINX | HAProxy | Envoy | Traefik |
|---------|-------|---------|-------|---------|
| **L7 routing** | Excellent | Good | Excellent | Good |
| **gRPC support** | Good | Limited | Native | Good |
| **Dynamic config** | Reload required | Reload required | Hot reload (xDS API) | Auto-discovery |
| **Observability** | Basic | Good (stats page) | Excellent (distributed tracing) | Good |
| **Service mesh** | NGINX Service Mesh | N/A | Istio sidecar | N/A |
| **K8s native** | NGINX Ingress (most popular) | HAProxy Ingress | Envoy Ingress (Contour, Emissary) | Native K8s Ingress |
| **Best for** | General web, high perf | TCP/high throughput | Microservices, service mesh | Auto-discovery, Let's Encrypt |

**For Kubernetes:** Envoy (via Istio or standalone) for service mesh needs. NGINX Ingress for simple ingress. Traefik for auto-discovery simplicity with Let's Encrypt.

---

**Q4. Traffic between reverse proxy and backend is unencrypted. Is this a problem?**

**A:**

**When it's acceptable:**
- Reverse proxy and backends are on the same trusted network (VPC, private subnet)
- No regulatory requirement for encryption in transit
- Network is isolated with security groups/firewalls

**When you need end-to-end encryption (mTLS):**
- Zero-trust security model (all traffic encrypted, even internal)
- Compliance requirements (PCI-DSS, HIPAA, SOC 2 for sensitive data)
- Multi-tenant infrastructure where networks are shared
- Service mesh (Istio auto-mTLS between sidecars)

**mTLS (mutual TLS):**
- Both client and server present certificates and verify each other
- Prevents: eavesdropping on internal traffic, service impersonation
- Overhead: ~1-5% CPU increase, certificate management complexity
- Service mesh makes this transparent — Envoy sidecars handle mTLS automatically

---

**Q5. Reverse proxy vs API gateway vs service mesh sidecar — differences and overlap.**

**A:**

| Feature | Reverse Proxy | API Gateway | Service Mesh Sidecar |
|---------|--------------|-------------|---------------------|
| **Primary role** | Route & optimize HTTP | External API management | Inter-service communication |
| **Position** | Edge (front of app) | Edge (front of APIs) | Beside each service |
| **Auth** | Basic (IP, header) | Full (OAuth, JWT, API key) | mTLS (identity) |
| **Rate limiting** | Basic | Advanced (per-user, per-tier) | Per-service |
| **Traffic control** | Round-robin, least conn | Canary, A/B by header | Circuit break, retry, timeout |
| **Observability** | Access logs | API analytics, usage tracking | Distributed tracing, metrics |
| **Example** | NGINX | Kong, AWS API Gateway | Envoy (Istio sidecar) |

**When to use all three together:**
- API Gateway at the edge for authentication, rate limiting, external routing
- Reverse proxy (NGINX) for SSL termination, compression, static files
- Service mesh (Envoy sidecars) for inter-service mTLS, retries, circuit breaking

In practice, they often consolidate: Envoy can act as reverse proxy + service mesh. Kong can act as API gateway + reverse proxy.

---

**Q6. NGINX caches API responses but a user updates their profile and sees stale data. How do you handle cache invalidation?**

**A:**

**Options:**

1. **Cache-Control headers from the app:**
   - `Cache-Control: no-cache` for user-specific endpoints (profile, settings)
   - `Cache-Control: public, max-age=300` for shared content (product listings)
   - Simplest approach: let the app decide what's cacheable

2. **Bypass cache on mutations:**
   - POST/PUT/DELETE → bypass cache + purge related cached keys
   - NGINX: `proxy_cache_bypass $request_method;` for non-GET

3. **Cache key design:**
   - Include user ID in cache key for personalized responses
   - `proxy_cache_key "$scheme$host$uri$arg_user_id";`
   - Different users get different cached entries

4. **Purge API:**
   - App calls NGINX purge endpoint after data changes
   - `PURGE /api/users/123/profile` → NGINX invalidates that cache entry
   - Requires nginx-cache-purge module

5. **Event-driven invalidation:**
   - App publishes "user.updated" event → cache invalidation service sends PURGE requests
   - Most scalable but most complex

**Simplest fix for this scenario:** Don't cache user-specific API responses at the proxy level. Cache only truly shared, slowly-changing content.

---

**Q7. Your reverse proxy is a SPOF. How do you make it HA?**

**A:**

**On-premise:**
1. **Keepalived + VRRP:** Two NGINX instances share a Virtual IP (VIP). Active-passive. If active dies, passive takes over VIP in <3 seconds. The VIP is what DNS points to
2. **DNS round-robin:** Multiple A records pointing to multiple proxy IPs. No health checking (clients retry on failure)
3. **Corosync/Pacemaker:** More sophisticated cluster manager. Active-passive or active-active with shared state

**Cloud:**
1. **Cloud LB in front of proxies:** NLB → multiple NGINX instances across AZs. NLB is inherently HA (managed by AWS)
2. **Auto-scaling group:** NGINX instances in ASG with health checks. Failed instance → replaced automatically
3. **Managed reverse proxy:** Use ALB directly — it IS the HA reverse proxy

**Best practice:** Cloud → ALB/NLB (zero ops HA). On-prem → Keepalived + VRRP pair. Don't run a single NGINX instance in production.

---

**Q8. Using reverse proxy for rate limiting instead of application-level. Pros and cons?**

**A:**

| Factor | Proxy-level Rate Limiting | Application-level |
|--------|--------------------------|-------------------|
| **Performance** | Fast (before hitting app) | Slower (request parsed, auth done) |
| **Granularity** | IP, path, basic headers | Per-user, per-account, per-feature |
| **Context** | No user identity (pre-auth) | Full user context (after auth) |
| **Config** | NGINX `limit_req` (simple) | Code changes (flexible) |
| **Distributed** | Each proxy has local counters | Can use shared Redis counter |

**When proxy-level fails:**
- Per-user rate limiting (proxy doesn't know who the user is before auth)
- Tiered limits (free vs paid users)
- API key-based limits
- Complex policies (100 reads/min but only 10 writes/min)

**Best practice:** Both! Proxy-level for DDoS protection (rough IP-based limits), application-level for business logic rate limiting (per-user, per-tier).

---

**Q9. How does a reverse proxy handle WebSocket connections differently from HTTP?**

**A:**

**The upgrade flow:**
1. Client sends HTTP request with `Upgrade: websocket` and `Connection: Upgrade` headers
2. Proxy must pass these headers through to the backend (not strip them)
3. Backend responds `101 Switching Protocols`
4. Proxy switches from HTTP mode to TCP tunnel mode
5. All subsequent data is bidirectional, binary frames — proxy can't inspect content

**Configuration challenges:**
1. **Timeouts:** WebSocket connections are long-lived. Default proxy timeouts (60 seconds) will kill them. Set `proxy_read_timeout 3600s;` or higher
2. **Buffering:** Disable response buffering for WebSocket (`proxy_buffering off;`)
3. **Connection limits:** Each WebSocket holds a connection. 10,000 concurrent users = 10,000 connections through the proxy. Size connection limits accordingly
4. **Health checks:** Can't use WebSocket connections for health checks. Need a separate HTTP health endpoint
5. **Load balancing:** Once a WebSocket is established, it's pinned to one backend. "Least connections" is the best algorithm (not round-robin)

---

**Q10. Route /api/v1/* to Service A, /api/v2/* to Service B, serve static files directly. Performance implications?**

**A:**

**NGINX configuration:**
```nginx
location /static/ {
    root /var/www;              # Serve directly from disk (fastest)
    expires 30d;
}

location /api/v1/ {
    proxy_pass http://service_a;
}

location /api/v2/ {
    proxy_pass http://service_b;
}
```

**Performance implications of complex routing:**
- **NGINX location matching is fast** — uses a prefix tree. Even with hundreds of routes, lookup is O(log n)
- **Regex locations are slower:** `location ~ /api/v[0-9]+/` requires regex evaluation. Use prefix matches (`location /api/v1/`) when possible
- **Per-location configuration overhead:** Different SSL certs, compression settings, and timeouts per location add memory but negligible CPU
- **Connection pooling per upstream:** Each service gets its own connection pool. More upstreams = more idle connections held open

**Scaling this pattern:** For 50+ routing rules, switch to a more purpose-built solution (Envoy with route configuration, Kong API gateway, or Kubernetes Ingress).

---

## 10. Application Layer
[← Back to topic](10-Application-Layer.md#-senior-interview-questions)

**Q1. Migrating a monolith to microservices. 50 tightly-coupled modules. How do you decide what to extract first?**

**A:**

**Strategy: Strangler Fig Pattern** — wrap the monolith, incrementally extract modules.

**Prioritization criteria (extract FIRST):**
1. **Highest independent scaling need** — Component that needs 10x more resources than the rest (e.g., image processing)
2. **Fastest rate of change** — Module deployed 5x/week while others deploy monthly. Extraction enables independent deployment
3. **Clearest domain boundary** — Module with minimal coupling to others (bounded context). E.g., notifications, email service
4. **Team ownership alignment** — A team fully owns a module → extract it so they can deploy independently

**DO NOT extract first:**
- Shared data models used by 20+ modules (causes distributed monolith)
- Auth/user service (everything depends on it — extract last)
- Core business logic with tight coupling (needs refactoring first)

**Process:**
1. Identify the module → build a new service implementing the same interface
2. Route traffic to new service via proxy (feature flag / API gateway)
3. Run both in parallel, compare results
4. Cut over, remove dead code from monolith

---

**Q2. "Microservices solve all scaling problems." What are the top 5 problems they introduce?**

**A:**

1. **Distributed systems complexity:** Network failures, partial failures, eventual consistency — problems that didn't exist in a monolith
2. **Operational overhead:** 100 services = 100 CI/CD pipelines, 100 log streams, 100 monitoring dashboards, 100 things to deploy/version/secure
3. **Data consistency:** No more ACID transactions across a join. Need sagas, eventual consistency, outbox pattern
4. **Debugging difficulty:** A single user request touches 12 services. Requires distributed tracing, correlation IDs, centralized logging
5. **Latency overhead:** Inter-service calls add network hops. 5 synchronous calls = 5× network latency. gRPC helps but doesn't eliminate it

**When monolith is better:**
- Small team (<10 engineers)
- New product still pivoting (monolith is faster to iterate)
- Simple domain model (no complex scaling requirements)
- When you don't have the DevOps maturity for microservices (CI/CD, monitoring, containerization)

---

**Q3. 100 microservices, new feature requires atomic changes to 7. How do you handle cross-service transactions?**

**A:**

**Option 1: Two-Phase Commit (2PC):**
- Coordinator asks all 7 services to PREPARE (lock resources)
- If all say YES → COMMIT. If any says NO → ABORT
- **Problem:** Blocking protocol. If coordinator crashes after PREPARE, all 7 services hold locks indefinitely. Very slow. Rarely used in microservices

**Option 2: Saga (Choreography):**
- Each service completes its step and publishes an event
- Next service reacts to the event
- On failure: each service publishes a compensating event (undo)
- **Pros:** Decoupled, scalable. **Cons:** Hard to debug, no central view

**Option 3: Saga (Orchestration):**
- Central orchestrator (saga coordinator) directs each step
- Step 1 → Step 2 → ... → Step 7. On failure at step 4: compensate 3, 2, 1
- **Pros:** Clear workflow, easier to debug. **Cons:** Orchestrator is a SPOF / bottleneck

**Best practice:** Saga orchestration for complex workflows (7 services = complex). Use a workflow engine (Temporal, Cadence) that handles retries, compensation, and state persistence.

---

**Q4. Service C is slow. How does this cascade to Service A? What patterns prevent it?**

**A:**

**Cascade mechanism:**
- A calls B (fast, 50ms) → B calls C (slow, 30 seconds) → B's thread pool fills up waiting for C → B can't accept new requests → A's calls to B timeout → A's thread pool fills up → **Total system failure**

**Defense patterns:**

| Pattern | How It Helps |
|---------|-------------|
| **Timeout** | A sets 2s timeout on B. B sets 500ms on C. Fail fast rather than wait forever |
| **Circuit breaker** | After 5 failures to C, B stops calling C. Returns fallback immediately |
| **Bulkhead** | B isolates C's thread pool. Only 10 threads for C-calls. Other threads free for other work |
| **Timeout budget** | Total request budget = 5s. A gives B 3s. B gives C 1s. Prevents deep chains consuming all time |
| **Async/queue** | B doesn't call C synchronously. Puts request in queue. C processes when ready |

**Implementation:** Use all together. Timeout (innermost) + circuit breaker (detects pattern) + bulkhead (limits blast radius) + graceful degradation (return partial result without C's data).

---

**Q5. Compare Consul, Eureka, etcd, and Kubernetes DNS for service discovery.**

**A:**

| Feature | Consul | Eureka | etcd | K8s DNS |
|---------|--------|--------|------|---------|
| **Type** | Service mesh + discovery | Client-side registry | Key-value store | Built-in DNS |
| **Health checks** | Rich (HTTP, TCP, gRPC, script) | Heartbeat only | External (no built-in) | Liveness + readiness probes |
| **DNS interface** | Yes (SRV records) | No (HTTP API only) | No | Yes (native) |
| **Multi-DC** | Yes (WAN gossip) | Limited | Via Raft (single cluster) | Federation (complex) |
| **Best for** | Multi-cloud, hybrid | Spring Boot / Java shops | K8s backing store | Pure K8s environments |

**For 500 services on K8s:** Kubernetes DNS (CoreDNS) + service mesh (Istio/Linkerd) for advanced routing. No additional service registry needed — K8s is the registry.

**For hybrid cloud/on-prem:** Consul — supports multi-DC, multi-cloud, and provides DNS + HTTP interfaces for any language.

---

**Q6. "Distributed monolith" anti-pattern — how to detect and fix it?**

**A:**

**Symptoms of a distributed monolith:**
- Services must be deployed together (change in A requires deploy of B)
- Shared database between services
- Synchronous call chains (A→B→C→D for every request)
- One service going down takes down all others
- Shared libraries with business logic (changes require all consumers to update)

**Detection:**
- Map service dependencies (dependency graph). Look for cycles and tight clusters
- Track deployment coupling — if services always deploy together, they're coupled
- Measure blast radius — taking down one service impacts how many others?
- Code analysis — shared data models, tight API coupling

**Fixes:**
1. **Database per service:** Each service owns its data. Communicate via APIs or events, not shared tables
2. **Async communication:** Replace synchronous chains with event-driven. A publishes event, B reacts asynchronously
3. **API contracts:** Formal contracts (OpenAPI, protobuf) with backward compatibility guarantees
4. **Eliminate shared libraries:** Extract shared business logic into a service, or duplicate it (DRY is less important than independence)
5. **Independence test:** Can each service be deployed, tested, and scaled independently? If not, it's still a monolith

---

**Q7. API gateway becomes a bottleneck or "god service." How do you scale it?**

**A:**

**When the gateway becomes problematic:**
- All traffic flows through one service → SPOF
- Complex routing logic, auth, transformation, rate limiting all in one place
- Changes to the gateway require coordinated deployments
- Latency increases as more logic is added

**Scaling strategies:**
1. **Horizontal scaling:** Run multiple gateway instances behind a load balancer. Stateless design (all state in Redis/DB)
2. **Federated gateways:** One gateway per domain (users-gateway, orders-gateway). Each team manages their own
3. **BFF pattern (Backend-for-Frontend):** Separate gateways for web, mobile, and internal APIs. Each optimized for its client
4. **Offload to service mesh:** Move auth, retries, circuit breaking to sidecar proxies (Envoy). Gateway only handles external routing
5. **Edge compute:** Move simple logic (auth verification, rate limiting) to CDN edge workers

**When to consider mesh:** >50 services, >10K req/sec through gateway, team can manage mesh complexity.

---

**Q8. Greenfield system, 5 engineers. Case for starting with modular monolith.**

**A:**

**Why monolith for a small team:**
- **Deployment:** One deploy vs 10. One CI pipeline vs 10
- **Debugging:** Single process, single debugger, single log file. No distributed tracing needed
- **Transactions:** ACID transactions across all modules. No saga complexity
- **Speed:** SSA to build features fast. Refactor easily
- **Infra:** One server, one database. Minimal DevOps knowledge needed

**How to make it modular (ready to split later):**
- Enforce module boundaries (separate packages/namespaces)
- Each module has a clear API layer (no reaching into another module's internals)
- Separate database schemas per module (shared DB, separate schemas)
- No shared mutable state between modules
- Integration tests at module boundaries

**Criteria to split:**
- Team grows to 10+ engineers (coordination cost > monolith productivity)
- One module needs independent scaling (e.g., 10x more CPU for ML inference)
- Deployment conflicts (teams blocking each other's releases)
- Different runtime requirements (one module needs Python, rest is Go)

---

**Q9. Shared data needed by 10 services. How do you handle it?**

**A:**

| Approach | Pros | Cons |
|----------|------|------|
| **Shared DB** | Simple, strong consistency, JOIN support | Tight coupling, schema changes affect everyone, scaling bottleneck |
| **API calls** | Clear ownership, encapsulation | Latency (network hop), availability dependency, N+1 problem at scale |
| **Event replication** | Decoupled, each service has local copy, fast reads | Eventual consistency, storage duplication, schema sync overhead |
| **Data mesh** | Domain-owned data products, self-serve access | Organizational complexity, requires data platform team |

**Recommendation by scenario:**
- 3-5 services needing user data → **API calls** (simple, don't over-engineer)
- 10+ services, high read volume → **Event replication** (publish UserUpdated events, each service builds local view)
- Large org with data teams → **Data mesh** (domain teams own their data as products)

**Never do:** Give all 10 services write access to the same table. That's a distributed monolith with extra steps.

---

**Q10. High latency in a request fanning out to 12 microservices. How do you trace and optimize?**

**A:**

**Tracing:**
1. **Distributed tracing (Jaeger/Zipkin/Datadog):** Inject trace_id at entry point. Each service propagates it. Visualize the entire call graph as a flame chart
2. **Identify the critical path:** Which calls are sequential? Which are parallel? The longest sequential chain determines total latency

**Optimization strategies:**

1. **Parallelize independent calls:** If services A, B, C don't depend on each other's results, call all three simultaneously. Latency = max(A,B,C) instead of A+B+C

2. **Service aggregation (BFF):** Create an aggregation service that combines data from multiple services in one response. Mobile calls 1 endpoint instead of 12

3. **Caching:** If some of the 12 services return slowly-changing data, cache their responses. Skip the call entirely

4. **Async for non-critical data:** User-facing response needs only 4 of the 12 calls. The other 8 (analytics, logging, recommendations) can be async

5. **Data locality:** If the fan-out is because data is spread across 12 services, consider denormalization — pre-compute and store a combined view

6. **Timeout budgets:** Allocate a total timeout (e.g., 3 seconds). If any service doesn't respond in time, return partial results with graceful degradation

---

## 11. Databases
[← Back to topic](11-Databases.md#-senior-interview-questions)

**Q1. 1 billion rows of user activity data per day. Walk through database choice, schema, and partitioning.**

**A:**

**Database choice:** Time-series / columnar store. Not a traditional RDBMS.
- **Best:** ClickHouse, TimescaleDB, or Apache Druid for analytics. Cassandra for write-heavy with simple reads
- **Why not PostgreSQL:** Single-node can't ingest 1B rows/day (~11.5K writes/sec sustained). Joins and indexing overhead at this volume is prohibitive

**Schema design:**
- Partition key: `user_id` (distributes evenly) or `date` (time-based partitioning)
- Clustering: `timestamp DESC` (most queries want recent data)
- Denormalize: embed metadata inline (no joins at this scale)

**Partitioning strategy:**
- **Time-based partitioning:** One partition per day. Old partitions → cold storage (S3/Glacier) after 90 days
- **Hash partitioning on user_id:** For user-specific queries. 256+ partitions across cluster
- **Hybrid:** Partition by date (first level), then by user_id hash (second level)

**Queries spanning multiple partitions:** Use a scatter-gather pattern. Query each partition in parallel, aggregate results. This is how ClickHouse and Druid work natively.

---

**Q2. Compare PostgreSQL internals (B-tree, MVCC, WAL) vs Cassandra internals (LSM tree, SSTables, compaction).**

**A:**

| Aspect | PostgreSQL | Cassandra |
|--------|-----------|-----------|
| **Index structure** | B-tree (balanced, in-place updates) | LSM tree (append-only, merge on compaction) |
| **Writes** | Update in-place + WAL. Slower (random I/O) | Append to memtable → flush to SSTable. Fast (sequential I/O) |
| **Reads** | B-tree lookup: O(log n), single I/O path | May check memtable + multiple SSTables. Bloom filters help |
| **Concurrency** | MVCC: readers don't block writers. Each txn sees a snapshot | No transactions. Last-write-wins per cell |
| **Storage** | Heap files with TOAST for large values | SSTables (sorted, immutable files) |
| **Maintenance** | VACUUM (reclaim dead tuples) | Compaction (merge SSTables) |

**Architectural fit:**
- PostgreSQL: Read-heavy, complex queries, transactions, small-medium datasets (<10TB)
- Cassandra: Write-heavy, simple queries (by partition key), massive datasets (petabytes), multi-DC replication

---

**Q3. Your sharded database has a hot partition — one shard gets 80% of writes. How do you fix it?**

**A:**

**How it happened:**
- Bad shard key: e.g., sharding by `country` and 80% of users are in the US
- Temporal hot spot: sharding by `date` and today's shard gets all current writes
- Celebrity problem: one user_id generates disproportionate traffic

**Fixes:**

1. **Better shard key:** Composite key that distributes evenly. `hash(user_id)` instead of `country`. Add salt/prefix to time-based keys: `random_prefix:2026-02-28`

2. **Consistent hashing with virtual nodes:** Each physical shard has 100+ virtual nodes. Data distributes more evenly. Adding a shard rebalances only ~1/N of the data

3. **Shard splitting:** Split the hot shard into 2-4 shards. Requires data migration. Most managed databases support this (DynamoDB adaptive capacity, Vitess resharding)

4. **Write buffering:** Batch writes to the hot shard in a queue. Smooth out burst writes

5. **Application-level scatter:** For counters or aggregates, split into N sub-keys across shards. Aggregate on read. (Same as sharded counter pattern)

---

**Q4. When would you use both SQL and NoSQL in the same system?**

**A:**

**Concrete architecture — E-commerce platform:**
- **PostgreSQL (SQL):** Orders, payments, user accounts — need ACID transactions
- **Elasticsearch (NoSQL):** Product search — full-text search, faceted navigation
- **Redis (NoSQL):** Session storage, shopping cart — fast key-value access
- **Cassandra (NoSQL):** Activity logs, event tracking — high write throughput, time-series

**Data flow between them:**
- Source of truth: PostgreSQL (orders, users, products)
- CDC (Change Data Capture) via Debezium: Streams changes from PostgreSQL to Kafka
- Kafka consumers update Elasticsearch index (search), Cassandra (analytics), and Redis (cache)

**Keeping them in sync:**
- CDC is the safest: captures all changes from the DB's WAL
- Avoid dual writes (writing to both SQL and NoSQL from the app) — invariably breaks consistency
- Accept eventual consistency between systems (search index may be seconds behind the DB)

---

**Q5. Add a column to a table with 10 billion rows with zero downtime.**

**A:**

**Naive approach (DON'T):** `ALTER TABLE ADD COLUMN` → locks the table for hours. Downtime.

**Online DDL migration (Expand-and-Contract):**

1. **Expand:** Create the new column with a default value (PostgreSQL 11+ does this without rewriting the table — instant for NOT NULL with default)

2. **If PostgreSQL < 11, or MySQL:**
   - Use `gh-ost` (GitHub's online schema migration) or `pt-online-schema-change` (Percona)
   - Creates a shadow table with the new schema
   - Triggers copy rows in batches (non-blocking)
   - Replays concurrent DML changes
   - Atomic rename at the end

3. **Dual-write phase:** Application writes to both old and new columns. Backfill old rows with a batch script

4. **Contract:** Once all rows are populated and app only reads the new column, drop the old column (if replacing)

**Key principles:**
- Never hold a lock for more than milliseconds
- Make the migration reversible at every step
- Backfill in small batches with sleeps between to avoid load spikes

---

**Q6. Explain the N+1 query problem. How do ORMs cause it? Three fixes.**

**A:**

**The problem:**
```
# Fetch 100 orders (1 query)
orders = Order.all()

# For each order, fetch the user (100 queries!)
for order in orders:
    print(order.user.name)
```
Total: 1 + 100 = 101 queries instead of 1-2.

**Why ORMs cause it:** Lazy loading by default. `order.user` triggers a query only when accessed. Looks clean in code, terrible in practice.

**Three fixes:**

1. **Eager loading (JOIN):**
   ```sql
   SELECT * FROM orders JOIN users ON orders.user_id = users.id
   ```
   Django: `Order.objects.select_related('user')`
   SQLAlchemy: `query.options(joinedload(Order.user))`

2. **Batching (IN clause):**
   ```sql
   SELECT * FROM users WHERE id IN (1, 2, 3, ..., 100)
   ```
   Only 2 queries total. Django: `prefetch_related('user')`

3. **DataLoader pattern (GraphQL):**
   Collect all IDs requested in a tick, issue one batched query. Useful for GraphQL resolvers

**Critical at scale:** At 10,000 orders, N+1 means 10,001 queries. At 1M: your DB dies. Always check query count in development.

---

**Q7. Read replicas have 5-second replication lag. User writes then immediately reads stale data. Fix without routing all reads to primary.**

**A:**

**Solutions (from cheapest to most expensive):**

1. **Read-your-writes routing (session-aware):**
   - After a write, set a session cookie with the write timestamp
   - For N seconds after a write, route THAT user's reads to the primary
   - Other users still read from replicas
   - Most reads go to replicas; only post-write reads go to primary

2. **Causal consistency token:**
   - Write returns a monotonic position (LSN/GTID)
   - Read request includes: "I need data at least as fresh as position X"
   - Replica checks if it has applied position X. If yes → serve. If no → wait or redirect to primary

3. **Client-side optimistic update:**
   - After writing, client locally applies the change to its UI state
   - When the replica catches up, the next read confirms the change
   - User never sees stale data (client-side already shows the update)

4. **Synchronous replication (last resort):**
   - At least one replica is synchronously replicated (zero lag)
   - Route read-your-writes to that replica specifically

---

**Q8. Compare DynamoDB single-table design vs traditional multi-table relational.**

**A:**

| Aspect | Single-Table (DynamoDB) | Multi-Table (Relational) |
|--------|------------------------|-------------------------|
| **Access pattern** | Must know ALL access patterns upfront | Can add queries later (just write SQL) |
| **Modeling** | Overloaded PK/SK with GSIs for different entity types | Normalized tables with FKs |
| **Joins** | No joins — denormalize / pre-join | Easy JOINs at query time |
| **Scaling** | Automatic horizontal scaling | Manual sharding |
| **Reads** | Single query returns multiple entity types | Multiple JOINs for complex reads |
| **Maintenance** | Hard to understand schema, hard to evolve | Self-documenting schema |

**When single-table shines:**
- Well-understood, stable access patterns (e.g., "get user + their orders + their address by user_id")
- Extreme scale (millions of req/sec)
- Low-latency requirement (single query vs multiple joins)

**When it becomes unmaintainable:**
- Evolving access patterns (new query = redesign the table)
- Complex reporting (ad-hoc queries are impossible)
- Large team (new engineers can't understand the schema)
- When you add your 5th GSI with overloaded keys

---

**Q9. ACID transactions across PostgreSQL and MongoDB. How?**

**A:**

**You can't have true distributed ACID across heterogeneous databases.** There's no shared transaction coordinator.

**Options:**

1. **Two-Phase Commit (XA):** Some databases support XA protocol. Coordinator sends PREPARE to both, then COMMIT. Problem: if coordinator crashes between prepare and commit, both DBs hold locks indefinitely. MongoDB doesn't support XA.

2. **Saga Pattern:**
   - Step 1: Write to PostgreSQL (commit)
   - Step 2: Write to MongoDB (commit)
   - If step 2 fails: compensating transaction on PostgreSQL (undo step 1)
   - Not ACID (temporary inconsistency between steps), but eventually consistent
   - Use Temporal/Cadence for saga orchestration

3. **Outbox Pattern:**
   - Write data + outbox event in PostgreSQL (single ACID transaction)
   - Background process reads outbox → writes to MongoDB
   - MongoDB eventually consistent with PostgreSQL
   - If MongoDB write fails → retry from outbox
   - Guarantees at-least-once delivery to MongoDB

**Best practice:** Outbox pattern for data synchronization. Avoid needing true cross-database transactions by redesigning boundaries — if two pieces of data must be ACID consistent, they belong in the same database.

---

**Q10. 500,000 writes/sec. Walk through the spectrum of solutions.**

**A:**

1. **Vertical scaling** (~50K writes/sec):
   - Bigger machine, NVMe SSDs, more RAM for buffer pool
   - Ceiling: one machine can only do so much
   - Good for: initial approach, buys time

2. **Write-behind caching** (~200K writes/sec):
   - Buffer writes in Redis, flush to DB in batches
   - Trade-off: potential data loss if Redis crashes before flush
   - Good for: metrics, counters, non-critical data

3. **Sharding** (~500K writes/sec):
   - Split data across 10-50 shards by hash key
   - Each shard handles ~10-50K writes/sec
   - Complexity: cross-shard queries, rebalancing
   - Good for: user data, where queries are scoped to shard key

4. **Event sourcing** (~1M+ events/sec):
   - Append-only log (Kafka) as source of truth
   - Write = append to log (sequential I/O, extremely fast)
   - Derive materialized views from the log
   - Good for: audit trails, financial systems

5. **Specialized time-series DB** (~1M+ writes/sec):
   - ClickHouse, QuestDB, InfluxDB — optimized for append-heavy workloads
   - Columnar storage, massive write throughput
   - Good for: IoT data, metrics, activity logs

**Pattern:** Start simple (vertical), move through the spectrum as write volume grows. Don't jump to event sourcing when vertical scaling handles your load.

---

## 12. Caching
[← Back to topic](12-Caching.md#-senior-interview-questions)

**Q1. Redis cache with 99% hit rate but P99 latency is WORSE than before. How?**

**A:**

**Possible causes:**

1. **Hot key problem:** One key receives 100K req/sec. All requests queue on a single Redis shard. Other keys are fast, but this one key causes P99 spikes
   - Fix: Split hot key (e.g., `user:popular:0` through `user:popular:9`, random selection)

2. **Cache stampede on expiration:** When a popular key expires, hundreds of concurrent requests miss, all query DB simultaneously, then all try to SET the same key
   - Fix: Lock-based recomputation or stale-while-revalidate

3. **Connection pool exhaustion:** App has 100 threads but Redis pool has only 10 connections. 90 threads wait for a connection
   - Fix: Increase pool size, use pipelining

4. **Large values:** Caching 10MB objects. Serialization/deserialization takes longer than the DB query it replaces
   - Fix: Cache smaller, more targeted data. Compress if needed

5. **Network latency:** Redis is in a different AZ (1-2ms). For hot paths, this adds up
   - Fix: Local in-process cache (L1) + Redis (L2). L1 handles 80% of hits with zero network

---

**Q2. Cache node crashes, 100K users logged out. How to design for cache failure?**

**A:**

**Problem:** Sessions stored only in cache. Cache = SPOF for user sessions.

**Solutions:**

1. **Redis replication + Sentinel:**
   - Primary + 1-2 replicas. Sentinel monitors and auto-failovers
   - If primary dies, replica promotes in seconds
   - Minimal session loss (only writes between last replication and failure)

2. **Redis Cluster:**
   - Data sharded across 6+ nodes (3 primary + 3 replica)
   - One node dies = only 1/3 of sessions affected
   - Automatic failover with replica promotion

3. **Consistent hashing:**
   - If a cache node dies, only keys on that node are affected
   - Other nodes' keys remain valid
   - Combined with replicas: zero loss

4. **Session store fallback:**
   - Cache miss → check persistent session store (DynamoDB, PostgreSQL)
   - Slower but prevents logout
   - Write sessions to both cache and persistent store (write-through)

5. **JWT tokens (client-side sessions):**
   - No server-side session at all. Stateless
   - Cache crash has zero impact on auth
   - Trade-off: can't revoke without a blacklist

---

**Q3. Compare cache-aside, write-through, write-behind, and refresh-ahead for e-commerce.**

**A:**

| Strategy | Flow | Consistency | Performance |
|----------|------|-------------|-------------|
| **Cache-aside** | App checks cache → miss → read DB → populate cache | Stale until TTL or invalidation | Read: fast after first miss |
| **Write-through** | App writes to cache → cache writes to DB synchronously | Strong (cache always current) | Write: slower (2 writes) |
| **Write-behind** | App writes to cache → cache writes to DB async (batch) | Weak (cache ahead of DB, risk of loss) | Write: fast |
| **Refresh-ahead** | Cache proactively refreshes before TTL expires | Fresh (if prediction is good) | Read: always fast (no misses) |

**E-commerce use cases:**
- **Product catalog:** Cache-aside with 5-min TTL. Reads are 100:1 vs writes. Slight staleness OK
- **Shopping cart:** Write-through. Cart must be persisted AND fast. Can't lose items
- **Inventory count:** Cache-aside + event-based invalidation. Must update when inventory changes (not TTL)
- **Price display:** Refresh-ahead for popular products. Prices should never show as "loading"

---

**Q4. "Cache everything with 1-hour TTL." What can go wrong?**

**A:**

1. **Stale data for 1 hour:** Price changes, stock goes to zero, user updates profile — all invisible for up to 60 minutes. For e-commerce pricing, this means selling items at wrong prices

2. **Memory pressure:** If everything is cached, cache size grows unbounded. When memory is full, eviction starts. LRU evicts useful entries, causing miss storms

3. **Cold start after restart:** Cache is empty → 100% miss rate → all traffic hits DB → DB overloaded → cascading failure. Takes minutes-hours to warm up

4. **Inconsistent data across cache layers:** Browser cache (1h) + CDN cache (1h) + Redis cache (1h) = some users see data that's up to 3 hours old

5. **Cache pollution:** Rarely-accessed data fills the cache, evicting frequently-accessed data. Hit rate drops

**Better approach:** Cache selectively. High-read, low-write, staleness-tolerant data gets long TTL. Frequently changing data gets short TTL or event-based invalidation. User-specific mutable data may not need caching at all.

---

**Q5. Redis node goes down, 1/6 of keys stampede to DB, DB crashes. Walk through every defense layer.**

**A:**

**Layer 1 — Prevent cache node loss:**
- Redis Cluster with replicas. Node dies → replica auto-promotes. <5 second failover
- Minimal key loss (only writes between last sync and failure)

**Layer 2 — Prevent stampede on miss:**
- **Request coalescing:** Multiple concurrent requests for the same key → only one queries DB. Others wait for that result
- **Probabilistic early expiration:** Keys refresh before TTL. No simultaneous expiration
- **Circuit breaker on DB:** If DB starts getting overwhelmed, reject cache-miss requests and serve stale data or errors

**Layer 3 — Protect the database:**
- **Connection limits:** DB rejects connections beyond pool size. Prevents OOM
- **Rate limiting on cache misses:** Max 100 DB queries/sec per key pattern
- **Fallback to stale cache:** Even expired, stale data is better than DB-crushing stampede. Serve stale with `stale-while-revalidate`

**Layer 4 — Recovery:**
- **Cache warming script:** Pre-populate cache from DB in batch (not on demand)
- **Graceful degradation:** Return degraded responses (without personalization, with defaults) until cache is warm

---

**Q6. Explain the dog-pile effect (cache stampede). Compare solutions.**

**A:**

**The problem:** Popular cache key expires → N concurrent requests simultaneously see MISS → N identical DB queries → DB overload → slow responses → more timeouts → more retries → cascade

**Solutions:**

1. **Locking (mutex-based):**
   - First request to miss acquires a lock (`SETNX cache_lock:key`)
   - Other requests wait (or return stale data)
   - First request fetches from DB, sets cache, releases lock
   - **Pro:** Simple. **Con:** Lock contention, what if lock holder crashes

2. **Probabilistic early expiration (XFetch):**
   - Each request has a probability of refreshing BEFORE TTL expires
   - Probability increases as TTL approaches: `P = exp(-remaining_ttl / beta)`
   - Popular keys (many requests) almost certainly refresh early
   - **Pro:** No locks, elegant. **Con:** Requires tuning beta

3. **Request coalescing:**
   - Middleware deduplicates concurrent identical requests
   - Only one request goes to DB, result served to all waiters
   - **Pro:** Works transparently. **Con:** Increases latency for waiters

4. **Pre-warming / background refresh:**
   - Background job refreshes popular keys before expiration
   - Cache never expires for hot keys
   - **Pro:** Eliminates stampede entirely. **Con:** Requires knowing which keys are hot

---

**Q7. Cache TTL is 5 minutes but data changes every 30 seconds. Product manager sees stale prices. Design cache invalidation.**

**A:**

**Strategy: Event-based invalidation + short TTL as safety net.**

1. **Event-driven invalidation:**
   - When price changes in DB, publish `price.updated` event (via CDC or app-level event)
   - Cache invalidation service subscribes to event → immediately `DEL` the cache key
   - Latency: ~100ms from DB write to cache invalidation

2. **Write-through cache:**
   - On price update, app writes to DB AND updates cache in the same operation
   - Cache is always current (no TTL-based staleness)
   - Trade-off: tighter coupling, app responsible for cache consistency

3. **Short TTL as safety net:**
   - Set TTL to 30 seconds (matches change frequency)
   - Even if event-based invalidation fails, staleness is bounded to 30 seconds
   - Higher origin load but acceptable for pricing accuracy

4. **Hybrid approach (recommended):**
   - Event-based invalidation for immediate freshness
   - TTL of 60 seconds as fallback (if event system fails)
   - `stale-while-revalidate` for graceful transition

**Trade-off acknowledged:** Event-based invalidation is exactly right here. TTL-only caching is the wrong tool for frequently-changing data.

---

**Q8. Memcached vs Redis for caching. When to choose each?**

**A:**

| Feature | Memcached | Redis |
|---------|-----------|-------|
| **Data types** | String only | Strings, lists, sets, sorted sets, hashes, streams |
| **Persistence** | None (pure cache) | RDB snapshots, AOF log |
| **Replication** | None | Primary-replica, Redis Cluster |
| **Memory efficiency** | Slab allocator (less fragmentation) | jemalloc (more flexible, more overhead) |
| **Max value size** | 1MB | 512MB |
| **Threading** | Multi-threaded | Single-threaded (I/O threads in 6.0+) |
| **Eviction** | LRU only | LRU, LFU, random, volatile-* |

**Choose Memcached when:**
- Simple key-value caching, nothing more
- Multi-threaded performance for simple GET/SET
- Need to scale horizontally with consistent hashing (no replication needed, cache is expendable)

**Choose Redis when:**
- Need data structures (sorted sets for leaderboards, lists for queues)
- Need persistence (cache that survives restart)
- Need pub/sub, streams, or Lua scripting
- Need replication and high availability

**When Redis features become footguns:** Using Redis as a primary database instead of a cache — persistence gives false confidence. Redis should enhance, not replace, your database.

---

**Q9. Caching at 5 layers: browser, CDN, API gateway, Redis, DB query cache. Data updates. Walk through staleness propagation.**

**A:**

**Staleness propagation (inside-out):**
```
Write to DB → DB query cache (stale) → Redis (stale) → API Gateway (stale) → CDN (stale) → Browser (stale)
```

**Invalidation strategies per layer:**

| Layer | Invalidation Method | Typical Staleness |
|-------|--------------------|--------------------|
| **DB query cache** | Auto-invalidated on write (usually) | 0 seconds |
| **Redis** | Event-driven invalidation (DEL key) | ~100ms |
| **API Gateway** | Short TTL or purge API | 5-60 seconds |
| **CDN** | Purge API or fingerprinted URLs | 0 (fingerprinted) to TTL |
| **Browser** | Short max-age + revalidation, or versioned URLs | Until user refreshes |

**Architecture for consistent invalidation:**
1. DB write triggers CDC event
2. Event handler invalidates Redis + sends CDN purge
3. API responds with updated `ETag` and short `Cache-Control`
4. CDN uses `stale-while-revalidate` to serve old content while fetching new
5. Browser uses `Cache-Control: max-age=0, must-revalidate` for dynamic content (relies on ETag 304)

**Key insight:** Use content-addressed URLs (fingerprinting) for static assets — eliminates CDN and browser cache staleness entirely. For dynamic data, event-based invalidation at each layer.

---

**Q10. Cache 500 million key-value pairs at ~1KB each. Calculate memory. Single instance or cluster?**

**A:**

**Raw data:** 500M × 1KB = **500 GB**

**Redis overhead per key:**
- Key pointer + value pointer + metadata: ~70 bytes per key
- Hash table entry: ~50 bytes
- Total overhead: ~120 bytes per key
- 500M × 120 bytes = **60 GB overhead**

**Total memory:** ~560 GB

**Single instance: NO.**
- Redis single instance practical limit: ~25-50 GB (100GB max, but GC/fork issues)
- 560 GB requires a cluster

**Redis Cluster architecture:**
- Minimum: 12 nodes (6 primary + 6 replica) = ~47 GB per primary shard
- Better: 24 nodes (12 primary + 12 replica) = ~24 GB per shard (comfortable)
- 16,384 hash slots distributed across primaries

**Client-side sharding vs Redis Cluster:**
- Redis Cluster: built-in, automatic rebalancing, handles failover. **Recommended**
- Client-side: simpler, but you manage failover and rebalancing manually

**Eviction policy:** LFU (Least Frequently Used) is better than LRU for large caches with varying access patterns. Popular items stay cached, tail gets evicted.

---

## 13. Asynchronism
[← Back to topic](13-Asynchronism.md#-senior-interview-questions)

**Q1. Synchronous API takes 30 seconds to generate a report. How do you redesign it with async processing?**

**A:**

**Current (broken):** Client → API → 30 seconds of processing → response. HTTP timeout likely kills it.

**Async redesign:**

1. **Submit:** `POST /reports` → returns `202 Accepted` + `{ "job_id": "abc123", "status_url": "/reports/abc123" }`
2. **Process:** API puts job on a message queue (SQS, RabbitMQ). Worker picks it up, processes for 30 seconds, stores result in S3/DB
3. **Notify:** Multiple patterns for notification:
   - **Polling:** Client polls `GET /reports/abc123` every 5 seconds until status = "complete"
   - **WebSocket:** Client connects to WS, receives push notification when ready
   - **Webhook:** Server POSTs to client's callback URL when complete
   - **SSE (Server-Sent Events):** Server pushes status updates to client

**Best for each client type:**
- Web browser: WebSocket or SSE (real-time UX)
- Mobile app: Push notification
- B2B integration: Webhook
- Simple API consumer: Polling (simplest to implement)

---

**Q2. Compare RabbitMQ, Kafka, and SQS. Need exactly-once, ordering, and replay.**

**A:**

| Feature | RabbitMQ | Kafka | SQS |
|---------|----------|-------|-----|
| **Model** | Message queue (push to consumer) | Distributed log (consumer pulls) | Managed queue (pull) |
| **Ordering** | Per-queue FIFO | Per-partition FIFO | FIFO queues (limited throughput) |
| **Replay** | No (messages deleted after ack) | Yes (retain messages for days/forever) | No (deleted after processing) |
| **Exactly-once** | No (at-least-once) | Yes (transactional producer + idempotent consumer) | No (at-least-once, FIFO has exactly-once delivery) |
| **Throughput** | ~50K msg/sec | ~1M+ msg/sec per cluster | ~3K msg/sec (FIFO), unlimited (standard) |

**For this requirement (exactly-once + ordering + replay):** **Kafka** is the only option that supports all three.

**Can Kafka truly guarantee exactly-once?** Kafka's transactional producer ensures exactly-once within Kafka (produce + commit offsets atomically). But end-to-end exactly-once requires the consumer side to be idempotent too. Kafka provides the tools; the consumer must cooperate.

---

**Q3. Queue depth at 10 million and climbing. Walk through your escalation strategy.**

**A:**

**Immediate actions (minutes):**
1. **Scale consumers horizontally:** Add more consumer instances. If using Kafka, add consumers up to partition count
2. **Check for poison messages:** A failing message that's continuously retried blocks the queue. Move it to DLQ (dead letter queue)

**Short-term (hours):**
3. **Back pressure:** Signal producers to slow down (`429 Too Many Requests` or reduce batch size). Better to reject new work than collapse
4. **Priority queues:** If messages have different priorities, process high-priority first. Low-priority can wait
5. **Load shedding:** If some messages are stale (>5 min old), discard them. No point processing outdated data

**Medium-term (days):**
6. **Optimize consumer processing:** Profile the consumer. Is it CPU-bound? I/O-bound? DB-bound? Optimize the bottleneck
7. **Batch processing:** Process multiple messages per DB transaction instead of one at a time
8. **Shard the queue:** Split into multiple queues by key (user_id, region). Parallel processing across shards

---

**Q4. "Just make everything async." What are the downsides?**

**A:**

1. **Debugging is harder:** Request spans multiple services/queues/workers asynchronously. No single stack trace. Need distributed tracing + correlation IDs

2. **Eventual consistency:** Async means the result isn't immediately visible. User creates an order → order service says "accepted" → payment hasn't happened yet. UI needs to handle pending states

3. **Error handling is complex:** Synchronous: throw exception, return error. Async: what if the worker fails? Retry? DLQ? Who monitors? Who alerts?

4. **Harder to reason about ordering:** Messages may arrive out of order. Two updates to the same record: last one processed may not be the latest chronologically

5. **UX impact:** Some operations need synchronous feedback. "Is my credit card valid?" must be answered immediately, not "we'll check later"

6. **Testing complexity:** Integration tests must account for eventual processing. Can't just assert immediately after the action

**When synchronous is better:** User login, credit card validation, real-time search, anything where the user needs an immediate response to proceed.

---

**Q5. Payment Service charges the customer but fails before acknowledging the message. How do you prevent double-charging?**

**A:**

**The problem:** At-least-once delivery means the queue will redeliver the message → Payment Service processes it again → customer charged twice.

**Solution: Idempotency key pattern.**

1. **Producer generates a unique idempotency key:** `order_id + "payment"` or a UUID
2. **Payment Service stores processed keys:**
   ```
   BEGIN TRANSACTION
     IF idempotency_key EXISTS in processed_payments → skip, return cached result
     ELSE → process payment, INSERT idempotency_key + result
   COMMIT
   ```
3. **Key storage:** Same database as the payment record (single ACID transaction ensures atomicity)

**Outbox Pattern (complementary):**
- Order Service writes the order + an outbox event in one DB transaction
- A CDC reader (Debezium) or poller publishes the outbox event to the queue
- If the publish fails, it retries (the outbox row is still there)
- Guarantees the event is published exactly once from the producer side

---

**Q6. Compare task queues, message queues, and event streams.**

**A:**

| Aspect | Task Queue (Celery) | Message Queue (RabbitMQ) | Event Stream (Kafka) |
|--------|--------------------|-----------------------|---------------------|
| **Semantics** | "Do this work" (command) | "Here's a message" (point-to-point or pub/sub) | "This happened" (event log) |
| **Consumer model** | Worker pool executes tasks | Consumer processes and acks | Consumer reads from log at own pace |
| **Retention** | Until processed | Until acknowledged | Days/weeks/forever |
| **Replay** | No | No | Yes (re-read from any offset) |
| **Multiple consumers** | No (one worker per task) | Fan-out exchange (copies) | Consumer groups (each group reads all) |
| **Best for** | Background jobs (email, resize image) | Service-to-service commands | Event sourcing, data pipelines, analytics |

**Key distinction:** Task queues = "do something." Event streams = "something happened, anyone interested can react."

---

**Q7. Worker crashes mid-processing, leaving an image in corrupted state. Design for idempotent, resumable processing.**

**A:**

**Idempotent design:**
1. **Use a unique processing ID:** Each upload gets a UUID. All intermediate files include this ID
2. **Atomic completion:** Process to a temp location → atomic rename to final location when done. A crash leaves temp files (not corrupt finals)
3. **Status tracking:** DB record per image: `{id, status: PENDING|PROCESSING|DONE|FAILED, worker_id, started_at}`
4. **Heartbeat:** Worker updates `heartbeat_at` every 10 seconds. If heartbeat is stale (>30 seconds), another worker can pick up the job

**Resumable design:**
1. **Checkpoints:** For multi-step processing (resize → compress → watermark), record which step was completed
2. **Cleanup before retry:** On retry, delete any partial outputs from the previous attempt
3. **Visibility timeout:** Message becomes visible again after timeout. New worker picks it up, sees partial state, cleans up, restarts

**Queue configuration:** SQS visibility timeout = 2× expected processing time. DLQ after 3 failures for manual investigation.

---

**Q8. At-most-once vs at-least-once vs exactly-once delivery. Why is exactly-once so hard?**

**A:**

| Guarantee | How | Risk |
|-----------|-----|------|
| **At-most-once** | Send and forget. Don't retry | Messages may be lost |
| **At-least-once** | Retry until acknowledged | Messages may be duplicated |
| **Exactly-once** | At-least-once + idempotent processing | Theoretically impossible in general case |

**Why exactly-once is hard:**
- **Two Generals' Problem:** You can never be 100% sure the other side received your message. Any acknowledgment can itself be lost
- **Network uncertainty:** Did the message arrive and the ack was lost? Or did it not arrive at all? You can't distinguish these cases
- **Crash recovery:** Process receives message, processes it, crashes before acknowledging. On restart, it processes again

**How Kafka approximates it:**
- **Idempotent producer:** Each message has a sequence number. Broker deduplicates
- **Transactional producer:** Atomically write to multiple partitions + commit consumer offset. If any part fails, all are rolled back
- **Consumer-side:** Still needs idempotent processing logic (Kafka can't control what your consumer does with the data)

---

**Q9. Async job takes 5 minutes. User cancels after 30 seconds. How do you handle cancellation?**

**A:**

**Cancellation strategies:**

1. **Cooperative cancellation (recommended):**
   - Set a `cancelled` flag in the job's DB record
   - Worker periodically checks: `if job.cancelled: cleanup_and_exit()`
   - Check at natural breakpoints (between steps, every N iterations)

2. **Message-based cancellation:**
   - Publish a `CancelJob` command to a cancellation topic
   - Worker subscribes and checks for cancel messages
   - Works well in event-driven architectures

3. **Compensating transactions:**
   - If the job has already done partial work (charged payment, reserved inventory):
   - Execute compensating actions: refund payment, release inventory
   - Saga pattern with compensation for each completed step

**Challenges:**
- **Non-atomic operations:** Can't "unprocess" half a video. Must either complete or discard partial results
- **External side effects:** If the job sent an email, you can't unsend it. Design jobs to do irreversible actions last
- **Timing:** Cancel arrives after job completes. Need to handle "cancel too late" gracefully

---

**Q10. Choreography-based microservices, debugging a failed order across 8 services. How to make it observable?**

**A:**

**Correlation ID pattern:**
- Generate a unique `correlation_id` at the entry point (first service)
- Pass it through every message/event in the chain
- Every service logs `[correlation_id=abc123] Processing payment...`
- Search logs by correlation_id → see the complete journey

**Distributed tracing (Jaeger/Zipkin):**
- Instrument each service with OpenTelemetry
- Each event publish/consume creates a span
- Trace shows the complete event flow as a DAG (not just a linear chain)

**Saga state machine:**
- Central saga state table tracks the state of each order across all steps:
  ```
  order_id: abc123
  step_1_order_created: DONE
  step_2_payment: DONE
  step_3_inventory: FAILED (reason: out of stock)
  step_4_shipping: SKIPPED
  compensation_1: refund_issued
  ```
- Dashboard shows where each order is in the pipeline
- Alerts on stuck sagas (step hasn't progressed in >5 minutes)

**Dead letter queue monitoring:** Each service has a DLQ. Monitor DLQ depth. Any message in DLQ = a failure that needs investigation. Include the correlation_id for cross-referencing.

---

## 14. Communication Protocols
[← Back to topic](14-Communication-Protocols.md#-senior-interview-questions)

**Q1. REST, gRPC, and GraphQL — mobile needs subset, web needs full object, internal needs high throughput. How to use all three?**

**A:**

**Architecture:**
```
Mobile App ────► GraphQL Gateway ────┐
                                     ├──► Internal gRPC services
Web App ────────► REST API ──────────┘
                                     
Internal ───────► gRPC directly ─────┘
```

- **Mobile → GraphQL:** Clients request exactly the fields they need. Saves bandwidth on cellular. One request instead of multiple REST calls
- **Web → REST:** Full resource representations. Browser-friendly. Cacheable with standard HTTP semantics
- **Internal → gRPC:** Binary protocol (protobuf), HTTP/2 multiplexing, streaming. 10x lower serialization overhead than JSON

**Implementation:** Internal services communicate via gRPC. The REST API and GraphQL gateway are BFF (Backend-for-Frontend) layers that translate to gRPC calls internally. REST/GraphQL endpoints are thin adapters over gRPC service methods.

---

**Q2. gRPC works in testing but fails in production behind AWS ALB. Why?**

**A:**

**Root cause:** gRPC uses HTTP/2 trailers for status codes and error metadata. AWS ALB (before 2020 updates) didn't support HTTP/2 trailers properly. Even now, there are nuances:

**Common issues:**
1. **ALB HTTP/2 → HTTP/1.1 downgrade:** ALB may translate HTTP/2 to HTTP/1.1 when forwarding to backend. gRPC requires end-to-end HTTP/2
2. **Trailing headers stripped:** gRPC's `grpc-status` and `grpc-message` are in HTTP trailers. Some L7 LBs strip trailers → client thinks every call failed
3. **Long-lived streams:** gRPC streaming keeps connections open. ALB has idle timeout (default 60s) that kills streams

**Fixes:**
- Use **NLB (L4)** instead of ALB for gRPC traffic. NLB passes TCP through without inspecting HTTP
- If must use ALB: enable HTTP/2 to target, configure ALB to handle gRPC protocol (AWS added gRPC support in 2020)
- Use **Envoy** as an internal load balancer (native gRPC support, properly handles trailers)
- Set ALB idle timeout higher for streaming endpoints

---

**Q3. "Why do we still use HTTP/1.1 when HTTP/2 exists?" Head-of-line blocking across versions.**

**A:**

**HTTP/1.1 HOL blocking: Application level**
- One request per TCP connection at a time. Request 2 waits for request 1 to complete
- Workaround: browsers open 6 parallel TCP connections per domain

**HTTP/2 HOL blocking: Transport (TCP) level**
- Multiplexes many requests over ONE TCP connection (great!)
- But TCP guarantees ordered delivery. If one packet is lost, ALL streams on that connection stall waiting for retransmission
- Under poor networks (mobile, satellite), this can be worse than HTTP/1.1's 6 connections

**HTTP/3 (QUIC) solution:**
- Uses UDP instead of TCP
- Each stream has independent packet ordering
- Lost packet in stream A doesn't block streams B, C, D
- Also: 0-RTT connection establishment (fastest possible)

**Why HTTP/1.1 persists:**
- Simplicity (text-based, easy to debug with curl)
- Universal support (every proxy, every CDN, every tool)
- HTTP/2 improvement is marginal for simple request-response APIs
- HTTP/3 adoption is slow (UDP blocked by some firewalls)

---

**Q4. Building a real-time collaborative editor (like Google Docs). Compare WebSockets, SSE, and long polling.**

**A:**

| Factor | WebSocket | SSE (Server-Sent Events) | Long Polling |
|--------|-----------|--------------------------|--------------|
| **Direction** | Full duplex (both ways) | Server → client only | Simulated bidirectional |
| **Overhead** | Low (persistent connection) | Low (persistent connection) | High (repeated HTTP requests) |
| **Browser support** | Excellent | Good (no IE) | Universal |
| **Through proxies** | May need configuration | Works (plain HTTP) | Works |
| **Binary data** | Yes | No (text only) | Yes |

**For Google Docs:** **WebSocket** is the clear winner:
- Need bidirectional: user types (client→server) AND sees others' edits (server→client)
- Low latency: <50ms for each keystroke
- Operational Transformation (OT) or CRDTs require fast, ordered, bidirectional message exchange
- SSE can't send client→server; long polling's latency is too high for real-time typing

**Architecture:** WebSocket for real-time edits + REST API for document CRUD (create, list, delete). WebSocket servers backed by a pub/sub system (Redis Pub/Sub) for multi-server fanout.

---

**Q5. REST API returns 200 OK with an error in the body. Why is this an anti-pattern?**

**A:**

**Why it's wrong:**
1. **Breaks HTTP semantics:** Clients, proxies, CDNs, and monitoring tools rely on status codes. 200 = success. A "200 with error body" looks like success to everything except your custom client code
2. **Caching disaster:** CDNs and browsers cache 200 responses. An error response cached for hours!
3. **Monitoring blind spots:** Dashboards tracking 5xx rates show 0% errors even though the system is broken
4. **Client complexity:** Every client must parse the body to check for errors instead of checking the status code

**Correct error communication:**

| Protocol | Error Mechanism |
|----------|----------------|
| **REST** | HTTP status codes (400, 401, 403, 404, 422, 500) + error body with `{code, message, details}` |
| **gRPC** | `grpc-status` trailer (OK, INVALID_ARGUMENT, NOT_FOUND, INTERNAL) + error details |
| **GraphQL** | `errors` array in response (can have partial data + partial errors) — status is always 200 (by design, which is controversial) |

---

**Q6. Migrating 200 REST services to gRPC incrementally.**

**A:**

**Incremental migration strategy:**

1. **Phase 1 — Define protobufs:** Write `.proto` files for the gRPC service contract. Generate client/server stubs in each language

2. **Phase 2 — gRPC-Gateway (bridge):**
   - Add gRPC-Gateway to each service: a reverse proxy that translates REST ↔ gRPC
   - Existing REST clients keep working (gateway translates to gRPC)
   - New internal consumers use gRPC directly
   - Zero client changes required initially

3. **Phase 3 — Migrate callers gradually:**
   - When a consuming service is being updated anyway, switch it from REST to gRPC
   - Track adoption: 10% → 25% → 50% → 75% → 100% gRPC callers

4. **Phase 4 — Remove REST gateway** for fully-migrated services

**Envoy transcoding** works similarly: Envoy sidecar translates JSON/REST to gRPC protobuf transparently. No application code changes.

**Key principle:** Both protocols must work simultaneously for months during migration. Never do a big-bang switch.

---

**Q7. TCP + TLS impact on API latency. Round trips for first byte on mobile 3G.**

**A:**

**Round trip breakdown (cold connection, TLS 1.2):**

| Step | Round Trips | 3G latency (~200ms RTT) |
|------|-------------|------------------------|
| DNS | 1 RTT (if not cached) | 200ms |
| TCP handshake (SYN→SYN-ACK→ACK) | 1 RTT | 200ms |
| TLS 1.2 handshake | 2 RTT | 400ms |
| HTTP request/response | 1 RTT | 200ms |
| **Total** | **5 RTT** | **1,000ms** |

**Optimizations:**

| Technique | Savings |
|-----------|---------|
| DNS cache | -1 RTT (-200ms) |
| TLS 1.3 | -1 RTT (-200ms): 1-RTT handshake |
| TLS 1.3 0-RTT resumption | -2 RTT (-400ms): pre-shared key, first data with first packet |
| HTTP/2 | Multiplex: one connection for all requests (amortize handshake) |
| HTTP/3 (QUIC) | 0-RTT connection + request possible: first packet carries data |
| TCP Fast Open | -0.5 RTT: data in SYN packet |

**Best case (TLS 1.3 + 0-RTT + HTTP/3):** 1 RTT total = **200ms** on 3G.

---

**Q8. Compare serialization: JSON, Protocol Buffers, MessagePack, and Avro.**

**A:**

| Format | Size | Parse Speed | Schema | Human-readable | Language Support |
|--------|------|-------------|--------|---------------|-----------------|
| **JSON** | Large (text, keys repeated) | Slow (text parsing) | None (schema-less) | Yes | Universal |
| **Protobuf** | Small (~3-10x smaller) | Very fast (binary, compiled) | Required (.proto) | No | Wide (generated) |
| **MessagePack** | Medium (~30% smaller than JSON) | Fast | None | No | Wide |
| **Avro** | Small (schema embedded or referenced) | Fast | Required (.avsc) | No | Java ecosystem |

**When serialization format matters:**
- >10K messages/sec: the difference in parse CPU adds up
- Mobile/IoT: bandwidth is limited, smaller = better
- Large payloads (>100KB): JSON's size overhead becomes significant

**When it's premature optimization:**
- <1K requests/sec: JSON is fine
- Small payloads (<1KB): difference is negligible
- External APIs: JSON is expected by consumers (developer experience > wire efficiency)

---

**Q9. 1 million notifications per minute to different clients. Compare pull vs push vs hybrid.**

**A:**

**1M/min = ~16,700 notifications/sec**

**Pull (polling):**
- Each client polls every 5 seconds: `GET /notifications`
- If 1M clients poll every 5s: 200K req/sec to the server (most returning empty)
- **Overhead:** Massive wasted bandwidth and server CPU on empty responses
- **Latency:** Up to 5 seconds delay

**Push (WebSocket / SSE):**
- Server pushes to connected clients instantly
- 1M concurrent WebSocket connections: ~16GB memory for connection state (at ~16KB per connection)
- **Overhead:** Holding 1M connections open (file descriptors, heartbeats)
- **Latency:** Instant (<100ms)

**Hybrid (best for this scale):**
- **Active users (online):** WebSocket push (instant, low latency)
- **Inactive users:** Push notification (APNs/FCM) or email
- **Connection servers:** Dedicated servers hold WebSocket connections. Use pub/sub (Redis/Kafka) to route messages to the right connection server
- Scale connection servers horizontally (each holds ~100K connections)

---

**Q10. 5 microservices in sequence (A→B→C→D→E), total 500ms. How to reduce latency?**

**A:**

**Analysis:** Each hop adds ~100ms. That's accumulated across 5 sequential calls.

**Strategies:**

1. **Parallelize independent calls:** If B and C don't depend on each other, call both from A simultaneously. Latency = max(B,C) not B+C. Potential reduction: 200ms → 100ms

2. **Collapse the chain:** Does A really need to call B which calls C? Maybe A can call B and C directly (fan-out instead of chain). Fewer hops = less latency

3. **Service aggregation:** Create a "composite service" that orchestrates B,C,D,E internally. A makes ONE call. The composite service parallelizes internally. Network hops reduced from 4 to 1

4. **Async for non-critical steps:** If D and E are for analytics/logging, make them async (fire-and-forget). A→B→C (300ms) + D,E async (0ms added)

5. **Caching at each layer:** If C's response rarely changes, B caches it. Skip the call entirely when cached. Cache at each service reduces downstream calls

6. **gRPC + connection reuse:** Switch from REST/JSON (connection setup + serialization overhead) to gRPC (persistent HTTP/2 connections, binary protobuf). Saves ~10-20ms per hop

**Combined:** Parallelize (B,C) + async (D,E) + gRPC = A→(B||C, async D,E) = ~120ms total.

---

## 15. API Design
[← Back to topic](15-API-Design.md#-senior-interview-questions)

**Q1. Designing a public API for 10,000 third-party developers. Versioning strategy — URL vs header vs content negotiation.**

**A:**

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **URL versioning** | `/v1/users`, `/v2/users` | Simple, visible, cacheable, easy to route | URL changes on every version. Lots of duplication. Hard to deprecate |
| **Header versioning** | `X-API-Version: 2` | URL stays clean. Can default to latest | Not visible in browser. Harder to link/share. Can't cache by URL alone |
| **Content negotiation** | `Accept: application/vnd.myapi.v2+json` | HTTP-standard. Fine-grained per resource | Complex. Developers struggle with it. Tooling support is weak |

**Recommendation for 10K developers:** **URL versioning** — simplicity wins at scale.

**Evolution strategy without breaking clients:**
1. **Additive changes only (no version bump):** Adding a new field never breaks clients. Adding a new endpoint never breaks clients. These don't need a new version
2. **Breaking changes = new version:** Removing a field, renaming a field, changing a type = v2
3. **Sunset policy:** v1 → deprecated (6 months) → sunset (12 months). Use `Sunset: Sat, 01 Jul 2026 00:00:00 GMT` HTTP header
4. **Migration guide:** Provide diff-based migration docs. "In v2, `user.name` became `user.first_name` + `user.last_name`"
5. **API analytics:** Track which consumers still use v1. Reach out directly to top consumers before sunsetting

---

**Q2. API returns 10 million records. Compare offset, cursor, and keyset pagination.**

**A:**

| Pagination | How | SQL | Weakness |
|-----------|-----|-----|----------|
| **Offset** | `?page=5&limit=20` → skip 80 rows | `LIMIT 20 OFFSET 80` | Deep pages are slow (`OFFSET 1000000` = scan 1M rows). Insertions cause skipped/duplicated items |
| **Cursor** | `?cursor=eyJpZCI6MTAwfQ==` (opaque token) | Decode cursor → `WHERE id > 100 LIMIT 20` | Can't jump to arbitrary page. Cursor becomes invalid if record is deleted |
| **Keyset** | `?after_id=100&limit=20` | `WHERE id > 100 ORDER BY id LIMIT 20` | Same as cursor but transparent. Requires a unique, sequential column. Multi-column sorting is complex |

**What happens to offset pagination during inserts?** If 5 new records are inserted before your current offset while you're paginating, your next page skips 5 records (they shifted). Conversely, deletions cause duplicates.

**For 10M records:** Cursor/keyset is the only viable option. Offset at page 500,000 does `OFFSET 10,000,000` which is effectively a full table scan.

**Cursor encoding:** `base64({ "id": 100, "created_at": "2026-01-20T..." })` — opaque to client, decodable by server. Allows changing the underlying implementation without breaking clients.

---

**Q3. Client retries a payment request due to network timeout. How do you make this idempotent?**

**A:**

**Idempotency Key Pattern:**

1. **Client generates a unique key:** `Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000` (UUID v4). Sent as an HTTP header with the payment request

2. **Server processing:**
   ```
   BEGIN TRANSACTION
     SELECT * FROM idempotency_keys WHERE key = ? FOR UPDATE
     IF found AND status = 'completed':
       RETURN cached_response     ← Don't process again!
     IF found AND status = 'in_progress':
       RETURN 409 Conflict        ← Another request is processing
     INSERT INTO idempotency_keys (key, status) VALUES (?, 'in_progress')
   COMMIT
   
   Process payment...
   
   BEGIN TRANSACTION
     UPDATE idempotency_keys SET status = 'completed', response = ? WHERE key = ?
   COMMIT
   RETURN response
   ```

3. **Storage:** Same database as the payment table (ACID atomicity). Key expires after 24 hours (configurable)

4. **Edge cases:**
   - Server crashes during processing → key is `in_progress` → after timeout (5 min), allow retry
   - Different payload with same key → return `422 Unprocessable Entity`
   - Key reuse after expiry → treat as new request

**Stripe's implementation:** Idempotency keys are stored for 24 hours. Same key + same parameters = cached response. Same key + different parameters = error.

---

**Q4. API returns 2MB JSON for a user profile. How to redesign?**

**A:**

| Approach | How | Best For |
|----------|-----|----------|
| **Field filtering** | `?fields=id,name,email` | Simple use cases. Easy to implement |
| **Sparse fieldsets (JSON:API)** | `?fields[user]=name&fields[posts]=title` | Standard spec. Per-relationship field control |
| **GraphQL** | `{ user(id: 1) { name posts { title } } }` | Complex nested data. Multiple client types |
| **BFF (Backend-for-Frontend)** | Separate API per client type | Mobile vs web have fundamentally different needs |

**Best approach for this case:** It depends on scale and team structure.

- **10 consumers, simple needs:** Field filtering (`?fields=`)
- **Many consumers, nested relationships:** GraphQL
- **2-3 distinct client types (mobile, web, admin):** BFF pattern (each BFF calls the same internal APIs but returns different shapes)

**Immediate fixes before any redesign:**
1. **Don't embed relationships by default.** Use `?include=posts,friends` to opt-in (HATEOAS links for unfetched relationships)
2. **Compress:** Enable gzip/brotli. 2MB JSON → ~200KB compressed
3. **Pagination:** Embedded lists (posts, friends) should be paginated, not fully expanded

---

**Q5. API gateway for 50 microservices. When does it become a bottleneck or "god service"?**

**A:**

**It becomes a bottleneck when:**
- **Business logic creeps in:** The gateway starts doing data transformation, orchestration, or validation. It becomes a coupling point that every team must coordinate with
- **Single point of failure:** All traffic funnels through it. Gateway down = everything down
- **Deployment bottleneck:** 50 teams need gateway changes. One shared repo/config. Merge conflicts. Weekly deploys become monthly
- **Performance ceiling:** All 50 services' traffic hits one fleet. Each gateway instance needs enough CPU/memory for ALL transformation rules

**How to scale it:**

1. **Keep the gateway thin:** Authentication, rate limiting, routing, TLS termination. Nothing else. No business logic.
2. **Distributed gateways:** Per-domain gateways instead of one monolith. Payment gateway, User gateway, Content gateway. Each team owns their gateway
3. **Service mesh (sidecar):** Move cross-cutting concerns (mTLS, observability, retries) to Envoy sidecars. Gateway only does edge concerns (auth, rate limit)
4. **Serverless gateway:** AWS API Gateway / Cloudflare Workers auto-scale. No capacity planning needed

---

**Q6. PUT vs PATCH vs POST. Why is POST-for-everything problematic?**

**A:**

| Method | Semantics | Idempotent? | Use Case |
|--------|-----------|-------------|----------|
| **POST** | Create a new resource (server assigns ID) | No | `POST /users` → creates user, returns `201 Created` |
| **PUT** | Replace entire resource at a known URL | Yes | `PUT /users/123` → replace all fields of user 123 |
| **PATCH** | Partial update of a resource | No (but can be) | `PATCH /users/123` → update only `{name: "new"}` |

**Why POST-for-everything is bad:**
1. **Not idempotent:** Retrying `POST /payments` creates duplicate payments. PUT is safe to retry
2. **Not cacheable:** GET responses are cached. POST responses are not. Using POST for reads wastes caching
3. **Violates discoverability:** REST clients can't reason about what actions are safe (GET, HEAD) vs unsafe. Everything being POST removes this distinction
4. **Tooling breaks:** Swagger/OpenAPI generates better docs when methods are used correctly. Rate limiters typically differentiate GET vs POST

**PUT vs PATCH nuance:**
- `PUT /users/123 {"name": "Alice"}` — replaces the entire user. Missing fields become null (unless the API is lenient, which breaks REST semantics)
- `PATCH /users/123 {"name": "Alice"}` — updates only the name. Other fields unchanged
- JSON Merge Patch (RFC 7386) vs JSON Patch (RFC 6902): Merge Patch is simpler but can't distinguish "set to null" from "don't change"

---

**Q7. 300 endpoints over 3 years. How to safely deprecate unused ones?**

**A:**

**Step 1: Discover usage**
- API analytics: Log every request with endpoint, consumer API key/token, timestamp
- Build a dashboard: endpoints × consumers × last 30 days call count
- Identify: zero-usage endpoints (easy deprecation), low-usage endpoints (reach out to consumers)

**Step 2: Announce deprecation**
- `Sunset: Sat, 01 Jan 2027 00:00:00 GMT` header on every response
- `Deprecation: true` header
- `Link: <https://docs.api.com/migration>; rel="deprecation"` header
- Changelog entry. Email top consumers directly

**Step 3: Grace period (6-12 months)**
- Deprecated endpoints still work but return deprecation headers
- Monitor usage during grace period. If usage drops to zero, accelerate sunset
- Provide migration guides with code examples

**Step 4: Remove**
- Return `410 Gone` (not 404) with a body: `{"error": "This endpoint was removed on 2027-01-01. See https://docs.api.com/v2/migration"}`
- Keep 410 responding for 6+ months so consumers get a clear error message

---

**Q8. REST API auth for B2B SaaS: API keys vs OAuth 2.0 vs JWT.**

**A:**

| Approach | How | Best For |
|----------|-----|----------|
| **API keys** | Static key in header (`X-API-Key: abc123`) | Simple integrations, server-to-server |
| **OAuth 2.0 (auth code)** | User grants permission, app gets access token | User-facing apps accessing on behalf of users |
| **OAuth 2.0 (client credentials)** | Service gets token using client_id + client_secret | Machine-to-machine (no user context) |
| **JWT bearer** | Self-contained token with claims, signed | Stateless auth, microservice-to-microservice |

**For B2B SaaS with partners:**

- **Partner server-to-server:** OAuth 2.0 Client Credentials flow. Partners register an app, get client_id/secret, exchange for short-lived access token. Tokens expire (1 hour). Secrets can be rotated without downtime
- **Partner dashboard (admin users):** OAuth 2.0 Authorization Code flow with PKCE. Users authenticate, grant scopes, get tokens
- **Internal microservices:** JWT with short expiry (5 min) + mTLS between services

**Why NOT just API keys for everything:**
- API keys don't expire (unless you build expiry logic)
- API keys can't represent user-level permissions (only app-level)
- If leaked, they're valid until manually revoked
- No standard for key rotation

---

**Q9. Design the API for a ride-sharing app (like Uber).**

**A:**

**Core resources and endpoints:**

```
POST   /rides                    → Request a ride (pickup, dropoff, ride_type)
GET    /rides/{id}               → Get ride details + status
PUT    /rides/{id}/cancel        → Cancel a ride
GET    /rides/{id}/tracking      → Real-time location tracking

GET    /drivers/{id}             → Driver profile
PATCH  /drivers/{id}/availability → Toggle online/offline
GET    /drivers/{id}/location    → Current location

POST   /payments                 → Process payment for a ride
GET    /rides/{id}/estimate      → Fare estimate before requesting
GET    /rides/{id}/receipt       → Receipt after completion
```

**"Request a ride" workflow (spans multiple services):**
1. Client → `POST /rides` → rides-service creates ride with status=REQUESTED
2. Rides-service → matching-service: find nearby available drivers
3. Matching-service → notification-service: push offer to top driver
4. Driver accepts → rides-service updates status=ACCEPTED, returns driver info
5. Driver arrives → status=ARRIVED (via driver app)
6. Trip starts → status=IN_PROGRESS, tracking begins (WebSocket for real-time location)
7. Trip ends → status=COMPLETED, payment-service charges rider

**Real-time updates:** WebSocket connection for ride status changes + driver location during trip. Polling fallback for unreliable connections.

**Error handling:** Idempotent ride requests (idempotency key prevents duplicate rides). Timeouts for driver matching (30s → expand search radius). Compensation saga for failed payments after trip.

---

**Q10. Same API for mobile (limited bandwidth) and admin dashboard (needs all data). Compare approaches.**

**A:**

| Approach | Pros | Cons |
|----------|------|------|
| **Two separate APIs** | Optimized for each client. Independent evolution | Code duplication. Two teams/codebases to maintain |
| **GraphQL** | One API, each client queries what it needs. Schema = contract | Learning curve. N+1 query risks. Complex caching |
| **BFF pattern** | Thin adapter per client type. Shared backend services | Extra layer (latency). Each BFF needs a team/owner |
| **Sparse fieldsets** | One API, field-level control. Simple to implement | Limited to flat filtering. Doesn't handle different response structures |

**Best fit by organization size:**
- **Small team (5-10 devs):** Sparse fieldsets + `?include=` for relationships. Simplest to build and maintain
- **Medium team (10-30 devs):** BFF pattern. Mobile team owns mobile BFF, web team owns web BFF, both call shared APIs
- **Large team (30+ devs):** GraphQL federated gateway. Each team owns their subgraph. Clients query the unified schema

**Organizational implication of BFF:** Each BFF has a clear owner (the frontend team that uses it). This aligns ownership with consumption. GraphQL requires a "platform" team to own the gateway/schema, which can become a bottleneck.

---

## 16. Security
[← Back to topic](16-Security.md#-senior-interview-questions)

**Q1. "We use HTTPS, so our API is secure." What threats remain despite TLS?**

**A:**

HTTPS encrypts the transport layer. It does NOT protect against:

1. **Broken Object-Level Authorization (BOLA):** `/api/users/123` → change to `/api/users/456`. TLS doesn't check if the requester is authorized to see user 456

2. **Injection (SQL, NoSQL, command):** `{"name": "'; DROP TABLE users;--"}`. TLS encrypts this payload — it still gets executed by the server

3. **SSRF (Server-Side Request Forgery):** `{"webhook_url": "http://169.254.169.254/metadata/"}` — attacker tricks your server into fetching internal resources (cloud metadata, internal services)

4. **Broken Authentication:** Weak passwords, missing MFA, JWT with `alg: "none"`, session fixation. TLS doesn't validate identity quality

5. **Mass Assignment:** `POST /users {"name": "Alice", "role": "admin"}` — server blindly assigns all fields including privileged ones

6. **Rate Limiting:** No rate limit → brute force, credential stuffing, DDoS. TLS doesn't throttle

7. **Data Exposure:** API returns more data than the client needs (internal IDs, email addresses, hashed passwords in response). TLS encrypts the over-exposure — it doesn't prevent it

8. **Supply Chain:** Compromised npm/pip dependency. TLS between your services doesn't help if the code itself is malicious

---

**Q2. Auth for users, admin dashboard, mobile app, and third-party API consumers.**

**A:**

| Consumer | Mechanism | Why |
|----------|-----------|-----|
| **Web users** | Session cookies (HttpOnly, Secure, SameSite=Strict) | Browser-native. Automatic CSRF protection with SameSite. No JS access to token |
| **Admin dashboard** | Session cookies + MFA + IP allowlist | Higher security for privileged access. Short session timeout (15 min) |
| **Mobile app** | OAuth 2.0 Authorization Code + PKCE → short-lived JWT (15 min) + refresh token (30 days) | PKCE prevents code interception. Refresh token stored in secure keychain |
| **Third-party API** | OAuth 2.0 Client Credentials → scoped access token | Partners get client_id/secret. Tokens have limited scopes (read:orders, not write:users) |
| **Internal services** | mTLS (mutual TLS) + JWT | Each service has a cert. No shared secrets. JWT carries service identity + permissions |

**Why this segmentation matters:** Each consumer has different threat models. Mobile apps can be decompiled (never embed secrets). Browsers are vulnerable to XSS/CSRF. Internal services need zero-trust (assume network is compromised).

---

**Q3. Passwords stored as MD5. Migrate to bcrypt/Argon2 without forcing password resets.**

**A:**

**Migration strategy (zero-downtime, no forced resets):**

**Phase 1: Wrap existing hashes**
- Hash each MD5 hash with bcrypt: `bcrypt(md5_hash)`
- Update all DB rows: `password_hash = bcrypt(existing_md5_hash)`, `hash_algorithm = "bcrypt_wrapped_md5"`
- On login: compute `bcrypt(md5(input_password))` and compare

**Phase 2: Upgrade on next login (lazy migration)**
- When a user logs in successfully:
  ```
  1. Verify with current algorithm (bcrypt_wrapped_md5)
  2. If success → rehash with pure bcrypt: bcrypt(input_password)
  3. Update DB: password_hash = bcrypt(raw_password), hash_algorithm = "bcrypt"
  ```
- Over weeks/months, active users are silently migrated to pure bcrypt

**Phase 3: Force stragglers**
- After 6 months, users still on `bcrypt_wrapped_md5` get a password reset prompt on next login
- Very inactive users → send password reset email

**Why not just force everyone immediately?** Mass password reset = support nightmare + user churn + phishing confusion ("real reset" vs "is this a phishing email?"). Lazy migration handles 90% of users transparently.

---

**Q4. BOLA vulnerability — users accessing other users' data by changing the ID. How to fix?**

**A:**

**Application level:**
```python
# BAD: No authorization check
@app.get("/users/{user_id}/orders")
def get_orders(user_id):
    return db.query("SELECT * FROM orders WHERE user_id = ?", user_id)

# GOOD: Authorization check
@app.get("/users/{user_id}/orders")
def get_orders(user_id, current_user):
    if current_user.id != user_id and not current_user.is_admin:
        raise ForbiddenError()
    return db.query("SELECT * FROM orders WHERE user_id = ?", user_id)
```

**Better: Use UUIDs instead of sequential IDs.** `/users/550e8400-e29b-41d4-a716-446655440000` is not guessable. (But still check authorization — UUIDs are not access control!)

**API Gateway level:**
- Extract user identity from JWT/session
- Inject `X-User-ID` header server-side (strip any client-provided value)
- Middleware: `if request.path contains {user_id} and user_id != authenticated_user → 403`

**Database level:**
- Row-Level Security (PostgreSQL RLS):
  ```sql
  CREATE POLICY user_isolation ON orders
    USING (user_id = current_setting('app.current_user_id')::int);
  ```
- Every query automatically filtered. Even if the application code forgets, the DB enforces it

---

**Q5. 10 million requests/second to login endpoint (DDoS). Defense layers.**

**A:**

**Layer 1: Edge (Cloudflare/AWS Shield)**
- Absorb volumetric attacks (L3/L4). These services handle terabits/sec
- Geo-blocking if attack originates from specific regions
- Bot detection: challenge suspicious traffic with JS challenges

**Layer 2: CDN/WAF**
- Web Application Firewall rules: block known attack patterns
- Rate limit by IP: 10 requests/sec per IP to `/login`
- Challenge: CAPTCHA after 3 failed attempts per IP

**Layer 3: Application rate limiting**
- Rate limit by account: 5 failed login attempts → 15 min lockout for that account
- Rate limit by IP: 100 requests/min per IP across all endpoints
- Progressive delay: 1s wait after attempt 1, 2s after attempt 2, 4s after attempt 3 (exponential backoff)

**Layer 4: Application hardening**
- Don't reveal whether username or password is wrong ("Invalid credentials" not "User not found")
- Constant-time password comparison (prevent timing attacks)
- Account lockout: temporary (15 min) not permanent (permanent lockouts let attackers lock out legitimate users)

**Trade-offs:**
- CAPTCHA: stops bots but hurts UX for legitimate users
- IP-based rate limiting: breaks for users behind corporate NAT (thousands of users share one IP)
- Account lockout: attackers can DoS specific accounts by repeatedly failing

---

**Q6. Employee leaves, how to revoke JWT access if JWTs are stateless?**

**A:**

**The problem:** JWT is self-contained. Server doesn't check a database on every request. Token is valid until `exp` (expiry).

| Strategy | How | Latency Impact | Complexity |
|----------|-----|---------------|-----------|
| **Short-lived tokens** | JWT expires in 5-15 min. Refresh token rotated on each use | None (just wait for expiry) | Low. But 5-15 min window of access after revocation |
| **Token blacklist** | Store revoked JTI (JWT ID) in Redis. Check on every request | +1ms (Redis lookup) | Medium. Defeats purpose of stateless JWT |
| **Reference tokens** | Token is an opaque ID. Server looks up permissions on every request | +2-5ms (DB/cache lookup) | High. Essentially session-based auth |

**Best approach for enterprise:**
1. **Short-lived access tokens (5 min)** + **refresh tokens (30 days) stored in DB**
2. When employee is deactivated → delete their refresh tokens from DB
3. Existing access tokens work for at most 5 more minutes, then they attempt refresh → denied
4. For immediate revocation (security incident): add JTI to short-lived Redis blacklist (TTL = token's remaining lifetime). Small, bounded set.

---

**Q7. Multi-tenant SaaS — row-level vs schema-per-tenant vs database-per-tenant security.**

**A:**

| Model | Isolation | Cost | Operations | Security |
|-------|-----------|------|-----------|----------|
| **Row-level** | Logical (`WHERE tenant_id = ?`) | Low (shared infra) | Simple (one DB to manage) | Bug in query = data leak. Need RLS |
| **Schema-per-tenant** | Moderate (separate tables, shared DB) | Medium | Medium (1000s of schemas to migrate) | Better (schema boundary). Cross-schema query = explicit |
| **Database-per-tenant** | Strong (separate databases) | High (DB per tenant) | Complex (1000s of DBs to patch, backup) | Strongest. Physical isolation. Compliance-friendly |

**Security testing differences:**
- **Row-level:** Test that EVERY query includes `tenant_id`. Fuzzing: can tenant A see tenant B's data by manipulating any parameter? Automated pen tests for BOLA
- **Schema-per-tenant:** Test that connection strings are scoped to the correct schema. Test that cross-schema joins are blocked
- **Database-per-tenant:** Test that connection routing maps tenant → correct DB. Test that credential rotation doesn't cross-wire tenants

**Recommendation:** Start with row-level + RLS for most tenants. Offer database-per-tenant for enterprise clients with compliance requirements (HIPAA, SOC 2).

---

**Q8. Secrets management evolution: hardcoded → env vars → vault. Secret rotation without downtime.**

**A:**

**Evolution and why each step is insufficient:**

| Stage | How | Problem |
|-------|-----|---------|
| **Hardcoded** | `db_password = "hunter2"` in source code | In git history forever. Any developer can see it. Stolen laptop = breach |
| **Env vars** | `DB_PASSWORD` set in deployment config | Better, but still visible in process listing, crash dumps, docker inspect |
| **Vault** | App authenticates to Vault → gets dynamic secret → secret expires | Best. Secrets are never on disk. Can be audited. Automatic rotation |

**Secret rotation without downtime:**

1. **Dual-credential strategy:**
   ```
   1. Generate new DB password (password_v2)
   2. DB now accepts BOTH password_v1 and password_v2
   3. Update Vault with password_v2
   4. Apps gradually pick up new secret (next lease renewal)
   5. After all apps use v2 → revoke password_v1
   ```

2. **Vault dynamic secrets (best):**
   - Vault creates a unique DB credential for each app instance
   - Credential has a TTL (e.g., 1 hour)
   - App renews lease before expiry → gets fresh credential
   - Compromised credential? Revoke just that one lease. Others unaffected

3. **Application-level:**
   - Connection pool refreshes credentials on the next connection (not mid-query)
   - Health check verifies credential validity
   - Graceful fallback: if new credential fails, log alert, retry with cached credential briefly

---

**Q9. GDPR right to erasure + SOC 2 compliance. Impact on database, logging, and data pipelines?**

**A:**

**Database design:**
- **Separate PII from operational data:** User PII in a dedicated `user_pii` table. Orders reference `user_id` (not name/email directly)
- **Deletion = delete PII table row.** Operational data (orders, analytics) retains anonymized `user_id` but no PII
- **Encryption per user:** Encrypt PII with a per-user key. "Delete" = delete the key (crypto-shredding). Data becomes unreadable without re-encrypting everything

**Logging:**
- **Never log PII.** Log `user_id: 12345` not `user_email: alice@example.com`
- **If PII was logged:** Need log rotation + deletion pipeline. Logs older than retention period are purged
- **Structured logging:** Makes it possible to redact specific fields programmatically

**Data pipelines (event sourcing):**
- **Event sourcing challenge:** Events are immutable by design. How do you "delete" a `UserRegistered` event?
- **Crypto-shredding:** PII in events is encrypted with a per-user key. Delete key → events still exist but PII fields are undecryptable
- **Tombstone events:** Publish `UserDataErased` event. Downstream consumers process it and purge their copies
- **Data lake:** PII in S3/data lake must also be purged. Partition data by user to make targeted deletion possible (otherwise you scan everything)

---

**Q10. Zero-trust security. VPN compromised — how does zero-trust prevent lateral movement?**

**A:**

**Traditional perimeter model:**
- Hard outer shell (firewall/VPN), soft inside
- Once inside the VPN → access to everything on the network
- Compromised VPN credential = attacker moves laterally across all internal services

**Zero-trust model: "Never trust, always verify"**

1. **Identity-based access:** Every request (even internal) must present verified identity. No implicit trust based on network location
2. **mTLS everywhere:** Service A → Service B requires mutual TLS. Both sides present certificates. Network position doesn't grant access
3. **Microsegmentation:** Each service can only talk to explicitly authorized services. Payment service cannot reach the HR database (even on the same network)
4. **Least privilege:** Tokens/certs carry only the minimum permissions needed. Payment service gets `write:payments` not `admin:*`
5. **Continuous verification:** Not just "authenticated at login." Re-verify on every request. Check device posture (is the laptop patched? Is antivirus running?)

**How it prevents lateral movement:**
- Attacker compromises Service A → tries to reach Service B
- Service B requires valid mTLS cert for Service A + authorized scope
- Even with A's cert, attacker can only do what A is authorized to do (not escalate)
- Cannot scan the network (microsegmentation blocks unexpected connections)
- Anomaly detection: A suddenly making unusual requests to B → alert

**Implementation:** Service mesh (Istio/Linkerd) for mTLS + authorization policies. BeyondCorp (Google's model) for user access without VPN.

---

## 17. Rate Limiting
[← Back to topic](17-Rate-Limiting.md#-senior-interview-questions)

**Q1. Distributed rate limiter with Redis for 100K concurrent users across 50 servers.**

**A:**

**Data structure:** Redis sorted set or simple key with atomic increment.

**Simple approach — Fixed window with Redis:**
```
Key: "ratelimit:{user_id}:{window}"  (e.g., "ratelimit:user123:202601201530")
MULTI
  INCR key
  EXPIRE key 60
EXEC
IF count > limit → reject (429)
```

**Better — Sliding window with Lua script (atomic):**
```lua
-- KEYS[1] = rate limit key, ARGV[1] = limit, ARGV[2] = window_ms, ARGV[3] = now_ms
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)  -- Remove old entries
local count = redis.call('ZCARD', key)                  -- Count current
if count < limit then
    redis.call('ZADD', key, now, now .. math.random())   -- Add this request
    redis.call('PEXPIRE', key, window)                    -- Set TTL
    return 1  -- Allowed
end
return 0  -- Rejected
```

**Why Lua:** The entire check-and-increment is atomic. No race conditions between 50 servers.

**If Redis goes down:**
- **Fail open:** Allow all requests (risk: no rate limiting during outage)
- **Fail closed:** Reject all requests (risk: total outage for legitimate users)
- **Best: Local fallback** — each server maintains a local token bucket. Less accurate (each server allows `limit/50`) but prevents total failure. When Redis recovers, sync back

---

**Q2. Compare rate limiting algorithms. Need bursts but steady average.**

**A:**

| Algorithm | How | Bursts? | Memory | Accuracy |
|-----------|-----|---------|--------|----------|
| **Token bucket** | Tokens added at steady rate, consumed per request. Bucket has max capacity | Yes (burst up to bucket size) | O(1) — one counter | Good |
| **Leaky bucket** | Requests enter a queue, processed at fixed rate | No (constant output rate) | O(1) | Exact |
| **Fixed window** | Counter per time window (e.g., per minute) | Yes (double burst at boundary) | O(1) | Low at boundaries |
| **Sliding window log** | Store timestamp of every request, count within window | No burst exploit | O(N) — one entry per request | Exact |
| **Sliding window counter** | Weighted average of current + previous window | Minimal burst exploit | O(1) | Good approximation |

**For "allow bursts but enforce average":** **Token bucket** is the answer.
- Set rate = 100 tokens/min (steady average)
- Set bucket size = 200 (allows burst of 200 requests)
- After burst, client must wait for tokens to refill at 100/min

**Configuration:** AWS API Gateway, Nginx, and Stripe all use token bucket because it naturally models "average rate with burst allowance."

---

**Q3. Attacker creates 10K accounts to bypass per-user rate limits.**

**A:**

**Layered defense:**

1. **IP-based rate limiting:** Rate limit per IP in addition to per-user. Even with 10K accounts, attacker likely uses limited IPs. 10 req/sec per IP
2. **Device fingerprinting:** Browser fingerprint (canvas, WebGL, fonts, screen resolution). Same fingerprint across accounts = suspicious
3. **Behavioral analysis:** New accounts that immediately hit API at max rate. Accounts with no organic activity. Flag and throttle
4. **CAPTCHA on account creation:** Solve CAPTCHA to create account. Makes bulk account creation expensive
5. **Progressive rate limiting:** New accounts (< 24 hours old) get stricter limits (10 req/min). Limits increase as account ages and shows legitimate behavior
6. **Phone/email verification:** Require verified phone number. Limits to number of phones an attacker has
7. **Cost-based deterrence:** Require a small deposit or credit card on file. Even $0.01 authorization = real card required

**Detection signals:** Accounts sharing IP, accounts created in rapid succession, identical user agents, no variation in request patterns (bots are mechanical, humans are messy).

---

**Q4. Client ignores 429 and retries in a tight loop. How to handle?**

**A:**

1. **Retry-After header:** `429 Too Many Requests` + `Retry-After: 30` (seconds). Well-behaved clients wait
2. **Exponential backoff enforcement:** Track retry behavior. If client retries within Retry-After window → double their backoff. 30s → 60s → 120s → 240s
3. **Progressive penalties:**
   - First 429: normal cooldown (30s)
   - Repeated 429s within 5 min: extend cooldown to 5 min
   - Continued abuse: block for 1 hour
   - Persistent abuse: block for 24 hours + alert security team
4. **Connection-level throttle:** After N violations, slow down the TCP connection (tarpit). Respond very slowly (2-3 seconds per byte). Ties up attacker's resources
5. **IP ban (last resort):** Temporary IP block at the WAF/firewall level. No application processing at all

**Key principle:** Make abuse more expensive for the attacker than for you. Each escalation level costs the attacker more time/resources.

---

**Q5. Tiered pricing: free (100 req/min), paid (10K), enterprise (unlimited). Distributed implementation.**

**A:**

**Architecture:**
```
Request → API Gateway → Check user tier → Apply tier-specific limit → Backend
```

**Tier storage:**
- Redis hash: `HSET user_tiers user_123 "paid"` — O(1) lookup
- Cached from the billing/subscription database
- Updated in real-time via event: `PlanUpgraded → update Redis → new limit applies immediately`

**Implementation:**
```python
TIER_LIMITS = {
    "free": {"requests_per_min": 100, "burst": 150},
    "paid": {"requests_per_min": 10000, "burst": 15000},
    "enterprise": {"requests_per_min": float('inf'), "burst": float('inf')},
}

def check_rate_limit(user_id):
    tier = redis.hget("user_tiers", user_id) or "free"
    limit = TIER_LIMITS[tier]
    # Apply token bucket with tier-specific parameters
```

**Real-time plan upgrade:** User upgrades to paid → billing service emits `PlanUpgraded` event → rate limit service updates Redis → next request uses new limit. Latency: <1 second.

**Enterprise "unlimited":** Not truly unlimited. Set to 100K req/min with alerting. Protect against compromised API keys flooding the system.

---

**Q6. Rate limiting at API gateway vs at each service? Pros/cons.**

**A:**

| Location | Pros | Cons |
|----------|------|------|
| **API Gateway** | Centralized policy. One place to configure. Rejects bad traffic early (saves backend resources) | Single point. Can't enforce service-specific limits. Coarse-grained |
| **Per-service** | Fine-grained (different limits per endpoint). Service knows its own capacity | Duplicated logic. Bad traffic reaches backend. Inconsistent implementation across teams |

**When to use both (defense in depth):**
- **Gateway:** Global rate limits (1000 req/min per API key). Protects the platform. Stops DDoS before it reaches services
- **Per-service:** Local rate limits (this service handles 500 req/sec max). Protects individual service from being overwhelmed by internal traffic too (service A calling service B excessively)

**Service mesh approach:** Envoy sidecar enforces rate limits at the service level. Configuration is centralized (control plane) but enforcement is distributed (per-pod). Best of both worlds.

---

**Q7. Fixed window boundary exploit. How sliding window counter fixes it.**

**A:**

**The exploit:**
- Fixed window: 100 req/min, window = 12:00-12:01
- Attacker sends 100 requests at 12:00:59 (end of window) + 100 at 12:01:00 (start of next window)
- Result: 200 requests in 2 seconds! Both within limit in their respective windows

**Sliding window counter fix:**
```
Current time: 12:01:15 (15 seconds into current window)
Previous window count: 80 requests
Current window count: 20 requests

Weighted count = prev × (1 - elapsed/window) + current
             = 80 × (1 - 15/60) + 20
             = 80 × 0.75 + 20
             = 60 + 20 = 80

80 < 100 limit → allowed
```

**How it prevents the exploit:** At the boundary (12:01:00), the previous window's count still carries 100% weight. So 100 (prev) + 0 (current) = 100. Already at limit! The attacker can't exploit the boundary.

**Trade-off:** Memory is still O(1) — just two counters. Accuracy is approximate (assumes even distribution within previous window) but very close to exact in practice. CloudFlare uses this algorithm.

---

**Q8. Webhook delivery system with per-customer outbound rate limiting and fair queuing.**

**A:**

**Problem:** Customer A allows 10 req/sec, Customer B allows 100 req/sec. Must respect each customer's limits without one customer's queue starving others.

**Design:**
1. **Per-customer token bucket:** Each customer has a token bucket in Redis with their contracted rate
2. **Fair queue:** Weighted fair queue (WFQ). Each customer gets a queue. Scheduler round-robins across queues, weighted by their rate limit
3. **Delivery workers:**
   ```
   while true:
     customer = fair_queue.next()
     if customer.token_bucket.try_acquire():
       event = customer.queue.dequeue()
       deliver(event)
     else:
       skip customer this round (they're at their limit)
   ```

**Handling failures:**
- **Customer endpoint down:** Exponential backoff for that customer (1s, 2s, 4s, 8s... up to 1 hour)
- **Circuit breaker:** After 10 consecutive failures, stop trying for 5 minutes
- **DLQ:** After 72 hours of failures, move events to dead letter queue, notify customer

**Fair scheduling ensures:** Customer A's slow endpoint doesn't block Customer B's fast endpoint. Each customer's queue is independent.

---

**Q9. Rate limiter adds 2-3ms latency (Redis round trip). Low-latency trading API needs sub-ms.**

**A:**

1. **Local token bucket with periodic sync:**
   - Each server maintains a local in-memory token bucket
   - Allocate: `total_limit / num_servers` tokens per server
   - Sync to Redis every 5 seconds (not every request)
   - Latency: ~0 (in-process check)
   - Trade-off: Less accurate (±20% error during sync intervals)

2. **Token pre-fetching:**
   - Server fetches a batch of 100 tokens from Redis at once
   - Serves from local batch until depleted, then fetches more
   - Latency: 0 for 99% of requests, 2ms for 1% (refetch)

3. **Approximate counters (probabilistic):**
   - Count-Min Sketch: probabilistic data structure for frequency estimation
   - Each request: hash user_id, increment local sketch, check threshold
   - Accuracy: within ε with probability 1-δ
   - Good enough: allow 100 ± 5 requests doesn't matter in practice

4. **Hardware-level:** CAS (Compare-And-Swap) on shared memory for multi-threaded servers. Lock-free atomic increment.

**For trading API:** Local token bucket with periodic sync. Accept slight inaccuracy (allow 102 instead of exactly 100) for 0ms overhead.

---

**Q10. Rate limiting vs throttling vs load shedding vs circuit breaking.**

**A:**

| Mechanism | What | When | How |
|-----------|------|------|-----|
| **Rate limiting** | Limit requests per user/IP/key over time | Always (proactive) | Token bucket, sliding window. Return 429 |
| **Throttling** | Slow down requests (don't reject) | When approaching capacity | Add delay, queue requests, degrade response quality |
| **Load shedding** | Reject requests to protect the system | Under extreme load | Drop lowest-priority requests. Return 503 |
| **Circuit breaking** | Stop calling a failing downstream service | When dependency is failing | Open circuit → fast-fail → periodic probe → close |

**How they work together:**
```
Request arrives
  ├─ Rate limiter checks: over limit? → 429 Too Many Requests
  ├─ Throttling: nearing capacity? → add 100ms delay, return degraded response
  ├─ Load shedding: at 95% CPU? → drop non-critical requests (analytics, preview)
  └─ Circuit breaker: payment service down? → fail fast, don't wait 30s timeout
```

**Key difference:** Rate limiting is per-client fairness. Load shedding is self-preservation. Throttling is graceful degradation. Circuit breaking is protecting against downstream failures.

---

## 18. Distributed Systems
[← Back to topic](18-Distributed-Systems.md#-senior-interview-questions)

**Q1. Raft consensus: leader election, log replication, safety. What happens during split-brain?**

**A:**

**Leader election:**
1. All nodes start as followers with a random election timeout (150-300ms)
2. Timeout expires → node becomes candidate, increments term, votes for itself, sends `RequestVote` to all
3. Node wins if it gets majority votes (>N/2). Becomes leader for this term
4. Leader sends periodic heartbeats to prevent new elections

**Log replication:**
1. Client sends command to leader
2. Leader appends entry to its log, sends `AppendEntries` to all followers
3. Once majority acknowledges → entry is committed
4. Leader notifies client of success

**Split-brain scenario (network partition):**
- 5 nodes: A(leader), B, C | D, E (partition separates them)
- Partition 1 (A, B, C): A still has majority (3/5). Can commit entries. Works normally
- Partition 2 (D, E): D might become candidate, but can never get majority (2/5). No leader elected on this side. Clients connected to D, E get stale reads or errors
- **After partition heals:** D and E discover the current term is higher. They discard any uncommitted entries and follow the real leader. Safety preserved because commits always require majority

**Safety guarantee:** A committed entry is on a majority of nodes. Any future leader must have that entry (because a candidate needs majority votes, and at least one voter has the entry).

---

**Q2. Distributed lock: Redis Redlock vs ZooKeeper vs etcd. Kleppmann's critique of Redlock.**

**A:**

| System | Mechanism | Availability | Safety |
|--------|-----------|-------------|--------|
| **Redis Redlock** | Acquire lock on N/2+1 of N independent Redis instances | High (no single point) | Controversial (see below) |
| **ZooKeeper** | Ephemeral sequential node. Smallest number = lock holder | High (ZAB consensus) | Strong (linearizable) |
| **etcd** | Lease-based lock with revision for fencing | High (Raft consensus) | Strong (linearizable) |

**Kleppmann's critique of Redlock:**
1. **GC pauses:** Client acquires lock → long GC pause → lock TTL expires → another client acquires lock → first client resumes, thinks it still has lock → both operate on shared resource
2. **Clock drift:** Redlock assumes clocks on N Redis instances are roughly synchronized. Clock jumps (NTP corrections, VM migration) can cause premature expiry
3. **No fencing:** Redlock doesn't provide a monotonically increasing fencing token. Without fencing, stale lock holders can corrupt data

**Antirez's rebuttal:** Fencing tokens solve this — but Redlock doesn't natively provide them. Practically, lock TTL + reasonable GC pauses work. But Kleppmann's point stands: if you need correctness, use a consensus-based system (ZK, etcd).

**Recommendation:** Use etcd/ZooKeeper for correctness-critical locks (financial transactions). Use Redis for efficiency-critical locks (preventing duplicate work, where occasional duplicate is tolerable).

---

**Q3. Distributed transaction: debit A → credit B → send notification. Saga pattern implementation.**

**A:**

**Choreography (event-driven):**
```
Account Service:     DebitAccount(A) → emit AccountDebited
Payment Service:     on AccountDebited → CreditAccount(B) → emit AccountCredited  
Notification Service: on AccountCredited → SendNotification → emit NotificationSent
```
**Compensating transactions (on failure):**
- CreditAccount fails → emit CreditFailed → Account Service refunds A (compensate)
- SendNotification fails → usually not compensated (non-critical). Log and retry

**Orchestration (central coordinator):**
```
Saga Orchestrator:
  1. Command: DebitAccount(A)      → success
  2. Command: CreditAccount(B)     → success  
  3. Command: SendNotification     → failure
  
  Compensate:
  3. (skip — notification is optional)
  -- OR if critical: --
  2. Command: ReverseCreditAccount(B) → success
  1. Command: RefundAccount(A)        → success
```

**Choreography vs Orchestration:**
- Choreography: no central point of failure, but hard to debug (events flying everywhere). Good for 3-4 steps
- Orchestration: clear visibility (saga state machine), but orchestrator is a single point. Good for 5+ steps or complex logic

---

**Q4. Two Generals' Problem and FLP impossibility. Fundamental limits and practical workarounds.**

**A:**

**Two Generals' Problem:**
- Two generals must agree to attack simultaneously. Communication by messenger through enemy territory (messages can be lost)
- General A sends "attack at dawn." Did B receive it? B sends ack. Did A receive the ack? A sends ack-of-ack. Infinite regress
- **Theorem:** No protocol with a finite number of messages can guarantee consensus over an unreliable channel
- **Practical impact:** TCP uses timeouts and retries but can never guarantee delivery. That's why TCP has a "connection timeout"

**FLP Impossibility (Fischer, Lynch, Paterson):**
- In an asynchronous system with even one faulty process, no deterministic algorithm can guarantee consensus
- "Asynchronous" = no bound on message delay. You can't distinguish a slow node from a dead one

**How practical systems work despite these:**
- **Raft/Paxos:** Use timeouts (violates pure asynchrony assumption). If leader doesn't respond in 300ms, assume it's dead. This is a practical trade-off: technically lose liveness guarantee, but it works in practice because networks are "mostly synchronous"
- **Randomization:** Some algorithms use random election timeouts to break symmetry (Raft does this)
- **Partial synchrony model:** Assume the network is eventually synchronous (messages arrive within some bound, eventually). This is realistic for most data centers

---

**Q5. Consistent hashing: node goes down. Impact on keys, cache hit rate, virtual nodes.**

**A:**

**When a node goes down:**
- Hash ring: keys mapped to nodes by position on the ring
- Node C dies → C's keys remapped to the next node clockwise (node D)
- **Only 1/N of keys are affected** (where N = number of nodes). Other keys stay on the same nodes
- Compare to modular hashing: node removal changes `hash % N` to `hash % (N-1)` → nearly ALL keys remap

**Cache hit rate impact:**
- N nodes, one goes down → ~1/N keys miss (need to rebuild from DB)
- 10 nodes → ~10% miss. 100 nodes → ~1% miss
- Temporary load spike on the DB for those keys

**Virtual nodes (vnodes):**
- Instead of one point on the ring per physical node, each node gets 100-200 virtual points
- **Without vnodes:** Uneven distribution. One node might own 40% of the ring by chance
- **With vnodes:** Load is evenly distributed. When a node dies, its keys spread across ALL remaining nodes (not just one neighbor)
- **Trade-off:** More memory for the ring mapping. But well worth it at any meaningful scale

---

**Q6. Lamport timestamps vs vector clocks vs hybrid logical clocks. For collaborative editing.**

**A:**

| Clock | What | Captures |
|-------|------|----------|
| **Lamport timestamp** | Single counter. Increment on send, max+1 on receive | Total ordering. But NOT causal: if L(a) < L(b), a might not have caused b |
| **Vector clock** | Array of N counters (one per node) | Causality. Can detect concurrent events (neither caused the other) |
| **Hybrid Logical Clock (HLC)** | Physical clock + logical counter | Causality + closeness to wall-clock time. Compact (one value, not N) |

**For collaborative editing: Vector clocks (or their variant).**

Why: Two users edit simultaneously on different servers. You need to detect that these are concurrent edits (not ordered). Only vector clocks can detect concurrency.

- User A types on Server 1: VC = [2, 0]
- User B types on Server 2: VC = [0, 3]
- Neither [2,0] ≤ [0,3] nor [0,3] ≤ [2,0] → **concurrent!**
- Apply conflict resolution (OT or CRDT)

**Lamport won't work:** It gives a total order but can't detect concurrency. It might order A's edit before B's when they were actually simultaneous, losing B's edit.

**HLC for databases:** Google Spanner uses TrueTime (a form of HLC). Good for databases where you need causality + approximate wall-clock ordering. But for collaborative editing, explicit concurrency detection (vector clocks) is more important.

---

**Q7. Distributed counter: 1M increments/sec across 10 data centers. CRDTs and gossip.**

**A:**

**G-Counter (Grow-only Counter) CRDT:**
```
Each data center maintains its own count:
  DC1: 150,000
  DC2: 120,000
  ...
  DC10: 95,000

Global count = sum of all entries = 1,250,000
```

**Merge rule:** For each DC entry, take the max. Commutative, associative, idempotent → convergent.

**PN-Counter (Positive-Negative):** Two G-Counters — one for increments, one for decrements. Value = P - N. Needed if counter can go down.

**Gossip protocol for synchronization:**
1. Every 1 second, each DC picks a random peer and exchanges its counter state
2. Merge received state with local state (take max per entry)
3. After O(log N) rounds, all DCs converge

**Anti-entropy:** Periodically, do a full state exchange (not just delta) to correct any missed gossip messages.

**Performance:** Each DC handles 100K increments/sec locally (in-memory atomic counter). No cross-DC coordination on the write path. Gossip syncs eventual totals every 1-5 seconds.

**Trade-off:** Count is eventually consistent. At any instant, `sum(all DCs)` might be stale by a few seconds. For counters (likes, views, page hits), this is perfectly acceptable.

---

**Q8. Process dies while holding a distributed lock. TTL, fencing tokens, timeout dangers.**

**A:**

**TTL-based expiration:**
- Lock has a TTL (e.g., 30 seconds). If holder dies, lock auto-expires
- **Danger:** What if the holder is alive but slow (GC pause, network delay)? Lock expires while it's still working. Another process acquires the lock. Now TWO processes think they hold it

**Fencing tokens (solution):**
```
Lock acquisition returns a monotonically increasing token:
  Process A: acquires lock, gets token=33
  Process A: GC pause... lock expires
  Process B: acquires lock, gets token=34
  Process A: resumes, tries to write with token=33
  Storage: rejects token=33 because it already saw token=34
```
- The storage/resource being protected must check the fencing token
- Stale lock holders are rejected even if they think they still hold the lock

**The timeout problem:**
- Too short TTL → false expiry (holder is alive but slow) → safety violation
- Too long TTL → dead holder keeps lock for too long → availability issue
- **No perfect timeout exists** (you can't distinguish slow from dead in an asynchronous system)

**Best practice:** Short TTL (10-30s) + TTL renewal/heartbeat (holder extends TTL every TTL/3). If holder dies, lock expires after at most TTL. If holder is alive, TTL never expires. Fencing token protects against the edge case where renewal fails but holder continues.

---

**Q9. Byzantine Generals' Problem. Real-world BFT beyond blockchain.**

**A:**

**The problem:** N generals must agree on a battle plan. Up to F generals are traitors who may send conflicting messages. Need 3F+1 total generals to tolerate F traitors.

**Beyond blockchain — real-world BFT:**
1. **Aviation systems:** Flight control computers (3-4 redundant computers). One might produce wrong output due to hardware fault (cosmic ray, chip defect). Majority vote among computers
2. **Space missions:** Mars rovers have triple-redundant processors. Can't "restart" when you're 20 light-minutes away
3. **Financial systems:** Stock exchange matching engines. A Byzantine fault (wrong price computation) could cause massive financial damage
4. **Certificate authorities:** CT (Certificate Transparency) logs must be tamper-evident. Byzantine-fault-tolerant append-only logs

**Why most systems don't bother:**
- **Expensive:** BFT consensus (PBFT) needs 3F+1 nodes and O(N²) messages per decision. Raft needs 2F+1 and O(N)
- **Rare:** Byzantine faults (hardware producing wrong results) are extremely rare in data centers. Crash faults (process dies) are common. Crash fault tolerance (Raft) is sufficient
- **Trust model:** In a corporate data center, you trust your own servers. BFT is for environments where you DON'T trust all participants (blockchain: untrusted miners)

---

**Q10. Google Spanner: external consistency across data centers. TrueTime, commit-wait.**

**A:**

**The challenge:** Traditional distributed databases can't order transactions across data centers because clocks aren't perfectly synchronized.

**TrueTime API:**
```
TT.now() → returns interval [earliest, latest]
  Example: [12:00:00.003, 12:00:00.007]
  Real time is guaranteed to be within this interval
  Uncertainty ε = (latest - earliest) / 2 ≈ 4ms (typically 1-7ms)
```

**How it works:** GPS receivers + atomic clocks in every data center. GPS gives absolute time (±100ns). Atomic clocks drift slowly between GPS syncs. Combined uncertainty: ~1-7ms.

**Commit-wait protocol:**
1. Transaction T1 gets commit timestamp `s1 = TT.now().latest`
2. **Wait** until `TT.now().earliest > s1` (wait for uncertainty interval to pass, ~7ms)
3. Now we're CERTAIN: real time is after `s1`
4. Any transaction T2 that starts after T1 committed will get `s2 > s1`
5. This guarantees: if T1 committed before T2 started (in real time), then `s1 < s2` (in Spanner time)

**External consistency:** The order of transactions in Spanner matches the order a real-time observer would see. Stronger than serializability — it's linearizability across the globe.

**Why atomic clocks matter:** Without hardware clocks, uncertainty could be seconds (NTP). Commit-wait of seconds = unusable. With atomic clocks, uncertainty is ~4ms. Commit-wait of 4ms is acceptable for most workloads.

---

## 19. Event-Driven Architecture
[← Back to topic](19-Event-Driven-Architecture.md#-senior-interview-questions)

**Q1. Choreography vs orchestration saga: Order, Payment, Inventory, Shipping. Happy path, failure, compensation.**

**A:**

**Choreography (event-driven, no central coordinator):**

Happy path:
```
OrderService: CreateOrder → emit OrderCreated
PaymentService: on OrderCreated → ChargePayment → emit PaymentCompleted
InventoryService: on PaymentCompleted → ReserveStock → emit StockReserved
ShippingService: on StockReserved → CreateShipment → emit ShipmentCreated
```

Failure (Inventory fails):
```
InventoryService: on PaymentCompleted → ReserveStock FAILS → emit StockReservationFailed
PaymentService: on StockReservationFailed → RefundPayment → emit PaymentRefunded
OrderService: on PaymentRefunded → CancelOrder → emit OrderCancelled
```

**Orchestration (central saga coordinator):**

Happy path:
```
SagaOrchestrator:
  1. Call OrderService.CreateOrder → success
  2. Call PaymentService.Charge → success
  3. Call InventoryService.Reserve → success
  4. Call ShippingService.Ship → success
  5. Saga COMPLETED
```

Failure (Step 3 fails):
```
SagaOrchestrator:
  3. Call InventoryService.Reserve → FAILED
  Compensate:
  2. Call PaymentService.Refund → success
  1. Call OrderService.Cancel → success
  Saga COMPENSATED
```

**When to choose:**
- **Choreography:** Simple flows (3-4 steps), teams are autonomous, events are the natural boundary
- **Orchestration:** Complex flows (5+ steps), need clear visibility, business logic in the ordering, easier to test and debug

---

**Q2. Event sourcing with 500M events. Rebuilding aggregate takes 30 seconds. Optimization.**

**A:**

**Snapshots:**
- Periodically save the aggregate state: "as of event #10,000, the order state is {...}"
- To rebuild: load snapshot → replay only events after the snapshot
- Snapshot every N events (e.g., every 1000). Replay: at most 1000 events instead of millions
- Storage: save snapshot to a fast store (Redis, DynamoDB)

**Projection stores (materialized views):**
- Pre-compute read-optimized views by processing events in real-time
- "Current order state" projection: updated as each event arrives
- Reading current state: single DB lookup (0ms replay), not event replay
- Trade-off: eventual consistency between event store and projection

**Event archiving:**
- Move events older than X months to cold storage (S3, Glacier)
- Keep recent events in hot store (EventStoreDB, Kafka)
- For auditing: query archive if needed. For operational reads: use projections

**Combined strategy:**
```
Write path: append event to event store
Read path: query projection (not event store)
Rebuild: load snapshot + replay recent events
Archive: move old events to S3 weekly
```

**Result:** Aggregate rebuild from snapshot + last 1000 events: <100ms instead of 30s.

---

**Q3. Event vs command vs query. Can a consumer emit another event? Infinite loop prevention.**

**A:**

| Concept | Direction | Intent | Example |
|---------|-----------|--------|---------|
| **Command** | Sender → specific receiver | "Do this" (imperative) | `CreateOrder`, `ChargePayment` |
| **Event** | Publisher → any subscriber | "This happened" (past tense) | `OrderCreated`, `PaymentCharged` |
| **Query** | Requester → responder | "What's the state?" | `GetOrderDetails`, `ListUsers` |

**Can a consumer emit another event?** Yes — this is the foundation of event-driven workflows. Service A emits `OrderCreated` → Service B consumes it, processes payment, emits `PaymentCompleted`.

**Infinite loop risks:**
- Service A emits EventX → Service B consumes EventX, emits EventY → Service A consumes EventY, emits EventX → infinite loop!

**Prevention:**
1. **Acyclic event flow:** Design event flows as a DAG (directed acyclic graph). No cycles allowed. Code review event flows
2. **Correlation ID + hop count:** Each event carries a correlation ID and a hop counter. After N hops (e.g., 10), stop processing
3. **Idempotency:** If Service A already processed this correlation ID, skip it
4. **Event type discipline:** Events should describe state changes, not trigger commands disguised as events. `OrderCreated` is an event. `ProcessPayment` is a command (should be a direct call, not an event)

---

**Q4. New event schema version breaks 3 downstream consumers. Prevention strategy.**

**A:**

**Schema Registry (Confluent Schema Registry, AWS Glue):**
- Every event schema is registered with a version
- Before publishing a new schema version: compatibility check
- Backward compatible: new schema can read old data (add fields with defaults)
- Forward compatible: old schema can read new data (ignore unknown fields)

**Compatibility rules:**
```
BACKWARD: New consumers can read old events ← safest for consumers
FORWARD:  Old consumers can read new events ← safest for producers
FULL:     Both directions ← most restrictive, safest overall
```

**Safe schema changes:**
- ✅ Add optional field with default
- ✅ Remove optional field (if consumers ignore unknown fields)
- ❌ Remove required field (breaks consumers expecting it)
- ❌ Rename field (old consumers can't find it)
- ❌ Change field type (int → string)

**Contract testing:**
- Consumer-Driven Contract Tests: each consumer publishes a "contract" (what fields/shapes it expects)
- Producer CI/CD runs all consumer contracts before deploying schema changes
- If any contract fails → deployment blocked

**Migration path for breaking changes:** Create a new event type (`OrderCreatedV2`), publish both old and new during migration, consumers migrate on their schedule, deprecate old event type after all consumers switched.

---

**Q5. Kafka vs RabbitMQ vs AWS EventBridge for durable storage + replay + exactly-once.**

**A:**

| Feature | Kafka | RabbitMQ | EventBridge |
|---------|-------|----------|-------------|
| **Durable storage** | Yes (days/weeks/forever) | No (deleted after ack) | Limited (archive to S3) |
| **Replay** | Yes (re-read from any offset) | No | No (fire-and-forget) |
| **Exactly-once** | Yes (transactional producer + idempotent consumer) | No (at-least-once) | No (at-least-once) |
| **Throughput** | 1M+ msg/sec | ~50K msg/sec | Auto-scales (AWS managed) |
| **Operations** | Complex (ZK/KRaft, partitions, ISR) | Moderate | Zero (fully managed) |

**For these requirements: Kafka** is the only option that satisfies all three.

**When to use each:**
- **Kafka:** Event sourcing, data pipelines, stream processing. You need the log
- **RabbitMQ:** Task queues, request-reply, routing patterns. You need flexible routing
- **EventBridge:** AWS-native event routing, low-ops teams, glue between AWS services. You need simplicity

---

**Q6. CQRS read projection is 5 seconds behind. User doesn't see their just-created order.**

**A:**

**Solutions (from simplest to most complex):**

1. **Read-your-writes consistency:**
   After write, redirect to read the WRITE database (not the projection) for this specific user for the next 10 seconds. Other reads use projections normally
   ```
   POST /orders → write DB
   GET /my-orders → if last_write < 10s_ago → read from write DB
                   → else → read from projection
   ```

2. **Optimistic UI:**
   Client adds the order to the local UI immediately after POST returns success. Don't wait for the projection. If the projection eventually shows something different, update (rare)

3. **Synchronous projection for critical paths:**
   After writing, synchronously update the user's "my orders" projection before returning the HTTP response. Only for this specific projection (not all projections)

4. **Version/sequence-based consistency:**
   Write returns `{order_id, version: 42}`. Read passes `?min_version=42`. Read endpoint waits (short-polls) until projection has version ≥ 42. Timeout after 5 seconds → fall back to write DB

**Best approach:** Optimistic UI (solution 2) for web/mobile. It's instant, simple, and covers 99% of cases. Combined with solution 1 for API consumers.

---

**Q7. Event sourcing + GDPR right-to-erasure. Events are immutable — how to reconcile?**

**A:**

**Crypto-shredding (recommended):**
1. Personal data in events is encrypted with a per-user key
   ```json
   { "type": "OrderCreated",
     "user_id": "user_123",
     "encrypted_data": "aGVsbG8gd29ybGQ=",  // name, email, address
     "encryption_key_id": "key_user_123" }
   ```
2. Keys stored in a separate key management service
3. GDPR erasure request → delete `key_user_123`
4. Events remain in the log, but `encrypted_data` is permanently unreadable
5. Non-personal data (order_id, timestamps, amounts) stays readable for business analytics

**Tombstone events:**
- Publish `UserDataErased { user_id: "user_123", timestamp: "..." }`
- Projection rebuilds: when processing events, check if `UserDataErased` exists for this user → skip/anonymize personal data
- Downstream consumers process tombstone and purge their copies

**Personal data store (separate):**
- Don't put PII in events at all
- Events reference `user_id` only
- PII lives in a separate, mutable "personal data store"
- GDPR erasure = delete from personal data store. Events unaffected

---

**Q8. PaymentProcessed event consumed twice → double charge. How did it happen and how to prevent?**

**A:**

**How it happened (at-least-once delivery):**
1. Consumer processes `PaymentProcessed`, charges the customer
2. Consumer tries to commit offset to Kafka → network timeout
3. Kafka doesn't record the offset as committed
4. Consumer restarts (or rebalances) → re-reads from last committed offset → processes `PaymentProcessed` again → second charge

**Prevention — Idempotent consumer:**
```python
def handle_payment_processed(event):
    idempotency_key = f"{event.order_id}_{event.event_id}"
    
    # Atomic: check + process in one transaction
    with db.transaction():
        if db.exists("processed_events", idempotency_key):
            return  # Already processed, skip
        
        charge_customer(event.amount)
        db.insert("processed_events", idempotency_key)
    
    # Commit Kafka offset AFTER successful DB transaction
    consumer.commit()
```

**Key design principles:**
- **Idempotency key:** Derived from event ID (not generated on each attempt). Same event → same key → deduplicated
- **Atomic processing + recording:** The charge and the "I processed this" record must be in the same DB transaction
- **Outbox pattern:** If the charge involves an external payment gateway, use two-phase: (1) record intent in DB, (2) call gateway, (3) update DB with result. On retry: check DB → see already charged → skip

---

**Q9. Event-driven vs request-driven for food delivery (DoorDash). Where to draw the boundary.**

**A:**

**Should be synchronous (request-driven):**
- **Place order:** User needs immediate confirmation. `POST /orders → 201 Created`
- **Restaurant search:** User queries, expects instant results. `GET /restaurants?location=...`
- **Payment processing:** Must confirm payment before proceeding. Synchronous charge → confirmed/declined
- **Estimated delivery time:** Real-time calculation. `GET /orders/{id}/eta`

**Should be event-driven:**
- **Order status updates:** `OrderAccepted → DriverAssigned → PickedUp → Delivered` — events flowing through the system, multiple consumers (customer notification, analytics, driver app)
- **Driver assignment/matching:** Complex matching algorithm triggered by events. Multiple matches → best driver notified. If declined → next driver. Async by nature
- **Restaurant notifications:** New order → notify restaurant. Kitchen queue management is async
- **Analytics/reporting:** Every event feeds into the data pipeline. Decoupled from order flow
- **Promotions/recommendations:** User placed 10th order → trigger loyalty reward event

**The boundary:**
```
Synchronous (user-facing, needs immediate response):
  Browser/App → API Gateway → Order Service → Payment Service

Event-driven (backend workflows, multi-consumer):
  Order Service → [OrderCreated event] → Kafka
    → Driver Matching Service
    → Restaurant Notification Service  
    → Analytics Pipeline
    → Loyalty/Promotions Service
```

---

**Q10. Event-sourced system needs reports. Projection/materialized view strategy.**

**A:**

**Architecture:**
```
Event Store → Event Processor → Projection DB (read-optimized)
                                    ↓
                            Report Queries (SQL)
```

**Projection design:**
- **Per-report projections:** "Orders by region last month" → dedicated table `order_region_monthly` updated by processing each `OrderCreated` event
- **Generic projections:** Materialize the current state of each aggregate. Enables ad-hoc SQL queries
- **OLAP projections:** Star schema (fact + dimension tables) for analytical queries. Best for complex reports

**Handling projection failures:**
1. Projection processor stores its last processed offset/position
2. On failure: restart from last committed offset → reprocess (must be idempotent)
3. If projection is corrupted: rebuild from scratch (replay all events)

**Schema evolution:**
- Projection schema changes (add column): create new projection version, rebuild it from event stream
- No migration scripts needed — just replay events into the new schema
- Run old and new projections in parallel during migration. Switch reads to new projection when caught up

**Rebuilding from scratch:**
- Create new projection table (e.g., `order_region_monthly_v2`)
- Replay all events from event store into new table
- When caught up: swap reads from v1 to v2 → delete v1
- Duration: 500M events at 50K events/sec = ~3 hours. Run as a background job

---

## 20. Observability
[← Back to topic](20-Observability.md#-senior-interview-questions)

**Q1. 200 microservices, intermittent slow responses. Debugging with logs, metrics, and traces.**

**A:**

**Step 1: Metrics (start wide, narrow down)**
- Dashboard: check overall p99 latency across all services
- Identify which service(s) show latency spikes: Service X p99 jumped from 50ms to 2s
- Check Service X's dependencies: is Service Y (downstream) also slow?

**Step 2: Traces (find the slow path)**
- Search traces where duration > 2s
- Trace waterfall shows: Service X → Service Y (50ms) → Database call (1800ms!) → Service Z (50ms)
- Root cause narrowed to: database call in Service Y

**Step 3: Logs (understand why)**
- Filter logs: `service=Y AND correlation_id=abc123 AND span_id=xyz`
- Log: `"Slow query: SELECT * FROM orders WHERE status='pending' — scanned 5M rows, no index on status"`
- Root cause: missing database index

**Correlation across pillars:**
- **Trace ID** connects metrics spike → specific slow traces → relevant logs
- Without trace ID: you're searching 200 services' logs for a needle in a haystack
- **Golden signals to check first:** Latency, traffic, errors, saturation (USE/RED methods)

---

**Q2. 50 TB logs/day. Reduce volume without losing observability.**

**A:**

**Sampling:**
- **Head-based sampling:** Decide at entry point: log 10% of requests. 50TB → 5TB
- **Tail-based sampling:** Keep 100% of errors and slow requests, sample 1% of successful/fast ones. Preserves interesting data
- **Dynamic sampling:** Under normal conditions: 1%. During incident: 100%. Triggered by error rate threshold

**Log levels:**
- Production: INFO and above (skip DEBUG/TRACE)
- Per-service overrides: Enable DEBUG for Service X during investigation via feature flag
- Estimated reduction: 30-50% by eliminating DEBUG logs

**Structured logging:**
- JSON logs instead of free-text. `{"level":"error","service":"payment","user_id":"123","latency_ms":500}`
- Enables efficient parsing, indexing, and querying
- Smaller than verbose free-text logs with stack traces

**Hot/warm/cold tiering:**
| Tier | Storage | Retention | Query Speed | Cost |
|------|---------|-----------|-------------|------|
| **Hot** | Elasticsearch/Loki | 7 days | Fast (seconds) | $$$ |
| **Warm** | S3 + Athena | 30 days | Moderate (minutes) | $$ |
| **Cold** | S3 Glacier | 1 year+ | Slow (hours) | $ |

**Combined:** Tail-based sampling (5x reduction) + log levels (2x) + tiering (cost reduction) = manageable at scale.

---

**Q3. Prometheus+Grafana vs Datadog vs New Relic for K8s microservices.**

**A:**

| Factor | Prometheus + Grafana | Datadog | New Relic |
|--------|---------------------|---------|-----------|
| **Cost** | Free (self-hosted). Infra cost only | $$$$ (per host + custom metrics) | $$$ (per GB ingested) |
| **At scale (500 nodes)** | Need Thanos/Cortex for federation | Scales automatically (SaaS) | Scales automatically (SaaS) |
| **Cardinality** | Limited (~10M series per instance) | High (but expensive per custom metric) | High |
| **Custom metrics** | PromQL (powerful but learning curve) | DogStatsD (easy) | NRQL (SQL-like) |
| **Alerting** | Alertmanager (powerful, complex) | Built-in (easy) | Built-in |
| **K8s native** | Yes (kube-state-metrics, node-exporter) | Yes (Datadog Agent DaemonSet) | Yes |
| **All-in-one** | No (need Grafana, Loki, Tempo separately) | Yes (metrics, logs, traces, APM) | Yes |

**Recommendation by organization:**
- **Startup / cost-conscious:** Prometheus + Grafana + Loki + Tempo. Free but requires operational expertise
- **Mid-size / velocity-focused:** Datadog. All-in-one. Fast to set up. Cost grows with scale
- **Enterprise / already invested:** Whichever has organizational buy-in. Migration cost > tool differences

---

**Q4. 200 alerts/day, on-call ignores most. Fix alert fatigue.**

**A:**

**Diagnosis:**
- Categorize alerts: How many are actionable? How many are noise?
- Typical finding: 80% are noise (non-critical, auto-resolving, duplicate)

**Fixes:**

1. **SLO-based alerting:** Don't alert on individual metric thresholds. Alert when SLO is at risk
   - Instead of: "CPU > 80% on instance-47" (noise)
   - Use: "Error budget for payment API is 50% consumed with 20 days remaining" (actionable)

2. **Multi-window burn rate (Google SRE):**
   - Fast burn: consuming error budget 14x faster than sustainable → page immediately
   - Slow burn: consuming 1.5x faster → ticket (not page)
   - This reduces alerts to ~5/day, all meaningful

3. **Alert hygiene:**
   - Every alert must have a runbook (what to do when it fires)
   - If an alert fires and requires no action → delete it
   - Weekly alert review: which alerts fired? Were they useful? Tune or remove

4. **Deduplication and grouping:**
   - Alertmanager: group alerts by service (`group_by: [service]`). 50 pod alerts → 1 service alert
   - Inhibition: if the database is down, suppress all "service can't connect to DB" alerts (root cause is the DB)

---

**Q5. Monitoring vs observability. 100% test coverage + dashboards but still slow to diagnose.**

**A:**

**Monitoring answers:** "Is the system working?" (known-unknowns)
- Dashboards with predefined metrics: CPU, memory, error rate, latency
- Alerts on thresholds: "error rate > 5%"
- Works for known failure modes

**Observability answers:** "WHY is the system broken?" (unknown-unknowns)
- Ability to ask arbitrary questions of your system without deploying new code
- "Show me all requests from user X that took >2s in the last hour, broken down by service"
- Requires: high-cardinality, high-dimensionality data (traces, structured logs, events)

**Why 100% coverage + dashboards fail:**
- Tests verify known behaviors. Production has emergent behaviors from service interactions
- Dashboards show pre-selected metrics. Novel failures don't have dashboards yet
- Example: "requests from users in Japan are slow on Tuesdays between 3-4 PM" — no dashboard covers this. But with structured logs + traces, you can query for it

**The shift:** From "what metrics should we dashboard?" to "what data do we need to emit so we can answer ANY question later?" Structured events with rich context > aggregated metrics.

---

**Q6. Distributed tracing across 5 languages and 3 frameworks without modifying every service.**

**A:**

**OpenTelemetry auto-instrumentation:**
- Java: `-javaagent:opentelemetry-javaagent.jar` — attach to JVM at startup. Zero code changes
- Python: `opentelemetry-instrument python app.py` — wraps common libraries (Flask, requests, SQLAlchemy)
- Node.js: `--require @opentelemetry/auto-instrumentations-node`
- Go: No auto-instrumentation (Go's compilation model prevents it). Need manual or middleware-based instrumentation
- .NET: `dotnet add package OpenTelemetry.AutoInstrumentation`

**What auto-instrumentation captures:** HTTP in/out, database calls, gRPC, messaging (Kafka, RabbitMQ). Context propagation (trace-id in headers) is automatic.

**Service mesh telemetry (for Go or hard-to-instrument services):**
- Envoy sidecar (Istio) captures all network traffic
- Generates spans for every request without any application code changes
- Limitation: can't see inside the service (business logic spans)

**Architecture:**
```
Services → OTel SDK (auto-instrumented) → OTel Collector → Jaeger/Tempo
Sidecar proxies → generate mesh-level spans → same Jaeger/Tempo
```

**context propagation header:** `traceparent: 00-<trace-id>-<span-id>-01` (W3C standard). All services must forward this header. Auto-instrumentation handles this for HTTP clients.

---

**Q7. Prometheus high cardinality: user_id as label. Why dangerous and how to fix.**

**A:**

**Why high cardinality kills Prometheus:**
- Prometheus stores one time series per unique label combination
- `http_requests{user_id="user_1"}`, `http_requests{user_id="user_2"}`, ... `user_id="user_1000000"`
- 1M users × 10 metrics × 5 labels = 50M time series
- Each series: ~1-3 bytes per sample × 15s scrape interval = GB/day
- Prometheus memory: ~2KB per time series in memory → 50M × 2KB = 100GB RAM. OOM

**Why it's fine for logs:** Logs are just text lines stored on disk. High cardinality = just more unique values. No explosion. Logs are queried, not aggregated in real-time.

**How to fix:**
1. **Remove user_id from metrics labels.** Metrics answer "how many?" not "who?"
2. **Use request-level tracing for per-user analysis.** Traces carry user_id. Query traces: "show me traces for user_123"
3. **If you need per-user metrics:** Use a histogram of latency (all users combined) + traces filtered by user_id for specific users
4. **Recording rules:** Pre-aggregate high-cardinality metrics into lower-cardinality: `sum by (endpoint) (http_requests)` instead of `sum by (user_id, endpoint)`

**Rule of thumb:** Metrics labels should have bounded cardinality (<1000 unique values). Unbounded cardinality → use logs or traces.

---

**Q8. SLIs, SLOs, SLAs for a payment processing API.**

**A:**

**SLIs (Service Level Indicators) — what we measure:**
| SLI | Measurement |
|-----|-------------|
| **Availability** | % of requests returning non-5xx responses |
| **Latency** | p50, p95, p99 of response time |
| **Correctness** | % of payments processed with correct amount (no over/under-charge) |
| **Throughput** | Successful transactions per second |

**SLOs (Service Level Objectives) — our targets:**
| SLO | Target |
|-----|--------|
| Availability | 99.99% (≤4.3 minutes downtime/month) |
| Latency (p99) | < 500ms |
| Correctness | 100% (zero tolerance for wrong amounts) |
| Throughput | Handle 10K TPS at peak |

**SLA (Service Level Agreement) — contractual commitment:**
- "99.9% availability per month. If breached, customer receives 10% credit"
- SLA is looser than SLO. SLO = 99.99%, SLA = 99.9%. Buffer allows internal issues before contractual breach

**Error budget:**
- SLO = 99.99% → error budget = 0.01% → 4.3 minutes/month
- If error budget is consumed by Day 15 → freeze deployments, focus on reliability
- If error budget is healthy → deploy features freely, take risks
- Error budget aligns product velocity with reliability investment

---

**Q9. 12-service trace shows 2s total but each service shows <100ms. Where's the time?**

**A:**

**The gap between service time and wall time:**

| Hidden Time | Explanation |
|-------------|-------------|
| **Queueing time** | Request sits in a message queue or thread pool queue waiting to be processed. Not counted in service metrics |
| **Network latency** | Time between services (especially cross-AZ or cross-region). 12 hops × 5ms = 60ms |
| **Serialization/deserialization** | JSON parse/stringify at each hop. 12 services × 2 (ser + deser) × 5ms = 120ms |
| **Connection setup** | TLS handshake, TCP connection pool miss. Cold connections: +50-100ms per hop |
| **Load balancer processing** | Each hop through an L7 LB adds 1-5ms |
| **Sidecar proxy** | Envoy/Istio sidecar adds ~1-3ms per hop (2 sidecars per hop: source + destination) |

**How to find it:**
- Distributed trace with fine-grained span boundaries. Each span should include: queue wait time, network time, processing time
- Look for gaps between spans. A gap = time not accounted for in any service
- Check: are calls sequential when they could be parallel? 12 sequential × 100ms = 1.2s. Parallelizing independent calls reduces wall time

**Typical finding:** Queue wait time (backlogged thread pool) + serialization overhead + sequential calls that should be parallel.

---

**Q10. Entire observability stack goes down. How to diagnose production issues?**

**A:**

**Failsafe mechanisms (build before you need them):**

1. **Health check endpoints:** Every service exposes `/health` and `/ready`. Curl them manually. Binary signal: up or down
2. **SSH + system tools:** `top`, `htop`, `vmstat`, `iostat`, `netstat`, `ss`, `strace`. The OG debugging tools work without any observability stack
3. **Application logs to disk:** Even if ELK is down, logs should also write to local disk (`/var/log/app/`). `grep`, `awk`, `tail -f` still work
4. **Database direct query:** Check DB directly: connection count, slow query log, replication lag. `SHOW PROCESSLIST`, `pg_stat_activity`
5. **Canary endpoints:** Synthetic requests that test critical paths. Curl them from your laptop. "Can I create an order? Can I process a payment?"

**Manual debugging process:**
```
1. Is it networking? → ping, traceroute, curl between services
2. Is it compute? → top (CPU), free -m (memory), df -h (disk)  
3. Is it the database? → slow query log, connection pool exhaustion
4. Is it a deploy? → when did it start? correlate with last deployment time
5. Is it external? → check external dependency status pages
```

**Prevention:** Observability stack should be more reliable than the production services it monitors. Self-hosted → run on a separate cluster. Cloud SaaS (Datadog) → their SLA covers you.

---

## 21. Data Pipelines
[← Back to topic](21-Data-Pipelines.md#-senior-interview-questions)

**Q1. Lambda vs Kappa architecture. Why teams are moving to Kappa.**

**A:**

**Lambda architecture:**
```
               ┌── Batch Layer (MapReduce/Spark) ──► Batch View ──┐
Raw Data ──────┤                                                   ├──► Query
               └── Speed Layer (Storm/Flink) ──────► Real-time View┘
```
- Two code paths: batch (accurate, slow) + speed (approximate, fast)
- Merge results from both layers for each query

**Kappa architecture:**
```
Raw Data ──► Stream Layer (Flink/Kafka Streams) ──► Materialized View ──► Query
```
- ONE code path: stream processing. Replay from Kafka for reprocessing
- No batch layer needed

**Why teams move to Kappa:**
1. **Code duplication:** Lambda requires writing the same logic twice (batch + stream). Two codebases to maintain, test, and debug
2. **Consistency:** Batch and speed layers may produce different results (different codebases, different semantics)
3. **Kafka enables replay:** With Kafka's log retention, you can reprocess historical data by replaying from an earlier offset. This was the batch layer's job
4. **Stream frameworks matured:** Flink handles out-of-order events, windowing, exactly-once — things that previously required batch

**When Lambda still makes sense:** When batch processing requires fundamentally different algorithms (e.g., ML model training on full dataset) or when stream processing can't handle the scale of historical reprocessing.

---

**Q2. Kafka Streams at 100ms latency, business wants 10ms. Bottleneck analysis.**

**A:**

| Bottleneck | Typical Cost | Optimization |
|-----------|-------------|-------------|
| **Serialization (JSON)** | 5-20ms | Switch to Avro/Protobuf (binary, compiled) → <1ms |
| **Network (Kafka fetch)** | 10-50ms | Reduce `fetch.min.bytes`, `fetch.max.wait.ms`. Co-locate consumers with brokers |
| **State store (RocksDB)** | 5-30ms | Use in-memory state store (if state fits). SSD for RocksDB with bloom filters |
| **Commit interval** | 30ms default | Reduce `commit.interval.ms` to 10ms (trade-off: more overhead) |
| **Processing logic** | Variable | Profile. Remove unnecessary allocations. Cache DB lookups |
| **Consumer group rebalancing** | Spikes to seconds | Use cooperative rebalancing (`CooperativeStickyAssignor`). Avoid triggers |

**Architecture-level:**
- **Partitioning:** More partitions = more parallelism. 10ms requires enough partitions that each processes a small batch
- **Co-partition input topics:** Avoid repartitioning (shuffle) during joins. Pre-partition by key
- **Avoid external calls:** No DB lookups in the hot path. Pre-load state into the state store

**Realistic target:** 10ms end-to-end is at the edge of Kafka's design (it's a log, not a socket). For true sub-10ms: consider a purpose-built stream processor (Hazelcast Jet) or LMAX Disruptor pattern.

---

**Q3. 1 billion events/day with exactly-once. Kafka Streams vs Flink vs Spark Streaming.**

**A:**

| Feature | Kafka Streams | Apache Flink | Spark Structured Streaming |
|---------|--------------|-------------|---------------------------|
| **Model** | Library (embedded in app) | Cluster framework | Micro-batch (or continuous) |
| **Exactly-once** | Yes (Kafka-to-Kafka) | Yes (end-to-end with checkpoints) | Yes (with WAL + idempotent sinks) |
| **State management** | RocksDB (per partition) | RocksDB (managed, redistributable) | In-memory / external |
| **Windowing** | Tumbling, hopping, session | Tumbling, sliding, session, custom | Tumbling, sliding |
| **Latency** | Low (event-at-a-time) | Low (event-at-a-time) | Higher (micro-batch default ~100ms) |
| **Failure recovery** | Changelog topics (fast) | Distributed snapshots (fast) | WAL + micro-batch replay (slower) |

**For 1B events/day (~12K/sec):**
- **Kafka Streams** if source and sink are Kafka. Simplest deployment (just a JVM app). Limited to Kafka ecosystem
- **Flink** if you need complex event processing, multiple sources/sinks, or sophisticated windowing. Best state management. Best for large-scale stream processing
- **Spark** if the team already uses Spark for batch and wants unified batch+stream. Micro-batch latency may be acceptable

**Recommendation for exactly-once at this scale:** Flink. Most mature exactly-once with end-to-end guarantees including external systems (via two-phase commit sinks).

---

**Q4. Nightly ETL fails at hour 6 of 8. Design for resumable/restartable processing.**

**A:**

**Checkpointing:**
- ETL pipeline divided into stages. After each stage completes, record a checkpoint:
  ```
  Stage 1: Extract from source → checkpoint: "extracted, 50M rows, file: s3://bucket/extract_20260120.parquet"
  Stage 2: Transform → checkpoint: "transformed, 50M rows, file: s3://bucket/transform_20260120.parquet"
  Stage 3: Load to target → checkpoint: "loaded 30M of 50M rows, last_id: 30000000"
  ```
- On restart: read last checkpoint → resume from Stage 3, row 30,000,001

**Idempotent writes:**
- Use `UPSERT` (ON CONFLICT UPDATE) instead of INSERT. Re-running the same load is safe
- For data warehouses: write to staging table → atomic swap to production table
- For files: write to temp path → atomic rename to final path

**Watermarks (for streaming ETL):**
- Track "how far have I processed?" as a timestamp or offset
- On restart: process only events with timestamp > watermark

**Practical pattern:**
```
for each partition in data:
    if partition already processed (check marker): skip
    process partition
    write output to staging
    mark partition as processed
    
atomic commit: move staging → production
```

---

**Q5. CDC (Debezium) vs dual writes vs application events for keeping Elasticsearch in sync.**

**A:**

| Approach | How | Consistency | Failure Mode |
|----------|-----|-------------|-------------|
| **CDC (Debezium)** | Read DB WAL → stream to Kafka → index to ES | Strong (WAL is source of truth) | Debezium lag → ES is stale but consistent |
| **Dual write** | App writes to DB AND ES | Weak (no atomic cross-system write) | DB write succeeds, ES write fails → inconsistent. Or vice versa |
| **Application events** | App emits event → consumer writes to ES | Moderate (at-least-once) | Event lost → ES missing data. Event replay → eventually consistent |

**Why CDC wins:**
1. **No application changes:** Debezium reads the DB transaction log. No code changes to the application
2. **No data loss:** Every committed DB change is captured (WAL is the source of truth)
3. **Ordering preserved:** Changes arrive in commit order. No race conditions
4. **Schema changes:** Debezium detects schema changes and propagates them

**Dual write is the worst option:** You can't atomically write to two systems. If either fails, they're inconsistent. Even with retries, the order of operations may differ. This is the distributed transaction problem without a solution.

---

**Q6. Real-time fraud detection at 50K events/sec. State management and windowing.**

**A:**

**Architecture:**
```
Payment Events → Kafka → Flink (fraud detection) → Alert/Block
                                    ↓
                           State Store (user history)
```

**State management:**
- **Per-user state:** Last 30 days of transactions for each user
- **Keyed state in Flink:** State partitioned by user_id. Each parallel instance holds state for its users
- **State backend:** RocksDB (on SSD) for large state. In-memory for hot users
- **State size estimate:** 100M users × 30 txns/month × 200 bytes = ~600GB total. Distributed across Flink task managers

**Windowing for fraud rules:**
```
Rule 1: > 3 transactions in 5 minutes from different countries
  → Sliding window (5 min, advance 1 min), keyed by user_id
  → Aggregate: count distinct countries

Rule 2: Total spend > $10,000 in 1 hour
  → Tumbling window (1 hour), keyed by user_id
  → Aggregate: sum(amount)

Rule 3: Transaction amount > 10x user's average
  → Session window (gap = 24 hours), rolling average
```

**Latency requirement:** Decision must be made in <100ms (before payment is authorized). Use Flink's event-time processing with low watermark delay. Pre-load user profile into state store at startup.

---

**Q7. 10 PB data lake nobody trusts. What went wrong?**

**A:**

**Common causes:**
1. **No schema enforcement:** Anything dumped into the lake. CSVs with different delimiters, JSONs with inconsistent schemas, duplicate data
2. **No data quality checks:** Missing values, nulls where shouldn't be, wrong data types, stale data presented as current
3. **No lineage:** "Where did this data come from? When was it last updated? What transformations were applied?" Nobody knows
4. **No ownership:** "Data swamp" — everyone writes, nobody maintains. No team owns data quality for any dataset

**Solutions:**

**Data contracts:**
- Producers define a contract (schema, freshness SLA, quality guarantees)
- Consumers depend on the contract, not the raw data
- Breaking changes require contract negotiation (like API versioning)

**Schema enforcement:**
- Use a lake format with schema: Delta Lake, Apache Iceberg, Apache Hudi
- Schema evolution rules: additive changes only. Breaking changes = new table version

**Data quality (automated):**
- Great Expectations, dbt tests, Soda: automated checks on every pipeline run
- Checks: null counts, uniqueness, referential integrity, freshness, value ranges
- Block bad data from entering the lake (shift quality left)

**Data mesh (organizational):**
- Domain teams own their data as a product
- Payment team owns payment data: schema, quality, freshness, documentation
- Central platform team provides infrastructure (storage, catalog, access control)
- Each domain publishes data products with SLAs

---

**Q8. Stream join: payment arrives before order event. Out-of-order handling.**

**A:**

**The problem:** Join orders and payments by order_id. Payment event arrives at T+5s, order event arrives at T+8s. Standard inner join at T+5s finds no matching order → payment dropped.

**Solution: Event-time windowed join**
```
orders.join(payments)
  .where(order.id == payment.order_id)
  .window(TumblingEventTimeWindows.of(10 minutes))
  .apply(joinFunction)
```

**How it works:**
1. Both streams are buffered in a time window (10 minutes)
2. Payment arrives at T+5s → buffered, waiting for matching order
3. Order arrives at T+8s → joined with buffered payment → output result
4. Window closes at T+10m → anything unmatched is discarded or sent to side output

**Watermarks:**
- Watermark = "I've seen all events up to time T"
- Watermark advances as events arrive. When watermark passes window end → window fires
- `Watermark delay = 30 seconds` means allow up to 30s of lateness before closing window

**Late-arriving data (beyond watermark):**
- **Allowed lateness:** `allowedLateness(1 minute)` — accept events up to 1 min after watermark
- **Side output:** Events arriving after allowed lateness → routed to a separate stream for manual processing
- **Never silently drop:** Always route unmatched/late events somewhere observable

---

**Q9. Orchestrating 500 daily batch jobs. Airflow vs Prefect vs Dagster vs dbt.**

**A:**

| Tool | Model | Strengths | Weaknesses |
|------|-------|-----------|------------|
| **Airflow** | DAGs in Python. Scheduler + workers | Mature, huge community, many operators/hooks | DAG complexity at scale. UI shows runs, not data. Dynamic DAGs are hacky |
| **Prefect** | Python-native tasks with decorators | Better DX than Airflow. Dynamic flows. Better error handling | Smaller community. Prefect Cloud vs self-hosted confusion |
| **Dagster** | Software-defined assets. Data-aware | Assets (not tasks) as primitives. Built-in data quality. Excellent dev UX | Newer. Fewer integrations. Steeper mental model shift |
| **dbt** | SQL transformations only | Best for SQL-centric data warehouses. Lineage built-in | Can't orchestrate non-SQL tasks (Python, API calls). Not a general orchestrator |

**For 500 daily batch jobs with dependencies:**

- **If mostly SQL transforms:** dbt (for transforms) + Airflow/Dagster (for orchestration)
- **If mostly Python + diverse tasks:** Airflow (battle-tested at this scale) or Dagster (better DX, data-aware scheduling)
- **Key features for 500 jobs:** dependency management, retries with backoff, SLA monitoring, backfill support, clear lineage visualization

**Airflow at 500 jobs:** Works. Use KubernetesExecutor (isolate each job in a pod). Use task groups for logical organization. Monitor scheduler performance (can become bottleneck at 1000+ DAGs).

---

**Q10. Downstream materialized views inconsistent because consumers process at different speeds.**

**A:**

**The problem:** Stream A consumer is caught up (real-time). Stream B consumer is 30 seconds behind. Materialized view joins data from both → inconsistent (A shows current state, B shows stale state).

**Solutions:**

1. **Kafka transactions (exactly-once, coordinated):**
   - Producer writes to multiple topics in one transaction
   - Consumers with `isolation.level=read_committed` only see committed data
   - Guarantee: if two events are in the same transaction, consumers see both or neither
   - Limitation: works within Kafka. External sinks need two-phase commit

2. **Coordinated checkpoints (Flink):**
   - Flink processes multiple input streams with aligned checkpoints
   - Checkpoint guarantees: all inputs are at a consistent point
   - Materialized view is updated atomically at each checkpoint
   - Trade-off: checkpoint alignment adds latency (barrier must reach all operators)

3. **Eventual convergence (pragmatic):**
   - Accept that views may be temporarily inconsistent (seconds, not minutes)
   - Design the UI/query layer to tolerate this: show "last updated: 30s ago" per data source
   - Detect lag: if consumer B is >1 minute behind, show a warning

4. **Versioned materialized views:**
   - Each update to the view includes a vector clock `{stream_a: offset_100, stream_b: offset_95}`
   - Query can specify minimum consistency: "give me the view where stream_b >= offset_98"
   - If not yet available: wait or return stale data with warning

---

## 22. Containers & Orchestration
[← Back to topic](22-Containers-Orchestration.md#-senior-interview-questions)

**Q1. Stateful app (PostgreSQL) on Kubernetes. Challenges and when NOT to.**

**A:**

**Challenges:**

1. **Persistent volumes:** Pods are ephemeral but data must survive restarts. PersistentVolumeClaims (PVC) bind to specific storage. Must provision correct storage class (SSD, IOPS)
2. **StatefulSets:** Unlike Deployments, StatefulSets give each pod a stable identity (`postgres-0`, `postgres-1`). Ordered startup/shutdown. Stable network identity (DNS: `postgres-0.postgres-service`)
3. **Pod identity:** Primary vs replica. Only `postgres-0` should be writable. Requires init containers or sidecar for role assignment
4. **Leader election:** If primary pod dies, a replica must be promoted. Patroni/Stolon operators handle this. Complex failure modes (split-brain)
5. **Backup/restore:** Kubernetes doesn't natively handle DB backups. Need CronJob or operator for `pg_dump` / WAL archiving
6. **Storage performance:** Network-attached storage (EBS, Persistent Disk) has higher latency than local SSD. Some workloads need local storage → but local storage doesn't survive node failure

**When NOT to run databases on K8s:**
- **Small teams:** The operational overhead of stateful K8s is significant. Use managed RDS/Cloud SQL instead
- **High-IOPS workloads:** Network storage latency matters. Local NVMe is faster but fragile on K8s
- **Compliance:** Some compliance frameworks require managed, auditable database services
- **Simple deployments:** One database = overkill for K8s. K8s shines at managing many pods

**When it makes sense:** Multi-tenant databases (one DB per tenant), edge deployments, air-gapped environments, or when Kubernetes operators (CrunchyData, Zalando) handle the complexity.

---

**Q2. Docker vs Kubernetes. Where do containerd, CRI-O, and OCI fit?**

**A:**

**Docker:** Tool for building and running containers on a single machine. `docker build` (creates image), `docker run` (runs container).

**Kubernetes:** Orchestration platform for managing containers across many machines. Scheduling, scaling, networking, self-healing.

**Analogy:** Docker = a single shipping container. Kubernetes = the port that manages thousands of containers across ships.

**Container runtime stack:**
```
Kubernetes (Orchestration)
    ↓ CRI (Container Runtime Interface)
containerd / CRI-O (High-level runtime)
    ↓ OCI (Open Container Initiative spec)
runc (Low-level runtime — actually creates the container)
```

- **OCI:** Standard spec for container images and runtimes. Any OCI-compliant image works with any OCI-compliant runtime
- **containerd:** Industry-standard high-level runtime. Docker uses it internally. K8s uses it directly (Docker shim was deprecated in K8s 1.24)
- **CRI-O:** Lightweight alternative to containerd. Built specifically for Kubernetes. Smaller footprint
- **runc:** The actual low-level runtime that creates Linux namespaces and cgroups. Both containerd and CRI-O use it under the hood

**Key point:** You can use Kubernetes without Docker at all. K8s talks to containerd/CRI-O directly. Docker is a developer tool; containerd is the production runtime.

---

**Q3. Auto-scaling takes 3 minutes. Users see errors during scaling. How to reduce scaling time.**

**A:**

**Where the 3 minutes go:**

| Phase | Typical Time | Optimization |
|-------|-------------|-------------|
| Metrics detection | 30-60s | Reduce HPA `--horizontal-pod-autoscaler-sync-period` to 15s. Use custom metrics (queue depth) instead of CPU |
| Pod scheduling | 5-10s | Pre-warm nodes. Reserve capacity with `pause` pods (low-priority pods that get evicted when real work arrives) |
| Image pull | 30-120s | Pre-pull images to all nodes. Use smaller images (<100MB). Use image caching (local registry in cluster) |
| App startup | 30-120s | Optimize app initialization. Use readiness probes (don't receive traffic until ready). JVMs: use CDS/AppCDS, GraalVM native image |

**Strategies:**

1. **Over-provisioning:** Keep 20% extra pods running always. Absorb burst instantly. Cost: 20% more resources
2. **Pod priority + preemption:** Run low-priority batch jobs in spare capacity. When scaling needed, evict batch jobs instantly → real workloads take their place
3. **Knative / KEDA:** Scale to zero for cold workloads. Scale from zero in ~5-10 seconds (with pre-warmed nodes)
4. **Predictive scaling:** Know traffic patterns (9 AM spike daily). Pre-scale 15 minutes before predicted peak

**Result:** Pre-pull + over-provision + fast readiness = scale in <30 seconds instead of 3 minutes.

---

**Q4. Deployments vs StatefulSets vs DaemonSets vs Jobs. Concrete use cases.**

**A:**

| Resource | Identity | Scaling | Use Case |
|----------|----------|---------|----------|
| **Deployment** | Interchangeable pods. Any pod can handle any request | Horizontal (add/remove replicas) | Stateless web servers, API services, microservices |
| **StatefulSet** | Stable identity (`app-0`, `app-1`). Ordered startup | Horizontal (ordered) | Databases, Kafka brokers, ZooKeeper, Elasticsearch |
| **DaemonSet** | One pod per node. Guaranteed | Tied to nodes (auto) | Log collectors (Fluentd), monitoring agents (Datadog), CNI plugins |
| **Job / CronJob** | Run-to-completion. No restart on success | Parallelism config | Data migrations, backups, batch processing, report generation |

**Why other options fail:**
- **Database as Deployment:** Pods are interchangeable. Two pods might both think they're the primary. No stable storage binding. Wrong choice
- **Log collector as Deployment:** No guarantee of one per node. Some nodes might get 0 or 3. Wrong choice
- **Batch job as Deployment:** Deployment restarts pods forever. Job runs once and stops. Wrong lifecycle

---

**Q5. Helm upgrade fails halfway. Designing for safe rollbacks. Helm vs ArgoCD vs Flux.**

**A:**

| Tool | Model | Rollback | Strength |
|------|-------|----------|----------|
| **Helm** | Imperative (`helm upgrade`) | `helm rollback release 3` (reverts to revision 3) | Simple. Package manager metaphor. Templates |
| **ArgoCD** | GitOps (git = source of truth) | `git revert` → ArgoCD auto-syncs | Declarative. Audit trail = git history. Auto-sync |
| **Flux** | GitOps (similar to ArgoCD) | `git revert` → Flux reconciles | Lighter weight. Better multi-tenancy |

**Helm upgrade failure recovery:**
- Helm stores release history as K8s secrets. `helm rollback` applies previous revision
- Problem: if some resources applied and others didn't → partial state
- Prevention: use `--atomic` flag → auto-rollback on failure. `--wait` → wait for pods to be ready before marking success

**GitOps advantage:**
- Git is the source of truth. To rollback: `git revert <commit>`. ArgoCD/Flux detect the change and reconcile
- Full audit trail: who changed what, when, why (commit messages)
- No kubectl access needed for deployments. Developers push to git, CI/CD applies
- Drift detection: if someone manually changes cluster state, GitOps controller reverts it

**Recommendation:** ArgoCD for most teams. Git-based rollback is simpler and safer than imperative `helm rollback`. Full audit trail included.

---

**Q6. K8s networking: internet request → container. ClusterIP vs NodePort vs LoadBalancer.**

**A:**

**Request flow:**
```
Internet
  ↓
Cloud Load Balancer (AWS ALB/NLB)
  ↓
Ingress Controller (nginx/traefik) — routes by hostname/path
  ↓
Service (ClusterIP) — virtual IP, load balances across pods
  ↓
kube-proxy (iptables/IPVS rules) — routes to actual pod IP
  ↓
Pod (container)
```

**Service types:**

| Type | Access | How | Use Case |
|------|--------|-----|----------|
| **ClusterIP** | Internal only | Virtual IP inside cluster | Service-to-service communication |
| **NodePort** | External via node IP:port | Opens a port (30000-32767) on every node | Development/testing. Direct node access |
| **LoadBalancer** | External via cloud LB | Provisions cloud load balancer (ALB/NLB/ELB) | Production external traffic |

**Ingress vs LoadBalancer:**
- LoadBalancer creates one cloud LB per service. 50 services = 50 LBs = expensive
- Ingress: one LB → Ingress Controller → routes to many services by URL path/hostname. 50 services share 1 LB

---

**Q7. 100 microservices, bad deployment in Service A causes cascading failures. Prevention.**

**A:**

1. **Resource quotas and limits:**
   ```yaml
   resources:
     requests: { cpu: "100m", memory: "128Mi" }
     limits: { cpu: "500m", memory: "256Mi" }
   ```
   - Service A can't consume all cluster CPU/memory. Other services protected
   - Namespace ResourceQuota: limits total resources per team/namespace

2. **Network policies:**
   ```yaml
   kind: NetworkPolicy
   spec:
     podSelector: { matchLabels: { app: service-B } }
     ingress:
       - from: [{ podSelector: { matchLabels: { app: service-A } } }]
   ```
   - Restrict which services can talk to which. Service A can't send traffic to unrelated services

3. **Pod Disruption Budgets (PDB):**
   - `minAvailable: 2` — Kubernetes won't kill more than N-2 pods during rolling updates
   - Prevents disrupting dependent services during deployments

4. **Canary deployments:**
   - Deploy new version to 5% of pods. Monitor error rate for 10 minutes
   - If errors spike → auto-rollback. Only 5% of traffic affected, not 100%

5. **Circuit breakers (application level):**
   - Service A is failing → circuit breaker opens → other services stop calling A, return fallback response
   - Prevents cascade: A's failure doesn't propagate to B, C, D

---

**Q8. Self-managed K8s vs managed (EKS/GKE/AKS). What you avoid with managed K8s.**

**A:**

**Operational tasks managed K8s handles:**

| Task | Self-managed | Managed (EKS/GKE/AKS) |
|------|-------------|----------------------|
| Control plane HA | You configure etcd cluster, API server redundancy | Managed (99.95% SLA) |
| K8s version upgrades | Manual. Test + upgrade master + workers. Risky | One-click (or automatic) |
| etcd backup/restore | Your responsibility. Critical | Managed |
| API server scaling | You scale. Under-provision → kubectl fails | Auto-scales |
| Certificate management | Rotate certs before expiry (outage risk) | Managed |
| Security patching | Monitor CVEs, patch control plane | Auto-patched |
| Networking (CNI) | Choose, install, configure (Calico, Cilium) | Pre-configured (or choose from options) |

**When self-managed makes sense:**
- **Air-gapped environments:** No internet access (defense, government). Can't use cloud services
- **Edge/on-premises:** No cloud available (factory floor, retail stores)
- **Cost at extreme scale:** >10,000 nodes — managed K8s costs per cluster hour add up. Self-managed + dedicated team may be cheaper
- **Customization:** Need specific K8s patches, custom schedulers, or features not available in managed K8s

**Recommendation:** Managed K8s for 95% of organizations. The operational burden of self-managed is significant and diverts from business value.

---

**Q9. Java Docker image is 1.2GB. Optimization walkthrough.**

**A:**

| Optimization | Image Size | Impact |
|-------------|-----------|--------|
| **Base:** `FROM openjdk:17` | 1.2 GB | Full OS + JDK + tools |
| **Slim JRE:** `FROM eclipse-temurin:17-jre-alpine` | ~200 MB | Alpine Linux + JRE only (no compiler) |
| **Multi-stage build** | ~180 MB | Build in JDK image, copy JAR to JRE image. Build tools don't ship |
| **jlink custom runtime** | ~100 MB | Create minimal JRE with only the modules your app needs |
| **Distroless:** `FROM gcr.io/distroless/java17` | ~150 MB | No shell, no package manager. Minimal attack surface |
| **GraalVM native image** | ~50-80 MB | Ahead-of-time compile to native binary. No JVM needed. Fastest startup |

**Multi-stage Dockerfile:**
```dockerfile
# Stage 1: Build
FROM eclipse-temurin:17-jdk AS build
COPY . /app
RUN cd /app && ./gradlew bootJar

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-alpine
COPY --from=build /app/build/libs/app.jar /app.jar
CMD ["java", "-jar", "/app.jar"]
```

**Layer caching:** Order Dockerfile so frequently-changing layers (COPY source code) are last. Dependency layer (COPY build.gradle) changes less → cached.

**Security:** Smaller image = fewer packages = fewer CVEs. Distroless has zero shell access (attacker can't exec into container).

---

**Q10. CI/CD for 50 services takes 45 minutes. Optimization strategies.**

**A:**

| Optimization | Time Saved | How |
|-------------|-----------|-----|
| **Parallel builds** | 40-60% | Build independent services concurrently. 50 services × 5 min serial → 5 min parallel |
| **Docker layer caching** | 30-50% | Push/pull cache layers to registry. `--cache-from` flag. BuildKit inline cache |
| **Incremental builds** | 70-90% | Only build services that changed. Detect changes via git diff per service directory |
| **Registry caching** | Image pull: 90% | Mirror/cache base images locally (Harbor, Artifactory). Avoid pulling from Docker Hub on every build |
| **BuildKit** | 20-30% | Parallel layer builds within a single Dockerfile. `DOCKER_BUILDKIT=1` |
| **Monorepo tooling** | 60-80% | Bazel, Nx, Turborepo: dependency graph → build only affected targets |

**Progressive delivery (deployment time):**
- **Canary:** Deploy to 5% → monitor → 25% → 50% → 100%. Automated rollback on error spike
- **Blue-green:** Deploy entire new version alongside old. Switch traffic atomically. Instant rollback = switch back

**Architecture:**
```
Push to main → CI detects changed services (git diff)
  → Build changed services in parallel (BuildKit + cache)
  → Push images to registry
  → ArgoCD/Flux syncs changed manifests
  → Canary rollout (5% → 25% → 100%)
```

**Result:** 45 min → build only 3 changed services (~5 min) + canary rollout (~10 min) = 15 min total.

---

## 23. Networking Deep Dive
[← Back to topic](23-Networking-Deep-Dive.md#-senior-interview-questions)

**Q1. What happens when you type "https://example.com" and hit Enter? Full network-level walkthrough.**

**A:**

**Step-by-step:**

| Step | What Happens | Round Trips |
|------|-------------|-------------|
| 1. **DNS Lookup** | Browser checks cache → OS cache → router cache → ISP DNS → recursive resolver → root → TLD (.com) → authoritative DNS → returns IP | 1 RTT (if uncached) |
| 2. **TCP Handshake** | Client → SYN → Server → SYN-ACK → Client → ACK. Connection established | 1 RTT |
| 3. **TLS 1.3 Handshake** | ClientHello (supported ciphers) → ServerHello (cert, key share) → Client verifies cert, generates session keys | 1 RTT (TLS 1.3), 2 RTT (TLS 1.2) |
| 4. **HTTP Request** | `GET / HTTP/2` sent over encrypted connection | 0.5 RTT (request sent) |
| 5. **Server Processing** | Server processes request, generates HTML | Server time (~50ms) |
| 6. **HTTP Response** | Server sends response. Browser receives first byte (TTFB) | 0.5 RTT (response arrives) |
| **Total** | | **3-4 RTT + server time** |

**With TLS 1.3 on fast network (30ms RTT):**
- DNS: 30ms (cached: 0ms)
- TCP: 30ms
- TLS 1.3: 30ms
- HTTP: 30ms
- Total: ~120ms + server time

**With TLS 1.3 0-RTT resumption (returning visitor):** TLS and HTTP data sent in first packet → 2 RTT total.

---

**Q2. HTTP/1.1 vs HTTP/2 vs HTTP/3 head-of-line blocking in microservices.**

**A:**

**HTTP/1.1 — Application-level HOL blocking:**
- One request per TCP connection at a time
- Request B waits for request A to complete on same connection
- Fix: browsers open 6 parallel connections. Microservices use connection pools

**HTTP/2 — TCP-level HOL blocking:**
- Multiplexes multiple requests over ONE TCP connection (great for reducing connections)
- Problem: TCP requires ordered byte delivery. If packet 3 is lost, packets 4-10 (potentially belonging to different HTTP streams) all wait for packet 3's retransmission
- Under high packet loss (mobile, congested networks): can be worse than HTTP/1.1's 6 connections

**HTTP/3 (QUIC) — No HOL blocking:**
- Uses UDP instead of TCP. Each stream has independent delivery
- Lost packet in stream A → only stream A waits. Streams B, C, D proceed normally
- Also: 0-RTT connection establishment, connection migration (change IP without reconnecting)

**For microservices during traffic spikes:**
- **gRPC (HTTP/2):** Great for normal conditions. Multiplexed, binary, efficient. But TCP HOL blocking can cause latency spikes under packet loss
- **If latency-sensitive:** Consider gRPC over QUIC (experimental), or use connection pools with multiple HTTP/2 connections (reduce blast radius of TCP HOL blocking)

---

**Q3. NAT, NAT Gateway, Internet Gateway, route tables for EC2 in private subnet.**

**A:**

**NAT (Network Address Translation):**
- Translates private IPs (10.x.x.x) to public IPs for internet access
- Your EC2: 10.0.1.5 → NAT translates to 203.0.113.50 (public IP) → internet
- Return traffic: internet → 203.0.113.50 → NAT translates back to 10.0.1.5

**AWS Architecture:**
```
Private Subnet (10.0.1.0/24)
  EC2 (10.0.1.5) → Route table: 0.0.0.0/0 → NAT Gateway
  
Public Subnet (10.0.2.0/24)
  NAT Gateway (has Elastic IP: 203.0.113.50) → Route table: 0.0.0.0/0 → Internet Gateway
  
Internet Gateway — attached to VPC, enables internet connectivity
```

**Flow:**
1. EC2 sends packet to google.com (142.250.x.x)
2. Route table: destination not in VPC → send to NAT Gateway
3. NAT Gateway: replaces source IP (10.0.1.5 → 203.0.113.50), tracks the mapping
4. Packet goes to Internet Gateway → internet → Google
5. Response: Google → Internet Gateway → NAT Gateway → translates back → EC2

**Key distinction:**
- **Internet Gateway:** Enables internet access for resources WITH public IPs (bidirectional)
- **NAT Gateway:** Enables outbound-only internet access for resources WITHOUT public IPs. Internet can't initiate inbound connections

---

**Q4. TCP connections being randomly reset. Diagnostic process and causes.**

**A:**

**Diagnostic tools:**
```bash
# Check connection states
ss -tnp | grep <port>       # Active connections, process info
ss -s                        # Summary statistics (resets, timeouts)

# Capture packets
tcpdump -i eth0 'tcp[tcpflags] & (tcp-rst) != 0' -w resets.pcap
# Shows every RST packet with timestamps and endpoints

# Connection tracking
conntrack -L | grep <ip>     # NAT/firewall connection tracking table
dmesg | grep -i "nf_conntrack: table full"  # Is conntrack table full?
```

**Common causes of TCP RST:**

| Cause | How to Identify | Fix |
|-------|----------------|-----|
| **Conntrack table full** | `dmesg` shows "table full, dropping packet" | Increase `nf_conntrack_max`. Reduce connection churn |
| **Idle timeout** | RST after exactly N seconds of inactivity. Load balancer closes idle connection | Enable TCP keepalive. Set LB idle timeout higher |
| **Application crash** | RST on established connections after app restart | Graceful shutdown (drain connections first) |
| **Port exhaustion** | Many TIME_WAIT connections. `ss -s` shows thousands | Increase port range. Enable `tcp_tw_reuse` |
| **Firewall/security group** | RST from intermediary, not from server | Check security groups, NACLs, host iptables |
| **Half-open connections** | SYN received but never completed | Check SYN queue limits (`tcp_max_syn_backlog`) |

---

**Q5. VPC Peering vs Transit Gateway vs VPN vs PrivateLink.**

**A:**

| Option | Topology | Bandwidth | Latency | Cost | Use Case |
|--------|----------|-----------|---------|------|----------|
| **VPC Peering** | 1:1 (point-to-point) | Full AWS backbone | Lowest | Free (data transfer charges) | 2 VPCs need to communicate |
| **Transit Gateway** | Hub-and-spoke (many:many) | Up to 50 Gbps | Low | Per hour + per GB | 10+ VPCs, centralized routing |
| **VPN** | Over internet (encrypted) | ~1.25 Gbps per tunnel | Variable (internet) | Per hour + per GB | Connect on-premises to AWS |
| **PrivateLink** | Service-to-service (unidirectional) | Scales with endpoints | Low | Per hour + per GB | Expose a single service to another VPC without full VPC access |

**When to use each:**
- **2-3 VPCs:** VPC Peering. Simple, free, fast. Not transitive (A↔B, B↔C doesn't mean A↔C)
- **10+ VPCs:** Transit Gateway. Hub connects everything. Transitive routing. Central route management
- **Hybrid cloud:** VPN (quick/cheap) or Direct Connect (dedicated line, higher bandwidth, consistent latency)
- **Expose one service (like a DB):** PrivateLink. Consumer VPC gets an ENI endpoint. No VPC-wide access. Least privilege

---

**Q6. 10,000 short-lived TCP connections/sec to database. Connection pooling overhead.**

**A:**

**TCP handshake overhead per connection:**
- 3-way handshake: 1 RTT (~0.5ms in same AZ)
- TLS handshake (if encrypted): +1-2 RTT (~1-2ms)
- Connection setup in DB (auth, allocate session memory): ~1-5ms
- Total per connection: ~3-8ms

**At 10,000 connections/sec:**
- Total overhead: 10,000 × 5ms = 50 seconds of CPU time per second (impossible on one server)
- File descriptors: 10,000 simultaneous connections = 10,000 FDs. Default ulimit is often 1024
- DB connection limit: PostgreSQL default `max_connections = 100`. Each connection uses ~5-10MB of memory

**Why connection pooling is essential:**
- **PgBouncer** (PostgreSQL) or **ProxySQL** (MySQL): maintains a pool of ~50-100 persistent DB connections
- Application opens connection to PgBouncer (fast, local). PgBouncer multiplexes onto pooled DB connections
- 10,000 app connections → 50 real DB connections. No handshake overhead on the DB

**Modes:**
- **Session pooling:** One DB connection per client session. Safest
- **Transaction pooling:** DB connection returned after each transaction. Most efficient. 10,000 app connections share 50 DB connections
- **Statement pooling:** DB connection returned after each statement. Most aggressive. Some features (prepared statements) break

---

**Q7. TLS latency: 1.2 vs 1.3 vs 0-RTT. When is 0-RTT dangerous?**

**A:**

**TLS 1.2:** 2-RTT handshake
```
Client → ClientHello → Server
Server → ServerHello + Certificate + KeyExchange → Client
Client → ClientKeyExchange + Finished → Server
Server → Finished → Client
```

**TLS 1.3:** 1-RTT handshake
```
Client → ClientHello + KeyShare → Server
Server → ServerHello + KeyShare + Certificate + Finished → Client
Client → Finished → Server
```
Key exchange and authentication happen in one round trip (combined messages).

**TLS 1.3 0-RTT resumption:**
- Returning client sends encrypted application data WITH the ClientHello (first packet!)
- Server processes immediately. No additional round trips
- Saves 1 RTT. Total: first data sent in the first packet

**Why 0-RTT is dangerous:**
1. **Replay attack:** An attacker captures the 0-RTT data and replays it. The server may process the request twice
2. **No forward secrecy for 0-RTT data:** 0-RTT uses a pre-shared key (PSK) from the previous session. If that key is compromised, 0-RTT data from past sessions can be decrypted
3. **Safe only for idempotent requests:** GET requests (safe to replay). NOT for POST/payments/state-changing operations

**Best practice:** Enable 0-RTT only for safe (GET) requests. Reject or defer non-idempotent requests to after the full handshake.

---

**Q8. BGP: internet routing, route leaks, and hijacks.**

**A:**

**BGP in a nutshell:**
- Internet is divided into Autonomous Systems (AS): networks managed by one organization (Cloudflare = AS13335, Google = AS15169)
- BGP is the protocol ASes use to tell each other: "I can reach these IP prefixes via this path"
- Each AS announces its prefixes to neighbors. Neighbors propagate. Eventually, every AS knows how to reach every prefix

**Route leak:**
- AS-B receives a route from AS-A (provider) and accidentally announces it to AS-C (another provider)
- AS-C thinks AS-B is the best path to AS-A's IPs → traffic flows through AS-B (which may not have capacity)
- **Example:** 2019 Verizon/Cloudflare incident. A small AS leaked thousands of routes through Verizon. Verizon accepted them. Significant internet traffic rerouted through a tiny network → congestion

**Route hijack:**
- Malicious AS announces someone else's IP prefix
- Other ASes believe it → traffic intended for the victim goes to the attacker
- Can intercept traffic, serve malware, or create outages

**Defenses:**
- **RPKI (Resource Public Key Infrastructure):** Cryptographically sign route announcements. ASes verify signatures before accepting routes
- **BGP monitoring:** RIPE RIS, BGPStream. Detect unexpected route announcements
- **IRR (Internet Routing Registry):** Maintain prefix filters based on documented routing policies

---

**Q9. Multi-region architecture. Anycast vs DNS-based global load balancing.**

**A:**

**Anycast:**
- Same IP address announced from multiple locations (US, EU, Asia)
- BGP routes users to the nearest location (shortest AS path)
- How CDNs work: Cloudflare announces 1.1.1.1 from 200+ cities. Your packet goes to the nearest one

| Aspect | Anycast | DNS-based GLB |
|--------|---------|---------------|
| **Routing** | Network-level (BGP) | Application-level (DNS response) |
| **Failover** | Automatic (BGP withdraws route from failed location) | Depends on DNS TTL (30s-300s delay) |
| **Granularity** | Per-packet (can vary) | Per-DNS-lookup (cached for TTL) |
| **Use case** | UDP services (DNS, CDN), DDoS absorption | HTTP services, any TCP-based service |
| **TCP stickiness** | Problem: BGP route change mid-connection → different server → broken TCP session | No issue (DNS resolves once, connection sticks) |

**Anycast + TCP:** Works for short-lived connections (DNS queries, CDN edge). For long-lived TCP connections (WebSockets), use DNS-based routing (resolve once, connect, stay connected).

**Combined approach:** Anycast for DDoS absorption at edge (Cloudflare) → proxied to DNS-routed regional servers for TCP connections.

---

**Q10. 1 million concurrent WebSocket connections. Server resources and architecture.**

**A:**

**Resource calculation per server:**

| Resource | Per Connection | 1M Total |
|----------|---------------|----------|
| **File descriptors** | 1 FD | 1,000,000 FDs (default ulimit ~1024, must increase!) |
| **Memory (kernel TCP buffer)** | ~4-8 KB | 4-8 GB |
| **Memory (application state)** | ~2-4 KB (user ID, session, subscriptions) | 2-4 GB |
| **Total memory per server** | ~10-16 KB | ~10-16 GB |

**One server can hold ~100K-200K connections** (with tuned kernel parameters). So need **5-10 servers** for 1M connections.

**Architecture:**
```
Clients ──► Load Balancer (L4, sticky sessions per connection)
               ↓
         Connection Servers (hold WebSocket connections)
               ↓
         Pub/Sub (Redis Pub/Sub or Kafka)
               ↓
         Backend Services (generate events to push)
```

**How a message reaches the right client:**
1. Backend service: "Notify user_123 about new message"
2. Publish to pub/sub channel: `user:123`
3. Connection server that holds user_123's WebSocket is subscribed to `user:123`
4. Connection server pushes message down the WebSocket

**Kernel tuning:**
```bash
sysctl -w net.core.somaxconn=65535
sysctl -w fs.file-max=2000000
ulimit -n 2000000
sysctl -w net.ipv4.tcp_tw_reuse=1
```

**Horizontal scaling:** Hash user_id → connection server. Registry (Redis) tracks which server holds which user's connection. Connection migration on server restart.

---

## 24. Estimation & Numbers
[← Back to topic](24-Estimation-Numbers.md#-senior-interview-questions)

**Q1. Estimate Twitter storage: 500M tweets/day, 10% have images, 1% have video.**

**A:**

**Text storage:**
- Average tweet: 280 chars × 2 bytes (UTF-8 avg) = 560 bytes
- Metadata (user_id, timestamp, location, etc.): ~440 bytes
- Total per tweet: ~1 KB
- Daily: 500M × 1 KB = **500 GB/day**
- Monthly: 500 GB × 30 = **15 TB/month**
- 5 years: 15 TB × 60 = **900 TB**

**Image storage:**
- 10% of tweets: 50M images/day
- Average image: ~200 KB (compressed JPEG, multiple sizes stored)
- Daily: 50M × 200 KB = **10 TB/day**
- 5 years: 10 TB × 365 × 5 = **18.25 PB**

**Video storage:**
- 1% of tweets: 5M videos/day
- Average video: ~5 MB (short clips, compressed, multiple resolutions stored)
- Daily: 5M × 5 MB = **25 TB/day**
- 5 years: 25 TB × 365 × 5 = **45.6 PB**

**Total 5-year storage:** ~900 TB text + ~18 PB images + ~46 PB video ≈ **~65 PB**

**Key insight:** Text is negligible. Media dominates. This is why CDNs and object storage (S3) are critical. Text can be in a database; media must be in a blob store.

---

**Q2. How many servers for 1 billion DAU?**

**A:**

**Assumptions:**
- Average requests per user per day: 20 (page loads, API calls, etc.)
- Total requests/day: 1B × 20 = 20 billion
- Average QPS: 20B / 86,400 ≈ **230,000 QPS**
- Peak QPS (3-5× average): ~**1,000,000 QPS (1M QPS)**

**Server capacity:**
- Modern server: handles ~10,000-50,000 QPS (depends on workload complexity)
- For API servers (light processing): ~25,000 QPS per server
- Servers needed at peak: 1,000,000 / 25,000 = **40 servers** (compute only)

**With caching (80% cache hit rate):**
- Only 20% of requests hit application servers
- Peak QPS to servers: 200,000 / 25,000 = **8 servers**
- Cache: 800,000 QPS / 100,000 per Redis instance = ~8 Redis instances

**But Facebook-scale reality includes:**
- Database servers, cache servers, media servers, search servers, ML servers
- Redundancy (3 replicas × 3 regions × 2x headroom)
- Total fleet: ~100,000+ servers (not just compute, but storage, network, cache, ML, etc.)

**Key message:** The answer isn't "40 servers." It's demonstrating the methodology: requests → QPS → peak → per-server capacity → caching impact → total with redundancy.

---

**Q3. YouTube bandwidth: 1B views/day at 720p (~50MB per video).**

**A:**

**Total bandwidth:**
- 1B views × 50MB = 50 exabytes/day (if every view streamed the full video)
- Average watch time: ~50% of video → 25 EB/day
- Spread over 24 hours: 25 × 10^18 bytes / 86,400 seconds = **290 TB/s = 2.3 Pbps**

**Peak bandwidth (2-3× average):**
- ~**5-7 Pbps** during peak hours

**How CDN reduces origin bandwidth:**
- CDN caches popular videos at edge locations (80-90% cache hit rate)
- Origin serves: 10-20% of traffic
- Origin bandwidth: 290 TB/s × 0.15 = ~**45 TB/s** from origin
- CDN edge: serves the remaining 85% from 100+ global PoPs

**Adaptive bitrate streaming:**
- Not everyone watches at 720p. Mobile: 360p (~10MB). Desktop: 1080p (~150MB)
- Weighted average is probably ~30MB per view, not 50MB
- This reduces total by 40%

**Reality check:** Google/YouTube's actual network capacity is estimated at 100+ Tbps globally. CDN edge caching is what makes this possible.

---

**Q4. Instagram home feed cache: 500M DAU, 50 posts/feed, 1KB/post.**

**A:**

**Raw calculation:**
- Per user feed: 50 posts × 1 KB = 50 KB
- 500M users: 500M × 50 KB = **25 TB**

**Should you cache everyone's feed?**
- 500M DAU ≠ 500M concurrent users. Users are spread across 24 hours
- Peak concurrent: ~50M users (10% of DAU)
- Cache only active users: 50M × 50 KB = **2.5 TB** — fits in a Redis cluster

**Strategy:**
- **Pre-compute feeds for active users** (users who logged in within last 24 hours): ~200M users × 50 KB = **10 TB**
- **On-demand for inactive users:** Compute feed on first request, cache for 30 minutes
- **Redis cluster:** 10 TB / 64 GB per node = ~160 Redis instances (with replication: ~480)

**Optimization:**
- Don't cache full post content (1 KB with text, image URLs, etc.)
- Cache only post IDs (8 bytes each): 50 × 8 = 400 bytes per user
- 200M × 400 bytes = **80 GB** — fits in a few Redis instances!
- Look up full post content from a separate post cache (shared across all feeds)

---

**Q5. URL shortener: 1B URLs over 10 years. How many characters in Base62?**

**A:**

**Keyspace calculation:**
- Base62 alphabet: `a-z` (26) + `A-Z` (26) + `0-9` (10) = 62 characters
- `n` characters → $62^n$ possible URLs

| Length | Possible URLs | Enough for 1B? |
|--------|--------------|----------------|
| 5 | $62^5$ = 916 million | No (barely) |
| 6 | $62^6$ = 56.8 billion | Yes (56× headroom) |
| 7 | $62^7$ = 3.5 trillion | Yes (3500× headroom) |

**Answer: 7 characters** for comfort ($62^7 = 3.5T$, more than enough for 1B with massive growth room).

**Collision probability:**
- With 1B URLs and 3.5T keyspace: collision probability per generation ≈ $1B / 3.5T = 0.03\%$
- With random generation: use a uniqueness check (DB lookup or Bloom filter) before inserting
- Alternative: sequential counter encoded in Base62 → zero collisions guaranteed

**ID generation approaches:**
- **Random:** Simple. Need collision check. Uniform distribution across DB shards
- **Hash (MD5/SHA256 → take first 7 chars):** Deterministic but collision-prone with truncation
- **Counter (Snowflake-like):** Guaranteed unique. Timestamp + worker_id + sequence. Encode in Base62

---

**Q6. Black Friday payments: 100M transactions in 24 hours, 50% in a 2-hour peak.**

**A:**

**Average QPS:**
- 100M / 86,400 ≈ **1,157 QPS average**

**Peak QPS (50% in 2 hours):**
- 50M transactions / 7,200 seconds ≈ **6,944 QPS**
- With burst factor (2×): ~**14,000 QPS peak**

**Database implications:**
- At 14K QPS, each transaction = 2-3 DB operations (read balance, write debit, write credit)
- DB operations: ~35,000-42,000 QPS
- Single PostgreSQL instance: handles ~5,000-10,000 simple TPS
- Need: **4-8 database instances** (sharded by account_id or region)

**Scaling strategy:**
- **Read replicas:** Balance checks (reads) routed to replicas. Only writes go to primary
- **Sharding:** Shard by `account_id % N`. Each shard handles 14K/N QPS
- **Connection pooling:** Must use PgBouncer. 14K QPS with direct connections = connection explosion
- **Pre-compute:** Cache frequently accessed accounts in Redis. Reduce DB reads by 80%

---

**Q7. Chat message storage: 100M users, 40 msgs/day, 100 bytes each.**

**A:**

**Daily storage:**
- 100M × 40 × 100 bytes = **400 GB/day**

**Annual storage:**
- 400 GB × 365 = **146 TB/year**

**With metadata overhead (timestamps, sender_id, chat_id, indexes):**
- 3× raw data → ~**438 TB/year** (realistic with indexes and replication)

**Cassandra vs PostgreSQL:**

| Factor | Cassandra | PostgreSQL |
|--------|-----------|------------|
| **Write throughput** | Excellent (distributed, no single primary bottleneck) | Limited (single primary for writes) |
| **Scale** | Linear horizontal scaling. Add nodes = add capacity | Vertical scaling primarily. Sharding is complex |
| **Query pattern** | Key-value + range scans. `WHERE chat_id = ? AND timestamp > ?` | Complex queries, joins, analytics |
| **Total 146 TB** | Easy. 50 nodes × 3 TB each (with replication = 150 nodes) | Hard. Need sharding solution (Citus). Operational burden |
| **Replication** | Tunable (2-3 replicas per row). Multi-DC built-in | Streaming replication. Multi-DC with pg_logical |

**Recommendation:** **Cassandra** — write-heavy workload (4B writes/day), time-series access pattern (messages by chat + time range), horizontal scaling needed.

---

**Q8. Little's Law: 10ms avg latency, 100ms P99, 10,000 QPS. In-flight requests and thread pool.**

**A:**

**Little's Law:** $L = \lambda \times W$

Where: L = average number of in-flight requests, λ = arrival rate (QPS), W = average time per request

**Average case:**
- $L = 10,000 \times 0.010 = 100$ requests in-flight at any time

**P99 case (for thread pool sizing):**
- At P99, requests take 100ms: $L_{p99} = 10,000 \times 0.100 = 1,000$ requests in-flight
- During a latency spike, up to 1,000 requests could be simultaneously active

**Thread pool sizing:**
- If using thread-per-request: need at least **1,000 threads** to handle P99 without queuing
- With headroom (1.5×): **1,500 threads**
- Each thread: ~1MB stack → 1,500 MB = **1.5 GB** just for thread stacks

**Alternative: async/event-driven:**
- Node.js, Go goroutines, Java virtual threads: handle 10K+ concurrent requests with hundreds of threads
- Don't need 1:1 thread-per-request

**Key insight:** The gap between average (100 in-flight) and P99 (1,000 in-flight) is 10×. Thread pools sized for average will queue requests during P99 spikes → cascading latency.

---

**Q9. Redis cache: 100M user profiles × 500 bytes. RAM needed, single vs cluster.**

**A:**

**Raw data:** 100M × 500 bytes = **50 GB**

**Redis overhead:**
- Each key-value pair: ~80-100 bytes overhead (dict entry, SDS string header, robj, pointers)
- With keys (~30 bytes average): 100M × 130 bytes overhead = **13 GB overhead**
- Total: 50 GB data + 13 GB overhead ≈ **63 GB**
- With safety margin (fragmentation, peak): ~**80 GB**

**Single instance vs cluster:**

| Option | Capacity | Pros | Cons |
|--------|----------|------|------|
| **Single instance** | Max ~100 GB practical | Simple. No partitioning logic | Single point of failure. Fork for persistence doubles memory briefly (128 GB needed for background save) |
| **Cluster (10 shards)** | 10 × 8 GB = 80 GB | HA. One shard fails → 10% of data unavailable. Better write throughput | Operational complexity. Cross-shard operations limited |

**Recommendation:** **Redis Cluster with 10 shards × 2 replicas = 30 instances.** Each shard holds ~8 GB. Replicas provide HA. Total capacity: 80 GB with failover.

---

**Q10. "1 million events/sec" — is that impressive? Kafka partition/broker math.**

**A:**

**Context:**
- Single Kafka partition throughput: ~10,000-100,000 msg/sec (depends on message size, replication)
- Assume ~50,000 msg/sec per partition (common for 1KB messages, replication factor 3)

**Partitions needed:**
- 1,000,000 / 50,000 = **20 partitions minimum**
- With headroom (2×): **40 partitions**

**Brokers needed:**
- Each broker handles ~200,000-500,000 msg/sec (depends on disk I/O, network)
- 1,000,000 / 300,000 = **3-4 brokers minimum**
- With replication (RF=3): each message written 3×. Broker write throughput: 3M msg/sec across cluster
- Need: **6-10 brokers** for comfort

**Is 1M/sec impressive?**
- For a single application: Yes. Most apps process 1K-100K/sec
- For Kafka: Moderate. LinkedIn's Kafka processes 7+ trillion messages/day (~80M/sec)
- For comparison: Visa processes ~65,000 transactions/sec globally (not events, but financial transactions)

**Message size matters enormously:**
- 1M × 100 bytes = 100 MB/s (trivial — any laptop can do this)
- 1M × 10 KB = 10 GB/s (serious network/disk throughput)
- Always state message size when citing throughput numbers

---

*Generated answer key covering 240 interview questions across 24 system design topics.*

