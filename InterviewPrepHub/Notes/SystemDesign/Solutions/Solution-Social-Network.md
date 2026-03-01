# Design Data Structures for a Social Network

This problem focuses on designing the **data layer** for a social network like Facebook or LinkedIn — specifically how to model users, friendships, and efficiently answer graph queries like "find the shortest path between two users" (degrees of separation), "mutual friends," and "friend suggestions."

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we designing the full social network or just the data structures and graph queries?  
**Interviewer:** Focus on the data structures — how to store the social graph and efficiently query relationships like shortest path, mutual friends, and friend recommendations.

**Candidate:** How many users and connections?  
**Interviewer:** 1 billion users, average 500 friends each.

**Candidate:** What queries do we need to support?  
**Interviewer:** (1) Are two users friends? (2) List all friends of a user. (3) Find mutual friends. (4) Find shortest path between two users (degrees of separation). (5) Friend suggestions.

**Candidate:** What's the latency requirement for these queries?  
**Interviewer:** Friend check and friend list should be < 50 ms. Shortest path can be < 5 seconds.

### Functional Requirements

- Store user profiles and friendship connections
- Check if two users are friends (O(1) or near)
- List all friends of a user
- Find mutual friends between two users
- Find shortest path (degrees of separation) between two users
- Suggest potential friends (people you may know)

### Non-Functional Requirements

- 1 billion users, ~250 billion edges (500 avg friends × 1B / 2)
- Low latency for common queries (friend check, friend list)
- Shortest path queries can tolerate higher latency
- High availability for read-heavy workload

### Back-of-the-Envelope Estimation

- **Nodes:** 1 billion users
- **Edges:** 250 billion friendships (undirected)
- **Edge storage:** 250B × 16 bytes (two user IDs) = 4 TB
- **Adjacency list per user:** 500 friends × 8 bytes = 4 KB
- **Total adjacency lists:** 1B × 4 KB = 4 TB
- **Node data (user profiles):** 1B × 1 KB = 1 TB

---

## Step 2 — High-Level Design

### Graph Representation Options

#### Option A: Adjacency Matrix

```
        User1  User2  User3  User4
User1    0      1      1      0
User2    1      0      0      1
User3    1      0      0      1
User4    0      1      1      0

Pros:
  - O(1) friendship check: matrix[i][j]
  - Simple implementation

Cons:
  - Space: O(n²) = 10^18 bits = 125 PB → IMPOSSIBLE
  - Extremely sparse (density = 500/1B ≈ 0.00005%)
  - Not viable at scale
```

#### Option B: Adjacency List

```
User1 → [User2, User3, User5, ...]
User2 → [User1, User4, User7, ...]
User3 → [User1, User4, User6, ...]

Pros:
  - Space efficient: O(V + E) = ~8 TB
  - Natural for "list friends" queries
  - Good for graph traversal (BFS/DFS)

Cons:
  - Friendship check: O(degree) per user
    Can be optimized with sorted lists + binary search: O(log d)
```

#### Option C: Edge List (Relational Table)

```
friendships table:
| user_id_1 | user_id_2 | created_at |
|-----------|-----------|------------|
| 101       | 205       | 2024-01-15 |
| 101       | 307       | 2024-02-20 |

Pros:
  - Works with traditional RDBMS
  - Easy to add metadata (friendship date, type)
  - SQL-friendly

Cons:
  - Graph traversal requires multiple JOINs (slow for BFS)
  - Multi-hop queries are expensive
```

### Chosen Approach: Hybrid

```
┌────────────────────────────────────────────┐
│  Storage Layer                              │
│                                             │
│  ┌──────────────┐  ┌─────────────────────┐ │
│  │ PostgreSQL   │  │ Graph DB (Neo4j)    │ │
│  │ (User data,  │  │ or                  │ │
│  │  friendships │  │ Custom Adjacency    │ │
│  │  metadata)   │  │ List (in-memory)    │ │
│  └──────────────┘  └─────────────────────┘ │
│                                             │
│  PostgreSQL: CRUD operations, metadata      │
│  Graph Layer: BFS, shortest path, recs      │
└────────────────────────────────────────────┘
```

---

## Step 3 — Design Deep Dive

### Query 1: Are Two Users Friends?

