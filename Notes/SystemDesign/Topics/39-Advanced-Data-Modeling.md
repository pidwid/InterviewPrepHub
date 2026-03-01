# Advanced Data Modeling Patterns

## Table of Contents

1. [Overview](#1-overview)
2. [DynamoDB Single-Table Design](#2-dynamodb-single-table-design)
3. [Cassandra Partition Design](#3-cassandra-partition-design)
4. [Time-Series Data Modeling](#4-time-series-data-modeling)
5. [Denormalization Patterns](#5-denormalization-patterns)
6. [Polymorphic Data Models](#6-polymorphic-data-models)
7. [Event Sourcing Data Model](#7-event-sourcing-data-model)
8. [Multi-Tenant Data Modeling](#8-multi-tenant-data-modeling)
9. [Schema Evolution](#9-schema-evolution)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Data modeling for NoSQL databases is fundamentally different from relational
modeling. In SQL, you model your data and worry about access patterns later.
In NoSQL, you model your data **around your access patterns**.

```
SQL approach:                      NoSQL approach:
1. Define entities                 1. Define access patterns
2. Normalize (3NF)                 2. Model data to serve those patterns
3. Write queries for any pattern   3. Denormalize aggressively
4. Add indexes for performance     4. One table can serve many patterns

"What data do I have?"             "How will I query this data?"
```

---

## 2. DynamoDB Single-Table Design

The practice of storing all entities in a single DynamoDB table using
carefully designed partition keys (PK) and sort keys (SK).

```
Traditional (multi-table):         Single-table:
┌─────────────┐                    ┌──────────────────────────────┐
│ Users table │                    │ Single table                  │
├─────────────┤                    │                               │
│ Orders table│                    │ PK          │ SK      │ Data  │
├─────────────┤                    │ USER#123    │ PROFILE │ {...} │
│ Products    │                    │ USER#123    │ ORDER#1 │ {...} │
└─────────────┘                    │ USER#123    │ ORDER#2 │ {...} │
                                   │ ORDER#1     │ ITEM#A  │ {...} │
                                   │ ORDER#1     │ ITEM#B  │ {...} │
                                   │ PRODUCT#A   │ META    │ {...} │
                                   └──────────────────────────────┘
```

### Access Pattern Mapping

```
Access Patterns → Key Design:

1. "Get user profile"
   PK = "USER#123", SK = "PROFILE"
   → GetItem (O(1))

2. "Get all orders for a user"
   PK = "USER#123", SK begins_with("ORDER#")
   → Query on PK + SK prefix

3. "Get all items in an order"
   PK = "ORDER#1", SK begins_with("ITEM#")
   → Query on PK + SK prefix

4. "Get orders by date range"
   GSI: GSI1PK = "USER#123", GSI1SK = "2024-01-15T10:00:00"
   → Query on GSI with SK range
```

### Global Secondary Index (GSI) Overloading

```
Main table:
  PK          │ SK          │ GSI1PK     │ GSI1SK
  USER#123    │ PROFILE     │ us-east    │ USER#123
  USER#123    │ ORDER#001   │ PENDING    │ 2024-01-15
  USER#456    │ PROFILE     │ eu-west    │ USER#456
  USER#456    │ ORDER#002   │ SHIPPED    │ 2024-01-14

GSI1 enables:
  - "Get all users in region us-east"     (GSI1PK = "us-east")
  - "Get all pending orders"              (GSI1PK = "PENDING")
  - "Get pending orders sorted by date"   (GSI1PK = "PENDING", GSI1SK range)

Different entity types reuse the same GSI columns!
```

### When to Use Single-Table

```
Use single-table when:
  ✓ Well-defined access patterns
  ✓ Need joins-without-joins (get related data in one query)
  ✓ High scale, low latency requirements
  ✓ DynamoDB is your primary store

Avoid single-table when:
  ✗ Access patterns are unknown or changing frequently
  ✗ Team is unfamiliar with DynamoDB
  ✗ Data is highly relational (many-to-many everywhere)
  ✗ Ad-hoc query/analytics needs (use SQL for that)
```

---

## 3. Cassandra Partition Design

Cassandra's partition key determines which node stores the data.
Good partition design = even data distribution + efficient queries.

```
CREATE TABLE messages (
    channel_id UUID,
    message_time TIMESTAMP,
    message_id UUID,
    author TEXT,
    content TEXT,
    PRIMARY KEY ((channel_id), message_time, message_id)
);

  Partition Key: channel_id (which node)
  Clustering Keys: message_time, message_id (sort order within partition)

Query: "Get latest 50 messages in channel X"
  SELECT * FROM messages 
  WHERE channel_id = X 
  ORDER BY message_time DESC 
  LIMIT 50;
  
  → Hits exactly ONE partition → fast!
```

### Partition Sizing

```
Rules:
  - Target: < 100 MB per partition (hard limit: 2 GB)
  - Too large → slow reads, unbalanced cluster
  - Too small → too many partitions, overhead

Problem: Chat channel with millions of messages
  Partition on channel_id alone → partition too large!

Solution: Bucketing (compound partition key)
  PRIMARY KEY ((channel_id, bucket), message_time, message_id)
  
  bucket = date or incrementing counter
  
  channel_id = "general", bucket = "2024-01-15"
  → One partition per channel per day
  → Each partition stays manageable
```

### Anti-Patterns

```
✗ SELECT * without WHERE (full table scan)
✗ WHERE on non-partition key without ALLOW FILTERING
✗ Unbounded partition growth
✗ Too many secondary indexes (use materialized views or denormalize)
✗ Using Cassandra for ad-hoc analytics (use Spark on top)
```

---

## 4. Time-Series Data Modeling

```
Time-series data: metrics, IoT sensors, logs, stock prices.
High write throughput, append-only, queries by time range.

Table design (Cassandra):
  CREATE TABLE sensor_data (
      sensor_id TEXT,
      day TEXT,          -- Bucket by day
      reading_time TIMESTAMP,
      value DOUBLE,
      PRIMARY KEY ((sensor_id, day), reading_time)
  ) WITH CLUSTERING ORDER BY (reading_time DESC);

  "Get today's readings for sensor X":
    SELECT * FROM sensor_data 
    WHERE sensor_id = 'X' AND day = '2024-01-15';

Time-series databases:
  ├── InfluxDB: Purpose-built, SQL-like query
  ├── TimescaleDB: PostgreSQL extension
  ├── Prometheus: Metrics monitoring
  ├── Amazon Timestream: Managed
  └── ClickHouse: Analytics, columnar

Key optimizations:
  ├── Compression: Delta encoding, gorilla compression
  ├── Downsampling: 1-second → 1-minute → 1-hour aggregates
  ├── TTL/retention: Auto-delete old data
  └── Pre-aggregation: Store rollups alongside raw data
```

---

## 5. Denormalization Patterns

### Write-Time Joins

```
In SQL you JOIN at read time:
  SELECT * FROM orders o JOIN users u ON o.user_id = u.id

In NoSQL you "join" at write time:
  When order is created, embed user info directly:
  {
    "order_id": "O001",
    "user_id": "U123",
    "user_name": "Alice",          ← Denormalized from users
    "user_email": "alice@mail.com", ← Denormalized from users
    "items": [...]
  }

  Read: Get order → all data in one read. No join.
  Trade-off: If user changes name, must update ALL their orders.
```

### Materialized Views / Precomputed Aggregates

```
Instead of computing at query time, precompute and store:

Real-time:
  User likes a post → Increment likes_count in post document
  → No need to COUNT(*) on a likes table

Periodic:
  Every hour, compute:
    - Top 100 trending posts
    - User's unread notification count
    - Category-level product counts
  Store in a precomputed table / cache.
```

### Fan-Out Patterns

```
Fan-out on write (Twitter timeline):
  User posts → write to ALL followers' timelines
  Read: just read your timeline (precomputed, fast)
  Write: O(N followers) per post
  
Fan-out on read:
  Read: query all followed users' posts, merge, rank
  Write: O(1) per post
  Read: O(N following) per read
  
Hybrid (Twitter actual approach):
  Regular users: fan-out on write
  Celebrities (>1M followers): fan-out on read
```

---

## 6. Polymorphic Data Models

Storing different entity types in the same collection.

```
MongoDB example:
  Collection: "content"
  
  { type: "article", title: "...", body: "...", author: "..." }
  { type: "video",   title: "...", url: "...", duration: 120 }
  { type: "podcast", title: "...", url: "...", episodes: [...] }

  Common fields: type, title, created_at
  Type-specific fields: body (article), duration (video)

Query all content:  db.content.find({}).sort({created_at: -1})
Query videos only:  db.content.find({type: "video"})

Pros: Flexible schema, unified queries across types
Cons: No schema enforcement (use validation rules), sparse indexes
```

### Discriminated Unions in SQL

```sql
-- Option 1: Single Table Inheritance
CREATE TABLE content (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20),     -- 'article', 'video', 'podcast'
    title TEXT,
    body TEXT,            -- NULL for non-articles
    video_url TEXT,       -- NULL for non-videos
    duration INT          -- NULL for non-videos
);

-- Option 2: Table per Type (separate tables)
-- Option 3: Shared table + type-specific tables (Class Table Inheritance)

CREATE TABLE content (id SERIAL PRIMARY KEY, type TEXT, title TEXT);
CREATE TABLE article_details (content_id INT REFERENCES content, body TEXT);
CREATE TABLE video_details (content_id INT REFERENCES content, url TEXT, duration INT);
```

---

## 7. Event Sourcing Data Model

```
Instead of storing current state, store the sequence of events:

Traditional (state-based):
  Account: { id: A1, balance: 750 }

Event Sourced:
  Event Stream for A1:
  ┌───┬────────────────┬────────┬───────────┐
  │ # │ Event          │ Amount │ Timestamp │
  ├───┼────────────────┼────────┼───────────┤
  │ 1 │ AccountOpened  │ 0      │ Jan 1     │
  │ 2 │ MoneyDeposited │ +1000  │ Jan 2     │
  │ 3 │ MoneyWithdrawn │ -200   │ Jan 5     │
  │ 4 │ MoneyWithdrawn │ -50    │ Jan 10    │
  └───┴────────────────┴────────┴───────────┘
  
  Current balance = replay: 0 + 1000 - 200 - 50 = 750
  
  Benefits:
    - Full audit trail
    - Can rebuild state at any point in time
    - Can add new projections retroactively
```

### Snapshots

```
Problem: Replaying 1M events is slow.
Solution: Periodic snapshots.

  Events: [1] [2] [3] ... [999] [1000] [Snapshot: balance=750]
  
  [1001] [1002] [1003]
  
  To get current state:
    Load snapshot (balance=750) + replay events 1001-1003
    Much faster than replaying all 1003 events.
```

---

## 8. Multi-Tenant Data Modeling

```
Three approaches:

1. Shared Database, Shared Schema (Pool Model):
   ┌────────────────────────────────────────┐
   │ Table: orders                          │
   │ tenant_id │ order_id │ amount │ ...    │
   │ A         │ 1        │ 50     │        │
   │ B         │ 2        │ 75     │        │
   │ A         │ 3        │ 30     │        │
   └────────────────────────────────────────┘
   Cheapest. Add tenant_id to every query.
   Risk: Noisy neighbor, data leakage.

2. Shared Database, Separate Schemas:
   Schema "tenant_a" → orders, users, products
   Schema "tenant_b" → orders, users, products
   Better isolation. Migration requires updating all schemas.

3. Separate Databases:
   Database per tenant.
   Best isolation. Most expensive. Hardest to manage.

Decision factors:
  # of tenants │ Isolation needed │ Recommended
  < 10          │ High             │ Separate databases
  10-1000       │ Medium           │ Separate schemas  
  1000+         │ Low              │ Shared (Pool)
```

---

## 9. Schema Evolution

```
How to change data models without downtime:

SQL:
  1. Add new column (nullable or with default)
  2. Backfill existing rows
  3. Update application to use new column
  4. (Eventually) drop old column
  
  ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL;
  -- Backfill: UPDATE users SET phone = ... WHERE ...
  -- Deploy app code that uses phone column
  -- Later: ALTER TABLE users DROP COLUMN old_phone;

NoSQL / Event Schemas:
  Use schema versions:
  { "version": 1, "name": "Alice" }
  { "version": 2, "name": "Alice", "phone": "555-1234" }
  
  Application handles both versions:
    if (doc.version === 1) { /* handle v1 */ }
    else if (doc.version === 2) { /* handle v2 */ }

  Or: Lazy migration — update to v2 on read:
    Read v1 doc → transform to v2 → write back → return v2
```

### Backward / Forward Compatibility

```
Backward compatible: New code can read OLD data ✓
  → Always support reading older schema versions

Forward compatible: OLD code can read NEW data ✓
  → New fields should be optional / have defaults
  → Old code ignores unknown fields

Both are critical for zero-downtime deployments:
  Deploy new code (reads old + new data) ← backward compat
  Write new data format
  Old code still running (reads new data) ← forward compat
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| NoSQL: model for access patterns | Design around queries, not entities |
| DynamoDB single-table is powerful | One table + GSIs can serve many access patterns |
| Cassandra: partition key is everything | Determines data placement, query efficiency, hotspots |
| Denormalize for read performance | Write-time joins, precomputed aggregates |
| Time-series needs special modeling | Bucket by time, downsample, TTL old data |
| Fan-out on write vs read | Trade-off between write amplification and read latency |
| Event sourcing gives full history | But needs snapshots for performance |
| Multi-tenant: isolation vs cost | Pool (cheap, shared) vs silo (expensive, isolated) |
| Schema evolution requires compatibility | Backward + forward compatibility for zero-downtime |
| Hybrid is common | OLTP in NoSQL + replicate to SQL/warehouse for analytics |
