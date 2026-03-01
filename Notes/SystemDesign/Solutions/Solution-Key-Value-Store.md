# Design a Key-Value Store

A key-value store (KV store) is a non-relational database where data is stored as key-value pairs. Examples include Redis, DynamoDB, Cassandra, and Memcached. This design focuses on building a **distributed** key-value store that supports high availability, scalability, and tunable consistency — similar to Amazon DynamoDB or Apache Cassandra.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What's the size of key-value pairs?  
**Interviewer:** Keys are < 256 bytes, values are < 10 KB.

**Candidate:** Do we need strong consistency or is eventual consistency acceptable?  
**Interviewer:** Support tunable consistency — let the client choose.

**Candidate:** What are the main operations?  
**Interviewer:** `put(key, value)` and `get(key)`. No complex queries.

**Candidate:** How many nodes in the cluster?  
**Interviewer:** Start with 20 nodes, scale to hundreds.

**Candidate:** What happens during network partitions?  
**Interviewer:** Prioritize availability (AP system) but support strong consistency mode.

### Functional Requirements

- `put(key, value)` — Insert or update a key-value pair
- `get(key)` → value — Retrieve value by key
- `delete(key)` — Remove a key-value pair
- Tunable consistency (strong, eventual, quorum)

### Non-Functional Requirements

- **Scalability:** Automatic horizontal scaling by adding nodes
- **Availability:** System works even with node failures
- **Partition tolerance:** Handles network partitions (CAP theorem: AP or CP)
- **Low latency:** < 10 ms for reads and writes
- **Durability:** Data must not be lost after acknowledged write

### Back-of-the-Envelope Estimation

- 100M key-value pairs
- Average key: 50 bytes, average value: 5 KB → 5 KB per record
- Total data: 100M × 5 KB = 500 GB
- With replication factor 3: 1.5 TB
- Read/Write: 100K QPS each
- 20 nodes: ~50K QPS per node, ~75 GB data per node

---

## Step 2 — High-Level Design

### Core Architecture

```
┌──────────────────────────────────────────────────┐
│              Distributed KV Store                 │
│                                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │Node 1│  │Node 2│  │Node 3│  │Node N│   ...    │
│  │      │  │      │  │      │  │      │          │
│  │ Data │  │ Data │  │ Data │  │ Data │          │
│  │Shard │  │Shard │  │Shard │  │Shard │          │
│  └──────┘  └──────┘  └──────┘  └──────┘          │
│                                                   │
│  Key → hash(key) → consistent hash ring → node   │
│                                                   │
│  Each key replicated on N nodes (N=3 default)     │
└──────────────────────────────────────────────────┘
```

### API Design

```
PUT /kv/{key}
  Body: { "value": "...", "consistency": "quorum" }
  Response: { "version": 42, "timestamp": "..." }

GET /kv/{key}?consistency=quorum
  Response: { "key": "k1", "value": "...", "version": 42 }

DELETE /kv/{key}
  Response: 204 No Content
```

---

## Step 3 — Design Deep Dive

### Data Partitioning: Consistent Hashing

The fundamental question: given a key, which node stores it?

```
Simple hash: node = hash(key) % N
  Problem: Adding/removing a node rehashes EVERYTHING

Consistent Hashing:
  - Arrange hash space as a ring (0 to 2^128)
  - Each node is assigned a position on the ring
  - Each key is hashed → walk clockwise to find the first node
  - Adding/removing a node only affects neighboring keys

  Ring:
       Node A (pos 0)
      /              \
  Node D (pos 270)    Node B (pos 90)
      \              /
       Node C (pos 180)

  Key "user:123" → hash = 50 → lands between A(0) and B(90) → stored on B
```

**Virtual Nodes (vnodes):**
```
Problem: With few physical nodes, data distribution is uneven.
Solution: Each physical node gets multiple virtual positions on the ring.

  Physical Node A → vnode_A1 (pos 10), vnode_A2 (pos 120), vnode_A3 (pos 250)
  Physical Node B → vnode_B1 (pos 50), vnode_B2 (pos 160), vnode_B3 (pos 300)

Benefits:
  - More even data distribution
  - When a node joins/leaves, load is spread across multiple nodes
  - Powerful nodes can have more vnodes

Typical: 100-200 vnodes per physical node
```

### Replication

```
Replication Factor N = 3 (configurable)

For each key:
  - Hash to find primary node (Node A)
  - Replicate to next N-1 nodes clockwise on ring (Node B, Node C)
  - These 3 nodes form the "preference list" for this key

  Ring with replication (N=3):
  Key K → hash → primary: Node A → replicas: Node B, Node C

  Write: Client → Coordinator → [Node A, Node B, Node C]
  Read:  Client → Coordinator → [Node A or B or C]
```

