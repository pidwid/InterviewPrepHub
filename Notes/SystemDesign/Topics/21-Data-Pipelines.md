# Data Pipelines & Stream Processing

## Table of Contents

1. [Overview](#1-overview)
2. [Batch Processing](#2-batch-processing)
3. [Stream Processing](#3-stream-processing)
4. [Lambda and Kappa Architectures](#4-lambda-and-kappa-architectures)
5. [Data Pipeline Design Patterns](#5-data-pipeline-design-patterns)
6. [Change Data Capture (CDC)](#6-change-data-capture-cdc)
7. [Data Warehousing and Data Lakes](#7-data-warehousing-and-data-lakes)
8. [Key Takeaways](#8-key-takeaways)

---

## 1. Overview

Data pipelines move data from **sources** (where data is created) to
**sinks** (where data is consumed) — with transformation, enrichment,
and validation along the way.

```
Sources              Pipeline                    Sinks
┌──────────┐                                    ┌──────────────┐
│ App DBs  │──┐    ┌──────────────────────┐  ┌─►│ Data Warehouse│
└──────────┘  │    │                      │  │  └──────────────┘
┌──────────┐  ├───►│  Extract             │  │  ┌──────────────┐
│ APIs     │──┤    │  Transform           │──┼─►│ Search Index  │
└──────────┘  │    │  Load                │  │  └──────────────┘
┌──────────┐  │    │                      │  │  ┌──────────────┐
│ Logs     │──┤    └──────────────────────┘  └─►│ ML Models    │
└──────────┘  │                                 └──────────────┘
┌──────────┐  │                                 ┌──────────────┐
│ Events   │──┘                              ┌─►│ Dashboards   │
└──────────┘                                    └──────────────┘
```

### ETL vs ELT

<abbr title="ETL: extract → transform → load (clean before storage).">ETL (Extract, Transform, Load)</abbr> and
<abbr title="ELT: extract → load → transform (store raw, transform inside the warehouse).">ELT (Extract, Load, Transform)</abbr> describe when transformations happen.

```
ETL (Extract, Transform, Load):
  Source ──► Extract ──► Transform (on pipeline) ──► Load to target
  
  Traditional approach. Transform happens in the pipeline before loading.
  Good when: target is expensive (data warehouse), want to load clean data.

ELT (Extract, Load, Transform):
  Source ──► Extract ──► Load to target ──► Transform (in target)
  
  Modern approach. Load raw data first, transform using target's compute.
  Good when: target is powerful (BigQuery, Snowflake, Spark).
  
  ELT has become dominant because modern data warehouses are 
  powerful enough to do the transformation efficiently.
```

---

## 2. Batch Processing

Process large volumes of data in scheduled intervals (hourly, daily, weekly).

### MapReduce

```
The original big data processing paradigm (Google, 2004, Hadoop).

Input Data → Split → Map → Shuffle & Sort → Reduce → Output

Example: Count words in a massive text corpus.

Input: "the cat sat on the mat"

Map phase (parallel across machines):
  Mapper 1: "the cat"  → [(the, 1), (cat, 1)]
  Mapper 2: "sat on"   → [(sat, 1), (on, 1)]
  Mapper 3: "the mat"  → [(the, 1), (mat, 1)]

Shuffle & Sort (group by key):
  cat → [1]
  mat → [1]
  on  → [1]
  sat → [1]
  the → [1, 1]

Reduce phase (parallel across machines):
  Reducer 1: cat → 1
  Reducer 2: mat → 1
  Reducer 3: on  → 1
  Reducer 4: sat → 1
  Reducer 5: the → 2

Output: {cat: 1, mat: 1, on: 1, sat: 1, the: 2}
```

### Apache Spark

Spark replaced Hadoop MapReduce for most batch workloads. Key advantage:
**in-memory processing** instead of writing intermediate results to disk.

```
Spark Stack:
  ┌───────────────────────────────────────────────┐
  │ Spark SQL │ MLlib    │ Spark    │ GraphX       │
  │ (queries) │ (ML)     │ Streaming│ (graphs)     │
  ├───────────┴──────────┴──────────┴──────────────┤
  │           Spark Core (RDDs, DataFrames)         │
  ├─────────────────────────────────────────────────┤
  │  YARN / Mesos / Kubernetes / Standalone         │
  ├─────────────────────────────────────────────────┤
  │  HDFS / S3 / GCS / Azure Blob                   │
  └─────────────────────────────────────────────────┘

Speed improvement over Hadoop:
  - In-memory: 100x faster for iterative algorithms
  - On disk: 10x faster (optimized shuffles, DAG execution)
```

```python
# Spark batch processing example
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("DailyReport").getOrCreate()

# Read yesterday's events
events = spark.read.parquet("s3://data-lake/events/date=2024-01-15/")

# Transform: aggregate orders by region
daily_report = (
    events
    .filter(events.event_type == "order_placed")
    .groupBy("region")
    .agg(
        count("order_id").alias("total_orders"),
        sum("amount").alias("total_revenue"),
        avg("amount").alias("avg_order_value")
    )
)

# Write results to data warehouse
daily_report.write.mode("overwrite").parquet("s3://warehouse/daily-report/")
```

### Batch Processing Characteristics

| Aspect      | Description                                               |
|-------------|-----------------------------------------------------------|
| Latency     | Minutes to hours (scheduled jobs)                         |
| Throughput  | Very high (optimized for large volumes)                   |
| Data size   | Terabytes to petabytes                                    |
| Scheduling  | Cron, Airflow, Prefect, Dagster                           |
| Use cases   | Daily reports, ETL, ML training, data warehouse loading   |
| Fault tolerance| Re-run failed jobs (idempotent processing)             |

---

## 3. Stream Processing

Process data **as it arrives**, with low latency (milliseconds to seconds).

### Core Concepts

```
Event Stream:
  An unbounded, continuously arriving sequence of events.
  
  ──[e1]──[e2]──[e3]──[e4]──[e5]──[e6]──[e7]──►  (never ends)

Processing Semantics:
  ┌─────────────────────┬────────────────────────────────────────┐
  │ At-most-once        │ Events may be lost. No duplicates.     │
  │ At-least-once       │ Events never lost. May have duplicates.│
  │ Exactly-once        │ Events never lost, no duplicates.      │
  │                     │ (hardest to achieve)                   │
  └─────────────────────┴────────────────────────────────────────┘

  Exactly-once is typically achieved via:
    - Idempotent writes (deduplication at the consumer)
    - Transactional writes (Kafka transactions)
```

- <abbr title="At-most-once: each event is processed 0 or 1 times (fast but can lose data).">At-most-once</abbr>
- <abbr title="At-least-once: events are processed 1+ times (no loss, possible duplicates).">At-least-once</abbr>
- <abbr title="Exactly-once: each event processed once (hard to guarantee).">Exactly-once</abbr>

### Windowing

Streams are infinite, but aggregations need boundaries. Windows provide them.

```
Tumbling Window (fixed, non-overlapping):
  ┌────────┐┌────────┐┌────────┐
  │ Window1 ││ Window2 ││ Window3 │
  │ 0-5min  ││ 5-10min ││10-15min │
  └────────┘└────────┘└────────┘
  ──[e1][e2]──[e3]────[e4][e5]──[e6]───►
  
  "Count events every 5 minutes."

Sliding Window (overlapping):
  ┌────────────────┐
  │   Window 1     │
  └──────┬─────────┘
         ┌────────────────┐
         │   Window 2     │
         └──────┬─────────┘
                ┌────────────────┐
                │   Window 3     │
                └────────────────┘
  
  "Count events in the last 5 minutes, updated every 1 minute."

Session Window (gap-based):
  ┌──────────────┐     ┌──────────┐     ┌────────┐
  │  Session 1   │     │ Session 2│     │Session 3│
  └──────────────┘     └──────────┘     └────────┘
  ──[e1][e2][e3]────gap────[e4][e5]──gap──[e6]───►
  
  "Group events by user activity. New session after 30min of inactivity."
```

### Event Time vs Processing Time

```
Event Time: When the event actually happened (set by producer).
Processing Time: When the event is processed (set by the system).

Problem: Events can arrive late!

  Event happened at:    10:00  10:01  10:02  10:05
  Event arrived at:     10:01  10:06  10:02  10:05
                                 ↑
                         This event was 5 minutes late!
  
  If using processing time: a 10:01 event is counted in the wrong window.
  If using event time: events are placed in the correct window.
  
  But with event time, you need to handle late data:
    - Watermarks: "I believe all events up to time T have arrived"
    - Allowed lateness: "Accept events up to 5 minutes late"
    - Late data: Discard, or update the result
```

### Stream Processing Frameworks

| Framework       | Model              | Language    | Strengths                   |
|-----------------|--------------------|-------------|-----------------------------|
| Apache Kafka Streams | Stream per partition | Java/Scala | Lightweight, no separate cluster |
| Apache Flink    | True streaming     | Java/Scala/Python | Most powerful, exactly-once |
| Apache Spark Streaming | Micro-batches | Python/Java/Scala | Unified batch+stream |
| Amazon Kinesis  | Managed streaming  | Any (SDK)   | AWS-native, easy setup      |
| Google Dataflow | Beam model         | Java/Python | Unified batch+stream, managed|

### Batch vs Stream Comparison

| Aspect           | Batch Processing           | Stream Processing          |
|------------------|----------------------------|----------------------------|
| Latency          | Minutes to hours           | Milliseconds to seconds    |
| Data             | Bounded datasets           | Unbounded event streams    |
| Processing       | Process all data at once   | Process event by event     |
| Complexity       | Simpler                    | More complex               |
| Fault tolerance  | Re-run the batch           | Checkpointing, offsets     |
| Use cases        | Reports, ETL, ML training  | Real-time analytics, alerts|
| State management | Read from disk             | In-memory with checkpoints |

---

## 4. Lambda and Kappa Architectures

### Lambda Architecture

Run both batch and stream processing in parallel. Use batch for accuracy,
stream for speed.

```
                    ┌─────────────────────────────────┐
                    │        Batch Layer              │
                    │  (Spark, Hive)                  │
                    │  Accurate but slow              │
Data ──► Storage ──►│  Runs hourly/daily              │──┐
         (Kafka,    │                                  │  │    ┌──────────┐
          S3)       └─────────────────────────────────┘  ├───►│ Serving  │
                    ┌─────────────────────────────────┐  │    │  Layer   │
                    │        Speed Layer              │  │    │ (merge   │
                    │  (Flink, Kafka Streams)         │──┘    │  results)│
                    │  Fast but approximate           │       └──────────┘
                    │  Processes real-time            │
                    └─────────────────────────────────┘

Serving Layer merges batch results (accurate) with speed results (real-time).

Problem: You maintain TWO processing pipelines doing the same thing
in different frameworks. Double the code, double the bugs.
```

### Kappa Architecture

Simplification: only use the streaming layer. No separate batch layer.

```
Data ──► Event Log (Kafka) ──► Stream Processor ──► Serving Layer
                                 (Flink, Kafka Streams)

For reprocessing (equivalent of a batch job):
  1. Deploy new version of the stream processor
  2. Have it replay events from the beginning of the Kafka log
  3. Build new output table from scratch
  4. Switch serving layer to the new table
  
  Kafka retains all events, so you can always replay.
```

| Aspect              | Lambda                     | Kappa                      |
|---------------------|----------------------------|----------------------------|
| Complexity          | High (two code paths)      | Simpler (one code path)    |
| Accuracy            | Batch ensures accuracy     | Reprocessing ensures accuracy |
| Latency             | Speed layer provides low latency | Inherently low latency |
| Reprocessing        | Batch layer handles it     | Replay from event log      |
| Maintenance         | Hard (two systems to maintain)| Easier (one system)     |
| Best for            | When batch and stream logic differ | When logic is the same |

---

## 5. Data Pipeline Design Patterns

### Idempotent Processing

```
If a pipeline runs twice on the same data, the result should be the same.

Bad (not idempotent):
  INSERT INTO daily_revenue (date, amount) VALUES ('2024-01-15', 50000)
  Running twice → TWO rows with $50,000 each!

Good (idempotent):
  INSERT INTO daily_revenue (date, amount) VALUES ('2024-01-15', 50000)
  ON CONFLICT (date) DO UPDATE SET amount = 50000
  Running twice → One row with $50,000. ✓
```

### Backfilling

```
When you fix a bug or add a new pipeline, you might need to reprocess
historical data. Design pipelines to support this:

1. Partition data by date (easy to reprocess specific days)
2. Make processing idempotent (safe to re-run)
3. Separate storage from compute (can spin up extra compute for backfill)

Example:
  Normal: Process today's data → write to daily_report/date=2024-01-15/
  Backfill: Reprocess last 30 days in parallel → overwrite each partition
```

### Schema Evolution

```
Data schemas change over time. Pipelines must handle this gracefully.

Example: User event schema v1 → v2

v1: {"user_id": "123", "name": "Alice"}
v2: {"user_id": "123", "first_name": "Alice", "last_name": "Smith"}

Strategies:
  1. Schema Registry: Confluent Schema Registry with Avro/Protobuf
     - Enforce backward/forward compatibility rules
     - Reject breaking schema changes at publish time
  
  2. Nullable fields: New fields are nullable, old fields deprecated but kept
  
  3. Versioned topics/tables: order_events_v1, order_events_v2
     (heavy-handed but sometimes necessary)
```

### Dead Letter Queue

```
When a pipeline can't process a message, put it in a dead letter queue (DLQ)
for manual inspection instead of blocking the pipeline.

                     ┌──────────────┐
Input Queue ────────►│  Processor   │────────► Output
                     │              │
                     └──────┬───────┘
                            │ Failed messages
                            ▼
                     ┌──────────────┐
                     │  Dead Letter │   → Alert team
                     │  Queue (DLQ) │   → Manual review
                     └──────────────┘   → Fix and replay

Without DLQ: One bad message blocks the entire pipeline.
With DLQ: Bad messages are set aside, good messages keep flowing.
```

---

### <abbr title="Change Data Capture (CDC): capture changes from a database by reading its transaction log and streaming them to other systems.">Change Data Capture (CDC)</abbr>

CDC captures changes from a database and streams them to other systems.
Instead of polling or dual-writes, CDC reads from the database's
transaction log (WAL in Postgres, binlog in MySQL).

```
Traditional approach (problems):
  App ──► DB
   │
   └──► Also writes to Kafka ← Two writes! Inconsistency risk.
                                What if DB write succeeds but Kafka fails?

CDC approach:
  App ──► DB ──► Transaction Log ──► CDC (Debezium) ──► Kafka
  
  Single write to DB. CDC reads the transaction log.
  Guaranteed consistent because CDC reads from the source of truth.
```

### Debezium (Popular CDC Tool)

```
┌──────────┐    WAL/Binlog    ┌──────────┐    ┌─────────┐
│ PostgreSQL│───────────────── │ Debezium │───►│  Kafka  │
│           │                  │ Connector│    │ Topics  │
└──────────┘                  └──────────┘    └────┬────┘
                                                   │
                                         ┌─────────┼──────────┐
                                         ▼         ▼          ▼
                                    Elasticsearch  Data     Another
                                    (search)      Warehouse  Service
```

### CDC Event Format

```json
{
  "before": {"id": 1, "name": "Alice", "balance": 100},
  "after":  {"id": 1, "name": "Alice", "balance": 150},
  "source": {
    "connector": "postgresql",
    "db": "mydb",
    "table": "accounts"
  },
  "op": "u",
  "ts_ms": 1705312200000
}

Operations: c=create, u=update, d=delete, r=read (snapshot)
```

### CDC Use Cases

| Use Case                     | Description                                   |
|------------------------------|-----------------------------------------------|
| Search index sync            | Keep Elasticsearch in sync with database      |
| Data warehouse loading       | Stream DB changes to warehouse (real-time ETL) |
| Cache invalidation           | Invalidate Redis cache when DB changes         |
| Cross-service data sync      | Replicate data between microservices           |
| Event sourcing retrofit      | Generate events from existing CRUD database    |
| Audit logging                | Capture all changes for compliance             |

---

## 7. Data Warehousing and Data Lakes

### Data Warehouse

A specialized database optimized for **analytical queries** (<abbr title="OLAP: Online Analytical Processing — large, read-heavy analytics like aggregations and reporting.">OLAP</abbr>) rather than
transactional workloads (<abbr title="OLTP: Online Transaction Processing — high-volume inserts/updates for day-to-day app operations.">OLTP</abbr>).

```
OLTP (Online Transaction Processing):        OLAP (Online Analytical Processing):
  Your application database                     Your data warehouse
  ┌────────────────────────┐                    ┌────────────────────────┐
  │ Row-oriented storage   │                    │ Column-oriented storage│
  │ INSERT, UPDATE, DELETE │                    │ SELECT, aggregate      │
  │ Single row lookups     │                    │ Scan millions of rows  │
  │ Normalize for writes   │                    │ Denormalized for reads │
  │ PostgreSQL, MySQL      │                    │ Snowflake, BigQuery    │
  └────────────────────────┘                    └────────────────────────┘
```

### Column-Oriented Storage

```
Row-oriented (OLTP):
  Row 1: [Alice, 25, NYC, $50K]
  Row 2: [Bob,   30, SF,  $80K]
  Row 3: [Carol, 28, LA,  $60K]
  
  Great for: SELECT * FROM users WHERE id = 1 (read one full row)
  Bad for:   SELECT AVG(salary) FROM users (reads ALL columns for every row)

Column-oriented (OLAP):
  Name column:   [Alice, Bob, Carol]
  Age column:    [25, 30, 28]
  City column:   [NYC, SF, LA]
  Salary column: [$50K, $80K, $60K]
  
  Great for: SELECT AVG(salary) FROM users (reads ONLY the salary column)
  Compression: Same column has similar values → excellent compression
  Bad for:    Single row lookups (must read from every column file)
```

### Data Lake

Store raw data in its native format. No predefined schema.
Process and transform as needed (schema-on-read).

```
Data Lake (S3, GCS, Azure Blob Storage):
  s3://data-lake/
    ├── raw/
    │   ├── events/date=2024-01-15/  (Parquet, JSON, CSV)
    │   ├── logs/date=2024-01-15/    (gzip text files)
    │   └── images/                   (binary files)
    ├── processed/
    │   ├── user_profiles/            (cleaned, deduplicated)
    │   └── daily_aggregates/         (pre-computed)
    └── curated/
        ├── marketing_dashboard/      (business-ready)
        └── ml_features/              (feature store)

Medallion Architecture (Bronze / Silver / Gold):
  Bronze: Raw data (as-is from source)
  Silver: Cleaned, validated, deduplicated
  Gold:   Business-level aggregates, ready for reporting
```

### <abbr title="Data lakehouse: combines cheap object storage of a data lake with ACID reliability and performance features of a data warehouse.">Data Lakehouse</abbr>

Combines the best of data lakes and data warehouses.

```
Data Lake: Cheap storage, any format, no ACID, no schema enforcement
Data Warehouse: Expensive, structured, ACID, great query performance

Data Lakehouse (Delta Lake, Apache Iceberg, Apache Hudi):
  ✓ Cheap storage (files on S3)
  ✓ ACID transactions on files
  ✓ Schema enforcement + evolution
  ✓ Time travel (query historical versions)
  ✓ Supports both batch and streaming
  ✓ Open formats (no vendor lock-in)
```

---

## 8. Key Takeaways

### Decision Guide

```
What data processing do I need?

Data frequency:
  ├── Data arrives in large batches (daily files, DB dumps)
  │     → Batch Processing (Spark, dbt)
  │
  ├── Data arrives continuously and must be processed quickly
  │     → Stream Processing (Flink, Kafka Streams)
  │
  └── Both historical reprocessing and real-time needed
        ├── Same logic for both → Kappa Architecture
        └── Different logic needed → Lambda Architecture

Data storage:
  ├── Need fast analytical queries on structured data
  │     → Data Warehouse (Snowflake, BigQuery)
  │
  ├── Need cheap storage for diverse data formats
  │     → Data Lake (S3 + Spark/Presto)
  │
  └── Need both
        → Data Lakehouse (Delta Lake, Iceberg)

Data movement:
  ├── Need to sync DB changes to other systems
  │     → CDC (Debezium)
  │
  └── Need to move data between systems on schedule
        → ETL/ELT pipeline (Airflow, dbt)
```

### Golden Rules

1. **Start with batch, add streaming when latency matters.** Batch is simpler.
2. **Make pipelines idempotent.** Re-running should produce the same result.
3. **Use CDC instead of dual writes.** One source of truth, no inconsistency.
4. **Schema evolution from day one.** Use a schema registry.
5. **Partition data by time.** Makes backfilling and archiving easy.
6. **Monitor pipeline lag.** know how far behind your real-time pipeline is.
7. **Use dead letter queues.** Don't let bad messages block good ones.
8. **Exactly-once is hard.** Design for at-least-once + idempotent consumers.

---

## 🔥 Senior Interview Questions

1. Compare Lambda architecture vs Kappa architecture. You're building an analytics platform that needs both real-time dashboards and historical reports. Which architecture do you choose, and why are many teams moving from Lambda to Kappa? [Answer](QnA-Answer-Key.md#21-data-pipelines)

2. Your Kafka Streams application has 100ms end-to-end latency for processing events. The business wants 10ms. Walk through the bottleneck analysis: serialization, network, computation, state store access. How do you optimize each? [Answer](QnA-Answer-Key.md#21-data-pipelines)

3. You need to process 1 billion events per day with exactly-once semantics. Compare Kafka Streams, Apache Flink, and Spark Structured Streaming for this workload. Consider state management, windowing, and failure recovery. [Answer](QnA-Answer-Key.md#21-data-pipelines)

4. Your ETL pipeline runs nightly and takes 8 hours. One morning it fails at hour 6. How do you design the pipeline to be resumable/restartable without reprocessing everything? Discuss checkpointing, idempotent writes, and watermarks. [Answer](QnA-Answer-Key.md#21-data-pipelines)

5. Compare CDC (Change Data Capture) via Debezium vs dual writes vs application-level events for keeping a search index (Elasticsearch) in sync with a database. What are the failure modes and consistency guarantees of each? [Answer](QnA-Answer-Key.md#21-data-pipelines)

6. You're designing a real-time fraud detection pipeline. Events come from payment processing at 50,000 events/sec. You need to check each transaction against user history (last 30 days). How do you design the state management and windowing? [Answer](QnA-Answer-Key.md#21-data-pipelines)

7. An interviewer says: "We have a data lake with 10 PB of data, but nobody trusts it." What went wrong? Discuss data quality, schema enforcement, data contracts, lineage tracking, and the data mesh approach. [Answer](QnA-Answer-Key.md#21-data-pipelines)

8. You have a stream processing job that joins two event streams (orders and payments) by order ID. A payment event arrives before the order event. How do you handle this out-of-order processing? Discuss event-time windows, watermarks, and late-arriving data. [Answer](QnA-Answer-Key.md#21-data-pipelines)

9. Compare Apache Airflow, Prefect, Dagster, and dbt for orchestrating data pipelines. Your team needs to orchestrate 500 daily batch jobs with dependencies. Which do you choose and why? [Answer](QnA-Answer-Key.md#21-data-pipelines)

10. Your real-time pipeline processes correctly, but the downstream materialized views in the database are inconsistent because consumers process at different speeds. How do you achieve cross-stream consistency? Discuss transactions in Kafka (exactly-once), coordinated checkpoints, and eventual convergence. [Answer](QnA-Answer-Key.md#21-data-pipelines)

---

## 📚 Further Reading

- [Streaming Systems by Tyler Akidau (O'Reilly)](https://www.oreilly.com/library/view/streaming-systems/9781491983867/) — The definitive book on stream processing concepts (windowing, watermarks, triggers).
- [The Log: What Every Engineer Should Know About Real-Time Data (Jay Kreps)](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying) — Foundational blog post on logs, Kafka, and stream processing from LinkedIn.
- [Kafka: The Definitive Guide (Confluent, Free)](https://www.confluent.io/resources/kafka-the-definitive-guide/) — End-to-end guide to Kafka architecture and best practices.
