# Read-Heavy vs Write-Heavy Systems

> "Is this read-heavy or write-heavy?" is one of the most common opening prompts in modern system design interviews. Identifying the workload shape first drives every downstream decision — caching, replication, database choice, sharding strategy.

---

## Table of Contents

1. [The Core Question](#1-the-core-question)
2. [Read-Heavy Systems](#2-read-heavy-systems)
3. [Write-Heavy Systems](#3-write-heavy-systems)
4. [Decision Framework](#4-decision-framework)
5. [Mixed Workloads (CQRS)](#5-mixed-workloads-cqrs)
6. [Trade-Off Cheat Sheet](#6-trade-off-cheat-sheet)
7. [Senior Interview Power Moves](#7-senior-interview-power-moves)
8. [Quick Reference](#8-quick-reference--match-workload-to-architecture)
9. [Senior Interview Questions](#9-senior-interview-questions)

---

## 1. The Core Question

Before drawing a single box, ask the interviewer:

> "What's the read:write ratio? And what does the access distribution look like — is the read load on a small hot set or spread across all data?"

Common ratios:

| System | R:W ratio | Type |
|--------|-----------|------|
| Twitter timeline | 100:1 to 1000:1 | Read-heavy |
| Instagram feed | 100:1 | Read-heavy |
| Wikipedia | 1000:1 | Read-heavy |
| Google Search | 10000:1 | Read-heavy |
| Stock exchange (orders) | 1:10 | Write-heavy |
| IoT telemetry / metrics | 1:100 | Write-heavy |
| Logging pipeline | 0:N | Write-only |
| Uber location pings | 1:50 | Write-heavy |
| Banking transactions | 5:1 | Balanced (write-critical) |

---

## 2. Read-Heavy Systems

### Architectural Levers

| Lever | Why it works |
|-------|--------------|
| **Aggressive caching** (CDN, Redis, app-level) | Most reads served without touching DB |
| **Read replicas** (1 primary, N replicas) | Horizontal read scaling |
| **Denormalization / materialized views** | Pre-compute joins; trade write cost for read speed |
| **Indexing** (covering, composite) | Skip table reads entirely |
| **Eventual consistency** | OK to serve slightly stale data from cache/replica |
| **Pre-computation / fan-out on write** | Push complexity to write side (Twitter timeline) |
| **Edge caching / CDN** | Move data closer to user |

### Database Choices

- **SQL with read replicas**: Postgres, MySQL, Aurora.
- **Document stores**: MongoDB with replica sets.
- **Wide-column**: Cassandra (tunable consistency, fast reads).
- **Search**: Elasticsearch for full-text.
- **In-memory**: Redis as primary cache layer.

### Real-World Pattern: Twitter Timeline (Read-Heavy)

- **Fan-out on write**: when celeb posts, push to followers' inboxes.
- Reads are O(1) inbox fetch; writes do the heavy lifting.
- Hybrid: pull-on-read for celebrity accounts (avoids 100M-write fan-out).

### Common Mistakes (Read-Heavy)
- Forgetting **cache invalidation** strategy (the hardest problem in CS).
- Not addressing **stale-data window** (how stale is acceptable?).
- Single primary still being a write bottleneck if writes ever spike.
- No mention of **CDN** for static / quasi-static content.

---

## 3. Write-Heavy Systems

### Architectural Levers

| Lever | Why it works |
|-------|--------------|
| **Append-only log / LSM-tree storage** | Sequential writes are fast |
| **Write buffering / batching** | Coalesce many small writes |
| **Async write paths (queue-first)** | Smooth out spikes; decouple producer from storage |
| **Sharding (write fan-out)** | Spread write load across N shards |
| **CRDTs / conflict-free merges** | Allow concurrent writes without locks |
| **Sampling / aggregation** | Don't store every event raw |
| **Cold/hot tiering** | Recent in fast storage, old in cheap storage |
| **Sequential IDs avoided** | Hot-spotting on a single shard |

### Database Choices

- **LSM-based KV stores**: RocksDB, LevelDB, Cassandra, ScyllaDB.
- **Time-series DBs**: InfluxDB, TimescaleDB, Prometheus, M3.
- **Wide-column**: Cassandra, HBase, BigTable.
- **Stream stores**: Kafka, Pulsar (often the *primary* write target, not just transport).
- **Columnar OLAP** for batched writes: ClickHouse, Druid.

### Real-World Pattern: Uber Location Updates (Write-Heavy)

- 200k QPS of driver location pings.
- **Hot path**: latest position written to Redis (`GEOADD`); overwrites previous.
- **Cold path**: history streamed to Kafka → batched into Cassandra.
- Reads (matching) only ever hit Redis — converts an extreme-write-heavy problem into a manageable read-from-cache problem.

### Common Mistakes (Write-Heavy)
- Using **B-tree DB** (Postgres) for 1M writes/sec without sharding.
- Sequential primary keys → all writes hit one shard.
- Synchronous writes to DB on the request path during traffic spike.
- No back-pressure → cascading failure when DB falls behind.

---

## 4. Decision Framework

```
                     ┌─ R:W > 10:1  ──▶ READ-HEAVY  → cache + replicas + denormalize
   What's the R:W?  ─┤
                     └─ R:W < 1:1   ──▶ WRITE-HEAVY → LSM + queue + shard + batch
                     
                  ┌─ Hot keys?  ──▶ Cache-aside, replicate hot keys
   Read pattern? ─┤
                  └─ Random?    ──▶ Index hard; partition for parallelism
                  
                   ┌─ Bursty?  ──▶ Queue + auto-scale workers
   Write pattern? ─┤
                   └─ Steady?  ──▶ Capacity-plan to peak; reserved instances
```

---

## 5. Mixed Workloads (CQRS)

When the same system has both read-heavy *and* write-heavy paths, **separate them**:

- **Command side**: optimized for writes — append-only event log, simple schema.
- **Query side**: denormalized read models, materialized views, multiple shapes for different UIs.
- The two are connected by an **event stream** (Kafka, Kinesis).
- Examples: Order systems, banking, e-commerce checkout vs catalog browse.

---

## 6. Trade-Off Cheat Sheet

| Concern | Read-Heavy | Write-Heavy |
|---------|-----------|-------------|
| Consistency | Eventual usually fine | Often need strong (financial, inventory) |
| Cache | Everywhere | Limited (writes invalidate) |
| Replication lag | Tolerable | Must minimize / use sync replication |
| Sharding | Optional, often by user/tenant | Mandatory; key choice critical |
| DB type | SQL + replicas, doc, KV | LSM, time-series, columnar |
| Bottleneck | Cache miss rate | Disk write throughput, lock contention |
| Failure mode | Stale reads | Lost writes, queue overflow |

---

## 7. Senior Interview Power Moves

- **Quantify before designing.** "If the system has 1B users and average user reads feed 5x/day, that's 60K QPS reads — 1k write throughput is 60:1 read-heavy."
- **Name the trade-off explicitly.** "I'm choosing fan-out-on-write because reads dominate; the cost is a 100x amplification on writes for power users, which I'll mitigate with a hybrid pull-on-read for accounts >10M followers."
- **Discuss the failure mode.** "If Redis goes down, we degrade to reading from Cassandra at 5x latency. I'd add a circuit breaker."
- **Don't just list techniques — sequence them.** "Step 1 add cache, Step 2 add replicas, Step 3 shard. Each only when the previous saturates."

---

## 8. Quick Reference — Match Workload to Architecture

| Workload | Primary store | Cache | Queue | Sharding key |
|----------|---------------|-------|-------|--------------|
| Social feed | Cassandra | Redis (timelines) | Kafka (events) | userId |
| URL shortener | Postgres + read replicas | Redis (LRU) | — | hash prefix |
| Stock trading | In-memory matching engine | — | Kafka (audit) | symbol |
| Metrics ingestion | Time-series DB | — | Kafka | metric+timeBucket |
| Chat | Cassandra | Redis (online status) | Kafka | conversationId |
| Search | Elasticsearch | App cache | Kafka (indexer) | shard by docId hash |
| Analytics | ClickHouse / Druid | — | Kafka → batched | tenantId+date |

---

## 9. Senior Interview Questions

> 💡 Use the **Practice Questions** section above to reveal answers and track your progress.

1. *"You estimate 100M users, 10M DAU, 5 reads/sec/user, 1 write/min/user. What's the workload shape and what does that imply?"*
2. *"How would you design a system that's read-heavy on weekdays but write-heavy on weekends (e-commerce flash sales)?"*
3. *"Your read replicas are showing 5s of lag. Walk me through the trade-offs of sync vs async replication."*
4. *"In a write-heavy IoT system, how do you handle bursts that are 10x normal load?"*
5. *"When does CQRS make sense vs being over-engineering?"*
