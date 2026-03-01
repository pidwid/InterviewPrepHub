# Graph Databases & Social Graphs

## Table of Contents

1. [Overview](#1-overview)
2. [Graph Data Model](#2-graph-data-model)
3. [Graph Databases](#3-graph-databases)
4. [Graph Query Languages](#4-graph-query-languages)
5. [Social Graph Design](#5-social-graph-design)
6. [Graph Algorithms](#6-graph-algorithms)
7. [Scaling Graph Systems](#7-scaling-graph-systems)
8. [Graph vs Relational](#8-graph-vs-relational)
9. [Real-World Applications](#9-real-world-applications)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Some data is inherently connected — social networks, knowledge graphs,
fraud rings, recommendation engines. Graph databases are purpose-built
for these relationships, where SQL JOINs become expensive and NoSQL
loses the relationship context entirely.

```
Relational (friends query):                Graph (friends query):
  SELECT u2.name                             MATCH (me)-[:FRIEND]->(f)
  FROM users u1                              WHERE me.name = "Alice"
  JOIN friendships f ON u1.id = f.user_id    RETURN f.name
  JOIN users u2 ON f.friend_id = u2.id     
  WHERE u1.name = 'Alice';                  Much simpler!
  
Friends of friends (2 hops):               Friends of friends:
  3 JOINs, getting ugly                     MATCH (me)-[:FRIEND*2]->(fof)
  
Friends within 5 hops:                     Within 5 hops:
  11 JOINs?! Performance disaster           MATCH (me)-[:FRIEND*1..5]->(f)
                                             Still clean, still fast
```

---

## 2. Graph Data Model

### Property Graph Model

```
The most common graph model. Two primitives: Nodes and Edges.

  Node (Vertex):
  ┌──────────────────┐
  │ Label: Person     │
  │ Properties:       │
  │   name: "Alice"   │
  │   age: 30         │
  │   city: "SF"      │
  └────────┬─────────┘
           │
           │ Edge (Relationship)
           │ Type: FOLLOWS
           │ Properties:
           │   since: "2023-01"
           │
  ┌────────▼─────────┐
  │ Label: Person     │
  │ Properties:       │
  │   name: "Bob"     │
  │   age: 28         │
  └──────────────────┘

Key concepts:
  - Nodes have labels (Person, Company, Product)
  - Edges have types (FOLLOWS, WORKS_AT, PURCHASED)
  - Both can have properties (key-value pairs)
  - Edges are directional (but can be traversed both ways)
```

### RDF (Resource Description Framework)

```
Used in knowledge graphs (Wikidata, Google Knowledge Graph).

Everything is a triple: (Subject, Predicate, Object)

  (Alice, knows, Bob)
  (Alice, worksAt, Google)
  (Google, locatedIn, MountainView)
  (MountainView, isA, City)

Less expressive than property graphs (no edge properties without reification),
but better for semantic web and linked data.
```

---

## 3. Graph Databases

| Database      | Model          | Query Language | Scale        | Used By         |
|--------------|----------------|---------------|-------------|-----------------|
| Neo4j        | Property Graph | Cypher        | Single/Cluster| eBay, NASA     |
| Amazon Neptune| Both          | Gremlin, SPARQL| Managed    | Amazon          |
| JanusGraph   | Property Graph | Gremlin       | Distributed | Uber            |
| TigerGraph   | Property Graph | GSQL          | Distributed | Enterprise      |
| Dgraph       | GraphQL-native | GraphQL/DQL   | Distributed | Open source     |
| ArangoDB     | Multi-model    | AQL           | Distributed | Multi-model     |

### Neo4j Architecture

```
Neo4j Storage:
  ┌─────────────────────────────────────────┐
  │  Node Store    │  Relationship Store    │
  │  [Node1]──────►│  [Rel1: FOLLOWS]      │
  │  [Node2]──────►│  [Rel2: WORKS_AT]     │
  │  [Node3]       │  [Rel3: KNOWS]        │
  └────────────────┴───────────────────────┘
  
  Index-free adjacency:
    Each node directly references its relationships.
    No index lookup needed to traverse!
    
    Traversal: O(1) per hop (follow pointer)
    SQL JOIN:  O(log n) per hop (index lookup)
    
    For deep traversals (>3 hops), graphs are orders
    of magnitude faster than SQL.
```

---

## 4. Graph Query Languages

### Cypher (Neo4j)

```cypher
// Create nodes and relationships
CREATE (alice:Person {name: "Alice", age: 30})
CREATE (bob:Person {name: "Bob", age: 28})
CREATE (alice)-[:FOLLOWS {since: "2023"}]->(bob)

// Find friends
MATCH (p:Person {name: "Alice"})-[:FOLLOWS]->(friend)
RETURN friend.name

// Friends of friends (not already friends)
MATCH (me:Person {name: "Alice"})-[:FOLLOWS]->()-[:FOLLOWS]->(fof)
WHERE NOT (me)-[:FOLLOWS]->(fof) AND me <> fof
RETURN DISTINCT fof.name

// Shortest path
MATCH path = shortestPath(
  (a:Person {name: "Alice"})-[:FOLLOWS*..6]-(b:Person {name: "Charlie"})
)
RETURN path, length(path)

// Mutual friends
MATCH (a:Person {name: "Alice"})-[:FOLLOWS]->(mutual)<-[:FOLLOWS]-(b:Person {name: "Bob"})
RETURN mutual.name
```

### Gremlin (Apache TinkerPop)

```groovy
// Find friends
g.V().has('name', 'Alice').out('FOLLOWS').values('name')

// Friends of friends
g.V().has('name', 'Alice').out('FOLLOWS').out('FOLLOWS')
  .dedup().values('name')

// Shortest path
g.V().has('name', 'Alice')
  .repeat(out('FOLLOWS').simplePath())
  .until(has('name', 'Charlie'))
  .path().limit(1)
```

---

## 5. Social Graph Design

### Data Model

```
Nodes:
  User: {id, name, email, created_at}
  Post: {id, content, created_at}
  Comment: {id, text, created_at}
  Group: {id, name, description}

Edges:
  FOLLOWS: User → User (since, notification_pref)
  POSTED: User → Post
  LIKED: User → Post (at)
  COMMENTED: User → Comment
  ON_POST: Comment → Post
  MEMBER_OF: User → Group (role, joined_at)
  BLOCKED: User → User
```

### Common Social Graph Queries

```
1. News Feed:
   "Get posts from people I follow, ordered by time"
   MATCH (me)-[:FOLLOWS]->(friend)-[:POSTED]->(post)
   WHERE me.id = $userId
   RETURN post ORDER BY post.created_at DESC LIMIT 20

2. Mutual Friends:
   MATCH (me)-[:FOLLOWS]->(mutual)<-[:FOLLOWS]-(them)
   WHERE me.id = $myId AND them.id = $theirId
   RETURN mutual

3. Friend Recommendations (people you may know):
   MATCH (me)-[:FOLLOWS]->(friend)-[:FOLLOWS]->(suggested)
   WHERE me.id = $userId
     AND NOT (me)-[:FOLLOWS]->(suggested)
     AND me <> suggested
   RETURN suggested, COUNT(friend) AS mutual_count
   ORDER BY mutual_count DESC LIMIT 10

4. Degrees of Separation:
   MATCH path = shortestPath(
     (a:User {id: $user1})-[:FOLLOWS*]-(b:User {id: $user2})
   )
   RETURN length(path)
```

### Social Graph at Scale (Facebook TAO)

```
Facebook TAO (The Associations and Objects):
  Custom graph store optimized for social graph.
  
  ┌─────────────────────────────────────────┐
  │              TAO Architecture            │
  │                                          │
  │  Client ──► TAO Cache (memcached)        │
  │                  │                       │
  │                  ▼                       │
  │             TAO Storage (MySQL)          │
  │                                          │
  │  Objects: id → {type, data}              │
  │  Associations: id1 → [(type, id2, data)] │
  │                                          │
  │  Key optimization:                       │
  │    Association lists for common queries  │
  │    Fan-out at write time                 │
  │    Heavy caching layer                   │
  └─────────────────────────────────────────┘
  
  Handles billions of reads/sec with heavy caching.
```

---

## 6. Graph Algorithms

| Algorithm          | What It Does                              | Use Case                    |
|-------------------|-------------------------------------------|-----------------------------|
| BFS/DFS           | Traverse graph level-by-level / depth-first| Finding connected nodes    |
| Shortest Path     | Find minimum hops/weight between nodes    | Degrees of separation       |
| PageRank          | Rank node importance by link structure    | Search ranking, influence   |
| Community Detection| Find clusters of densely connected nodes | User groups, fraud rings    |
| Centrality        | Find most connected/important nodes       | Influencer identification   |
| Label Propagation | Spread labels through the graph           | Classification, clustering  |

### PageRank

```
PageRank algorithm (simplified):
  Each node starts with rank = 1/N
  Iteratively:
    rank(node) = (1-d)/N + d × Σ(rank(neighbor)/degree(neighbor))
    d = damping factor (typically 0.85)
  
  Intuition: A node is important if important nodes link to it.
  
  Used by Google for web search ranking (originally).
  Also: identify influential users, important documents.
```

---

## 7. Scaling Graph Systems

```
Graph partitioning is hard:

  The problem:
  ┌──────────┐    ┌──────────┐
  │ Server 1 │    │ Server 2 │
  │  A ─ B   │    │  C ─ D   │
  │  │       │    │  │       │
  │  E       │    │  F       │
  └──────────┘    └──────────┘
  
  Query: "Friends of A" → all on Server 1, fast!
  Query: "Is A connected to D?" → crosses servers, SLOW!

Partitioning strategies:
  1. Hash-based: hash(node_id) % N → balanced but random cuts
  2. Domain-based: partition by geography, org structure
  3. Replication: store hot nodes on multiple partitions
  
  All have trade-offs. This is why graph DBs are hard to scale
  compared to key-value stores.

Scaling approaches:
  - Read replicas (most common)
  - Caching hot subgraphs (TAO approach)
  - Limit traversal depth (cap at 3-4 hops)
  - Precompute common queries (materialized views)
  - Hybrid: graph DB for traversals + cache/search for lookups
```

---

## 8. Graph vs Relational

| Criteria               | Relational DB         | Graph DB                |
|-----------------------|----------------------|------------------------|
| Simple CRUD            | Excellent            | Good                   |
| Deep joins (3+ hops)   | Very slow            | Fast                   |
| Relationship queries   | Complex SQL JOINs    | Natural and fast       |
| Schema flexibility     | Rigid (ALTER TABLE)  | Flexible (add any prop)|
| Aggregations           | Excellent (GROUP BY) | Moderate               |
| Transactions           | ACID                 | Varies by database     |
| Scaling                | Well understood      | Challenging            |
| Ecosystem/tooling      | Mature               | Growing                |

### When to Use a Graph DB

```
✓ Highly connected data (social networks, knowledge graphs)
✓ Queries involve traversing relationships (friends-of-friends)
✓ Relationship patterns are more important than individual records
✓ Variable-depth traversals
✓ Pattern matching (fraud detection)

✗ Simple CRUD with no relationships
✗ Heavy aggregation/reporting workloads
✗ Write-heavy with little relationship querying
✗ Tabular data that fits naturally in rows
```

---

## 9. Real-World Applications

| Application            | How Graphs Are Used                        |
|-----------------------|-------------------------------------------|
| Social Networks       | Friend connections, feed, recommendations  |
| Fraud Detection       | Find fraud rings (connected suspicious accounts) |
| Recommendation Engines| "Users who bought X also bought Y"        |
| Knowledge Graphs      | Google Knowledge Panel, Wikipedia          |
| Network Management    | IT infrastructure dependencies            |
| Supply Chain          | Track goods through multi-level suppliers  |
| Identity Resolution   | Match records across systems              |
| Access Control        | Role → Permission → Resource hierarchies  |

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Graphs excel at relationship-heavy queries | Friends-of-friends, shortest path, pattern matching |
| Index-free adjacency is the key advantage | O(1) per hop vs O(log n) for SQL JOINs |
| Social graphs need heavy caching | Facebook TAO serves billions of reads/sec with cache |
| Graph partitioning is fundamentally hard | Relationships cross partition boundaries |
| Neo4j + Cypher is the most popular combo | Start here for most use cases |
| Limit traversal depth at scale | Cap at 3-4 hops to keep queries fast |
| Hybrid architectures are common | Graph DB for traversals + relational for aggregations |
| PageRank and community detection | Key algorithms for influence and clustering |
| Use graphs when relationships ARE the data | If you're mostly doing CRUD, use SQL |
