# Availability vs Consistency (CAP Theorem)

> In distributed systems you **cannot** have everything. The CAP theorem forces you to make deliberate trade-offs.

---

## Table of Contents

1. [The CAP Theorem Explained](#1-the-cap-theorem-explained)
2. [Why You Must Choose](#2-why-you-must-choose)
3. [CP — Consistency + Partition Tolerance](#3-cp--consistency--partition-tolerance)
4. [AP — Availability + Partition Tolerance](#4-ap--availability--partition-tolerance)
5. [CA — Consistency + Availability (The Unicorn)](#5-ca--consistency--availability-the-unicorn)
6. [Real-World System Choices](#6-real-world-system-choices)
7. [Beyond CAP: PACELC Theorem](#7-beyond-cap-pacelc-theorem)
8. [How to Decide: CP vs AP](#8-how-to-decide-cp-vs-ap)
9. [Key Takeaways](#9-key-takeaways)

---

## 1. The CAP Theorem Explained

The CAP theorem (proposed by Eric Brewer in 2000) states that a **distributed data store** can provide only **two out of three** guarantees simultaneously:

| Letter | Property | What It Means |
|--------|----------|---------------|
| **C** | **Consistency** | Every read receives the **most recent write** or an error. All nodes see the same data at the same time. |
| **A** | **Availability** | Every request receives a **response** (not an error), without guarantee it's the most recent data. |
| **P** | **Partition Tolerance** | The system continues to operate despite **network failures** (messages being lost or delayed between nodes). |

### Visual Explanation

```
                    Consistency
                       /\
                      /  \
                     /    \
                    / Pick  \
                   /  Two    \
                  /____________\
        Availability ——————— Partition
                              Tolerance
```

### What is a "Partition"?

A **network partition** happens when nodes in a distributed system **cannot communicate** with each other.

```
Normal operation:
  ┌──────────┐     ✅     ┌──────────┐
  │  Node A  │ ←────────→ │  Node B  │
  └──────────┘            └──────────┘

During a partition:
  ┌──────────┐     ❌     ┌──────────┐
  │  Node A  │ ←──╳╳╳╳──→ │  Node B  │
  └──────────┘            └──────────┘
  
  Node A and Node B are both alive, but they
  can't talk to each other. Now what?
```

---

## 2. Why You Must Choose

### Networks Are NOT Reliable

In the real world, **network partitions happen.** Cables get cut. Switches fail. Data centers have outages. This is not theoretical — it happens regularly at scale.

> Since network partitions are unavoidable, you **must** support Partition Tolerance (P). This means your real choice is between **Consistency (C)** and **Availability (A)**.

### The Forced Choice

When a partition occurs:

```
Option 1 (CP): Prioritize Consistency
  → Refuse to respond until you're sure the data is correct
  → Some requests will FAIL (unavailable)
  → But every successful response is CORRECT

Option 2 (AP): Prioritize Availability
  → Always respond, even if the data might be stale
  → Every request gets A response (available)
  → But some responses might be OUTDATED
```

### Example: Two Bank ATMs

```
You have $100 in your bank account.
Two ATMs (Node A and Node B) in different cities.
A network partition occurs — the ATMs can't sync.

You walk up to ATM A and withdraw $80.

Now someone (or you) walks up to ATM B:

  CP approach: ATM B says "Sorry, system unavailable. 
                Can't verify your balance."
                → You're frustrated, but the bank is safe.

  AP approach: ATM B shows balance: $100 (stale!)
                You withdraw $80 again.
                → Bank just lost $60.
                → But you got your money — "available"!

In banking, CP wins. Correctness > Availability.
```

---

## 3. CP — Consistency + Partition Tolerance

When a partition happens, the system **stops serving requests** to some/all clients to ensure that every response is **correct**.

### Behavior During a Partition

```
Client → Request → Node A
                    │
                    │ "I can't reach Node B to confirm 
                    │  the latest data. I'll return an error
                    │  rather than risk giving stale data."
                    │
                    ▼
Client ← ERROR / TIMEOUT
```

### Systems That Choose CP

| System | Why CP? |
|--------|---------|
| **MongoDB** (strong read concern) | Configuration options allow strong consistency |
| **HBase** | Built for consistent reads on big data |
| **Redis** (in cluster mode with specific config) | Can reject writes during partitions |
| **Zookeeper** | Coordination service — correctness is critical |
| **Etcd** | Kubernetes config store — must be consistent |
| **Traditional <abbr title="Relational Database Management System: a database that stores data in structured tables with rows and columns, supporting SQL queries. Examples: PostgreSQL, MySQL, Oracle">RDBMS</abbr>** (PostgreSQL, MySQL) | <abbr title="ACID: Atomicity (all or nothing), Consistency (data is always valid), Isolation (transactions don't interfere), Durability (committed data survives crashes). The gold standard for reliable transactions.">ACID</abbr> transactions require consistency |

### Good For

- **Financial systems:** Bank transfers, payment processing
- **Inventory management:** Can't sell the same item twice
- **Booking systems:** Can't double-book a hotel room or flight seat
| **Coordination services:** <abbr title="Leader election: the process by which distributed nodes agree on one node to act as the 'leader' or primary coordinator — critical for avoiding conflicting decisions">Leader election</abbr>, <abbr title="Distributed locks: a mechanism to ensure only one node at a time can perform a specific operation across a distributed system, preventing race conditions">distributed locks</abbr> |

---

## 4. AP — Availability + Partition Tolerance

When a partition happens, the system **continues serving requests** but may return **stale or divergent data**.

### Behavior During a Partition

```
Client → Request → Node A
                    │
                    │ "I can't reach Node B, but I'll
                    │  respond with what I have. It might
                    │  not be the absolute latest, but at
                    │  least you get a response."
                    │
                    ▼
Client ← Response (possibly stale data)
```

### Systems That Choose AP

| System | Why AP? |
|--------|---------|
| **Cassandra** | High availability for writes across data centers |
| **CouchDB** | <abbr title="Multi-master replication: multiple nodes can accept writes simultaneously, then sync later. Highly available but can cause conflicting writes that need resolving.">Multi-master replication</abbr>, eventual consistency |
| **DynamoDB** | Amazon chose availability for their shopping cart |
| **DNS** | Domain lookups should always work, even if slightly stale |
| **Riak** | Distributed key-value store prioritizing uptime |

### Good For

- **Social media feeds:** Showing a slightly stale timeline is better than showing nothing
- **Shopping carts:** Amazon's Dynamo paper: always accept writes to the cart
- **Content delivery:** CDN serving slightly stale content > serving errors
- **IoT sensor data:** A slightly delayed reading is fine; no reading is not
- **User profiles:** Showing last-known profile data > showing an error

---

## 5. CA — Consistency + Availability (The Unicorn)

In theory, you could have Consistency AND Availability if there are **no network partitions.**

In practice, this only works on a **single machine** (non-distributed system) because there's no network to partition.

```
Single PostgreSQL server:
  ✅ Consistent — one copy of data
  ✅ Available — responds to every request
  ❌ Not partition tolerant — it's one machine, can't partition
                              ...but also can't survive machine failure

As soon as you add a second node for redundancy,
you're in distributed territory and must choose CP or AP.
```

**CA systems are essentially non-distributed databases.** The moment you replicate data across machines, you must handle partitions.

---

## 6. Real-World System Choices

| System | CAP Choice | Reasoning |
|--------|-----------|-----------|
| **Google Spanner** | CP (effectively) | Uses <abbr title="TrueTime: Google's globally synchronized clock system using atomic clocks and GPS, allowing Spanner to assign precise timestamps to transactions and guarantee consistency across data centers">TrueTime</abbr> (atomic clocks + GPS) to achieve consistency globally. Sacrifices some availability during edge cases. |
| **Amazon DynamoDB** | AP (default) / CP (optional) | Shopping cart: always accept writes. But offers "strongly consistent reads" option. |
| **Cassandra** | AP (tunable) | <abbr title="Tunable consistency: Cassandra lets you set per-query consistency levels — from writing to just one node (fast, risky) to requiring a quorum majority (slower, safer)">Tunable consistency</abbr>: you can ask for <abbr title="Quorum: a majority of nodes (e.g. 2 out of 3) must acknowledge a read/write before it succeeds. Balances speed and safety.">quorum</abbr> reads (more CP) or single-node reads (more AP). |
| **MongoDB** | CP (default) | Primary handles writes; during primary election, writes are unavailable. |
| **CockroachDB** | CP | Distributed SQL — consistency is essential for SQL semantics. |
| **Redis Cluster** | AP (with caveats) | Async replication; during partition, acknowledged writes might be lost. |

### The Spectrum Is Tunable

Modern databases don't always fall cleanly into CP or AP. Many offer **tunable consistency**:

```
Cassandra example:
  Write with consistency level ONE → AP behavior
    "Write to any one node and acknowledge. Fast but might lose data."
  
  Write with consistency level QUORUM → More CP behavior
    "Write must be acknowledged by majority (quorum) of nodes."
  
  Write with consistency level ALL → Strong CP behavior
    "Write must be acknowledged by ALL nodes. Slower but safe."
```

---

## 7. Beyond CAP: PACELC Theorem

CAP only describes behavior **during a partition.** But what about when everything is working fine? That's where **PACELC** comes in.

```
PACELC: 
  IF there is a Partition (P):
    Choose between Availability (A) and Consistency (C)
  ELSE (E) (normal operation):
    Choose between Latency (L) and Consistency (C)
```

### Why This Matters

Even when there's **no** partition, replicating data synchronously (for consistency) adds latency. So you still have a trade-off:

| System | During Partition (PAC) | Normal Operation (ELC) |
|--------|----------------------|----------------------|
| **DynamoDB** | AP | EL (low latency, eventual consistency) |
| **Cassandra** | AP | EL (fast reads from nearest node) |
| **MongoDB** | CP | EC (consistent reads from primary) |
| **Google Spanner** | CP | EC (consistent but uses TrueTime to minimize latency) |
| **PNUTS (Yahoo)** | AP | EL (host data near the user) |

### Key Insight

> Even when everything is working, you're choosing between **fast responses** (Low Latency) and **correct responses** (Consistency). PACELC captures this nuance that CAP misses.

---

## 8. How to Decide: CP vs AP

Ask yourself these questions:

```
1. What happens if a user sees stale data?
   → Annoying but harmless? → AP is fine
   → Financial loss or safety risk? → Choose CP

2. What happens if the system is temporarily unavailable?
   → Users retry later? → CP is acceptable
   → Revenue loss per second of downtime? → Choose AP

3. Can you resolve conflicts later?
   → Yes (merge shopping carts, last-write-wins) → AP
   → No (double-booking, double-spending) → CP

4. What's your read-to-write ratio?
   → Read-heavy: Eventual consistency often works
   → Write-heavy with conflicts: Strong consistency safer
```

### Decision Matrix

| Scenario | Recommended | Why |
|----------|------------|-----|
| Banking / Payments | CP | Can't have inconsistent account balances |
| Social media feed | AP | Stale feed is better than no feed |
| E-commerce inventory | CP | Don't oversell products |
| Shopping cart | AP | Always let users add items; merge conflicts later |
| Real-time bidding | CP | Highest bid must be accurate |
| User session data | AP | Slight staleness is acceptable |
| Medical records | CP | Incorrect data is dangerous |
| Content/blog platform | AP | Showing cached content is fine |

---

## 9. Key Takeaways

1. **CAP Theorem:** In a distributed system, when a network partition occurs, you must choose between Consistency and Availability. You can't have both.

2. **Network partitions are inevitable** at scale. So the real question is always: **CP or AP?**

3. **CP** = Every response is correct, but some requests may fail. Good for financial systems, inventory, bookings.

4. **AP** = Every request gets a response, but it might be stale. Good for social feeds, CDN, shopping carts.

5. **Most modern systems are tunable.** Cassandra, DynamoDB, etc. let you dial the consistency level per query.

6. **PACELC extends CAP** to include what happens during *normal* operation: do you optimize for Latency or Consistency?

7. **There are no right answers, only trade-offs.** The key is to justify your choice based on the specific business requirements.

---

## 🔥 Senior Interview Questions

1. An interviewer says "CAP theorem means you can only have two out of three." How would you correct or nuance this statement? Why is partition tolerance not really optional? [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

2. You're designing a global e-commerce checkout system. Would you choose CP or AP? What if the interviewer then asks: "What about the product catalog — same choice?" Justify why different components may need different CAP trade-offs. [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

3. Explain PACELC with a concrete example. For Cassandra (PA/EL), what does it mean during normal operation vs. during a network partition? [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

4. A banking system needs strong consistency, but the team wants to use Cassandra for scalability. Is this possible? How would you configure Cassandra's consistency levels (QUORUM reads + QUORUM writes) to achieve it, and what do you sacrifice? [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

5. Your system experiences a network partition between two data centers. Users in DC-East can still write data. When the partition heals, you discover conflicting writes. How do you resolve them? Compare <abbr title="Last-write-wins: the most recently timestamped write overwrites all others. Simple but can silently discard valid data.">last-write-wins</abbr>, <abbr title="Vector clocks: a data structure that tracks the causal history of updates across nodes, allowing the system to detect and reason about conflicting writes rather than blindly discarding them.">vector clocks</abbr>, and application-level resolution. [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

6. Why is the CAP theorem often called misleading? Discuss the criticisms by Martin Kleppmann and others who argue that "CP vs AP" is an oversimplification. [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

7. Design a shopping cart system that remains available during network partitions but eventually becomes consistent. How do you handle the case where a user adds items from two partitioned DCs simultaneously? [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

8. You're told to design a system that is "always consistent and always available." How do you explain to a non-technical stakeholder that this is impossible in a distributed system? What compromises do you propose? [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

9. Compare how DynamoDB, MongoDB, and CockroachDB handle the availability-consistency spectrum. For each, identify where it falls on CAP and PACELC. [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

10. An interviewer asks: "If strong consistency is so expensive, why do banks use it?" Then follows with: "Could a bank ever use eventual consistency?" Walk through both sides. [Answer](QnA-Answer-Key.md#3-availability-vs-consistency)

---

## 📚 Further Reading

- [CAP Theorem Revisited — Robert Greiner](https://robertgreiner.com/cap-theorem-revisited/) — Clearest explanation of CAP with the "revisited" perspective.
- [A Plain English Introduction to CAP Theorem](http://ksat.me/a-plain-english-introduction-to-cap-theorem) — Tells the CAP story without jargon.
- [Martin Kleppmann: Please Stop Calling Databases CP or AP (YouTube)](https://www.youtube.com/watch?v=hUd_9FENShA) — Essential viewing on why CAP is more nuanced than most think.
