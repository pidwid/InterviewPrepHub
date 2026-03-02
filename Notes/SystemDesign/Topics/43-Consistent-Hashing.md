# Consistent Hashing & Data Partitioning

## Table of Contents

1. [Overview](#1-overview)
2. [The Problem with Simple Hashing](#2-the-problem-with-simple-hashing)
3. [The Hash Ring](#3-the-hash-ring)
4. [How Lookups Work](#4-how-lookups-work)
5. [Node Addition & Removal](#5-node-addition--removal)
6. [Virtual Nodes (vNodes)](#6-virtual-nodes-vnodes)
7. [Data Partitioning Strategies](#7-data-partitioning-strategies)
8. [Implementation Details](#8-implementation-details)
9. [Real-World Usage](#9-real-world-usage)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

When distributing data across multiple servers, you need a way to decide which
server stores which key. <abbr title="Consistent hashing: maps both keys and servers onto a circular hash ring so that adding or removing a server only remaps ~1/N keys — far less disruption than simple modulo hashing.">Consistent hashing</abbr> is an algorithm that maps both keys
and servers onto a circular hash space (a ring), so that adding or removing a
server only affects a minimal fraction of keys.

```
Traditional hashing:               Consistent hashing:

hash(key) % N                      hash(key) → position on ring
                                    walk clockwise → first server
If N changes, nearly ALL            
keys remap → catastrophe            If N changes, only ~1/N of
                                    keys remap → graceful
```

---

## 2. The Problem with Simple Hashing

Given N servers, the naive approach: `server = hash(key) % N`

```
Example: 4 servers, key "user_42"

hash("user_42") = 78
78 % 4 = 2  → Server 2

Now Server 2 crashes. N becomes 3:

78 % 3 = 0  → Server 0   (different!)

When N changes from 4 to 3:
  ~75% of ALL keys remap to different servers.
  This triggers a "cache stampede" — the database
  gets flooded with requests that used to hit the cache.
```

| N (servers) | Keys remapped when one server dies |
|-------------|------------------------------------|
| 4 → 3       | ~75%                               |
| 10 → 9      | ~90%                               |
| 100 → 99    | ~99%                               |

The larger the cluster, the worse it gets.

---

## 3. The Hash Ring

Consistent hashing maps both servers and keys onto a circular space.

```
Hash function output range: 0 to 2^32 - 1
Bend the number line into a circle:

              0
            ╱   ╲
          ╱       ╲
    2^32-1    Ring    2^30
          ╲       ╱
            ╲   ╱
             2^31

Place servers on the ring by hashing their identifiers:

              0
            ╱   ╲
         [A]       ╲
          ╱           [B]
          ╲       ╱
            ╲   ╱
             [C]

  hash("Server-A") → position on ring
  hash("Server-B") → position on ring
  hash("Server-C") → position on ring
```

### Placing Keys on the Ring

Keys are hashed using the same function and placed on the ring.

```
  hash("user_42")   → some position
  hash("order_789") → some position
```

---

## 4. How Lookups Work

**Rule:** From the key's position, walk clockwise until you hit the first server.
That server owns the key.

```
              0
            ╱   ╲
         [A]   •k1  ╲         k1 → walks clockwise → hits B
          ╱           [B]
     •k2  ╲       ╱            k2 → walks clockwise → hits C
            ╲   ╱
             [C]

  k1 is stored on Server B
  k2 is stored on Server C
```

### Implementation

The ring is not a linked list. It's a **sorted array** of server hash positions.

```python
import hashlib
import bisect

class ConsistentHash:
    def __init__(self):
        self.ring = []          # sorted list of (hash_value, node_id)
        self.hash_to_node = {}  # hash_value → node_id

    def _hash(self, key):
        return int(hashlib.sha256(key.encode()).hexdigest(), 16) % (2**32)

    def add_node(self, node_id):
        h = self._hash(node_id)
        bisect.insort(self.ring, h)
        self.hash_to_node[h] = node_id

    def get_node(self, key):
        if not self.ring:
            return None
        h = self._hash(key)
        # Binary search for first server clockwise
        idx = bisect.bisect_right(self.ring, h) % len(self.ring)
        return self.hash_to_node[self.ring[idx]]
```

Lookup is **O(log N)** via binary search.

---

## 5. Node Addition & Removal

### Removing a Node (Server Crash)

```
Before:                           After (B removed):

    [A]     [B]     [C]              [A]            [C]
     ↑       ↑       ↑                ↑              ↑
  keys    keys    keys             keys           keys
  a1-a3   b1-b3   c1-c3           a1-a3        b1-b3 + c1-c3

Only keys that belonged to B are redistributed to C.
Keys on A and C are unaffected.
Remapped: ~1/N of total keys (only B's keys)
```

### Adding a Node (Scale Up)

```
Before:                        After (D added between B and C):

  [A]   [B]       [C]            [A]   [B]   [D]   [C]
                    ↑                          ↑     ↑
                 keys c1-c5                 c1-c2  c3-c5

Only some of C's keys (those now closer to D) migrate to D.
Everything else is untouched.
```

---

## 6. <abbr title="Virtual nodes (vNodes): assigning each physical server many positions on the hash ring (100–200 virtual tokens) to ensure even load distribution and smoother rebalancing when a node joins or leaves.">Virtual Nodes (vNodes)</abbr>

### The Problem: Non-Uniform Distribution

With only a few physical servers, the ring is unbalanced:

```
Bad distribution (3 physical nodes):

    [A]  [B]                    A owns 10% of ring
                                B owns 60% of ring  ← HOTSPOT
         [C]                    C owns 30% of ring
```

### The Solution: Multiple Positions Per Server

Instead of one position per server, assign many (100–200) positions:

```
hash("Server-A-0"),  hash("Server-A-1"),  ... hash("Server-A-149")
hash("Server-B-0"),  hash("Server-B-1"),  ... hash("Server-B-149")
hash("Server-C-0"),  hash("Server-C-1"),  ... hash("Server-C-149")

450 positions scattered across the ring.
Each server owns roughly 1/3 of the ring space.
```

### Benefits of Virtual Nodes

| Benefit                  | Description                                                 |
|--------------------------|-------------------------------------------------------------|
| Uniform load distribution | With enough vNodes, each server owns ~1/N of the ring     |
| Heterogeneous hardware   | Give beefy servers more vNodes (200) than small ones (50)  |
| Smoother rebalancing     | When a node dies, its vNodes are scattered — load spreads evenly across all remaining nodes instead of dumping onto one neighbor |
| Gradual migration        | Adding a node can be done by adding vNodes incrementally   |

```python
class ConsistentHashWithVNodes:
    def __init__(self, num_vnodes=150):
        self.num_vnodes = num_vnodes
        self.ring = []
        self.hash_to_node = {}

    def _hash(self, key):
        return int(hashlib.sha256(key.encode()).hexdigest(), 16) % (2**32)

    def add_node(self, node_id):
        for i in range(self.num_vnodes):
            vnode_key = f"{node_id}-vnode-{i}"
            h = self._hash(vnode_key)
            bisect.insort(self.ring, h)
            self.hash_to_node[h] = node_id

    def remove_node(self, node_id):
        for i in range(self.num_vnodes):
            vnode_key = f"{node_id}-vnode-{i}"
            h = self._hash(vnode_key)
            self.ring.remove(h)
            del self.hash_to_node[h]

    def get_node(self, key):
        if not self.ring:
            return None
        h = self._hash(key)
        idx = bisect.bisect_right(self.ring, h) % len(self.ring)
        return self.hash_to_node[self.ring[idx]]
```

---

## 7. Data Partitioning Strategies

Consistent hashing is one partitioning approach. Here's how it compares:

### Range-Based Partitioning

```
Partition by key ranges:
  Server A: keys A-F
  Server B: keys G-M
  Server C: keys N-S
  Server D: keys T-Z

Pros: Range queries are efficient (all "A-F" keys on one server)
Cons: Hotspots if data is skewed (e.g., lots of "S" users)
```

### Hash-Based Partitioning (Modulo)

```
server = hash(key) % N

Pros: Uniform distribution
Cons: Catastrophic remapping when N changes
```

### Consistent Hashing

```
Pros: Minimal remapping (~1/N), handles dynamic clusters
Cons: No range queries, more complex implementation
```

### Comparison

| Strategy         | Distribution | Rebalancing | Range Queries | Complexity |
|------------------|-------------|-------------|---------------|------------|
| <abbr title="Range-based partitioning: assigns contiguous key ranges to each server — efficient for range queries but prone to hotspots if data is skewed.">Range-based</abbr>      | Skewed      | Manual      | Yes           | Low        |
| Hash (modulo)    | Uniform     | Catastrophic| No            | Low        |
| <abbr title="Consistent hashing: places both keys and servers on a hash ring; a node change only affects ~1/N keys.">Consistent hash</abbr>  | Uniform*    | Minimal     | No            | Medium     |

*With virtual nodes.

---

## 8. Implementation Details

### Replication with Consistent Hashing

To replicate data for fault tolerance, store each key on the next N clockwise
nodes (not just the first one):

```
Replication factor = 3

  Key K hashes to position P on the ring.
  Walk clockwise: first 3 distinct physical nodes = replicas.

    [A]   •K   [B]   [C]   [D]

  K is stored on B (primary), C (replica), D (replica).
  If B crashes, C and D still have the data.
```

### Handling Node Joins (Data Transfer)

```
When new node D joins between B and C:

  1. D announces itself to the cluster
  2. D is assigned its vNodes on the ring
  3. Keys that now belong to D are streamed from C → D
  4. Once transfer is complete, routing updates to include D
  5. Old copies on C are garbage-collected

  This is called "streaming" or "bootstrap" in Cassandra terminology.
```

### Hotspot Mitigation

Even with vNodes, specific keys can be hot (e.g., celebrity profile):

```
Mitigation strategies:
  1. Read replicas — spread reads across replicas
  2. Local caching — cache hot keys in application memory
  3. Key splitting — "hot_key" → "hot_key_0", "hot_key_1", etc.
     Application randomly picks a suffix → spreads across nodes
```

---

## 9. Real-World Usage

| System             | How It Uses Consistent Hashing                            |
|--------------------|------------------------------------------------------------|
| Amazon DynamoDB    | Partition key → token ring, vNodes for load balancing      |
| Apache Cassandra   | Token ring with vNodes, configurable replication factor    |
| Redis Cluster      | 16384 hash slots assigned to nodes (slot-based variant)   |
| Memcached          | Client-side consistent hashing (ketama algorithm)          |
| Akamai CDN         | Route content requests to nearest/optimal edge server      |
| Discord            | Route channel requests to the Erlang process managing state|

### Redis Cluster: Slot-Based Variant

Redis doesn't use a full ring. It uses 16384 fixed hash slots:

```
slot = CRC16(key) % 16384

3 nodes:
  Node A: slots 0–5460
  Node B: slots 5461–10922
  Node C: slots 10923–16383

Adding Node D:
  Migrate some slots from A, B, C to D.
  Only keys in migrated slots are affected.
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Modulo hashing breaks at scale | Changing N remaps nearly all keys — unacceptable |
| Consistent hashing minimizes disruption | Only ~1/N keys remap when a node joins or leaves |
| <abbr title="vNodes (virtual nodes): each physical server gets many hash-ring positions so load distributes evenly and a node failure spreads keys across all remaining nodes rather than just one neighbour.">Virtual nodes</abbr> are essential | Without vNodes, load distribution is uneven |
| Lookup is <abbr title="O(log V): binary search time complexity — V is the total number of virtual nodes on the ring; doubling V only adds one extra comparison.">O(log V)</abbr> | V = total virtual nodes; uses binary search on a sorted ring |
| Replication rides on the ring | Store copies on the next N clockwise distinct physical nodes |
| Not suited for range queries | Keys are scattered by hash — use range partitioning if needed |
| Industry standard | DynamoDB, Cassandra, Redis Cluster, Memcached all use variants |
| vNode count is tunable | More vNodes = better balance but more memory for the ring metadata |