### Consistency: Quorum Protocol

The most important concept for tunable consistency:

```
Parameters:
  N = total replicas (typically 3)
  W = write quorum (number of acks needed for successful write)
  R = read quorum (number of responses needed for successful read)

Rule: If W + R > N → strong consistency (guaranteed to read latest write)

Common configurations:
┌───────────┬───┬───┬───┬──────────────────────────┐
│ Config    │ N │ W │ R │ Behavior                  │
├───────────┼───┼───┼───┼──────────────────────────┤
│ Strong    │ 3 │ 3 │ 1 │ All replicas must ack     │
│           │   │   │   │ write; any one can serve   │
│           │   │   │   │ read (always latest)       │
│           │   │   │   │                            │
│ Quorum    │ 3 │ 2 │ 2 │ Majority ack write;       │
│           │   │   │   │ read from majority         │
│           │   │   │   │ (overlapping set)          │
│           │   │   │   │                            │
│ Fast read │ 3 │ 3 │ 1 │ Slow writes, fast reads    │
│           │   │   │   │                            │
│ Fast write│ 3 │ 1 │ 3 │ Fast writes, slow reads    │
│           │   │   │   │                            │
│ Eventual  │ 3 │ 1 │ 1 │ Fastest but may read stale │
└───────────┴───┴───┴───┴──────────────────────────┘

Why W + R > N guarantees consistency:
  - Write reaches W nodes (e.g., 2 out of 3)
  - Read queries R nodes (e.g., 2 out of 3)
  - At least 1 node has both the latest write AND is queried by read
  - That node returns the latest value
```

### Conflict Resolution: Vector Clocks

With concurrent writes to different replicas, conflicts can occur:

```
Scenario:
  Client A writes key "x" = "v1" to Node 1 (version: [N1:1])
  Client B writes key "x" = "v2" to Node 2 (version: [N2:1])
  → Both versions exist → CONFLICT

Vector Clock:
  - Each node maintains a counter per node that has written
  - Version vector: [(Node, Counter), ...]

  Initial:          x = "v0"       version: []
  Client A → Node1: x = "v1"      version: [N1:1]
  Client B → Node1: x = "v2"      version: [N1:1, N2:1]  — no conflict (causal)
  
  BUT if Client B writes to Node2 independently:
  Client A → Node1: x = "v1"      version: [N1:1]
  Client B → Node2: x = "v2"      version: [N2:1]
  → [N1:1] and [N2:1] are concurrent (neither dominates) → CONFLICT

Resolution strategies:
  1. Last-Write-Wins (LWW) — use timestamp, simple but loses data
  2. Application-level merge — return both versions to client, let app merge
     (e.g., Amazon shopping cart: union of items)
  3. CRDTs — Conflict-free Replicated Data Types (auto-merge)
```

### Storage Engine: LSM-Tree

Each node uses an LSM-Tree (Log-Structured Merge-Tree) for on-disk storage:

```
Write Path:
  1. Write to WAL (Write-Ahead Log) for durability
  2. Insert into MemTable (in-memory sorted structure, e.g., Red-Black Tree)
  3. When MemTable reaches threshold (e.g., 64 MB):
     a. Flush to disk as SSTable (Sorted String Table)
     b. SSTable is immutable, sorted by key
  4. Background compaction: merge SSTables, remove deleted/old entries

Read Path:
  1. Check MemTable (in-memory) → O(log n)
  2. Check Bloom filter for each SSTable
     - Bloom filter says "definitely not here" → skip SSTable
     - Bloom filter says "maybe here" → read SSTable
  3. Search relevant SSTables (most recent first)
  4. Return first match found

             Write
               │
   ┌───────────▼───────────┐
   │   WAL (append-only)   │  ← durability
   └───────────┬───────────┘
               │
   ┌───────────▼───────────┐
   │   MemTable (RB-tree)  │  ← fast writes
   └───────────┬───────────┘
               │ flush when full
   ┌───────────▼───────────┐
   │   SSTable L0          │  ← immutable, sorted
   │   SSTable L0          │
   └───────────┬───────────┘
               │ compaction
   ┌───────────▼───────────┐
   │   SSTable L1          │  ← merged, larger
   └───────────┬───────────┘
               │
   ┌───────────▼───────────┐
   │   SSTable L2          │  ← even larger
   └───────────────────────┘
```

### Failure Detection: Gossip Protocol

