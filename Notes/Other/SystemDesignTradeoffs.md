System Design Tradeoffs

> **Sources:**
> - [Scalability, Availability & Stability Patterns](https://www.slideshare.net/slideshow/scalability-availability-stability-patterns/4062682) — Jonas Bonér (CTO, Typesafe)
> - [A Word on Scalability](https://www.allthingsdistributed.com/2006/03/a_word_on_scalability.html) — Werner Vogels (CTO, Amazon)
> - [Understanding Latency vs Throughput](https://community.cadence.com/cadence_blogs_8/b/fv/posts/understanding-latency-vs-throughput) — Cadence
> - [CAP Theorem Revisited](https://robertgreiner.com/cap-theorem-revisited) — Robert Greiner
> - [A Plain English Introduction to CAP Theorem](http://ksat.me/a-plain-english-introduction-to-cap-theorem) — ksat.me
> - [The CAP FAQ](https://github.com/henryr/cap-faq) — Henry Robinson
> - [System Design Primer](https://github.com/donnemartin/system-design-primer) — Donne Martin
> - [Eventual Consistency — Video](https://www.youtube.com/watch?v=k-Yaq8AHlFA)

---

## Table of Contents

1. [Performance vs Scalability](#1-performance-vs-scalability)
2. [Latency vs Throughput](#2-latency-vs-throughput)
3. [Availability vs Consistency](#3-availability-vs-consistency)
4. [CAP Theorem](#4-cap-theorem)
5. [CP vs AP](#5-cp-vs-ap)

---

## 1. Performance vs Scalability

### Definitions

| Concept | Definition | Symptom when poor |
|---------|-----------|-------------------|
| **Performance** | How fast is the system for a *single* user? | Slow for one user in isolation |
| **Scalability** | How does performance hold up as load increases? | Fast for one user, slow for 1,000 |

These are related but **not the same thing.** You can have one without the other.

### The Diagnostic Test

```
Q: Is your system slow for a single user in isolation?
  YES → Performance problem
        Fix: optimize algorithms, add caching, better queries

  NO, only slow under load → Scalability problem
        Fix: horizontal scaling, load balancing, database sharding
```

### Examples

**Performance problem (not scalability):**
A blog page takes 3 seconds to load for a single user. The N+1 query issue fires 50 SQL queries per page. Adding more servers won't help — all 50 servers would still each fire 50 queries. You need to fix the query or add caching.

**Scalability problem (not performance):**
The same blog loads in 50ms for one user but degrades to 10 seconds under 10,000 concurrent visitors. A single database is the bottleneck. Performance for one user is fine; the system can't handle parallelism.

**Both problems at once:**
A poorly written algorithm that is slow *and* doesn't parallelize well. Must fix performance first (or the scalability fix just distributes slowness).

### Formal Definition of Scalability (Werner Vogels, Amazon)

> A service is **scalable** if adding resources results in increased performance proportional to the resources added.

Two interpretations of "increased performance":
- **More throughput:** Serving more requests per second (e.g., 10x more users)
- **Larger units of work:** Processing a 1TB dataset instead of a 10GB dataset

Critical corollary: in a reliability context, adding redundant resources (for fault tolerance) must *not* degrade performance. Redundancy should help, not hurt.

### Why Scalability Cannot Be Bolted On Later

1. **Algorithm explosion under load** — Many algorithms that are fine at small scale "explode in cost" as dataset size or request rate grows. An O(N) search is invisible at 1,000 records but takes 17 minutes at 1 billion records. Re-architecting later is a full rewrite.

2. **Heterogeneity** — As you scale out, hardware diversifies (different generations, different geographies, different capacities). Algorithms that assume uniform nodes break down and waste the newer, faster hardware.

3. **The wrong axis** — You must identify *which dimension* needs to grow:

| Axis | What grows | Example |
|------|-----------|---------|
| User scale | Concurrent users | Social media |
| Data scale | Volume of data | Analytics pipeline |
| Geographic scale | Physical distance | Global CDN |

Designing for user scale when you actually have a data scale problem wastes money and engineering effort.

---

## 2. Latency vs Throughput

### Definitions

| Concept | Definition | Units |
|---------|-----------|-------|
| **Latency** | The time to perform one action or produce one result | ms, seconds, clock periods |
| **Throughput** | The number of actions or results produced per unit of time | requests/sec, MB/s, words/clock |

These are **different axes of performance** and optimizing one often hurts the other.

### The Assembly Line Analogy

Imagine a car factory assembly line:

- **Latency** = how long it takes to manufacture one car (e.g., 8 hours from start to finish)
- **Throughput** = how many cars roll off the line per day (e.g., 120 cars/day = 5 cars/hour)

An assembly line with 8 workstations running in parallel can produce 5 cars/hour *even though each car takes 8 hours*. Throughput is high; latency is also high. These are independent.

```
Car 1:  [Station 1]─[Station 2]─[Station 3]─...─[Station 8]   (8 hours total)
Car 2:         [Station 1]─[Station 2]─...                     (starts 1 hour later)
Car 3:                [Station 1]─[Station 2]─...

At any given hour: 8 cars are being built simultaneously
→ High throughput (many in-flight), high latency (8 hours per car)
```

### The Tension: Batching

The classic trade-off is **batching**:

```
Option A — Write every record immediately:
  [Record] → DB write → ACK → [Next record] → DB write → ACK
  Latency: ~5ms per record (fast!)
  Throughput: ~200 writes/sec (limited by round-trip overhead)

Option B — Buffer 1,000 records, write in one batch:
  [Records 1-1000] → single DB write → ACK for all 1000
  Latency: up to 1 second before record 1 is persisted (slow!)
  Throughput: potentially 100,000 writes/sec (overhead amortized)
```

Batching **increases throughput by amortizing overhead** but **increases latency** because each item waits for the batch to fill.

### Real-World Examples

| System | Priority | Why |
|--------|---------|-----|
| High-frequency trading platform | Latency | A 1ms advantage over competitors = profit |
| Log aggregation (e.g., Kafka) | Throughput | Must ingest millions of events/sec; 1s delay acceptable |
| Real-time video call | Latency | Stale audio is useless; better to drop it |
| Batch analytics (Hadoop) | Throughput | Query over 100TB; takes hours; latency irrelevant |
| Web API (user-facing) | Both | < 200ms feel "instant"; must serve thousands of RPS |

### Hardware Example (concrete numbers)

A communications device running at 100MHz with:
- **Latency budget**: 1000ns = 100 clock periods
- **Throughput requirement**: 640 Mbits/sec with 64-bit words

```
Latency  = 1000 ns × (100×10⁶ clocks/s) = 100 clock periods
Throughput = (640×10⁶ bits/s) ÷ (64 bits/word) ÷ (100×10⁶ clocks/s)
           = 0.1 words/clock = 1 word every 10 clock periods
```

These are separate constraints that hardware (or software) must satisfy simultaneously.

### The Goal

> **Maximize throughput with acceptable latency for your specific use case.**

There is no universal "good" latency or throughput number. Define what "acceptable" means for your users or SLA first, then optimize.

```
User-facing API:    target < 200ms p99 latency, > 10,000 RPS throughput
Background job:     target > 50,000 jobs/hour throughput, latency irrelevant
Real-time stream:   target < 50ms latency, throughput secondary
```

### Memory Bandwidth — Throughput Specialization

"Memory bandwidth" is a common term for the throughput of a memory system specifically. Example: "DDR5 provides 64 GB/s bandwidth" means the memory subsystem can transfer 64 gigabytes of data per second (throughput), regardless of access latency (~70-100ns per operation).

---

## 3. Availability vs Consistency

### The Core Tension

In a distributed system, **availability** and **consistency** pull against each other, especially when the network misbehaves.

| Concept | Definition |
|---------|-----------|
| **Consistency** | Every read receives the most recent write (or an error) |
| **Availability** | Every request receives a *response* — but it might not contain the most recent data |

These are fundamentally in tension when network partitions occur (see Section 4: CAP). But even without partitions, the tension shows up in everyday design decisions.

### Consistency Models (Spectrum)

From strongest to weakest:

#### Strong Consistency
After a write completes, all subsequent reads (from any node, any client) will see that write.

- **How:** Data is replicated synchronously — the write is not acknowledged until all replicas confirm it
- **Cost:** Write latency = slowest replica's confirmation time; availability drops if any replica is unreachable
- **Examples:** Traditional RDBMS (MySQL, PostgreSQL), Google Spanner, CockroachDB, distributed file systems
- **Use when:** You need transactions; data integrity cannot be compromised (banking, inventory)

```
Write: user.balance = $50
Immediately after write returns:
  ANY node queried → returns $50 ✓
```

#### Eventual Consistency
After a write, reads will *eventually* see it — typically within milliseconds to seconds. Data is replicated asynchronously.

- **How:** Write is acknowledged when it hits one node; replication happens in the background
- **Cost:** Reads may return stale data during the propagation window
- **Examples:** DNS, email, DynamoDB (default), Cassandra (default), CDN caches
- **Use when:** High availability is more important than seeing the absolute latest data

```
Write: user.profile_picture = "new.jpg"  (acknowledged immediately)
  t=0ms:   Node A returns "new.jpg" ✓
  t=0ms:   Node B returns "old.jpg" ← stale, replication hasn't arrived yet
  t=50ms:  Node B returns "new.jpg" ✓ (replication propagated)
```

#### Weak Consistency
After a write, reads *may or may not* see it. Best-effort only, no guarantee.

- **How:** No synchronization between caches/nodes; data may be lost or out of order
- **Examples:** Memcached, real-time multimedia (VoIP, video)
- **Use when:** The cost of stale or missing data is zero (e.g., in a voice call, you don't replay dropped audio — you just continue the conversation)

```
VoIP example:
  You lose signal for 2 seconds.
  When you reconnect, you do NOT hear the 2 seconds you missed.
  Those audio packets are gone — weak consistency accepted.
```

### Eventual Consistency Subtypes

Even within "eventually consistent," there are finer consistency guarantees worth knowing:

**Read-your-writes** ← *Most important for user-facing applications*
After you write, your own subsequent reads always reflect your write. Other users may still see stale data.

```
Without read-your-writes:
  Alice updates her avatar → page refreshes → shows OLD avatar → Alice thinks it failed
  (She actually succeeded; the read just hit a stale replica)

With read-your-writes:
  Alice's requests are always routed to a replica that has her latest writes.
  Other users may briefly see her old avatar, but Alice always sees her own changes.
```

**Monotonic reads**
Once you've seen a value, you'll never be shown an older value for the same data in the same session.

```
Without monotonic reads:
  Request 1 → replica A → "balance = $100"
  Request 2 → replica B (lagging) → "balance = $50"   ← went backwards!
  This is deeply confusing and appears to be a data corruption bug.

With monotonic reads:
  Once you've seen $100, every subsequent read shows $100 or newer — never $50 again.
```

**Causal consistency**
If event A causally precedes event B, any observer who sees B also sees A.

```
Without causal consistency:
  Alice posts a comment → Bob replies to it
  Carol might see Bob's reply without seeing Alice's original comment.

With causal consistency:
  You never see a reply without its parent comment.
```

**Session consistency**
Within a single session, you get read-your-writes + monotonic reads. Across sessions (e.g., two different browser tabs), consistency may be weaker.

### ACID vs BASE

These two philosophies represent two points on the consistency vs. availability spectrum.

**ACID** (traditional relational databases — favors consistency):

| Property | Meaning | Example |
|----------|---------|---------|
| **Atomicity** | All ops in a transaction succeed, or none do | Transfer $50: debit + credit both happen, or neither |
| **Consistency** | Transaction brings DB from one valid state to another | Foreign key constraints always satisfied after commit |
| **Isolation** | Concurrent transactions don't see each other's partial state | Two users booking the last airline seat see consistent inventory |
| **Durability** | Committed data survives crashes | Written to disk with WAL; survives power loss |

ACID trades **performance** for **correctness**. Locking, two-phase commit, write-ahead logs are expensive but guarantee integrity. Used by: MySQL, PostgreSQL, Oracle, SQL Server.

**BASE** (distributed NoSQL — favors availability):

| Property | Meaning |
|----------|---------|
| **Basically Available** | The system guarantees availability (AP in CAP terms) |
| **Soft state** | State may change over time even without new input, as replication propagates |
| **Eventually consistent** | Will become consistent, given enough time and no new updates |

BASE trades **immediate consistency** for **availability and horizontal scalability**. Used by: Cassandra, DynamoDB, Riak, CouchDB.

### Choosing the Right Model

```
The key question to ask for each piece of data:
  "What is the cost of showing a user stale data for 100ms? For 1 second? For 1 minute?"

If the cost is catastrophic → Strong consistency / ACID
If the cost is tolerable   → Eventual consistency / BASE
```

**Practical guide for a single application** (don't be dogmatic — mix models):

| Data | Model | Why |
|------|-------|-----|
| Bank account balance | Strong (ACID) | Showing stale balance → overdraft, fraud |
| Product inventory count | Strong (ACID) | Overselling = real business harm |
| User profile picture | Eventual | 1-second delay showing old avatar is fine |
| Social media feed | Eventual | Seeing a post 2 seconds late is imperceptible |
| Session / auth token | Eventual (read-your-writes) | User must see their own login; others can be stale |
| Analytics / view counts | Weak / Eventual | Approximate counts are fine |

---

## 4. CAP Theorem

### Origin

Dr. Eric Brewer first proposed the CAP theorem as a conjecture in his keynote "Towards Robust Distributed Systems" at the Principles of Distributed Computing conference (PODC) in 2000. Two years later, Seth Gilbert and Nancy Lynch formally *proved* it in their 2002 paper "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services."

### Statement

> In a distributed system, you can only guarantee **two** of the following three properties simultaneously:
>
> - **Consistency (C)**
> - **Availability (A)**
> - **Partition Tolerance (P)**

```
              Consistency (C)
                    △
                   / \
                  /   \
                 / CA? \
                /       \
               ▼─────────▼
    Availability (A)   Partition Tolerance (P)
```

### Precise Definitions (from the proof)

| Property | Formal Meaning |
|----------|---------------|
| **Consistency** | Every read returns the most recent write *or an error*. Equivalently: all nodes see the same data at the same time. (Formal term: linearizability / atomic consistency.) |
| **Availability** | Every request to a non-failing node eventually returns a response — not an error or timeout. (Note: no time bound required, just eventual.) |
| **Partition Tolerance** | The system continues to operate even when the network drops or delays arbitrary messages between nodes. |

**Important nuance on "Consistency" in CAP:**
The C in CAP specifically means *linearizability* — a very strong guarantee. It does NOT mean "eventual consistency." Eventual consistency is actually a *relaxation* of C. This trips people up constantly.

**Important nuance on "Availability" in CAP:**
Every request must eventually return a response. This is binary — 100% of requests must respond. One unavailable request technically violates A.

### The "Remembrance Inc." Analogy (plain English)

Imagine a memory-as-a-service company run by a husband and wife. Customers call to store and retrieve information about themselves (e.g., upcoming flights).

**Setup:** Each employee has their own notebook. Calls route to whoever is free.

**Problem — inconsistency:**
```
Customer John calls the wife → updates his flight to Nov 15
Customer John calls back → reaches the husband → husband checks notebook → no entry for Nov 15!
John gets the OLD flight date.
```
This is a consistency failure: two nodes (husband, wife) have different data.

**Fix for consistency — synchronous replication:**
```
When an update arrives, both employees must write it down before the call ends.
Result: Both notebooks are always identical → consistent.

New problem: If one employee is absent, no update calls can complete.
→ Availability problem.
```

**Attempt to fix availability — async email:**
```
If the other employee is available: update them synchronously.
If they're absent: send an email; they'll update their notebook when back.

This seems to work! But...
```

**Partition tolerance failure:**
```
What if both employees are present, but one is angry and refuses to communicate?
The email/synchronous approach breaks entirely.
To stay consistent, the system must refuse update calls → not available.
To stay available, the system accepts updates with no replication → not consistent.

There is NO solution that is simultaneously consistent, available, AND partition-tolerant.
```

### Why CAP is True (Proof Sketch)

```
Scenario:
  Node A (US-East) and Node B (EU-West) share data.
  Network partition occurs: A and B cannot communicate.

  A write arrives at Node A: user balance $100 → $50

  A read now arrives at Node B:
    Option 1: Return $100 (stale)  → System is Available but NOT Consistent
    Option 2: Return an error      → System is Consistent but NOT Available
    Option 3: Wait for partition to heal → potentially wait forever (violates Availability)

  There is no Option 4. The system MUST sacrifice C or A.
```

This is why CAP is an *impossibility result*: it proves no design can escape this dilemma.

### The Critical Insight: P is Not Optional

A common misconception is treating CAP as "pick any two freely." In practice:

> **Networks are not reliable. Partitions will happen. Partition Tolerance is mandatory.**

Real reasons partitions occur in production:
- A network switch fails, splitting the datacenter in two
- A misconfigured firewall drops packets between availability zones
- A GC pause on a node makes it appear unreachable
- A cloud provider's cross-region link has elevated packet loss
- Rolling deployments where some nodes see new code and others don't

Since P is non-negotiable in any real distributed system, CAP reduces to:

> **You must choose between C and A during a partition.**

This is more precisely stated as:
```
Possibility of Partitions  ⟹  NOT (C AND A simultaneously)
```

### CA Systems — The "False Third Option"

Describing a distributed database as "CA" (choosing consistency + availability, sacrificing P) indicates a misunderstanding. If your system truly never experiences partitions, it's not really a distributed system in the relevant sense — it's a single-node system with perhaps a hot standby. The moment you have genuinely distributed nodes across a network, partitions are possible.

**The one legitimate CA context:** A single-site database (single node, or synchronously replicated nodes on a local network with negligible partition probability). But this isn't "distributed" in the modern sense.

### CAP is Binary, But C and A are Spectrums in Practice

The formal theorem treats C and A as binary (either 100% or not). In the real world, engineers tune *how much* consistency and availability they need:

- ZooKeeper: prioritizes consistency, relaxes availability (returns errors during partitions)
- Amazon Dynamo / Cassandra: prioritizes availability, relaxes consistency (serves stale data)
- Cassandra lets you tune per-operation with consistency levels (ONE, QUORUM, ALL)

This is not "beating CAP" — it's choosing where to land on the spectrum given your business requirements.

### N, W, R — The Consistency Tuning Knob

For systems with N replicas, consistency and availability are tuned by:

| Variable | Meaning |
|----------|---------|
| **N** | Total replicas |
| **W** | Replicas that must acknowledge a write before success |
| **R** | Replicas that must respond to a read |

**Rule:** `W + R > N` → Strong consistency (every read overlaps with every write)

```
N = 3 replicas. Examples:

W=3, R=1 → Strong consistency
  All 3 must acknowledge writes (slow writes, fast reads, high write durability)

W=1, R=3 → Strong consistency
  Read all 3, take latest (fast writes, slow reads)

W=2, R=2 → Strong consistency (2+2=4 > 3)
  Balanced trade-off — this is QUORUM

W=1, R=1 → Eventual consistency (1+1=2, not > 3)
  Fastest, but reads may return stale data
```

**Cassandra example:**
```python
# Strong read — contact majority of replicas, take latest
session.execute(query, consistency_level=ConsistencyLevel.QUORUM)

# Fast but potentially stale read — contact one replica
session.execute(query, consistency_level=ConsistencyLevel.ONE)

# Maximum durability write — all replicas must confirm
session.execute(insert, consistency_level=ConsistencyLevel.ALL)
```

---

## 5. CP vs AP

With partition tolerance mandatory in distributed systems, the design decision is:

> **When a partition occurs, does my system sacrifice Consistency or Availability?**

### CP Systems — Consistency + Partition Tolerance

**Behavior during a partition:**
The system detects it cannot guarantee the most recent data (because it can't communicate with all replicas). It *refuses to serve* rather than risk serving stale data. Returns a timeout or error.

```
Normal operation:
  [Client] → [Node A] ←sync→ [Node B] → data consistent ✓

During partition (A and B cannot communicate):
  Write arrives at Node A → accepted
  Read arrives at Node B  → ERROR or TIMEOUT (refuses to serve potentially stale data)
```

**The guarantee:** If you get a response, it is always the most recent data.

**The cost:** During a partition, some requests fail. Availability suffers.

**CP examples and why:**

| System | Why CP |
|--------|--------|
| **ZooKeeper** | Distributed coordination service. Incorrect config values or leader election results would be catastrophic. Better to be unavailable than give wrong answers. |
| **etcd** | Kubernetes relies on it for cluster state. Wrong cluster state = wrong scheduling decisions. Must be correct. |
| **HBase** | Modeled after Google Bigtable; prioritizes strong consistency for row-level operations. |
| **Redis Cluster (default)** | Prefers consistency; a partition can cause some keys to be unavailable. |
| **Traditional RDBMS with sync replication** | Writes only succeed when all replicas confirm. |

**When to choose CP:**
- Atomic reads and writes are a business requirement
- Incorrect data causes real harm: financial transactions, inventory counts, auth systems
- "Return an error" is a better user experience than "return the wrong answer"

```
Banking example:
  User's balance: $100
  Partition occurs.
  User attempts to withdraw $80.

  CP behavior: "Service temporarily unavailable. Please try again."
  → User is frustrated but balance is safe.

  AP behavior: "Success! You withdrew $80." (but the write may not have propagated)
  → Now user withdraws $80 from a second ATM simultaneously.
  → Both succeed → account goes to -$60. Catastrophic.
```

### AP Systems — Availability + Partition Tolerance

**Behavior during a partition:**
The system keeps serving requests even if it cannot guarantee the data is current. Returns the best available data — potentially stale. Accepts writes that will be reconciled later.

```
Normal operation:
  [Client] → [Node A] ←async→ [Node B] → data eventually consistent

During partition (A and B cannot communicate):
  Write arrives at Node A → accepted, queued for later sync
  Read arrives at Node B  → returns last known value (may be stale)
  Both nodes stay operational.
  When partition heals → conflicts resolved (last-write-wins or merge)
```

**The guarantee:** You will always get a response. It might not be the very latest.

**The cost:** During a partition, reads may return stale data. Writes on both sides may conflict and require reconciliation.

**AP examples and why:**

| System | Why AP |
|--------|--------|
| **Cassandra** | Designed for high availability across datacenters. Downtime is worse than briefly stale data. |
| **DynamoDB** | Amazon's flagship NoSQL; built on Dynamo paper's AP philosophy. Shopping carts should always work. |
| **CouchDB** | Designed for occasionally-connected clients (offline-first). Must accept writes with no network. |
| **Riak** | Built on Dynamo; AP by design with configurable conflict resolution. |
| **DNS** | Stale cached DNS records are expected and accepted; availability of name resolution is paramount. |
| **Voldemort** | LinkedIn's AP key-value store based on Dynamo. |

**When to choose AP:**
- The system must continue functioning during network failures
- Eventual consistency is acceptable — data will converge
- "Return slightly old data" is better user experience than "return an error"
- Writes must always succeed even if replication is delayed

```
Shopping cart example (Amazon Dynamo's motivation):
  User adds item to cart while Node B is partitioned from Node A.

  CP behavior: "Cannot add item right now. Try again later."
  → User leaves, purchases elsewhere. Revenue lost.

  AP behavior: Item added to cart successfully.
  If user also added item on another device hitting Node A:
  → Both carts have items → merge both when partition heals.
  → Slightly more items in cart than expected, but no data lost.
  → Amazon chose this tradeoff intentionally.
```

### Side-by-Side Comparison

| | CP | AP |
|--|----|----|
| **During a partition** | Returns error / timeout | Returns (potentially stale) data |
| **Writes during partition** | May be rejected | Accepted; reconciled later |
| **Guarantee** | Data is always correct | System is always responsive |
| **When wrong?** | Never (or returns error) | May return stale data briefly |
| **Conflict resolution** | Not needed (only one accepted) | Needed (last-write-wins, vector clocks, CRDTs) |
| **Use case** | Finance, inventory, coordination | Social feeds, carts, analytics, DNS |
| **Examples** | ZooKeeper, etcd, HBase | Cassandra, DynamoDB, CouchDB |

### Conflict Resolution in AP Systems

When both sides of a partition accept writes to the same key, there is a *conflict* to resolve when the partition heals:

**Last-Write-Wins (LWW):** Each write has a timestamp. The most recent timestamp wins.
- Simple to implement
- Problem: clocks are not perfectly synchronized in distributed systems; "most recent" can be wrong

**Vector clocks:** Each write carries a version vector tracking causality. The system can detect whether writes are concurrent or causally related.
- More precise than LWW
- Used by: Riak, Voldemort, DynamoDB (internally)

**CRDTs (Conflict-free Replicated Data Types):** Data structures mathematically designed so that concurrent updates from any replica always merge deterministically with no conflicts.
- Example: a counter that only increments — two nodes incrementing independently can just sum their increments; no conflict possible
- Used by: Redis (some data types), Riak, Cassandra (counters)

### The Practical Decision Framework

```
For each piece of data in your system, ask:

1. What happens if a user sees data that is 100ms stale? 1 second? 10 seconds?
   - "Catastrophic" → CP
   - "Acceptable" → AP

2. What happens if a write is rejected because the system is temporarily unavailable?
   - "Unacceptable — must always accept" → AP
   - "OK — user can retry" → CP

3. Is there meaningful merge logic if the same record is updated simultaneously on two partitioned nodes?
   - "No reasonable merge — must serialize writes" → CP
   - "Yes — last-write-wins or CRDTs work" → AP
```

### Real-World: Both in One System

Modern systems often use CP *and* AP for different data within the same application. Netflix, for example, uses:
- **ZooKeeper (CP)** for service discovery and leader election — must be correct
- **Cassandra (AP)** for viewing history, ratings — availability > consistency
- **EVCache/Memcached (AP)** for content metadata — stale cache is fine

Don't pick one philosophy for your entire system. Pick the right model for each specific data type based on its consistency requirements.

---

## Quick Reference

```
PERFORMANCE vs SCALABILITY:
  Slow for 1 user        → Performance problem (fix algorithms, queries, caching)
  Slow for many users    → Scalability problem (horizontal scale, DB sharding)
  Formal: scalable = adding resources ∝ increased performance

LATENCY vs THROUGHPUT:
  Latency   = time for one operation (ms, ns)
  Throughput = operations per unit time (RPS, MB/s)
  Goal: maximize throughput WITH acceptable latency
  Trade-off: batching ↑ throughput but ↑ latency

CONSISTENCY MODELS (strongest → weakest):
  Strong      → reads always return latest write (synchronous replication)
  Eventual    → reads eventually return latest write (async replication, ms-seconds)
  Weak        → reads may never return latest write (best effort, e.g. VoIP, memcached)

  Eventual consistency subtypes:
    Read-your-writes  → you always see your own latest writes (critical for UX)
    Monotonic reads   → reads never go backwards in time
    Causal            → cause always visible before effect
    Session           → read-your-writes + monotonic reads within a session

CAP THEOREM:
  Pick 2 of: Consistency, Availability, Partition Tolerance
  BUT: partitions are inevitable in real distributed systems → P is mandatory
  THEREFORE: real choice is C vs A during a partition

  CP: sacrifice availability → return error during partition, never stale data
      Examples: ZooKeeper, etcd, HBase, RDBMS with sync replication
      Use for: finance, inventory, auth, coordination

  AP: sacrifice consistency → return stale data during partition, always respond
      Examples: Cassandra, DynamoDB, CouchDB, DNS
      Use for: social feeds, shopping carts, analytics, user profiles

N/W/R CONSISTENCY KNOB (Cassandra, DynamoDB):
  N = replicas, W = write quorum, R = read quorum
  W + R > N → strong consistency
  W + R ≤ N → eventual consistency
  QUORUM = majority = (N/2) + 1
```
