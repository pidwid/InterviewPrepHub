# Databases

## Table of Contents

1. [Overview](#1-overview)
2. [Relational Databases (RDBMS)](#2-relational-databases-rdbms)
3. [ACID Properties](#3-acid-properties)
4. [Replication](#4-replication)
5. [Federation (Functional Partitioning)](#5-federation-functional-partitioning)
6. [Sharding (Horizontal Partitioning)](#6-sharding-horizontal-partitioning)
7. [Denormalization](#7-denormalization)
8. [SQL Tuning](#8-sql-tuning)
9. [NoSQL Databases](#9-nosql-databases)
10. [SQL vs NoSQL](#10-sql-vs-nosql)
11. [Database Indexing Deep Dive](#11-database-indexing-deep-dive)
12. [Connection Pooling](#12-connection-pooling)
13. [Database Migration Strategies](#13-database-migration-strategies)
14. [Key Takeaways](#14-key-takeaways)

---

## 1. Overview

Databases are the backbone of almost every system. Choosing the right database — and the
right scaling strategy — is one of the most consequential architectural decisions you'll make.
Getting it wrong is expensive to fix later.

### The Big Picture

```
                        ┌─────────────────────────┐
                        │      Application         │
                        └────────────┬────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
              ┌─────▼─────┐   ┌─────▼─────┐    ┌─────▼─────┐
              │  RDBMS     │   │  NoSQL     │    │  Cache     │
              │ (MySQL,    │   │ (Mongo,    │    │ (Redis,    │
              │  Postgres) │   │  Cassandra)│    │  Memcached)│
              └────────────┘   └───────────┘    └───────────┘
```

### When to Think About Databases

| Question                              | Implication                          |
|---------------------------------------|--------------------------------------|
| Do I need ACID transactions?          | Lean toward RDBMS                    |
| Is my data highly relational?         | RDBMS with proper normalization      |
| Do I need flexible schema?            | Document store (MongoDB)             |
| Is it mostly key-value lookups?       | Key-value store (Redis, DynamoDB)    |
| Do I need massive write throughput?   | Wide-column store (Cassandra)        |
| Do I have complex relationships?      | Graph database (Neo4j)               |

---

## 2. Relational Databases (RDBMS)

A relational database stores data in **tables** (relations) with **rows** and **columns**.
Data is organized according to a predefined **schema**, and tables can reference each other
via **foreign keys**.

### Core Concepts

- **Schema**: Defines the structure — column names, data types, constraints.
  You must define the schema *before* inserting data.
- **SQL**: Structured Query Language — the standard interface for querying relational data.
- **<abbr title="Normalization: organizing database tables to eliminate duplicate data. Data is split into separate tables linked by foreign keys. Reduces storage and prevents update anomalies.">Normalization</abbr>**: Organizing data to reduce redundancy (1NF, 2NF, 3NF, BCNF).
- **<abbr title="Foreign Keys: a column in one table that references a primary key in another table, enforcing referential integrity — you can't reference a row that doesn't exist.">Foreign Keys</abbr>**: Enforce referential integrity between tables.
- **<abbr title="Joins: a SQL operation that combines rows from two or more tables based on a related column. For example, JOIN orders with customers to get customer name on each order.">Joins</abbr>**: Combine data from multiple tables in a single query.

### Normalization Forms (Quick Reference)

| Form | Rule                                                         | Example                                    |
|------|--------------------------------------------------------------|--------------------------------------------|
| 1NF  | Each column holds atomic values; no repeating groups         | No arrays in cells                         |
| 2NF  | 1NF + every non-key column depends on the *whole* key       | Separate product details from order details|
| 3NF  | 2NF + no transitive dependencies                            | City/state → separate address table        |
| BCNF | Every determinant is a candidate key                        | Stricter version of 3NF                    |

### When to Use RDBMS

- You need ACID guarantees (financial data, user accounts)
- Data has clear, stable relationships
- You need complex queries, joins, aggregations
- Regulatory compliance requires strong consistency

### Popular RDBMS

| Database   | Key Strengths                                    | Common Use Cases              |
|------------|--------------------------------------------------|-------------------------------|
| PostgreSQL | Advanced features, JSONB, extensions, reliability| General-purpose, analytics    |
| MySQL      | Simplicity, wide adoption, good replication      | Web applications, OLTP        |
| Oracle     | Enterprise features, RAC, partitioning           | Enterprise, financial         |
| SQL Server | .NET integration, enterprise tooling             | Microsoft ecosystem           |
| SQLite     | Embedded, zero-config, file-based                | Mobile apps, edge, prototyping|

---

## 3. ACID Properties

ACID defines the guarantees that a relational database provides for transactions.

### A — Atomicity

A transaction is **all-or-nothing**. If any part fails, the entire transaction is rolled back.

```
BEGIN TRANSACTION;
  UPDATE accounts SET balance = balance - 500 WHERE id = 'alice';
  UPDATE accounts SET balance = balance + 500 WHERE id = 'bob';
COMMIT;
-- If the second UPDATE fails, the first one is also rolled back.
-- Alice doesn't lose money without Bob receiving it.
```

### C — Consistency

A transaction brings the database from one **valid state** to another valid state.
All constraints (primary keys, foreign keys, checks, triggers) must be satisfied.

### I — Isolation

Concurrent transactions don't interfere with each other. The result is as if
transactions were executed **sequentially**.

**Isolation Levels** (from weakest to strongest):

| Level              | Dirty Read | Non-Repeatable Read | Phantom Read | Performance |
|--------------------|------------|---------------------|--------------|-------------|
| Read Uncommitted   | Yes        | Yes                 | Yes          | Fastest     |
| Read Committed     | No         | Yes                 | Yes          | Fast        |
| Repeatable Read    | No         | No                  | Yes          | Moderate    |
| Serializable       | No         | No                  | No           | Slowest     |

- **Dirty Read**: Reading data written by an uncommitted transaction.
- **Non-Repeatable Read**: Reading the same row twice yields different values
  (another transaction committed a change between reads).
- **Phantom Read**: A query returns different *rows* on re-execution
  (another transaction inserted/deleted rows).

Most production databases default to **Read Committed** (PostgreSQL, Oracle)
or **Repeatable Read** (MySQL InnoDB).

### D — Durability

Once a transaction is committed, it stays committed — even if the server crashes.
Typically implemented via **<abbr title="WAL (Write-Ahead Log): before making any change to actual data, the database first writes what it's about to do to a sequential log file. If it crashes mid-operation, it can replay the WAL on restart to recover to a consistent state.">write-ahead logging (WAL)</abbr>**.

```
Write Flow:
  1. Write to WAL (sequential disk write — fast)
  2. Acknowledge to client
  3. Later, flush changes to actual data files (background)
  
Recovery:
  If crash happens between step 2 and 3, replay WAL on startup.
```

---

## 4. Replication

Replication maintains copies of data across multiple database servers.

### Master-Slave (Primary-Replica) Replication

```
                    ┌──────────────┐
   Writes ────────► │   Primary    │
                    │  (Master)    │
                    └──────┬───────┘
                           │ Replication Stream
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼─────┐ ┌────▼─────┐
        │ Replica 1│ │ Replica 2│ │ Replica 3│
        │ (Read)   │ │ (Read)   │ │ (Read)   │
        └──────────┘ └──────────┘ └──────────┘
              ▲            ▲            ▲
              └────────────┴────────────┘
                      Reads
```

**How it works:**
- All writes go to the primary.
- The primary streams changes (via binlog, WAL, oplog) to replicas.
- Reads can be distributed across replicas to scale read throughput.

**Replication Modes:**
- **Synchronous**: Primary waits until replica confirms the write.
  Strong consistency, higher latency.
- **Asynchronous**: Primary doesn't wait. Lower latency, but replicas
  may serve stale data (replication lag).
- **Semi-synchronous**: Primary waits for *at least one* replica to
  acknowledge. Compromise between the two.

**Advantages:**
- Scale reads horizontally (add more replicas)
- High availability — promote a replica if primary fails
- Offload analytics/reporting to replicas

**Disadvantages:**
- Writes are still bottlenecked at the primary
- Replication lag means replicas may serve stale data
- Failover adds complexity (split-brain risk)
- More hardware and operational overhead

### Master-Master (Multi-Primary) Replication

```
        ┌──────────────┐         ┌──────────────┐
        │   Primary A  │ ◄─────► │   Primary B  │
        │  Read/Write  │         │  Read/Write  │
        └──────────────┘         └──────────────┘
```

**How it works:**
- Multiple nodes accept writes. Each replicates to the others.
- Often used for geographic distribution (one primary per region).

**Advantages:**
- Scale writes across multiple nodes
- Lower write latency for geographically distributed users
- No single point of failure for writes

**Disadvantages:**
- **Conflict resolution** is the hard part:
  - Last-writer-wins (LWW): Simple but can lose data.
  - Application-level resolution: Complex.
  - CRDTs: Specialized data structures that merge automatically.
- Increased write latency if synchronous
- Harder to maintain consistency guarantees
- More complex operationally

### Replication Lag and Its Consequences

| Problem                    | Scenario                                                    | Mitigation                                    |
|----------------------------|-------------------------------------------------------------|-----------------------------------------------|
| Read-after-write anomaly   | User writes, immediately reads from stale replica           | Read-your-writes: route reads to primary after writes |
| Monotonic read anomaly     | User gets newer data, then older data from different replica| Sticky sessions or read from same replica     |
| Causal ordering violation  | Observer sees effect before cause                           | Causal consistency tracking                   |

---

## 5. Federation (Functional Partitioning)

Federation splits your **single monolithic database** into multiple databases,
each responsible for a **different domain** or function.

```
        ┌─────────────┐
        │ Application │
        └──────┬──────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│ Users │ │Orders │ │Products│
│  DB   │ │  DB   │ │   DB   │
└───────┘ └───────┘ └────────┘
```

**How it works:**
- Instead of one database with tables for users, orders, products, payments...
- You use separate databases: a User DB, an Order DB, a Product DB, etc.
- Each database can be independently scaled, maintained, and optimized.

**Advantages:**
- Less read and write traffic to each database
- Less replication lag (smaller datasets to replicate)
- More data can fit in memory → more cache hits
- Can write in parallel (no single write lock bottleneck)
- Independent scaling per domain

**Disadvantages:**
- **No cross-database joins**: You can't `SELECT ... FROM users JOIN orders` anymore.
  You need to do this at the application level.
- Application complexity increases significantly
- **No cross-database transactions**: Need distributed transactions or sagas.
- Schema changes must be coordinated across services.
- Determining the right split is an art, not a science.

### When to Use Federation

- When your monolithic database is hitting scaling limits
- When different parts of your data have very different access patterns
  (e.g., product catalog = read-heavy, order processing = write-heavy)
- When moving toward microservices architecture (one database per service)

---

## 6. Sharding (Horizontal Partitioning)

Sharding distributes data across multiple databases (shards), where each shard
holds a **subset of the same type of data**.

```
                       ┌─────────────────┐
                       │  Application    │
                       └────────┬────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              ┌─────▼────┐ ┌───▼─────┐ ┌───▼─────┐
              │ Shard A  │ │ Shard B │ │ Shard C │
              │ users    │ │ users   │ │ users   │
              │ A-H      │ │ I-P     │ │ Q-Z     │
              └──────────┘ └─────────┘ └─────────┘
```

Federation = split by *function* (different tables in different DBs).
Sharding = split by *data* (same table spread across multiple DBs).

### Sharding Strategies

#### 1. Range-Based Sharding

Partition by a range of values (e.g., user IDs 1-1M on Shard A, 1M-2M on Shard B).

```
Shard Key: user_id
  Shard 1:  user_id 1 - 1,000,000
  Shard 2:  user_id 1,000,001 - 2,000,000
  Shard 3:  user_id 2,000,001 - 3,000,000
```

- **Pros**: Simple, supports range queries efficiently.
- **Cons**: Can lead to **hotspots** if data isn't uniformly distributed.

#### 2. Hash-Based Sharding

Apply a hash function to the shard key to determine the shard.

```
shard_id = hash(user_id) % num_shards
```

- **Pros**: More even distribution of data.
- **Cons**: Range queries become expensive (need to query all shards).
  Adding/removing shards requires data redistribution.

#### 3. Directory-Based Sharding

A lookup service (directory) maps each key to its shard.

```
┌───────────────────┐       ┌─────────────────┐
│ Lookup Service    │       │                 │
│ user_123 → Shard B│──────►│    Shard B      │
│ user_456 → Shard A│       │                 │
│ user_789 → Shard C│       └─────────────────┘
└───────────────────┘
```

- **Pros**: Flexible — can move individual keys between shards.
- **Cons**: Lookup service is a single point of failure and a bottleneck.

#### 4. Consistent Hashing

Uses a hash ring to distribute data. When adding/removing nodes, only
a small fraction of keys needs to be remapped.

```
        A (node)
       / \
      /   \
     /     \
    D       B (node)
     \     /
      \   /
       \ /
        C (node)

Keys are hashed onto the ring and assigned to the next node clockwise.
Adding a node between B and C only affects keys in that arc.
```

- **Pros**: Minimal data movement when scaling.
- **Cons**: Can still have uneven distribution without virtual nodes.
- Used by: Cassandra, DynamoDB, Memcached.

### Choosing a Shard Key

| Criteria                       | Explanation                                         |
|--------------------------------|-----------------------------------------------------|
| High cardinality               | Many distinct values → even distribution            |
| Even distribution              | No single shard gets disproportionate traffic       |
| Query pattern alignment        | Most queries include the shard key in WHERE clause  |
| Avoid cross-shard queries      | Queries should target a single shard when possible  |

**Good shard keys**: user_id, tenant_id, geographic region
**Bad shard keys**: status (too few values), created_date (hotspot on latest shard)

### Handling Cross-Shard Queries

When a query needs data from multiple shards:

```
Application              Shard A     Shard B     Shard C
    │                       │           │           │
    │──── Query Part A ────►│           │           │
    │──── Query Part B ──────────────►│           │
    │──── Query Part C ────────────────────────►│
    │◄─── Result A ─────────│           │           │
    │◄─── Result B ─────────────────────│           │
    │◄─── Result C ─────────────────────────────────│
    │                       │           │           │
    │ Merge/Aggregate       │           │           │
    │ results locally       │           │           │
```

This is called <abbr title="Scatter-gather: when a query must be sent ('scattered') to all shards in parallel, then results are collected ('gathered') and merged by the application. Expensive but sometimes unavoidable for cross-shard queries.">scatter-gather</abbr>. It's expensive but sometimes unavoidable.

### Resharding (Adding/Removing Shards)

One of the hardest operational challenges. Strategies:

1. **Double-write**: Write to both old and new shard; switch reads when caught up.
2. **Ghost tables**: Create shadow tables on the new shard, copy data, swap.
3. **Consistent hashing**: Minimizes data movement (preferred for large-scale systems).
4. **Vitess/ProxySQL**: Use a proxy layer that handles sharding transparently.

### Trade-offs of Sharding

| Advantage                          | Disadvantage                                             |
|------------------------------------|----------------------------------------------------------|
| Horizontal write scaling           | Dramatically increased operational complexity            |
| More data fits in memory per shard | Cross-shard joins are expensive or impossible            |
| Fault isolation (one shard failure)| No cross-shard transactions (need sagas/2PC)             |
| Independent shard optimization     | Resharding is painful                                    |
| Higher overall throughput          | Application-level complexity for routing                 |

**Rule of thumb**: Don't shard until you absolutely have to. Try vertical scaling,
read replicas, caching, and federation first.

---

## 7. Denormalization

Denormalization is the process of adding **redundant data** to your tables to
avoid expensive joins at read time.

### Normalized vs Denormalized

```
NORMALIZED (3NF):
┌──────────┐     ┌────────────┐     ┌───────────┐
│ orders   │     │ customers  │     │ products  │
│──────────│     │────────────│     │───────────│
│ order_id │     │ customer_id│     │ product_id│
│ cust_id  │────►│ name       │     │ name      │
│ prod_id  │────►│ email      │     │ price     │
│ quantity │     │ address    │     │           │
└──────────┘     └────────────┘     └───────────┘

To display an order, you JOIN all three tables.

DENORMALIZED:
┌───────────────────────────────────────┐
│ orders_denormalized                   │
│───────────────────────────────────────│
│ order_id                              │
│ customer_name  (redundant)            │
│ customer_email (redundant)            │
│ product_name   (redundant)            │
│ product_price  (redundant)            │
│ quantity                              │
└───────────────────────────────────────┘

No joins needed. One table has everything.
```

### When to Denormalize

- Your workload is **read-heavy** (reads >> writes by 10x or more)
- Joins are becoming a performance bottleneck
- You're using sharding (cross-shard joins are very expensive)
- You need predictable, low-latency reads

### How to Denormalize

| Technique              | Description                                     | Example                                    |
|------------------------|─────────────────────────────────────────────────|──────────────────────────────────────────────|
| Duplicate columns      | Store frequently-joined columns in referencing table | customer_name in the orders table       |
| Summary/aggregate table| Pre-compute aggregates                          | daily_sales table with totals              |
| Materialized views     | Database-maintained denormalized views          | `CREATE MATERIALIZED VIEW order_summary`   |
| Cache table            | Periodically refreshed denormalized table       | product_catalog_cache                      |

### Trade-offs

| Advantage                    | Disadvantage                                    |
|------------------------------|─────────────────────────────────────────────────|
| Faster reads (no joins)      | Data redundancy → more storage                  |
| Simpler read queries         | Write overhead (must update all copies)         |
| Better with sharding         | Risk of data inconsistency                      |
| Predictable performance      | More complex application logic                  |

### Keeping Denormalized Data in Sync

1. **Application-level**: Update all copies in the same transaction (if possible).
2. **Triggers**: Database triggers update denormalized copies automatically.
3. **<abbr title="Change Data Capture (CDC): reads the database's transaction log in real-time to capture every insert, update, and delete as an event stream. Allows you to sync changes to other systems without polling. Tools: Debezium, AWS DMS.">Change Data Capture (CDC)</abbr>**: Tools like Debezium stream changes and update copies.
4. **<abbr title="Materialized views: a database object that stores the result of a query physically on disk, like a cached query result. Unlike a regular view (which runs the query every time), a materialized view is pre-computed and periodically refreshed.">Materialized views</abbr>**: Database refreshes them automatically (periodic or on-demand).

---

## 8. SQL Tuning

SQL tuning is about making queries run faster without changing what they return.

### The Query Execution Pipeline

```
SQL Query
    │
    ▼
┌──────────────┐
│   Parser     │  Syntax check, parse tree
└──────┬───────┘
       ▼
┌──────────────┐
│  Optimizer   │  Generate execution plans, choose cheapest
└──────┬───────┘
       ▼
┌──────────────┐
│  Executor    │  Execute the chosen plan
└──────┬───────┘
       ▼
   Results
```

### Index Basics

An index is a data structure (usually a **B-tree** or **B+ tree**) that speeds up
lookups at the cost of extra storage and slower writes.

```
B+ Tree Index on user_id:

              ┌───────────┐
              │  50 | 100  │        (Internal nodes: routing)
              └──┬────┬───┘
           ┌─────┘    └─────┐
     ┌─────▼─────┐   ┌─────▼─────┐
     │ 10|20|30  │   │ 60|70|80  │  (Internal nodes)
     └─┬──┬──┬──┘   └─┬──┬──┬──┘
       │  │  │         │  │  │
       ▼  ▼  ▼         ▼  ▼  ▼
   [Leaf nodes with actual row pointers, linked together]
   ◄──►◄──►◄──►       ◄──►◄──►◄──►
```

### Types of Indexes

| Type                 | Description                                   | Use Case                              |
|----------------------|-----------------------------------------------|---------------------------------------|
| B-tree / B+ tree     | Default, balanced tree, sorted                | Range queries, equality               |
| Hash index           | Hash table, O(1) equality lookups             | Exact lookups only                    |
| Composite index      | Index on multiple columns                     | Multi-column WHERE/ORDER BY           |
| Covering index       | Index contains all needed columns             | Avoid table lookup entirely           |
| Partial index        | Index on a subset of rows (with WHERE)        | Active users, recent orders           |
| Full-text index      | For text search (inverted index)              | Search functionality                  |
| GiST / GIN (PG)     | For JSONB, arrays, geospatial, full-text      | Complex data types in Postgres        |

### Common SQL Tuning Techniques

#### 1. Use EXPLAIN to Understand Query Plans

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;

-- Look for:
--   Seq Scan  → TABLE SCAN (bad for large tables, needs index)
--   Index Scan → Using index (good)
--   Hash Join vs Nested Loop → Join strategy
--   Sort → May need index for ORDER BY
--   Rows → Estimated vs actual (large mismatch = stale statistics)
```

#### 2. Index the Right Columns

```sql
-- Add index for frequently filtered columns
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Composite index for multi-column queries
-- Column order matters! Put the most selective column first.
CREATE INDEX idx_orders_cust_status ON orders(customer_id, status);

-- Covering index (all needed columns in the index)
CREATE INDEX idx_orders_covering ON orders(customer_id, status)
  INCLUDE (total, created_at);
```

#### 3. Avoid SELECT *

```sql
-- Bad: fetches all columns, can't use covering index
SELECT * FROM orders WHERE customer_id = 42;

-- Good: only fetch what you need
SELECT order_id, total, status FROM orders WHERE customer_id = 42;
```

#### 4. Avoid <abbr title="N+1 query problem: fetching N items with one query, then making one additional query per item to get related data. With 100 users, this creates 101 queries instead of 1. Solved by using JOINs or eager loading.">N+1 Queries</abbr>

```python
# BAD: N+1 problem (1 query + N queries)
users = db.query("SELECT * FROM users LIMIT 100")
for user in users:
    orders = db.query(f"SELECT * FROM orders WHERE user_id = {user.id}")

# GOOD: Single query with JOIN
results = db.query("""
    SELECT u.*, o.*
    FROM users u
    JOIN orders o ON o.user_id = u.id
    LIMIT 100
""")
```

#### 5. Partitioning Large Tables

```sql
-- Range partitioning by date
CREATE TABLE orders (
    order_id BIGINT,
    created_at TIMESTAMP,
    total DECIMAL
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE orders_2025 PARTITION OF orders
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

Benefits: Queries that filter by `created_at` only scan the relevant partition.
Old data can be easily archived by dropping or detaching old partitions.

#### 6. Other Tips

- **Avoid functions on indexed columns**: `WHERE YEAR(created_at) = 2024`
  defeats the index. Use `WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'`.
- **Use LIMIT**: Always paginate large result sets.
- **Batch writes**: Insert/update in batches instead of one row at a time.
- **Connection pooling**: Reuse database connections (PgBouncer, HikariCP).
- **Vacuum/Analyze**: Keep table statistics up to date (PostgreSQL).
- **Use read replicas**: Offload read-heavy queries to replicas.

---

## 9. NoSQL Databases

NoSQL (Not Only SQL) databases provide flexible schemas and are designed for
specific access patterns. They sacrifice some RDBMS guarantees for scalability and performance.

### 9.1 Key-Value Stores

The simplest NoSQL model. Data is stored as key-value pairs.

```
┌──────────────────────────────────────┐
│  Key              │  Value           │
│───────────────────│──────────────────│
│  user:123         │  {name: "Alice"} │
│  session:abc      │  {token: "..."}  │
│  cache:product:42 │  {name: "Widget"}│
└──────────────────────────────────────┘
```

**Characteristics:**
- O(1) lookup by key — extremely fast.
- No query language (just GET, SET, DELETE).
- Values are opaque to the database — it doesn't understand the structure.
- Typically stored in memory (Redis) or on disk (RocksDB, LevelDB).

**Examples:**
| Database  | Notes                                           |
|-----------|-------------------------------------------------|
| Redis     | In-memory, rich data structures (lists, sets, sorted sets, hashes) |
| Memcached | In-memory, simple key-value, multi-threaded       |
| DynamoDB  | Managed by AWS, partition key + sort key           |
| etcd      | Distributed, used for service discovery (Kubernetes)|
| Riak      | Distributed, high availability                     |

**Use Cases:**
- Session management
- Caching (most common)
- User preferences/settings
- Rate limiting counters
- Leaderboards (Redis sorted sets)

### 9.2 Document Stores

Stores data as semi-structured documents (usually JSON or BSON).

```json
{
  "_id": "order_123",
  "customer": {
    "name": "Alice",
    "email": "alice@example.com"
  },
  "items": [
    {"product": "Widget", "qty": 2, "price": 9.99},
    {"product": "Gadget", "qty": 1, "price": 24.99}
  ],
  "total": 44.97,
  "status": "shipped"
}
```

**Characteristics:**
- Documents can have different fields (flexible schema).
- Supports nested objects, arrays — models real-world entities naturally.
- Can query and index on any field within the document.
- Documents are typically self-contained (denormalized).

**Examples:**
| Database    | Notes                                               |
|-------------|-----------------------------------------------------|
| MongoDB     | Most popular, BSON, rich query language, aggregation pipeline |
| CouchDB     | HTTP API, built-in replication, eventual consistency |
| Amazon DocumentDB | MongoDB-compatible, managed by AWS              |
| Firestore   | Google Cloud, real-time sync for mobile/web         |

**Use Cases:**
- Content management systems
- Product catalogs (varying attributes per product)
- User profiles
- Event logging
- Mobile app backends (especially Firestore)

### 9.3 Wide-Column Stores

Data is stored in tables with rows and dynamic columns. Each row can have a
different set of columns. Data is grouped by column families.

```
Row Key    │ Column Family: profile  │ Column Family: activity
───────────│─────────────────────────│──────────────────────────
user_123   │ name=Alice, age=30      │ last_login=2024-01-15
user_456   │ name=Bob                │ last_login=2024-01-14, 
           │                         │ last_purchase=2024-01-10
user_789   │ name=Carol, age=25,     │ last_login=2024-01-15
           │ city=NYC                │
```

**Characteristics:**
- Optimized for writing and reading large volumes of data.
- Data is sorted by row key → efficient range scans.
- Column families are stored together on disk → reads within a family are fast.
- Eventually consistent (configurable per query in Cassandra).
- No joins, no complex queries.

**Examples:**
| Database    | Notes                                              |
|────────────|──────────────────────────────────────────────────── |
| Cassandra   | Linear scalability, tunable consistency, peer-to-peer |
| HBase       | Built on HDFS, strongly consistent, good for analytics |
| ScyllaDB    | C++ rewrite of Cassandra, lower latency              |
| BigTable    | Google's original, managed via Cloud Bigtable        |

**Use Cases:**
- Time-series data (IoT sensor readings, metrics)
- Event logging / audit trails
- Messaging systems (Discord uses Cassandra)
- Recommendation engines (user-item matrices)

### 9.4 Graph Databases

Stores data as **nodes** (entities) and **edges** (relationships).
Both nodes and edges can have properties.

```
     ┌──────────┐    FOLLOWS    ┌──────────┐
     │  Alice   │──────────────►│   Bob    │
     │ (User)   │               │ (User)   │
     └────┬─────┘               └────┬─────┘
          │                          │
    LIKES │                    LIKES │
          │                          │
     ┌────▼─────┐               ┌────▼─────┐
     │ Post #1  │               │ Post #2  │
     │ (Post)   │               │ (Post)   │
     └──────────┘               └──────────┘
```

**Characteristics:**
- Relationships are first-class citizens (not computed via joins).
- Traversals across relationships are O(1) per hop (<abbr title="Index-free adjacency: in graph databases, each node directly stores pointers to its adjacent nodes, so following a relationship takes constant time regardless of graph size. This is much faster than SQL joins which must look up foreign keys via indexes.">index-free adjacency</abbr>).
- Query languages: Cypher (Neo4j), Gremlin (Apache TinkerPop).
- Not designed for bulk analytics or simple key-value lookups.

**Examples:**
| Database    | Notes                                         |
|-------------|-----------------------------------------------|
| Neo4j       | Most popular, Cypher query language, ACID      |
| Amazon Neptune | Managed, supports Gremlin and SPARQL        |
| JanusGraph  | Distributed, can use various backends          |
| ArangoDB    | Multi-model (document + graph + key-value)     |

**Cypher Query Example:**
```cypher
// Find friends of friends who Alice doesn't already follow
MATCH (alice:User {name: "Alice"})-[:FOLLOWS]->()-[:FOLLOWS]->(fof:User)
WHERE NOT (alice)-[:FOLLOWS]->(fof) AND fof <> alice
RETURN DISTINCT fof.name
```

**Use Cases:**
- Social networks (friends, followers, connections)
- Recommendation engines ("people who bought X also bought Y")
- Fraud detection (finding suspicious patterns in transaction graphs)
- Knowledge graphs (entities and their relationships)
- Network topology (infrastructure, routing)

---

## 10. SQL vs NoSQL

### Decision Matrix

| Factor                    | SQL (RDBMS)                          | NoSQL                                   |
|---------------------------|--------------------------------------|-----------------------------------------|
| Schema                    | Rigid, predefined                    | Flexible, schema-on-read                |
| Query language            | SQL (standardized)                   | Varies by database                      |
| Transactions              | Full ACID                            | Varies (some offer it, most don't)      |
| Joins                     | Native, powerful                     | Usually not supported                   |
| Scaling model             | Vertical (mostly)                    | Horizontal (designed for it)            |
| Consistency               | Strong by default                    | Eventual by default (tunable)           |
| Schema changes            | Migrations required                  | Just add/remove fields                  |
| Data model                | Tables with rows                     | Documents, key-value, columns, graphs   |
| Maturity                  | Decades of tooling                   | Newer, evolving rapidly                 |
| Write throughput           | Limited by single node               | Can scale linearly with nodes           |

### When to Choose SQL

- Data is **highly relational** (many foreign keys, complex joins)
- You need **ACID transactions** (banking, e-commerce checkout)
- Your schema is **stable and well-defined**
- You need **complex queries** (multi-table joins, aggregations, window functions)
- Strong consistency is a hard requirement
- Team has SQL expertise

### When to Choose NoSQL

- Your data model is **hierarchical or denormalized** (fits a document)
- You need to scale **writes horizontally** across many nodes
- Schema is **rapidly evolving** (startup, iterating on product)
- Access patterns are **simple** (key lookups, no complex joins)
- You need **very low latency** at massive scale
- Strong consistency is not a hard requirement

### The Reality: <abbr title="Polyglot persistence: using multiple different database technologies within a single application, each chosen for what it does best (e.g., PostgreSQL for transactions, Redis for caching, Elasticsearch for search)">Polyglot Persistence</abbr>

Most real-world systems use **multiple databases**:

```
┌─────────────┐
│  Application│
└──────┬──────┘
       │
  ┌────┼────────────┬──────────────┐
  │    │            │              │
  ▼    ▼            ▼              ▼
PostgreSQL    Redis         MongoDB        Elasticsearch
(Users,       (Sessions,   (Product       (Full-text
 Orders,       Cache,       Catalog,       search,
 Payments)     Rate limits) CMS content)   Logs)
```

Use the right database for each use case. Don't force one database to do everything.

---

## 11. Database Indexing Deep Dive

### How B+ Trees Work

B+ trees are the default index structure in most RDBMS. They provide:
- O(log n) lookups, inserts, and deletes
- Efficient range scans (leaf nodes are linked)
- Self-balancing

```
Query: SELECT * FROM users WHERE age = 25

Without index (Full Table Scan):
  Scan ALL rows → O(n)
  1 million rows = 1 million comparisons

With B+ tree index on age:
  Tree height ≈ log(n) ≈ 20
  Only 20 disk reads to find the row → O(log n)
```

### Composite Index Column Order Matters

```sql
CREATE INDEX idx_name_date ON orders(customer_name, created_at);

-- USES the index (leftmost prefix rule):
SELECT * FROM orders WHERE customer_name = 'Alice';
SELECT * FROM orders WHERE customer_name = 'Alice' AND created_at > '2024-01-01';

-- DOES NOT use the index:
SELECT * FROM orders WHERE created_at > '2024-01-01';
-- Because 'created_at' is the second column, and you skipped 'customer_name'.
```

**Leftmost Prefix Rule**: A composite index on (A, B, C) can be used for queries on:
- (A)
- (A, B)
- (A, B, C)
But NOT for queries on just (B), (C), or (B, C).

### Write Amplification from Indexes

Every index must be updated on every write. More indexes = slower writes.

```
INSERT INTO orders (customer_id, status, total, created_at) VALUES (...);

Updates needed:
  1. Write to the table (heap/clustered index)
  2. Update idx_customer_id
  3. Update idx_status
  4. Update idx_created_at
  5. Update idx_customer_status (composite)
  
5 writes instead of 1. Each index makes writes slower.
```

**Rule of thumb**: 3-5 indexes per table is typical. More than 10 is a red flag.
Focus indexes on columns that appear in WHERE, JOIN, ORDER BY, and GROUP BY clauses.

---

## 12. Connection Pooling

Opening a database connection is expensive (TCP handshake, TLS, authentication, etc.).
Connection pools maintain a set of reusable connections.

```
┌─────────────────────┐      ┌─────────────────────┐
│ Application Server  │      │   Connection Pool    │      ┌──────────┐
│                     │      │  ┌─────┐ ┌─────┐    │      │          │
│  Thread 1 ──────────┼──────┼─►│Conn1│ │Conn2│────┼──────┤ Database │
│  Thread 2 ──────────┼──────┼─►│Conn3│ │Conn4│────┼──────┤          │
│  Thread 3 (waiting) │      │  │     │ │(idle)│   │      │          │
│                     │      │  └─────┘ └─────┘    │      └──────────┘
└─────────────────────┘      │  min=2, max=10      │
                             └─────────────────────┘
```

### Common Pool Settings

| Setting         | Description                               | Typical Value      |
|-----------------|-------------------------------------------|--------------------|
| min_pool_size   | Minimum connections kept open             | 2-5                |
| max_pool_size   | Maximum connections allowed               | 10-50              |
| connection_timeout | How long to wait for available connection | 5-30 seconds     |
| idle_timeout    | Close idle connections after this time     | 5-10 minutes       |
| max_lifetime    | Max lifetime of a connection              | 30-60 minutes      |

### Popular Connection Poolers

- **PgBouncer** (PostgreSQL) — external, lightweight
- **Pgpool-II** (PostgreSQL) — external, also does load balancing
- **HikariCP** (Java) — in-process, extremely fast
- **ProxySQL** (MySQL) — external, query routing + pooling

### Formula: How Many Connections?

PostgreSQL recommends:
```
max_connections = (number_of_CPU_cores * 2) + number_of_disks

Example: 8 cores, 2 SSDs
  max_connections = (8 * 2) + 2 = 18

With 5 app servers, each with a pool of max 10:
  Total potential connections = 50
  But database only handles 18 efficiently!
  → Use PgBouncer to multiplex 50 app connections over 18 DB connections.
```

---

## 13. Database Migration Strategies

### Schema Migrations

Changing your database schema in production requires careful planning.

#### Expand-Contract (Zero-Downtime) Pattern

```
Phase 1: EXPAND
  - Add new column/table (nullable or with default)
  - Deploy code that writes to BOTH old and new

Phase 2: MIGRATE
  - Backfill existing data into new column/table
  - Verify data integrity

Phase 3: CONTRACT
  - Deploy code that reads from new column/table
  - Drop old column/table
```

**Example: Renaming a column**

```
Step 1: ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
Step 2: Deploy code that writes to both 'name' and 'full_name'
Step 3: Run backfill: UPDATE users SET full_name = name WHERE full_name IS NULL;
Step 4: Deploy code that reads from 'full_name'
Step 5: Deploy code that stops writing to 'name'
Step 6: ALTER TABLE users DROP COLUMN name;
```

### Data Migration Between Databases

When migrating from one database to another (e.g., MySQL → PostgreSQL):

1. **Dual-write**: Application writes to both old and new databases.
2. **Shadow reads**: Read from both, compare results, but only return old DB results.
3. **Cutover**: Switch reads to new database once validated.
4. **Cleanup**: Stop writing to old database. Decommission.

Tools: AWS DMS, Debezium (CDC), Flyway, Liquibase, Alembic (Python).

---

## 14. Key Takeaways

### Golden Rules

1. **Start with a relational database.** PostgreSQL covers 80% of use cases.
2. **Add read replicas** before anything else when you need to scale reads.
3. **Add caching** (Redis/Memcached) before you add complexity to the database layer.
4. **Don't shard until you must.** Sharding is a one-way door that adds massive complexity.
5. **Choose the right tool for each job.** Polyglot persistence is normal at scale.
6. **Index wisely.** Too few = slow reads. Too many = slow writes.
7. **Denormalize only when joins are the proven bottleneck.** Not prematurely.
8. **Measure, don't guess.** Use EXPLAIN ANALYZE, slow query logs, and monitoring.

### Scaling Ladder

```
Start here:
  1. Single database (PostgreSQL/MySQL)
  2. Add connection pooling (PgBouncer)
  3. Add read replicas
  4. Add caching layer (Redis)
  5. Federation (split by domain)
  6. Denormalization
  7. SQL tuning + indexing improvements
  8. Sharding (last resort for RDBMS)
  9. Consider NoSQL for specific use cases
```

### Quick Reference: Database Terminology

| Term            | Definition                                                   |
|-----------------|--------------------------------------------------------------|
| OLTP            | Online Transaction Processing — many small, fast transactions|
| OLAP            | Online Analytical Processing — complex queries on large data |
| CAP             | Consistency, Availability, Partition tolerance               |
| WAL             | Write-Ahead Log — durability mechanism                       |
| MVCC            | Multi-Version Concurrency Control — concurrent reads/writes  |
| CDC             | Change Data Capture — stream DB changes to other systems     |
| Replication lag | Delay between primary write and replica receiving the change |
| Hot spot        | A shard/partition receiving disproportionate traffic         |
| Tombstone       | Marker for deleted data (in distributed DBs like Cassandra)  |
| Compaction      | Process of merging/cleaning up SSTables or LSM tree segments |

---

## 🔥 Senior Interview Questions

1. You're designing a system that handles 1 billion rows of user activity data per day. Walk through your database choice (SQL vs NoSQL), schema design, partitioning strategy, and how you'd handle queries spanning multiple partitions. [Answer](QnA-Answer-Key.md#11-databases)

2. Compare the internal architecture of PostgreSQL (B-tree, MVCC, WAL) vs Cassandra (LSM tree, SSTables, compaction). How do these architectural differences make each better suited for different workloads? [Answer](QnA-Answer-Key.md#11-databases)

3. Your sharded database has a hot partition — one shard receives 80% of all writes. How did this happen, and what are your options to fix it? Discuss consistent hashing, virtual nodes, and shard splitting. [Answer](QnA-Answer-Key.md#11-databases)

4. An interviewer asks: "When would you use both SQL and NoSQL in the same system?" Describe a concrete architecture where this makes sense, how data flows between them, and how you keep them in sync. [Answer](QnA-Answer-Key.md#11-databases)

5. You need to add a new column to a table with 10 billion rows in a live production database with zero downtime. Walk through the migration strategy. Compare online DDL (gh-ost, pt-online-schema-change) vs expand-and-contract. [Answer](QnA-Answer-Key.md#11-databases)

6. Explain the N+1 query problem, how ORMs cause it, and three different approaches to fix it (eager loading, batching, joins). At what scale does this become a critical performance issue? [Answer](QnA-Answer-Key.md#11-databases)

7. Your read replicas have 5 seconds of replication lag. A user writes data and immediately reads it from a replica, seeing stale data. How do you solve this without routing all reads to the primary? [Answer](QnA-Answer-Key.md#11-databases)

8. Compare DynamoDB's single-table design pattern with a traditional multi-table relational approach. When does the single-table pattern shine, and when does it become unmaintainable? [Answer](QnA-Answer-Key.md#11-databases)

9. You need ACID transactions across two different databases (e.g., PostgreSQL and MongoDB). How do you achieve this? Discuss two-phase commit, the Saga pattern, and the Outbox pattern. [Answer](QnA-Answer-Key.md#11-databases)

10. Your database needs to handle 500,000 writes per second. Walk through the spectrum of solutions: vertical scaling → write-behind caching → sharding → event sourcing → specialized time-series DBs. When would you jump to each level? [Answer](QnA-Answer-Key.md#11-databases)

---

## 📚 Further Reading

- [Designing Data-Intensive Applications by Martin Kleppmann](https://dataintensive.net/) — The bible of database internals and distributed data systems.
- [Things You Should Know About Databases (Architecture Notes)](https://architecturenotes.co/things-you-should-know-about-databases/) — Practical visual guide to database concepts.
- [CMU Database Group Lectures (YouTube)](https://www.youtube.com/c/CMUDatabaseGroup) — Andy Pavlo's graduate-level database engineering lectures.