```
Approach A: Hash Set per User
  - Each user's friend list stored as a HashSet
  - friends[userId].contains(friendId) → O(1)
  - Memory: 1B users × 500 friends × 8 bytes = 4 TB
  - Distributed across many servers (shard by userId)

Approach B: Database Query
  SELECT 1 FROM friendships
  WHERE (user_id_1 = ? AND user_id_2 = ?)
     OR (user_id_1 = ? AND user_id_2 = ?)
  LIMIT 1

  - Index on (user_id_1, user_id_2) → O(log n)
  - Cache result in Redis: "friends:101:205" → true/false

Approach C: Bloom Filter (Probabilistic)
  - Per-user Bloom filter for friend set
  - 500 friends, 1% FPR → ~600 bytes per user
  - 1B users × 600 bytes = 600 GB (fits in memory cluster)
  - False positive = "maybe friends" → verify with DB
  - False negative = impossible (never says "not friends" when they are)

Recommended: Bloom Filter for fast negative check + DB for confirmation
```

### Query 2: List All Friends

```
Data Structure: Adjacency List in DB + Cache

Storage:
  friendships table with index on user_id_1
  SELECT user_id_2 FROM friendships WHERE user_id_1 = ? 

Cache:
  Redis Set: friends:{userId} → {friend1, friend2, ...}
  TTL: 1 hour (invalidate on friendship change)

For sorted results (by name, recency):
  Redis Sorted Set: score = friendship_created_at
  ZREVRANGE friends:{userId} 0 19  → 20 most recent friends

Pagination:
  ZREVRANGEBYSCORE friends:{userId} +inf {cursor} LIMIT 0 20
```

### Query 3: Mutual Friends

```
Find friends in common between User A and User B.

Algorithm:
  mutual = friends(A) ∩ friends(B)

Implementation Options:

Option A: Set Intersection (in-memory)
  friendsA = Redis SMEMBERS friends:A  → {101, 205, 307, ...}
  friendsB = Redis SMEMBERS friends:B  → {205, 410, 307, ...}
  mutual = SINTER friends:A friends:B  → {205, 307}
  Time: O(min(|A|, |B|)) with sorted sets

Option B: SQL Query
  SELECT f1.user_id_2 AS mutual_friend
  FROM friendships f1
  JOIN friendships f2 ON f1.user_id_2 = f2.user_id_2
  WHERE f1.user_id_1 = :userA AND f2.user_id_1 = :userB

Option C: Pre-compute for Active Pairs
  - For frequently viewed profiles, pre-compute mutual friends
  - Store in cache: mutual:{A}:{B} → [205, 307]
  - Invalidate when either user's friend list changes
```

### Query 4: Shortest Path (Degrees of Separation)

This is the hardest query — finding the shortest path in a graph with 1B nodes.

```
Naive BFS from source to target:
  - Worst case explores entire graph
  - 1B nodes → way too slow

Bidirectional BFS (Optimal for unweighted graph):
  - Start BFS from BOTH source AND target simultaneously
  - When the two frontiers meet → shortest path found

  Why faster?
    - Single BFS: explores O(b^d) nodes (b=branching, d=depth)
    - Bidirectional BFS: explores O(2 × b^(d/2)) nodes
    - For b=500, d=6: Single = 500^6 = 15.6T vs Bidirectional = 2 × 500^3 = 250M
    - Massive speedup!
```

```
Bidirectional BFS Algorithm:

function shortestPath(source, target):
    if source == target: return 0

    // Forward BFS from source
    forwardVisited = {source: null}
    forwardQueue = [source]

    // Backward BFS from target
    backwardVisited = {target: null}
    backwardQueue = [target]

    while forwardQueue is not empty AND backwardQueue is not empty:
        // Expand the SMALLER frontier first (optimization)
        if len(forwardQueue) <= len(backwardQueue):
            result = expandLevel(forwardQueue, forwardVisited, backwardVisited)
        else:
            result = expandLevel(backwardQueue, backwardVisited, forwardVisited)

        if result is not null:
            return reconstructPath(result, forwardVisited, backwardVisited)

    return -1  // No path exists

function expandLevel(queue, visited, otherVisited):
    nextQueue = []
    for node in queue:
        for neighbor in getFriends(node):
            if neighbor in otherVisited:
                return neighbor  // Frontiers met!
            if neighbor not in visited:
                visited[neighbor] = node
                nextQueue.append(neighbor)
    queue = nextQueue
    return null
```

