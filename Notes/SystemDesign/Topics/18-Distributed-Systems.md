# Distributed Systems

## Table of Contents

1. [Overview](#1-overview)
2. [Fallacies of Distributed Computing](#2-fallacies-of-distributed-computing)
3. [Consensus Algorithms](#3-consensus-algorithms)
4. [Leader Election](#4-leader-election)
5. [Distributed Transactions](#5-distributed-transactions)
6. [Clocks and Time](#6-clocks-and-time)
7. [Consistency Models Recap](#7-consistency-models-recap)
8. [Distributed Coordination](#8-distributed-coordination)
9. [Failure Modes](#9-failure-modes)
10. [Consistent Hashing](#10-consistent-hashing)
11. [Distributed Computing with MapReduce](#11-distributed-computing-with-mapreduce)
12. [Scatter-Gather Pattern](#12-scatter-gather-pattern)
13. [Key Takeaways](#13-key-takeaways)

---

## 1. Overview

A distributed system is a collection of independent computers that appears to its
users as a single coherent system. The machines communicate over a network, and the
network can be slow, unreliable, or partitioned.

### Why Distribute?

| Reason               | Description                                        |
|----------------------|----------------------------------------------------|
| Scalability          | Handle more load than any single machine can       |
| Availability         | Survive individual machine/datacenter failures     |
| Latency              | Place data/compute closer to users geographically  |
| Fault isolation      | Limit blast radius of failures                     |

### The Core Challenge

In a single-machine system, you have **shared memory** — everything can see the same
state. In distributed systems, each node has its own local state, and communicating
state changes happens over unreliable networks. This creates all the hard problems:
consensus, consistency, ordering, failure detection.

---

## 2. Fallacies of Distributed Computing

Peter Deutsch's 8 fallacies — assumptions architects mistakenly make:

| #  | Fallacy                              | Reality                                      |
|----|--------------------------------------|----------------------------------------------|
| 1  | The network is reliable              | Packets get lost, connections drop            |
| 2  | Latency is zero                      | Cross-datacenter: 30-100ms. Cross-continent: 100-300ms |
| 3  | Bandwidth is infinite                | Bandwidth is finite and expensive at scale    |
| 4  | The network is secure                | Always assume the network is hostile          |
| 5  | Topology doesn't change              | Servers, routes, and networks change constantly|
| 6  | There is one administrator           | Multiple teams, orgs, and tools manage the network |
| 7  | Transport cost is zero               | Serialization, encryption, routing have costs |
| 8  | The network is homogeneous           | Different hardware, OS, protocols coexist     |

**Design implication**: Always plan for network failures, latency, and partial failures.
Use timeouts, retries, circuit breakers, and idempotency everywhere.

---

## 3. Consensus Algorithms

Consensus = getting multiple nodes to **agree on a value** despite failures.

### Why Consensus Is Hard

```
Node A proposes value "X"
Node B proposes value "Y"
Node C is unreachable (crashed? slow? network partition?)

Which value wins? How do you know Node C is actually down?
Can you proceed with just A and B?
```

### Paxos (Classical Consensus)

The original consensus algorithm (Leslie Lamport, 1989). Two phases:

```
Phase 1: PREPARE
  Proposer ──[Prepare(n)]──► Acceptors
  Acceptors reply with any previously accepted value.
  
Phase 2: ACCEPT
  Proposer ──[Accept(n, value)]──► Acceptors
  If majority accept → value is chosen.
  
Key Insight: Requires a MAJORITY (quorum) to agree.
  3 nodes → need 2 (tolerates 1 failure)
  5 nodes → need 3 (tolerates 2 failures)
  2f+1 nodes → tolerates f failures
```

Paxos is correct but notoriously difficult to implement and understand.

### Raft (Understandable Consensus)

Raft was designed to be **easier to understand** than Paxos while providing
the same guarantees.

```
┌──────────────────────────────────────────┐
│            Raft Cluster (5 nodes)        │
│                                          │
│  ┌────────┐                              │
│  │ Leader │ ← All writes go here         │
│  └───┬────┘                              │
│      │ Replicate log entries             │
│  ┌───┼────────────┬──────────┐           │
│  │   │            │          │           │
│ ┌▼───┴──┐  ┌─────▼──┐  ┌───▼────┐      │
│ │Follower│  │Follower│  │Follower│      │
│ └────────┘  └────────┘  └────────┘      │
│                                          │
│  + 1 more Follower (5 total)             │
└──────────────────────────────────────────┘
```

**Raft's Three Sub-problems:**

#### 1. Leader Election

```
States: Follower → Candidate → Leader

All nodes start as Followers.

If a Follower doesn't hear from the Leader (heartbeat timeout):
  → Becomes Candidate
  → Increments term number
  → Votes for itself
  → Requests votes from other nodes
  → If gets majority votes → becomes Leader
  → If another node has higher term → steps down

Leader sends periodic heartbeats to maintain authority.
```

#### 2. Log Replication

```
Client: "SET x = 5"

Leader:
  1. Append to local log: [index=4, term=2, SET x=5]
  2. Send AppendEntries to all Followers
  3. Wait for majority to acknowledge
  4. Commit entry (now safe — majority has it)
  5. Apply to state machine
  6. Respond to client

Follower:
  1. Receive AppendEntries
  2. Append to local log
  3. Acknowledge to Leader
```

#### 3. Safety

- Only nodes with the most up-to-date log can become Leader.
- Committed entries are never lost (as long as majority is available).
- All nodes apply the same entries in the same order.

**Used by**: etcd, CockroachDB, TiDB, Consul, InfluxDB.

### Byzantine Fault Tolerance (BFT)

Raft and Paxos assume nodes are **honest** (crash-fault tolerant).
BFT handles **malicious** nodes that might lie or send conflicting messages.

```
Crash fault: Node stops responding.
Byzantine fault: Node actively sends wrong/conflicting information.

BFT requires: 3f+1 nodes to tolerate f Byzantine faults.
  4 nodes → tolerates 1 malicious node
  7 nodes → tolerates 2 malicious nodes

Used in: Blockchain (PBFT, Tendermint), some financial systems.
Rarely used in traditional distributed systems (too expensive).
```

---

## 4. Leader Election

Many distributed systems use a single leader/primary for coordination.
Electing a leader reliably is a consensus problem.

### Why Have a Leader?

- Simplifies ordering (leader orders all operations)
- Avoids conflicts (only one writer)
- Makes reasoning about the system easier

### Election Methods

| Method                  | Description                                              |
|-------------------------|----------------------------------------------------------|
| Raft/Paxos election     | Consensus-based, leader elected by majority vote         |
| Bully algorithm         | Highest-ID node becomes leader (simple, less robust)     |
| ZooKeeper/etcd lease    | Acquire a distributed lock; lock holder is the leader    |
| Database-based lock     | `SELECT ... FOR UPDATE` on a leader row                  |
| AWS/Cloud built-in      | Use cloud primitives (DynamoDB lock table, etc.)         |

### Lease-Based Leader Election

```
Leader Election with ZooKeeper/etcd:

1. All candidates try to create an ephemeral node "/leader"
2. Only one succeeds → that node is the leader
3. Others watch "/leader" for changes
4. Leader sends periodic heartbeats (renews lease)
5. If leader crashes:
   → Ephemeral node is deleted (session timeout)
   → Watchers are notified
   → New election begins

Leader ──[lease: 30s]──► etcd/ZooKeeper
          │
          │ Renew every 10s
          │
          └── If not renewed within 30s → lease expires → new election
```

### Split-Brain

The most dangerous failure mode in leader election:

```
Network Partition:
  ┌────────────────┐         ┌────────────────┐
  │  DC A          │    X    │  DC B          │
  │  Leader (old)  │ ◄─X─►  │  Leader (new) │
  │  Followers     │    X    │  Followers     │
  └────────────────┘         └────────────────┘
  
Both sides think they're the leader → data divergence!

Prevention:
  1. Quorum: Leader can only operate if it can reach majority
  2. Fencing tokens: Each leader gets an incrementing token.
     Resources only accept writes from the latest token.
  3. Odd number of nodes: 3 or 5 nodes, not 2 or 4.
```

---

## 5. Distributed Transactions

How do you ensure atomicity across multiple services/databases?

### Two-Phase Commit (2PC)

```
Phase 1: PREPARE (voting)
  Coordinator ──[Prepare?]──► Participant A  → "Yes, I can commit"
               ──[Prepare?]──► Participant B  → "Yes, I can commit"
               ──[Prepare?]──► Participant C  → "Yes, I can commit"

Phase 2: COMMIT (or ROLLBACK)
  If ALL voted yes:
    Coordinator ──[Commit]──► A, B, C  → All commit
  If ANY voted no:
    Coordinator ──[Rollback]──► A, B, C  → All rollback
```

**Problem**: If the coordinator crashes between Phase 1 and Phase 2,
participants are stuck — they've locked resources but don't know whether
to commit or rollback. This is the **blocking problem** of 2PC.

**Used by**: Databases (XA transactions), some enterprise middleware.

### Three-Phase Commit (3PC)

Adds a "pre-commit" phase to reduce blocking, but doesn't fully solve it
and is rarely used in practice.

### Saga Pattern

Instead of a distributed transaction, use a sequence of local transactions
with compensating actions for rollback.

```
Order Saga (Choreography):

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Order   │───►│ Inventory│───►│ Payment  │───►│ Shipping │
│ Service  │    │ Service  │    │ Service  │    │ Service  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
 Create order   Reserve items   Charge card     Create shipment

If Payment fails:
  ← Cancel order   ← Release items  ← Refund        (compensating actions)
```

```
Order Saga (Orchestration):

              ┌─────────────────┐
              │ Saga Orchestrator│
              └────────┬────────┘
                       │
      ┌────────────────┼────────────────┐
      │                │                │
  ┌───▼──────┐   ┌────▼─────┐   ┌─────▼────┐
  │ Order    │   │Inventory │   │ Payment  │
  │ Service  │   │ Service  │   │ Service  │
  └──────────┘   └──────────┘   └──────────┘

  Orchestrator tells each service what to do (step by step).
  On failure, orchestrator calls compensating actions.
```

### Saga vs 2PC

| Feature              | 2PC                        | Saga                         |
|----------------------|----------------------------|------------------------------|
| Consistency          | Strong (ACID)              | Eventual                     |
| Coupling             | Tight (all in same tx)     | Loose (independent services) |
| Performance          | Lower (lock held across services) | Higher (no distributed lock) |
| Complexity           | Simpler logic              | Compensating actions are complex |
| Failure handling     | Coordinator is SPOF        | Each step can fail independently |
| Isolation            | Guaranteed                 | Not guaranteed (intermediate states visible) |

### Outbox Pattern (for Reliable Event Publishing)

Ensures the database write and the event publish happen atomically:

```
┌────────────────────────────────────┐
│       Single DB Transaction        │
│                                    │
│  INSERT INTO orders (...) ...      │
│  INSERT INTO outbox (event_data) ...│
│                                    │
│  COMMIT                            │
└────────────────────┬───────────────┘
                     │
         ┌───────────▼────────────┐
         │  Outbox Poller / CDC   │
         │  (reads outbox table,  │
         │   publishes to Kafka)  │
         └───────────┬────────────┘
                     │
              ┌──────▼──────┐
              │   Kafka     │
              └─────────────┘
```

---

## 6. Clocks and Time

### The Problem with Clocks

Physical clocks on different machines are **never perfectly synchronized**.
NTP (Network Time Protocol) can synchronize to within milliseconds, but not
microseconds or nanoseconds.

```
Machine A clock: 10:00:00.001
Machine B clock: 10:00:00.003
Machine C clock: 09:59:59.999

If Event X happens on A at 10:00:00.001
And Event Y happens on B at 10:00:00.002

Did X happen before Y? We can't be sure!
The clocks might be off by more than 1ms.
```

### Logical Clocks (Lamport Timestamps)

Instead of using physical time, track **causal order** with incrementing counters.

```
Rules:
  1. Before sending, increment counter: C = C + 1
  2. When sending, include C in the message
  3. On receiving, set C = max(local_C, received_C) + 1

Process A          Process B          Process C
  C=1 ─────────►                      
       event         C=2              
                     │                
                     └────────────► C=3
                                     │
  C=4 ◄────────────────────────────┘

If C(a) < C(b) → a MIGHT have happened before b
If C(a) > C(b) → a did NOT happen before b
If C(a) == C(b) → concurrent events (no causal relationship)
```

Lamport timestamps give **partial ordering** but can't distinguish
concurrent events.

### Vector Clocks

Each process maintains a vector of counters (one per process).

```
Process A         Process B         Process C
[1,0,0]           [0,0,0]           [0,0,0]

A sends to B:
[1,0,0] ─────►    [1,1,0]           [0,0,0]

B sends to C:
                   [1,1,0] ─────►   [1,1,1]

A does local event:
[2,0,0]            [1,1,0]          [1,1,1]

Comparing [2,0,0] and [1,1,1]:
  A[0] > C[0], but A[1] < C[1] and A[2] < C[2]
  → These events are CONCURRENT (neither happened before the other)
```

**Vector clocks can detect concurrent events** (Lamport timestamps cannot).
Used by: Dynamo, Riak for conflict detection.

### Hybrid Logical Clocks (HLC)

Combines physical time with logical counters to get the best of both worlds.

```
HLC = (physical_time, logical_counter)

Event 1 on A at T=100: HLC = (100, 0)
Event 2 on A at T=100: HLC = (100, 1)  ← same physical time, increment logical
Event 3 on B receives from A: HLC = (max(B_time, 100), 0) if B_time > 100
                                   = (100, 2) if B_time <= 100
```

Used by: CockroachDB, MongoDB, YugabyteDB.

### Google TrueTime

Google's approach: instead of pretending clocks are perfect, **quantify the
uncertainty**.

```
TrueTime API:
  TT.now() → (earliest, latest)  — returns a time interval
  
  Example: TT.now() → (10:00:00.001, 10:00:00.005)
  "The actual time is somewhere in this 4ms interval."

Spanner uses TrueTime:
  After committing a transaction at time T:
  Wait until TT.now().earliest > T (the "commit wait")
  This guarantees that all subsequent transactions see this one as in the past.
  
  Result: External consistency (linearizability) across the globe!
  Cost: Each commit has a ~7ms wait (Google syncs clocks with atomic clocks + GPS).
```

---

## 7. Consistency Models Recap

Quick reference (detailed in 04-Consistency-Patterns.md):

```
Strongest ──────────────────────────────── Weakest
    ▼                                          ▼
Linearizable → Sequential → Causal → Eventual

Linearizable: Reads see the most recent write. As if one copy.
              Used by: Spanner, single-node DBs.

Sequential:   All nodes see the same order of operations.
              Operations from one client preserve order.

Causal:       If A causes B, everyone sees A before B.
              Concurrent events may be seen in any order.
              Used by: MongoDB (configurable).

Eventual:     All replicas converge to the same value... eventually.
              Used by: DynamoDB, Cassandra.
```

### Real-World Consistency Choices

| System            | Default Consistency     | Can Be Tuned?         |
|-------------------|-------------------------|-----------------------|
| PostgreSQL        | Serializable available  | Yes (isolation levels)|
| MySQL             | Repeatable Read         | Yes                   |
| MongoDB           | Eventual                | Yes (read/write concern)|
| Cassandra         | Eventual                | Yes (quorum reads/writes)|
| DynamoDB          | Eventual                | Yes (strongly consistent reads)|
| Redis             | Eventual (async replication) | No (use Redis Cluster for better) |
| CockroachDB       | Serializable            | No (always serializable)|
| Google Spanner     | Linearizable            | No (always linearizable)|

---

## 8. Distributed Coordination

### ZooKeeper

ZooKeeper is a centralized service for distributed coordination.

```
Uses:
  - Leader election (ephemeral znodes)
  - Configuration management (watch for changes)
  - Distributed locks (sequential ephemeral znodes)
  - Service discovery (register services as znodes)
  - Cluster membership (track which nodes are alive)

Znode hierarchy (like a filesystem):
  /
  ├── /config
  │   ├── /config/database_url
  │   └── /config/feature_flags
  ├── /leader
  │   └── (ephemeral node — current leader)
  ├── /locks
  │   └── /locks/resource_x
  └── /services
      ├── /services/user-service/instance-1
      └── /services/user-service/instance-2
```

### etcd

Similar to ZooKeeper but simpler and based on Raft consensus.

```
Key-value store with:
  - Strong consistency (Raft consensus)
  - Watch API (get notified of changes)
  - Leases (keys with TTL — for leader election)
  - Transactions (compare-and-swap)

Used by: Kubernetes (stores all cluster state), CoreDNS.
```

### Distributed Locking

```python
# Redis distributed lock (Redlock algorithm conceptually)
import redis
import uuid
import time

def acquire_lock(lock_name, timeout=10):
    lock_id = str(uuid.uuid4())
    key = f"lock:{lock_name}"
    
    # SET if Not eXists, with TTL
    if redis_client.set(key, lock_id, ex=timeout, nx=True):
        return lock_id  # Lock acquired
    return None  # Lock held by someone else

def release_lock(lock_name, lock_id):
    # Only release if we own the lock (Lua script for atomicity)
    lua = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
    return 0
    """
    redis_client.eval(lua, 1, f"lock:{lock_name}", lock_id)

# Usage
lock_id = acquire_lock("process-payments")
if lock_id:
    try:
        process_payments()
    finally:
        release_lock("process-payments", lock_id)
```

**Warning**: Distributed locks are tricky. If a process holds a lock and gets paused
(GC pause, network delay), the lock may expire and another process can acquire it.
Use **fencing tokens** to detect stale lock holders.

---

## 9. Failure Modes

### Types of Failures

| Failure Type          | Description                                      | Example                    |
|-----------------------|--------------------------------------------------|----------------------------|
| Crash failure         | Node stops and doesn't recover                   | Hardware failure, OOM kill |
| Omission failure      | Node fails to send or receive messages            | Network packet loss        |
| Timing failure        | Node responds too slowly                         | GC pause, overloaded node  |
| Byzantine failure     | Node behaves arbitrarily (even maliciously)       | Bug, corrupted data, hack  |

### Failure Detection

You can never be **sure** a remote node has failed. It might just be slow.

```
Heartbeat-based detection:
  Node A ──[heartbeat]──► Monitor
  Node A ──[heartbeat]──► Monitor
  Node A ──────────────── (nothing for 30 seconds)
                          Monitor: "A might be down"
                          
  But A might just be:
    - Experiencing a GC pause
    - Network is congested
    - Temporarily overloaded
```

**Phi Accrual Failure Detector** (used by Cassandra, Akka):
Instead of binary "alive/dead", outputs a suspicion level (phi).
Higher phi = higher suspicion of failure. Adaptive to network conditions.

### Handling Partial Failures

```
Strategy 1: Retry with backoff
  → For transient failures (network blip, temporary overload)

Strategy 2: Circuit breaker
  → Stop calling a failing service, fail fast

Strategy 3: Fallback
  → Return cached/default data when a service is down

Strategy 4: Bulkhead
  → Isolate failures so one failing service doesn't bring down everything

Strategy 5: Timeout
  → Never wait indefinitely. Always have a deadline.
```

---

## 10. Consistent Hashing

Consistent hashing solves the problem of distributing data across a dynamic set
of nodes where nodes can be added or removed without remapping all keys.

### The Problem with Simple Hashing

```
Simple approach: hash(key) % N  (N = number of nodes)

3 nodes: hash("user:123") % 3 = 1  → Node 1
         hash("user:456") % 3 = 0  → Node 0
         hash("user:789") % 3 = 2  → Node 2

Add a 4th node (N changes from 3 to 4):
         hash("user:123") % 4 = ?  → Different node!
         hash("user:456") % 4 = ?  → Different node!
         hash("user:789") % 4 = ?  → Different node!

Almost ALL keys get remapped → massive cache misses, data migration storm.
```

### The Hash Ring

Instead of modulo, map both nodes and keys onto a **circular hash space** (ring).

```
Hash space: 0 ────────────────────────────────► 2^32 (wraps around)

Ring visualization (0 at top, clockwise):

                  0
                  │
           ┌──────┼──────┐
          /       │       \
         /    key:xyz      \
        │     ↓             │
  Node D ●                  ● Node A
        │                   │
        │         ● key:abc │
        │         ↓         │
  Node C ●──────────────── ● Node B
         \                /
          \              /
           └────────────┘

Rule: Each key is assigned to the FIRST node encountered
      moving CLOCKWISE from the key's position on the ring.

  key:xyz → Node A (next clockwise node)
  key:abc → Node B (next clockwise node)
```

### Adding and Removing Nodes

```
ADDING a node (Node E between C and D):

Before: Keys in arc C→D are served by D.
After:  Only keys in arc C→E move to E.
        Keys in arc E→D stay at D.
        ALL OTHER KEYS are unaffected.

         Before                    After
    D ●────────● A            D ●────────● A
      │        │                │        │
      │        │              E ●        │
      │        │                │        │
    C ●────────● B            C ●────────● B

Fraction of keys remapped: ~1/N  (only 1 node's worth of keys move)
vs simple hashing:         ~(N-1)/N  (almost everything moves)

REMOVING a node (Node B goes down):

  Only keys that were on Node B → move to the next clockwise node (Node A).
  All other keys stay put.
```

### Virtual Nodes (VNodes)

Problem: With only a few physical nodes on the ring, the distribution can be
very **uneven** — one node might own 60% of the ring, another only 10%.

```
Solution: Each physical node gets MULTIPLE positions on the ring (virtual nodes).

Physical Node A → vnodes: A0, A1, A2, A3, A4, ... A149
Physical Node B → vnodes: B0, B1, B2, B3, B4, ... B149
Physical Node C → vnodes: C0, C1, C2, C3, C4, ... C149

Ring with 150 vnodes per physical node (450 total points):

       B42  A12  C87  A91  B7  C23  A150  C44  B99  ...
         │    │    │    │   │    │     │     │    │
         ▼    ▼    ▼    ▼   ▼    ▼     ▼     ▼    ▼
    ●────●────●────●────●────●────●─────●────●────●──► (ring)

Benefits:
  1. Much more even distribution (statistical averaging)
  2. When a node goes down, its load spreads across ALL remaining nodes
     (not just one neighbor)
  3. Heterogeneous hardware: powerful nodes get more vnodes
```

### Node Failure Impact

```
Without virtual nodes:
  Node B dies → ALL of B's keys go to Node C (the next clockwise neighbor)
  Node C's load doubles!

With virtual nodes (150 per node, 3 physical nodes):
  Node B dies → B's 150 vnodes' keys spread across A and C
  Each of A and C absorbs ~50% of B's load
  Much more balanced redistribution!

Cache hit rate impact:
  Before failure: 100% hit rate (all cached)
  After failure:  ~(N-1)/N keys still cached = 66.7% for 3 nodes
                  Only keys belonging to the failed node are lost
```

### Consistent Hashing in Practice

| System         | Usage                                    | VNodes?  |
|----------------|------------------------------------------|----------|
| Cassandra      | Partition data across nodes              | Yes (256 default, tunable) |
| DynamoDB       | Partition key-value data                 | Yes      |
| Memcached      | Distribute cache keys across servers     | Client-dependent |
| Akamai CDN     | Map URLs to edge servers                 | Yes      |
| Redis Cluster  | Hash slots (16384 slots = similar concept)| Hash slots |
| Apache Kafka   | Partition assignment                     | No (range-based) |

### Replication with Consistent Hashing

```
Replication factor = 3 (store data on 3 consecutive nodes):

  Key hashes to position X on ring.
  Stored on:
    1. First node clockwise from X  (primary)
    2. Second node clockwise from X (replica 1)
    3. Third node clockwise from X  (replica 2)

  With virtual nodes, ensure replicas are on DIFFERENT physical nodes
  (skip vnodes belonging to the same physical node).
```

### Trade-offs

| Advantage                                  | Disadvantage                                   |
|--------------------------------------------|------------------------------------------------|
| Minimal key redistribution on add/remove   | More complex than simple modulo hashing         |
| Load balances well with virtual nodes      | Virtual node metadata has memory overhead       |
| Supports heterogeneous node capacities     | Range queries are difficult (keys are scattered)|
| Works well with replication strategies     | Hash function choice affects distribution       |

---

## 11. Distributed Computing with MapReduce

MapReduce is a programming model for processing large datasets in parallel
across a cluster of machines. Introduced by Google in 2004, it became the
foundation for Hadoop and influenced all subsequent big data processing
frameworks.

### Core Concept

```
The entire computation is broken into two user-defined functions:

  map(key, value)    → list of (intermediate_key, intermediate_value)
  reduce(inter_key, list_of_inter_values) → list of (output_key, output_value)

The framework handles EVERYTHING else:
  - Parallelization across machines
  - Data distribution and locality
  - Fault tolerance and retries
  - Shuffle and sort of intermediate data
```

### Architecture: Master-Worker Model

```
┌─────────────────────────────────────────────────────────┐
│                     Master (JobTracker)                  │
│  - Splits input into M map tasks and R reduce tasks     │
│  - Assigns tasks to idle workers                        │
│  - Monitors worker health (heartbeats)                  │
│  - Handles worker failures (reassign tasks)             │
└───────────┬───────────────────────┬─────────────────────┘
            │                       │
    ┌───────▼───────┐       ┌───────▼───────┐
    │  Map Workers  │       │ Reduce Workers│
    │               │       │               │
    │ W1  W2  W3    │       │ W4  W5  W6    │
    │ ↓   ↓   ↓     │       │ ↑   ↑   ↑     │
    │ Input Splits  │       │               │
    └───────────────┘       └───────────────┘

Data flow:
  Input (HDFS/GFS) → Map → Shuffle & Sort → Reduce → Output (HDFS/GFS)
```

### Execution Flow (Detailed)

```
Step 1: INPUT SPLITTING
  Input file (e.g., 1 TB) is split into chunks (64-128 MB each).
  Each chunk = one Map task.
  1 TB file → ~8,000 map tasks (128 MB splits)

Step 2: MAP PHASE (parallel)
  Each mapper reads its input split from LOCAL disk (data locality).
  Applies user's map() function to each record.
  Writes intermediate key-value pairs to local disk (partitioned by reduce task).

  Example (word count):
    Input split: "to be or not to be"
    Mapper emits: (to,1) (be,1) (or,1) (not,1) (to,1) (be,1)

Step 3: SHUFFLE & SORT (framework handles this)
  Intermediate data is partitioned: hash(key) % R → determines which reducer.
  Data is transferred over the network to reduce workers.
  Sorted by key at each reducer.

  Reducer 0 gets: (be, [1,1])  (not, [1])
  Reducer 1 gets: (or, [1])   (to, [1,1])

Step 4: REDUCE PHASE (parallel)
  Each reducer calls user's reduce() function for each unique key.
  Writes final output to distributed filesystem.

  reduce("be", [1,1]) → ("be", 2)
  reduce("to", [1,1]) → ("to", 2)
  reduce("or", [1])   → ("or", 1)

Step 5: OUTPUT
  R output files (one per reducer) written to HDFS/GFS.
```

### Fault Tolerance

```
WORKER FAILURE:
  Master pings workers periodically (heartbeats).
  If a worker doesn't respond within timeout:
    - Completed MAP tasks on that worker: RE-EXECUTE
      (output was on local disk, now inaccessible)
    - Completed REDUCE tasks: NO re-execute
      (output is on distributed filesystem, safe)
    - In-progress tasks: RE-ASSIGN to another worker

MASTER FAILURE:
  Original Google implementation: abort and restart.
  Hadoop: checkpoint master state, secondary NameNode takes over.

STRAGGLERS (slow workers):
  Near the end of a job, master launches BACKUP TASKS
  for remaining in-progress tasks.
  First copy to finish wins (speculative execution).
  Typically reduces job completion time by 30-40%.
```

### Data Locality Optimization

```
Key insight: Move COMPUTATION to DATA, not data to computation.

Scheduler attempts to assign Map tasks to machines that have the
input data on their local disk (or same rack):

  Priority 1: Same machine as the data → zero network transfer
  Priority 2: Same rack as the data    → intra-rack bandwidth
  Priority 3: Different rack           → cross-rack bandwidth (slowest)

With 3-way replication (HDFS), there's a 3× higher chance of
finding a local machine for each split.
```

### Common MapReduce Patterns

```
1. FILTERING / GREP
   Map:    emit record if it matches the pattern
   Reduce: identity (just output)

2. COUNTING / AGGREGATION
   Map:    emit (key, 1) for each occurrence
   Reduce: sum the values for each key

3. SORTING
   Map:    emit (sort_key, record)
   Reduce: identity (shuffle & sort does the work)

4. INVERTED INDEX
   Map:    for each word in document, emit (word, doc_id)
   Reduce: for each word, collect list of doc_ids

5. JOIN (Reduce-side)
   Map:    tag each record with its source table, emit (join_key, tagged_record)
   Reduce: for each join_key, combine records from different tables
```

### MapReduce Limitations and Evolution

| Limitation                          | Modern Solution                       |
|-------------------------------------|---------------------------------------|
| Writes intermediate data to disk    | Spark: in-memory RDDs (100x faster)   |
| Only Map and Reduce operations      | Spark: map, filter, join, group, etc. |
| No iterative computation support    | Spark: cache datasets across iterations|
| High latency (batch only)           | Flink/Spark Streaming: near real-time |
| Complex multi-stage pipelines       | Spark DAG optimizer, Tez              |
| Java-centric API                    | Spark: Python, Scala, R, SQL support  |

### MapReduce vs Spark

```
MapReduce (Hadoop):
  Read from HDFS → Map → Write to disk → Read from disk → Reduce → Write to HDFS
  SLOW for iterative algorithms (each iteration = full disk I/O cycle)

Spark:
  Read from HDFS → Transform → Transform → ... → Action → Write to HDFS
  Keep intermediate data IN MEMORY (RDDs/DataFrames)
  10-100x faster for iterative algorithms (ML, graph processing)

  BUT: Spark needs more RAM and can OOM on very large datasets.
  MapReduce is more robust for extremely large batch jobs on cheap hardware.
```

---

## 12. Scatter-Gather Pattern

Scatter-gather is a distributed computing pattern where a request is broadcast
("scattered") to multiple nodes in parallel, and the results are aggregated
("gathered") by a coordinator.

### How It Works

```
Client Request
      │
      ▼
┌─────────────┐
│ Coordinator │
│ (Scatter)   │
└──────┬──────┘
       │
  ┌────┼────────────┐
  │    │             │
  ▼    ▼             ▼
┌───┐ ┌───┐      ┌───┐
│ N1│ │ N2│ ...  │ Nn│   ← Each node processes in parallel
└─┬─┘ └─┬─┘      └─┬─┘
  │    │             │
  └────┼─────────────┘
       │
       ▼
┌─────────────┐
│ Coordinator │
│ (Gather)    │   ← Merge/aggregate results
└──────┬──────┘
       │
       ▼
  Final Response
```

### Real-World Examples

```
1. DISTRIBUTED SEARCH (Elasticsearch, Solr)
   Query: "system design interview"
   Scatter: Send query to all 10 shards
   Each shard: Returns top 10 matching documents (local ranking)
   Gather: Merge 100 results, re-rank globally, return top 10

2. SHARDED DATABASE QUERY (CockroachDB, Vitess)
   Query: SELECT * FROM orders WHERE total > 1000
   Scatter: Send query to all shards
   Each shard: Returns matching rows
   Gather: Combine results from all shards

3. AGGREGATION QUERIES
   Query: SELECT country, COUNT(*) FROM users GROUP BY country
   Scatter: Each shard computes local counts per country
   Gather: Sum counts across shards for each country

4. FAN-OUT ON READ (Twitter Timeline)
   User opens timeline
   Scatter: Fetch recent tweets from each user they follow
   Gather: Merge and sort by timestamp, return top N

5. PRICE COMPARISON / API AGGREGATION
   User searches for flights
   Scatter: Query 20 airline APIs in parallel
   Gather: Collect prices, deduplicate, sort by price
```

### Implementation Considerations

```
TIMEOUT HANDLING:
  Don't wait forever for the slowest node.

  Strategy 1: Fixed timeout
    Wait max 200ms. Return whatever results you have.
    Fast and predictable, but may miss slow-shard results.

  Strategy 2: Deadline with minimum
    Wait until min(deadline, all_responses_received).
    Return partial results if some nodes timeout.

  Strategy 3: Quorum
    Return once K out of N nodes respond (e.g., 8 of 10 shards).
    Trades completeness for latency.

PARTIAL FAILURES:
  Node 3 of 10 is down. Options:
    a) Return partial results (with a warning: "results may be incomplete")
    b) Retry the failed shard
    c) Query a replica of the failed shard
    d) Fail the entire request (safest but worst UX)

TAIL LATENCY:
  The curse of scatter-gather: response time = MAX(all node times)
  If each node has p99 = 50ms:
    10 shards: p99 ≈ 90-100ms (the slowest shard dominates)
    100 shards: p99 can spike dramatically

  Mitigation:
    - Hedged requests: send duplicate request to a second replica
      after short delay, take whichever responds first
    - Limit the number of shards queried (use routing/partitioning)
    - Cache popular queries at the coordinator level
```

### Scatter-Gather vs Other Patterns

| Pattern              | Description                              | When to Use                            |
|----------------------|------------------------------------------|----------------------------------------|
| Scatter-Gather       | Broadcast to all, merge results          | Queries spanning all shards/partitions |
| Request-Response     | Single request to one node               | Key-based lookups (known partition)    |
| Map-Reduce           | Multi-phase batch computation            | Large-scale batch processing           |
| Fan-Out/Fan-In       | Async version of scatter-gather          | Event-driven, non-blocking systems     |
| Saga                 | Sequential steps with compensation       | Multi-step transactions across services|

### Performance Analysis

```
N = number of nodes, L = per-node latency

Serial approach:    Total latency = N × L
Scatter-Gather:     Total latency = max(L₁, L₂, ..., Lₙ) + merge_overhead
                    ≈ L + tail_latency_factor

Speedup: ~N× for CPU-bound work
         Less than N× due to:
           - Network overhead of scatter/gather
           - Merge/aggregation cost at coordinator
           - Tail latency from slowest node
           - Coordinator becomes a bottleneck at scale

Optimization: Multi-level scatter-gather (tree topology)
  ┌──── Level 1 Coordinator ────┐
  │              │               │
  ▼              ▼               ▼
Level-2 Coord  Level-2 Coord  Level-2 Coord
  │  │  │        │  │  │        │  │  │
  ▼  ▼  ▼        ▼  ▼  ▼        ▼  ▼  ▼
 Workers        Workers        Workers

  Reduces coordinator bottleneck for very large clusters.
  Used by: Google (multi-level scatter-gather in web search)
```

---

## 13. Key Takeaways

### Golden Rules

1. **Everything fails in distributed systems.** Design for failure, not just success.
2. **Use Raft/Paxos-based systems** (etcd, ZooKeeper, Consul) for coordination.
   Don't implement consensus yourself unless you really know what you're doing.
3. **Prefer Saga over 2PC** for distributed transactions between microservices.
4. **Physical clocks are unreliable** across machines. Use logical clocks or
   systems that account for clock skew (HLC, TrueTime).
5. **Quorum = majority**. For N nodes, need N/2 + 1 to agree. Use odd numbers.
6. **Split-brain is the worst failure.** Prevent it with quorums and fencing tokens.
7. **Distributed locks are not as safe as you think.** Always use fencing tokens
   and lease-based TTLs.
8. **The CAP theorem is a starting point**, not an excuse. Most systems make nuanced
   trade-offs, not binary CP vs AP choices.

### Quick Reference

```
Consensus:     Raft (understandable) or Paxos (classical)
Coordination:  etcd, ZooKeeper, Consul
Transactions:  Saga pattern (preferred) or 2PC (databases)
Time:          Lamport (partial order), Vector (concurrent detection),
               HLC (hybrid), TrueTime (Google Spanner)
Failures:      Timeouts, retries, circuit breakers, bulkheads
Locking:       Redis Redlock, etcd leases, ZooKeeper recipes
Hashing:       Consistent hashing + virtual nodes for data distribution
Computation:   MapReduce (batch), Spark (in-memory), Flink (streaming)
Querying:      Scatter-gather for cross-partition queries
```

---

## 🔥 Senior Interview Questions

1. Explain the Raft consensus algorithm step by step: leader election, log replication, and safety. What happens during a network partition where two nodes both think they're the leader (split-brain)? [Answer](QnA-Answer-Key.md#18-distributed-systems)

2. You're designing a distributed lock service. Compare Redis Redlock vs ZooKeeper ephemeral nodes vs etcd leases. Martin Kleppmann wrote a famous critique of Redlock — what are his arguments, and does Antirez's rebuttal address them? [Answer](QnA-Answer-Key.md#18-distributed-systems)

3. Your microservices system needs to execute a distributed transaction: debit Account A → credit Account B → send notification. Implement this using the Saga pattern (both choreography and orchestration). What are the compensating transactions for each step? [Answer](QnA-Answer-Key.md#18-distributed-systems)

4. Explain the Two Generals' Problem and the FLP impossibility result. What do they tell us about the fundamental limits of distributed computing? How do practical systems (like Raft) work despite these theoretical impossibilities? [Answer](QnA-Answer-Key.md#18-distributed-systems)

5. You're using consistent hashing for your cache cluster. A node goes down. Walk through what happens: which keys are affected, how are they redistributed, and what's the impact on cache hit rate? How do virtual nodes improve the distribution? [Answer](QnA-Answer-Key.md#18-distributed-systems)

6. Compare Lamport timestamps, vector clocks, and hybrid logical clocks. You're building a collaborative editing system where operations can happen concurrently on different servers. Which clock mechanism do you need and why? [Answer](QnA-Answer-Key.md#18-distributed-systems)

7. An interviewer asks you to design a distributed counter that's eventually consistent but can handle 1 million increments per second across 10 data centers. Discuss CRDTs (specifically G-Counter and PN-Counter), gossip protocols, and anti-entropy mechanisms. [Answer](QnA-Answer-Key.md#18-distributed-systems)

8. Your system has a distributed lock, and the process holding the lock dies without releasing it. How do you handle this? Discuss TTL-based expiration, fencing tokens, and the dangers of relying on timeouts in distributed systems. [Answer](QnA-Answer-Key.md#18-distributed-systems)

9. Explain the Byzantine Generals' Problem. In what real-world systems (beyond blockchain) do you need Byzantine fault tolerance? Why don't most systems bother with it? [Answer](QnA-Answer-Key.md#18-distributed-systems)

10. You're designing a globally distributed database like Google Spanner. How does Spanner achieve external consistency (linearizability) across data centers? Explain TrueTime, commit-wait, and why atomic clocks and GPS receivers are essential to the design. [Answer](QnA-Answer-Key.md#18-distributed-systems)

---

## 📚 Further Reading

- [Designing Data-Intensive Applications by Martin Kleppmann](https://dataintensive.net/) — The gold-standard reference for distributed systems concepts.
- [The Raft Consensus Algorithm (Visualization)](https://raft.github.io/) — Interactive visualization of Raft leader election and log replication.
- [Distributed Systems Lecture Series (Martin Kleppmann, YouTube)](https://www.youtube.com/playlist?list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB) — University-level lectures covering clocks, consensus, and replication.
