# Consistency Patterns

> When you have multiple copies of data, how do you synchronize them? These patterns describe the guarantees your system makes about data freshness.

---

## Table of Contents

1. [Why Consistency Patterns Matter](#1-why-consistency-patterns-matter)
2. [Weak Consistency](#2-weak-consistency)
3. [Eventual Consistency](#3-eventual-consistency)
4. [Strong Consistency](#4-strong-consistency)
5. [Causal Consistency](#5-causal-consistency)
6. [Read-Your-Writes Consistency](#6-read-your-writes-consistency)
7. [Monotonic Read Consistency](#7-monotonic-read-consistency)
8. [Linearizability vs Serializability](#8-linearizability-vs-serializability)
9. [Comparison Table](#9-comparison-table)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Why Consistency Patterns Matter

When you replicate data across multiple nodes (for availability, performance, or both), you create **multiple copies** of the same data. The consistency pattern determines **what guarantee** you make about reading that data.

```
User writes "name = Alice" to Node A

  Node A: name = "Alice"     (updated immediately)
  Node B: name = "Bob"       (still has old value)
  Node C: name = "Bob"       (still has old value)

If another user reads from Node B right now, what do they see?
The answer depends on your consistency pattern.
```

---

## 2. Weak Consistency

**After a write, reads may or may not see it.** The system makes a **best effort** to propagate the update, but there's no guarantee of when — or even if — the update reaches all nodes.

### How It Works

```
Timeline:
  T1: Client writes "X = 5" to Node A
  T2: Client reads X from Node B → might get old value, or nothing
  T3: Update might propagate to Node B... eventually... maybe
  T4: Client reads X from Node B → still might get old value
```

### When Weak Consistency Is Acceptable

- **VoIP / Phone calls:** If you lose connectivity for a few seconds, you don't hear what was said during that gap. You don't "replay" the lost audio — it's just gone.
- **Video chat:** Dropped frames are discarded, not replayed.
- **Real-time multiplayer games:** If you miss a position update, you skip to the current state.
- **Live video streaming:** If you buffer, you skip ahead to live rather than playing old frames.

### Real-World Example: Memcached

```
Cache write:  SET user:123 "Alice"
Cache eviction: (LRU evicts user:123 when memory is full)
Cache read:  GET user:123 → MISS (data is gone, not stale — just gone)

Memcached makes no guarantees about data persistence.
If the data is there, great. If not, fetch from the database.
```

### Characteristics

| Property | Value |
|----------|-------|
| Latency | Very low |
| Throughput | Very high |
| Data freshness guarantee | None |
| Use when | Losing some data is acceptable |

---

## 3. Eventual Consistency

**After a write, reads will eventually see it** — typically within milliseconds to seconds. Data is replicated **asynchronously** across nodes.

### How It Works

```
Timeline:
  T1: Client writes "X = 5" to Node A         → Node A: X=5
  T2: Node A async replicates to Node B        → Node B: X=old (in transit)
  T3: Client reads X from Node B               → might get old value
  T4: Replication completes                     → Node B: X=5
  T5: Client reads X from Node B               → gets X=5 ✅

The "eventual" part: there is a window (T2→T4) where reads
from different nodes may return different values.
After that window, ALL nodes return the same value.
```

### The Consistency Window

```
  Write ──────────┐
                  │ Consistency Window
                  │ (reads might be stale)
                  ▼
  All replicas converge ✅
  
  Typical window: 10ms - few seconds
  DNS propagation: minutes to hours
```

### Conflict Resolution

When two nodes receive conflicting writes before syncing, you need a conflict resolution strategy:

| Strategy | How It Works | Example |
|----------|-------------|---------|
| **Last Writer Wins (LWW)** | Highest timestamp wins, other writes are discarded | Cassandra (default) |
| **Vector Clocks** | Track causal history; detect and surface conflicts | DynamoDB, Riak |
| **Merge (CRDT)** | Automatically merge conflicting changes | Counters, sets (Riak data types) |
| **Application-level resolution** | App decides how to merge | Shopping cart: union of items |

### When Eventual Consistency Is Appropriate

- **DNS:** DNS updates propagate across the internet over minutes/hours. Slightly stale DNS records are harmless.
- **Social media feeds:** A tweet showing up 2 seconds late on your follower's timeline is fine.
- **Email:** Emails are inherently eventually consistent — delivery delay is expected.
- **Product catalog:** Showing a slightly stale price for a few seconds is acceptable.
- **Analytics dashboards:** Real-time accuracy is not required.

### Real-World Example: Amazon DynamoDB

```
DynamoDB default behavior:
  Write: "item_price = $29.99" → writes to primary node
  
  Read from any replica (eventually consistent read):
    → Might return $24.99 (old price) for ~milliseconds
    → Latency: ~1ms, cheaper
  
  Read with "strongly consistent read" option:
    → Always returns $29.99 (latest)
    → Latency: ~5ms, costs 2x
```

### Characteristics

| Property | Value |
|----------|-------|
| Latency | Low |
| Throughput | High |
| Data freshness guarantee | Eventually (usually ms to seconds) |
| Use when | Staleness for a short window is acceptable |

---

## 4. Strong Consistency

**After a write, every subsequent read will see that write.** All nodes agree on the current value at all times.

### How It Works

```
Timeline:
  T1: Client writes "X = 5"
      → Write is sent to ALL replicas
      → System waits for ALL (or majority) to confirm
      → Only then does the write succeed
  T2: ANY read from ANY node returns X = 5 ✅

There is ZERO window where a stale read is possible.
```

### The Cost of Strong Consistency

```
Strongly consistent write:

  Client → Write → Node A ──┬──→ Node B (sync)
                             ├──→ Node C (sync)
                             └──→ Node D (sync)
                                    │
                        Wait for all/majority to ACK
                                    │
                        ← Write acknowledged to client

This adds latency:
  Eventual: Write acknowledged after Node A stores it (~1ms)
  Strong:   Write acknowledged after majority confirms (~10-50ms)
```

### When Strong Consistency Is Required

- **Financial transactions:** Bank transfers — both accounts must reflect the transfer atomically.
- **Inventory systems:** E-commerce stock counts — can't sell an out-of-stock item.
- **Booking systems:** Hotel rooms, airline seats — can't double-book.
- **User authentication:** Password changes must be immediately visible everywhere.
- **Leader election:** Only one leader at a time in a distributed system.

### Real-World Example: Google Spanner

```
Google Spanner achieves globally strong consistency using TrueTime:
  - Atomic clocks + GPS receivers in every data center
  - Tight clock synchronization (< 7ms uncertainty)
  - Every transaction waits out the uncertainty window

Result: Strong consistency across data centers worldwide
Trade-off: Higher latency per transaction (~10ms+)
```

### Characteristics

| Property | Value |
|----------|-------|
| Latency | Higher (must synchronize across nodes) |
| Throughput | Lower (synchronization overhead) |
| Data freshness guarantee | Immediate — always current |
| Use when | Correctness is non-negotiable |

---

## 5. Causal Consistency

A middle ground: **if operation A causally affects operation B, then everyone sees A before B.** But unrelated operations can be seen in any order.

### How It Works

```
Example: Comment thread

  User A posts: "Who wants pizza?" (operation 1)
  User B replies: "I do!" (operation 2, caused by operation 1)

Causal consistency guarantees:
  ✅ Everyone sees "Who wants pizza?" before "I do!"
  
But if User C independently posts: "Nice weather today" (unrelated)
  → This might appear before, after, or between the pizza comments.
  → That's fine — it's causally unrelated.
```

### Why It's Useful

- Preserves the **intuitive order** of related events
- Without the full cost of strong consistency
- Unrelated events don't need ordering, so the system has more flexibility

### Real-World Example

```
Social media comment system:
  Post → Comment → Reply to Comment

  All users must see: Post before Comment before Reply
  But two unrelated posts can appear in any order.
```

---

## 6. Read-Your-Writes Consistency

**A user always sees the effects of their own writes.** Other users might not see them yet (eventual), but the writer will always see their own updates.

### How It Works

```
  User A writes: profile.name = "Alice"
  User A reads:  profile.name → "Alice" ✅ (always sees own write)
  
  User B reads:  profile.name → "Bob"   (might still see old value)
                                          (will eventually see "Alice")
```

### Implementation Techniques

```
1. Read from the same node you wrote to
   → Session affinity / sticky sessions

2. Read from the master (for your own writes)
   → Route the writer's reads to the primary

3. Track write timestamps
   → If the replica hasn't caught up to your last write timestamp,
     read from the master instead
```

### Why It's Important

Without this guarantee, confusing experiences happen:

```
User updates their profile picture
→ Refreshes the page
→ Sees their OLD profile picture
→ Thinks the update didn't work
→ Tries again... and again...
→ Customer support ticket filed
```

---

## 7. Monotonic Read Consistency

**Once you've read a value, you won't see an older value on subsequent reads.** Your reads never "go backward in time."

### Without Monotonic Reads

```
Read 1 (from Replica A): score = 150  (latest)
Read 2 (from Replica B): score = 100  (behind, stale)

The user sees their score DROP from 150 to 100.
That's confusing and looks like a bug.
```

### With Monotonic Reads

```
Read 1 (from Replica A): score = 150
Read 2: System ensures you read from a replica that is
        at least as up-to-date as what you've already seen.
        → score = 150 or higher, never lower.
```

### Implementation

- Track the version/timestamp of the last value returned to each client
- On subsequent reads, only serve from replicas that are at least that fresh
- Or: always route the same user to the same replica (session stickiness)

---

## 8. Linearizability vs Serializability

These two terms are often confused. They're both about "consistency" but in different contexts.

### Linearizability (Single-Object, Real-Time)

- About **one object** (e.g., one row, one key)
- Guarantees: once a write completes, all subsequent reads see it
- Respects **real-time ordering** — if operation A finishes before B starts, A is visible to B
- This is what most people mean by "strong consistency"

### Serializability (Multi-Object, Transactions)

- About **transactions** (a group of operations on potentially multiple objects)
- Guarantees: concurrent transactions produce the same result as if they ran one-at-a-time
- This is the "I" (Isolation) in ACID
- Does NOT necessarily respect real-time ordering between transactions

### Strict Serializability (Both)

- Serializability + Linearizability
- Transactions are both serializable AND respect real-time ordering
- The strongest guarantee, and the most expensive
- Example: Google Spanner

---

## 9. Comparison Table

| Pattern | Guarantee | Latency | Throughput | Use Case |
|---------|-----------|---------|------------|----------|
| **Weak** | No guarantee | Lowest | Highest | VoIP, gaming, live streaming |
| **Eventual** | Will converge | Low | High | DNS, social feeds, analytics |
| **Causal** | Related ops ordered correctly | Medium | High | Comment threads, messaging |
| **Read-Your-Writes** | See your own writes | Medium | High | User profile updates |
| **Monotonic Reads** | Reads never go backward | Medium | High | Dashboards, score displays |
| **Strong** | Always see latest write | Higher | Lower | Banking, booking, inventory |
| **Linearizable** | Strong + real-time order | Highest | Lowest | Distributed locks, leader election |

---

## 10. Key Takeaways

1. **Not all data needs the same consistency.** A user's bank balance needs strong consistency; their social media feed does not.

2. **Eventual consistency** is the most common pattern at scale. It enables high availability and performance.

3. **The "consistency window"** in eventual consistency is usually milliseconds. For most applications, users don't notice.

4. **Read-your-writes** is a practical middle ground. Users see their own changes immediately while the rest of the system catches up.

5. **Strong consistency is expensive** — it requires synchronous replication which adds latency and reduces throughput.

6. **Choose the weakest consistency level that your business requirements allow.** Stronger consistency costs more in latency, throughput, and complexity.

7. **Many modern databases are tunable** — you can choose different consistency levels per query, mixing strong and eventual within the same system.

---

## 🔥 Senior Interview Questions

1. You're designing a social media "like" counter. Do you need strong consistency, eventual consistency, or something else? What if the counter is used to determine ad billing — does your answer change? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

2. Explain the difference between linearizability and serializability. Many engineers confuse them — when does each matter, and can you have one without the other? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

3. A user updates their profile photo and immediately refreshes the page but sees the old photo. Is this a bug or expected behavior? Which consistency model would prevent this, and at what cost? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

4. Your system uses eventual consistency with a replication lag of ~500ms. A downstream service reads stale data and makes a wrong decision. How do you architect around this without switching to strong consistency? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

5. Compare quorum-based consistency (R + W > N) with synchronous replication. When would you prefer one over the other? What are the failure modes of each? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

6. You need causal consistency for a messaging app (messages must appear in order). How would you implement this without strong consistency? Discuss vector clocks, Lamport timestamps, or hybrid logical clocks. [Answer](QnA-Answer-Key.md#4-consistency-patterns)

7. An interviewer asks you to design a distributed counter that is strongly consistent. Then they ask: "What if we need 100,000 increments per second?" Walk through why strong consistency at that scale is hard and what patterns (CRDTs, sharded counters) help. [Answer](QnA-Answer-Key.md#4-consistency-patterns)

8. Explain the "read-your-writes" consistency model. How would you implement it in a system with multiple read replicas? What happens if the user switches devices? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

9. You have a system where some operations (e.g., payments) need strong consistency and others (e.g., notifications) are fine with eventual. How do you architect a single system that supports both? [Answer](QnA-Answer-Key.md#4-consistency-patterns)

10. What is "monotonic read consistency" and why is it important? Describe a scenario where violating it causes user-visible bugs and how you'd fix it. [Answer](QnA-Answer-Key.md#4-consistency-patterns)

---

## 📚 Further Reading

- [Jepsen: Consistency Models](https://jepsen.io/consistency) — The definitive visual map of consistency models and their relationships.
- [Transactions Across Datacenters (Google I/O)](http://snarfed.org/transactions_across_datacenters_io.html) — Google's perspective on consistency trade-offs at massive scale.
- [Designing Data-Intensive Applications, Ch. 9 (Martin Kleppmann)](https://dataintensive.net/) — Deep dive into consistency and consensus (the gold standard reference).