```
Distributed BFS at Scale:

Challenge: Friend lists are distributed across many servers.
  - User 101's friends on Server A
  - User 205's friends on Server B

Solution: Graph Partitioning + Message Passing

1. Partition graph by user_id range (or hash)
   Server 1: users 1-100M
   Server 2: users 100M-200M
   ...

2. BFS coordinator sends "expand frontier" requests to relevant servers

3. Each server:
   a. Receives set of user IDs in the frontier
   b. Looks up their friends (local adjacency list)
   c. Returns friends to coordinator

4. Coordinator:
   a. Merges results
   b. Checks for intersection with other frontier
   c. Sends next expansion batch

5. Max depth: 6 (six degrees of separation) → max 12 expansion rounds

Alternative: Use a graph database (Neo4j, Amazon Neptune, TigerGraph)
  - Native graph traversal optimized for shortest path
  - Cypher query: MATCH p=shortestPath((a:User)-[:FRIEND*]-(b:User))
                   WHERE a.id = 101 AND b.id = 205
                   RETURN length(p)
```

### Query 5: Friend Suggestions (People You May Know)

```
Algorithm: Friends-of-Friends (FOF) with Scoring

1. Get all friends of the user: F = friends(user)
2. For each friend f ∈ F:
   a. Get friends of f: FOF = friends(f)
   b. For each fof ∈ FOF:
      - Skip if fof == user or fof ∈ F (already friends)
      - Increment score: suggestions[fof] += 1
3. Sort suggestions by score (descending)
4. Return top K suggestions

Score = number of mutual friends

Enhancement factors:
  - Same school/company (profile similarity)
  - Same city/location
  - Interaction frequency with mutual friends
  - Phone contacts (if imported)

Optimization:
  - Pre-compute FOF scores in batch (nightly job)
  - Store in cache: suggestions:{userId} → [(user_456, 12), (user_789, 8), ...]
  - 1B users × 50 suggestions × 12 bytes = 600 GB
```

### Data Structures Summary

| Query | Data Structure | Time Complexity | Space |
|-------|---------------|-----------------|-------|
| Friend check | Bloom filter + DB | O(1) avg | 600 GB (bloom) |
| List friends | Adjacency list (Redis Set) | O(k) for k friends | 4 TB |
| Mutual friends | Set intersection | O(min(d₁, d₂)) | Cached |
| Shortest path | Bidirectional BFS | O(b^(d/2)) | In-memory frontier |
| Suggestions | FOF scoring | Pre-computed batch | 600 GB |

### Storage Architecture

```
┌─────────────────────────────────────────────────┐
│  Hot Path (Real-time Queries)                    │
│  ┌────────────────────────┐                      │
│  │ Redis Cluster          │                      │
│  │  - Friend sets         │   4 TB sharded       │
│  │  - Mutual friend cache │                      │
│  │  - Suggestion cache    │                      │
│  │  - Bloom filters       │   600 GB             │
│  └────────────────────────┘                      │
│                                                   │
│  Warm Path (Graph Queries)                        │
│  ┌────────────────────────┐                      │
│  │ Graph DB / Custom      │                      │
│  │  - BFS traversal       │   Adjacency lists    │
│  │  - Shortest path       │   in memory           │
│  │  - Graph algorithms    │                      │
│  └────────────────────────┘                      │
│                                                   │
│  Cold Path (Persistence)                          │
│  ┌────────────────────────┐                      │
│  │ PostgreSQL (sharded)   │                      │
│  │  - User profiles       │   1 TB               │
│  │  - Friendship edges    │   4 TB               │
│  │  - Metadata            │                      │
│  └────────────────────────┘                      │
└─────────────────────────────────────────────────┘
```

---

## Step 4 — Wrap Up

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Graph representation | Adjacency list | Space efficient for sparse graph |
| Friend check | Bloom filter + DB | O(1) with minimal memory |
| Shortest path | Bidirectional BFS | Exponentially faster than single BFS |
| Friend suggestions | FOF scoring (batch) | Pre-compute for instant results |
| Storage | Redis (hot) + Graph DB (warm) + PostgreSQL (cold) | Tiered for performance |
| Graph partitioning | Hash-based sharding by user_id | Even distribution |

### Additional Talking Points

- **Graph partitioning** — Minimize cross-partition edges (use METIS or Fennel for community-aware partitioning)
- **Weak ties** — Granovetter's theory: weak ties (friends of friends) are more valuable for information spread than strong ties
- **Community detection** — Louvain algorithm for discovering friend groups/clusters
- **Privacy** — Users can hide friend list; affects mutual friend and suggestion queries
- **Real-time updates** — When a friendship is created/deleted, invalidate affected caches
- **Graph databases** — Neo4j, Amazon Neptune, TigerGraph are purpose-built for these queries
- **Six degrees of separation** — Research shows average path length in social networks is ~4.7 (Facebook data)