```
How does the cluster know when a node is down?

Naive: Heartbeat to a central monitor
  Problem: Central monitor is a single point of failure

Gossip Protocol:
  - Each node periodically picks a random node and exchanges heartbeat info
  - Each node maintains a list: [NodeId, HeartbeatCounter, Timestamp]
  - If a node's heartbeat hasn't increased in T seconds → suspected failure

  Node A's view:
  ┌─────────┬───────────┬────────────┐
  │ Node    │ Heartbeat │ Last Seen  │
  ├─────────┼───────────┼────────────┤
  │ Node A  │ 42        │ now        │
  │ Node B  │ 35        │ 2s ago     │
  │ Node C  │ 28        │ 15s ago    │ ← suspected dead!
  │ Node D  │ 50        │ 1s ago     │
  └─────────┴───────────┴────────────┘

  If multiple nodes agree C is dead → C is marked as failed
  → Data on C is re-replicated to a healthy node
```

### Handling Failures

```
Temporary Failure → Hinted Handoff:
  - If Node C is down, writes meant for C go to Node D (next on ring)
  - Node D stores a "hint": "this data belongs to C"
  - When C recovers, D sends the hinted data to C
  - Ensures write availability even during temporary failures

Permanent Failure → Anti-Entropy with Merkle Trees:
  - Replicas may drift out of sync over time
  - Use Merkle Tree (hash tree) to detect differences:
    
    Merkle Tree:
         Root Hash
        /         \
    Hash(L)     Hash(R)
    /    \      /    \
   H1    H2   H3    H4
   |     |    |     |
  D1    D2   D3    D4   (data partitions)
  
  - Compare root hashes between replicas
  - If different → drill down to find differing partitions
  - Only sync the differing data (not everything)
  - Efficient: O(log n) comparisons to find differences
```

### Node Addition / Removal

```
Adding a Node:
  1. New node joins ring at a position (determined by token assignment)
  2. Takes over a range of keys from neighboring nodes
  3. Neighboring nodes transfer data for reassigned key ranges
  4. Virtual nodes ensure even redistribution

  Before: [A:0, B:90, C:180, D:270]
  Add E at position 45:
  After:  [A:0, E:45, B:90, C:180, D:270]
  E takes keys in range (0, 45] from B

Removing a Node:
  1. Node leaves the ring
  2. Its key ranges are absorbed by next nodes clockwise
  3. System re-replicates data to maintain replication factor
```

### Complete Write and Read Flows

```
WRITE put("user:123", "{name: 'Alice'}"):

1. Client connects to any node (Coordinator)
2. Coordinator hashes "user:123" → determines preference list [N1, N2, N3]
3. Coordinator sends write to N1, N2, N3 in parallel
4. Each node:
   a. Write to local WAL
   b. Insert into MemTable
   c. Respond ACK to coordinator
5. Coordinator waits for W acks (e.g., W=2)
   - If 2 acks received → respond SUCCESS to client
   - If timeout → respond FAILURE (client can retry)

READ get("user:123"):

1. Client connects to Coordinator
2. Coordinator determines preference list [N1, N2, N3]
3. Coordinator sends read to R nodes (e.g., R=2)
4. Each node: lookup in MemTable → SSTables → return value + version
5. Coordinator compares versions:
   - All same → return value
   - Different → return latest (by vector clock or timestamp)
   - If stale replica detected → trigger read repair (update stale node)
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
Client → Any Node (Coordinator)
           │
     Consistent Hash Ring
     ┌─────┼──────┐
     ▼     ▼      ▼
   Node1  Node2  Node3  (preference list for key)
     │     │      │
   Write: WAL → MemTable → SSTable (LSM-Tree per node)
     │
   Gossip Protocol (failure detection between all nodes)
     │
   Hinted Handoff (temporary failure)
   Merkle Trees (permanent failure / anti-entropy)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Partitioning | Consistent hashing + vnodes | Minimal reshuffling on add/remove |
| Replication | N=3, configurable quorum | Tunable consistency vs availability |
| Consistency | Vector clocks + quorum | Detect and resolve conflicts |
| Storage engine | LSM-Tree (WAL + MemTable + SSTables) | Write-optimized, good read with Bloom filters |
| Failure detection | Gossip protocol | Decentralized, no SPOF |
| Failure handling | Hinted handoff + Merkle trees | Handle temp and perm failures |

### Additional Talking Points

- **Range queries** — If needed, use order-preserving hash (but loses even distribution) or add secondary index
- **TTL support** — Add expiration timestamp, cleanup during compaction
- **Compression** — Compress SSTables (Snappy, LZ4) to reduce disk/network
- **Hot keys** — Replicate hot keys to more nodes or use read-through cache
- **Multi-datacenter** — Async replication across datacenters, each DC has local quorum
- **Linearizability** — Use Raft/Paxos consensus for strong consistency (CP mode)
- **Real-world systems** — DynamoDB, Cassandra, Riak, Voldemort all use these techniques
