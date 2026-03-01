# System Design Interview Cheat Sheet

> Your last-minute refresher before the interview. One-page-style summaries of all topics.
> For deep dives, click the links to each topic file.

---

## Table of Contents

1. [How to Approach a System Design Interview](#1-how-to-approach-a-system-design-interview)
2. [Core Fundamentals Quick Reference](#2-core-fundamentals-quick-reference)
3. [Infrastructure & Networking Quick Reference](#3-infrastructure--networking-quick-reference)
4. [Data & Storage Quick Reference](#4-data--storage-quick-reference)
5. [Async, Communication & APIs Quick Reference](#5-async-communication--apis-quick-reference)
6. [Security & Reliability Quick Reference](#6-security--reliability-quick-reference)
7. [Advanced Topics Quick Reference](#7-advanced-topics-quick-reference)
8. [Numbers You Must Know](#8-numbers-you-must-know)
9. [Common System Design Patterns](#9-common-system-design-patterns)
10. [Classic Mistakes to Avoid](#10-classic-mistakes-to-avoid)
11. [The One-Page Framework](#11-the-one-page-framework)
12. [Specialized Infrastructure Quick Reference](#12-specialized-infrastructure-quick-reference)
13. [Cloud, DevOps & Ops Excellence Quick Reference](#13-cloud-devops--ops-excellence-quick-reference)
14. [Domain-Specific & Cross-Cutting Quick Reference](#14-domain-specific--cross-cutting-quick-reference)

---

## 1. How to Approach a System Design Interview

Every system design interview follows the same meta-structure. Memorize this 4-step framework:

```
┌─────────────────────────────────────────────────────────────────┐
│            THE 4-STEP SYSTEM DESIGN FRAMEWORK                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: REQUIREMENTS & SCOPE               (~5 min)            │
│  ├── Functional requirements (what does it DO?)                 │
│  ├── Non-functional requirements (scale, latency, availability) │
│  ├── Who are the users? How many?                               │
│  ├── What's the read/write ratio?                               │
│  └── Clarify constraints and assumptions                        │
│                                                                 │
│  Step 2: HIGH-LEVEL DESIGN                  (~10 min)           │
│  ├── Draw the major components                                  │
│  ├── Client → LB → App Servers → DB                            │
│  ├── Identify APIs (REST/GraphQL/RPC)                           │
│  └── Sketch the data flow                                       │
│                                                                 │
│  Step 3: DEEP DIVE                          (~15 min)           │
│  ├── Database schema & choice (SQL vs NoSQL)                    │
│  ├── Core algorithm / data structure                            │
│  ├── Caching strategy                                           │
│  ├── Detailed component design                                  │
│  └── Let the interviewer guide which area to go deeper          │
│                                                                 │
│  Step 4: SCALE & WRAP UP                    (~10 min)           │
│  ├── Identify bottlenecks                                       │
│  ├── Horizontal scaling, sharding, replication                  │
│  ├── Discuss failure modes & monitoring                         │
│  └── Summarize trade-offs you made                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Behaviors Interviewers Love

| Do This | Not This |
|---------|----------|
| Ask clarifying questions first | Jump straight into drawing |
| Drive the conversation | Wait for interviewer to guide you |
| State trade-offs for every decision | Claim one approach is "best" |
| Use back-of-the-envelope math | Guess at capacity |
| Discuss failure modes | Assume nothing breaks |
| Say "it depends on..." | Give absolute answers |

---

## 2. Core Fundamentals Quick Reference

> Deep dives: [01](01-Performance-vs-Scalability.md) · [02](02-Latency-vs-Throughput.md) · [03](03-Availability-vs-Consistency.md) · [04](04-Consistency-Patterns.md) · [05](05-Availability-Patterns.md)

### Performance vs Scalability ([Full Notes](01-Performance-vs-Scalability.md))

```
Performance problem  → slow for a SINGLE user
Scalability problem  → fast for 1 user, slow for 1M users
```

- **Vertical scaling** = bigger machine (easy, has ceiling)
- **Horizontal scaling** = more machines (complex, no ceiling)
- Scale vertically first, then horizontally (especially for databases)

### Latency vs Throughput ([Full Notes](02-Latency-vs-Throughput.md))

```
Latency    = time to complete ONE action (ms)
Throughput = actions completed per unit time (req/s)
Goal       = maximize throughput with acceptable latency
```

| Memory Reference | SSD Read | HDD Seek | Cross-DC Round Trip |
|-----------------|----------|----------|---------------------|
| 100 ns | 150 μs | 10 ms | 150 ms |

### CAP Theorem ([Full Notes](03-Availability-vs-Consistency.md))

```
In a distributed system, pick TWO (networks WILL partition):

    Consistency ←→ Availability
         ↑              ↑
         └── Partition Tolerance ──┘
              (you MUST have this)

CP = Consistency + Partition Tolerance  → e.g., HBase, MongoDB, Redis
AP = Availability + Partition Tolerance → e.g., Cassandra, DynamoDB, CouchDB
```

- **PACELC extends CAP**: Even without Partition, do you prefer Latency or Consistency?
- Most modern systems let you tune consistency per-query

### Consistency Patterns ([Full Notes](04-Consistency-Patterns.md))

| Pattern | Guarantee | Use Case | Example |
|---------|-----------|----------|---------|
| **Strong** | Read always sees latest write | Banking, inventory | PostgreSQL, Spanner |
| **Eventual** | Reads will *eventually* converge | Social feeds, DNS | Cassandra, DynamoDB |
| **Weak** | No guarantee reads see write | VoIP, video chat | Memcached |
| **Causal** | Causally related ops seen in order | Comments, threads | MongoDB (causal sessions) |
| **Read-Your-Writes** | You see your own writes | User profile edits | Sticky sessions |

### Availability Patterns ([Full Notes](05-Availability-Patterns.md))

| Pattern | How It Works | Risk |
|---------|-------------|------|
| **Active-Passive** (failover) | Standby takes over if primary fails | Data loss if not replicated |
| **Active-Active** (failover) | Both handle traffic; DNS routes | Conflict resolution needed |
| **Master-Slave** (replication) | Writes to master, reads from replicas | Replication lag |
| **Master-Master** (replication) | Both accept writes | Write conflicts |

**Availability Math:**

```
Sequential:  A_total = A1 × A2           (gets WORSE)
Parallel:    A_total = 1 - (1-A1)(1-A2)  (gets BETTER)

99.9% + 99.9% in sequence = 99.8%
99.9% + 99.9% in parallel = 99.9999%
```

| Nines | Downtime/Year |
|-------|---------------|
| 99.9% (three 9s) | 8h 46min |
| 99.99% (four 9s) | 52min 36s |
| 99.999% (five 9s) | 5min 16s |

---

## 3. Infrastructure & Networking Quick Reference

> Deep dives: [06](06-Domain-Name-System.md) · [07](07-Content-Delivery-Networks.md) · [08](08-Load-Balancers.md) · [09](09-Reverse-Proxy.md) · [10](10-Application-Layer.md)

### DNS ([Full Notes](06-Domain-Name-System.md))

```
Browser → Recursive Resolver → Root NS → TLD NS → Authoritative NS → IP
```

- Record types: **A** (name→IP), **CNAME** (name→name), **MX** (mail), **NS** (nameserver)
- TTL controls caching; lower TTL = faster propagation but more DNS traffic
- Modern DNS does **weighted, latency-based, geolocation routing**

### CDN ([Full Notes](07-Content-Delivery-Networks.md))

| Type | How It Works | Best For |
|------|-------------|----------|
| **Push CDN** | You upload content to CDN proactively | Low-traffic, rarely changing content |
| **Pull CDN** | CDN fetches from origin on first request | High-traffic, frequently changing content |

- CDN = geographically distributed cache for static (and some dynamic) content
- Reduces latency + offloads origin server traffic

### Load Balancers ([Full Notes](08-Load-Balancers.md))

```
              ┌──→ Server 1
Client → LB ──┼──→ Server 2
              └──→ Server 3
```

| Layer | Inspects | Speed | Flexibility |
|-------|----------|-------|-------------|
| **L4** (Transport) | IP, port, TCP/UDP headers | Faster | Less |
| **L7** (Application) | HTTP headers, cookies, URL | Slower | More |

- Algorithms: Round Robin, Weighted RR, Least Connections, IP Hash, Random
- Enables horizontal scaling, SSL termination, health checks
- Use **active-passive** or **active-active** LB pairs to avoid SPOF

### Reverse Proxy ([Full Notes](09-Reverse-Proxy.md))

```
Client → Reverse Proxy → Application Server(s)
```

- Benefits: security (hide backend), SSL termination, compression, caching, static content
- **LB vs Reverse Proxy**: LB needs multiple servers; reverse proxy useful even with ONE server
- NGINX and HAProxy do both reverse proxying and load balancing
- A single reverse proxy is a SPOF — use pairs

### Application Layer / Microservices ([Full Notes](10-Application-Layer.md))

```
Monolith: One big app → simple but doesn't scale teams/components
Microservices: Many small services → complex but scales independently
```

- Separate **web layer** from **application layer** for independent scaling
- Service discovery via Consul, etcd, ZooKeeper
- Anti-pattern: starting with microservices too early (distributed monolith)

---

## 4. Data & Storage Quick Reference

> Deep dives: [11](11-Databases.md) · [12](12-Caching.md)

### Databases ([Full Notes](11-Databases.md))

#### SQL vs NoSQL Decision Framework

| Choose SQL When | Choose NoSQL When |
|----------------|------------------|
| Structured, relational data | Flexible/dynamic schema |
| Complex joins needed | No complex joins |
| ACID transactions required | Eventual consistency OK |
| Well-defined schema | Rapid iteration |
| Moderate scale | Massive scale (PB range) |

#### Scaling Strategies

| Strategy | What It Does | Trade-Off |
|----------|-------------|-----------|
| **Master-Slave** | Write to master, read from replicas | Replication lag |
| **Master-Master** | Multiple write nodes | Conflict resolution |
| **Federation** | Split by function (users DB, posts DB) | Cross-DB joins impossible |
| **Sharding** | Split by data (user ID % N) | Hotspots, resharding complexity |
| **Denormalization** | Duplicate data to avoid joins | Write overhead, data sync |

#### The ACID vs BASE Spectrum

```
ACID (SQL)                           BASE (NoSQL)
──────────────────────────────────────────────────
Atomicity                            Basically Available
Consistency                          Soft state
Isolation                            Eventual consistency
Durability
```

### Caching ([Full Notes](12-Caching.md))

#### Cache Hierarchy

```
Client Cache → CDN → Reverse Proxy Cache → App Cache (Redis/Memcached) → DB Cache
```

#### Cache Update Strategies

| Strategy | Flow | Best For |
|----------|------|----------|
| **Cache-Aside** | App checks cache → miss → read DB → fill cache | General purpose, read-heavy |
| **Write-Through** | App writes to cache → cache writes to DB | Data that will be re-read soon |
| **Write-Behind** | App writes to cache → cache async writes DB | High write throughput |
| **Refresh-Ahead** | Cache pre-refreshes hot entries before expiry | Predictable access patterns |

#### Cache Eviction Policies

- **LRU** (Least Recently Used) — most common
- **LFU** (Least Frequently Used) — for skewed distributions
- **TTL** (Time to Live) — always set a TTL as a safety net

**Golden Rule**: Cache is for **speed**, not **correctness**. The source of truth is always the database.

---

## 5. Async, Communication & APIs Quick Reference

> Deep dives: [13](13-Asynchronism.md) · [14](14-Communication-Protocols.md) · [15](15-API-Design.md)

### Asynchronism ([Full Notes](13-Asynchronism.md))

```
Synchronous:   Client ──req──→ Server ──────────→ Response (client waits)
Asynchronous:  Client ──req──→ Queue ──→ Worker ──→ Notify when done
```

- **Message Queue** (RabbitMQ, SQS): decouple producers from consumers
- **Task Queue** (Celery): schedule and run background jobs
- **Back Pressure**: when queue fills up, reject new work (HTTP 503) rather than crashing
- Use async for: email sends, image processing, report generation, notifications

### Communication Protocols ([Full Notes](14-Communication-Protocols.md))

| Protocol | OSI Layer | Reliable | Best For |
|----------|-----------|----------|----------|
| **TCP** | L4 | Yes (ordered, guaranteed) | Web, DB, file transfer |
| **UDP** | L4 | No (best-effort) | Video, gaming, DNS |
| **HTTP** | L7 | Yes (over TCP) | Web APIs, browsers |
| **WebSocket** | L7 | Yes (persistent) | Real-time bidirectional |
| **RPC** (gRPC) | L7 | Yes | Internal microservice calls |
| **REST** | L7 | Yes | Public APIs |
| **GraphQL** | L7 | Yes | Flexible client queries |

#### REST vs RPC vs GraphQL

| | REST | RPC/gRPC | GraphQL |
|--|------|----------|---------|
| **Style** | Resource-oriented | Action-oriented | Query-oriented |
| **Use** | Public APIs | Internal services | Flexible frontends |
| **Format** | JSON | Protobuf (binary) | JSON |
| **Speed** | Good | Fastest | Good |
| **Caching** | Easy (HTTP) | Hard | Moderate |

### API Design ([Full Notes](15-API-Design.md))

- Use nouns, not verbs: `GET /users/123` not `GET /getUser?id=123`
- Version your APIs: `/v1/users`
- Paginate lists: `?limit=20&offset=40` or cursor-based
- Idempotency keys for POST/PUT
- Rate limit all endpoints
- API Gateway = single entry point (routing, auth, rate limiting, transformation)

---

## 6. Security & Reliability Quick Reference

> Deep dives: [16](16-Security.md) · [17](17-Rate-Limiting.md)

### Security ([Full Notes](16-Security.md))

```
Defense in Depth:

  Edge         → WAF, DDoS protection, rate limiting
  Transport    → TLS/HTTPS everywhere
  Application  → Input validation, parameterized queries, CSRF tokens
  Data         → Encryption at rest, key management
  Access       → RBAC, least privilege, OAuth 2.0 / JWT
  Monitoring   → Audit logs, anomaly detection
```

**Top Threats to Mention**: SQL Injection, XSS, CSRF, Broken Auth, SSRF, DDoS

### Rate Limiting ([Full Notes](17-Rate-Limiting.md))

| Algorithm | How It Works | Pros | Cons |
|-----------|-------------|------|------|
| **Token Bucket** | Tokens added at steady rate, each req uses one | Allows bursts, simple | Memory per user |
| **Leaky Bucket** | Requests drain at constant rate | Smooth output | Doesn't allow bursts |
| **Fixed Window** | Count requests per time window | Simple | Spike at window edges |
| **Sliding Window Log** | Track timestamp of each request | Precise | Memory intensive |
| **Sliding Window Counter** | Weighted count across windows | Memory efficient | Approximate |

- Implement with Redis (`INCR` + `EXPIRE`) for distributed systems
- Return `429 Too Many Requests` with `Retry-After` header
- Rate limit per user, per IP, per API key, or per endpoint

---

## 7. Advanced Topics Quick Reference

> Deep dives: [18](18-Distributed-Systems.md) · [19](19-Event-Driven-Architecture.md) · [20](20-Observability.md) · [21](21-Data-Pipelines.md) · [22](22-Containers-Orchestration.md) · [23](23-Networking-Deep-Dive.md) · [24](24-Estimation-Numbers.md)

### Distributed Systems ([Full Notes](18-Distributed-Systems.md))

| Concept | One-Line Summary |
|---------|-----------------|
| **Consensus** | Paxos/Raft — agreeing on a value despite failures |
| **Leader Election** | One node coordinates; ZooKeeper, etcd |
| **Consistent Hashing** | Distribute data evenly, minimal reshuffling on node change |
| **Vector Clocks** | Track causality across distributed nodes |
| **Gossip Protocol** | Nodes share state peer-to-peer |
| **Distributed Locks** | Redlock, ZooKeeper — mutual exclusion across machines |
| **2PC / 3PC** | Cross-service transaction coordination |
| **Saga Pattern** | Long-running transactions via compensating actions |

**Two Generals' Problem**: You can NEVER have 100% guaranteed coordination over an unreliable network.

### Event-Driven Architecture ([Full Notes](19-Event-Driven-Architecture.md))

```
Request-Driven:  Client → Service A → Service B → Response
Event-Driven:    Service A ──event──→ Broker ──→ Service B, C, D (async)
```

| Pattern | What It Does |
|---------|-------------|
| **Event Sourcing** | Store events, not state; rebuild state by replaying |
| **CQRS** | Separate read/write models for independent optimization |
| **Pub/Sub** | Publishers emit events; subscribers consume independently |
| **Choreography** | Services react to events (no orchestrator) |
| **Orchestration** | Central coordinator drives workflow |

- Kafka: distributed log, high throughput, durable
- Use event sourcing when you need full audit trail / time travel

### Observability ([Full Notes](20-Observability.md))

```
Three Pillars:

  Logs      → WHAT happened    (ELK Stack / Splunk)
  Metrics   → HOW MUCH is happening (Prometheus + Grafana)
  Traces    → WHERE it happened across services (Jaeger / Zipkin)
```

- **USE method**: Utilization, Saturation, Errors (for resources)
- **RED method**: Rate, Errors, Duration (for services)
- Alert on symptoms (high latency), not causes (high CPU)
- Correlation IDs thread through every request across services

### Data Pipelines ([Full Notes](21-Data-Pipelines.md))

| Processing | Latency | Tools | Use Case |
|-----------|---------|-------|----------|
| **Batch** | Hours | Hadoop, Spark | Analytics, reports |
| **Stream** | Seconds–ms | Kafka Streams, Flink, Spark Streaming | Real-time dashboards, fraud |
| **Micro-batch** | Seconds | Spark Streaming | Near-real-time with batch simplicity |

**Lambda Architecture** = batch layer + speed layer + serving layer
**Kappa Architecture** = everything through a stream (simpler, Kafka-centric)

### Containers & Orchestration ([Full Notes](22-Containers-Orchestration.md))

```
Container = lightweight, isolated process with its own filesystem
Docker     = builds and runs containers
Kubernetes = orchestrates containers across a cluster

K8s Key Objects:
  Pod → smallest unit (1+ containers)
  Service → stable network endpoint
  Deployment → manages replica sets, rolling updates
  Ingress → external traffic routing (L7)
```

### Networking Deep Dive ([Full Notes](23-Networking-Deep-Dive.md))

```
OSI Model (interview favorites):

  L7  Application   → HTTP, DNS, gRPC
  L4  Transport     → TCP, UDP
  L3  Network       → IP, routing
  L2  Data Link     → MAC, switches
  L1  Physical      → Cables, radio
```

- **TCP 3-way handshake**: SYN → SYN-ACK → ACK
- **TLS handshake**: adds ~1-2 round trips (TLS 1.3 = 1-RTT, 0-RTT for resumption)
- **BGP**: how the internet routes between autonomous systems
- **VPC / Subnets**: private networking in the cloud

---

## 8. Numbers You Must Know

> Deep dive: [24](24-Estimation-Numbers.md)

### Latency Reference

| Operation | Time |
|-----------|------|
| L1 cache reference | 0.5 ns |
| L2 cache reference | 7 ns |
| Main memory reference | 100 ns |
| SSD random read (4KB) | 150 μs |
| Round trip in same datacenter | 500 μs |
| Sequential read 1 MB from SSD | 1 ms |
| HDD seek | 10 ms |
| Sequential read 1 MB from HDD | 30 ms |
| Packet round trip CA→Netherlands→CA | 150 ms |

### Powers of 2

| Power | Value | Approx | Size |
|-------|-------|--------|------|
| 10 | 1,024 | ~1 Thousand | 1 KB |
| 20 | 1,048,576 | ~1 Million | 1 MB |
| 30 | ~1 Billion | ~1 Billion | 1 GB |
| 40 | ~1 Trillion | ~1 Trillion | 1 TB |

### Quick Estimation Anchors

| Metric | Ballpark |
|--------|----------|
| QPS for a single web server | ~1,000 (general), ~10,000 (optimized) |
| QPS for a single DB (SQL) | ~1,000-5,000 |
| QPS for Redis/Memcached | ~100,000+ |
| Tweets per day (Twitter-scale) | ~500 million |
| Daily active users (large app) | ~100 million - 1 billion |
| Average tweet/post size | ~250 bytes text + metadata |
| Average image size | ~200 KB (compressed) |
| Average video minute | ~50 MB (720p) |

### Estimation Template

```
1. Define scope: DAU, peak QPS, read/write ratio
2. Storage: (users × data per user × retention)
3. Bandwidth: (QPS × avg response size)
4. Memory (cache): follow the 80/20 rule (cache 20% of daily traffic)
5. Servers: (peak QPS ÷ QPS per server)
```

---

## 9. Common System Design Patterns

These patterns come up in almost every design — know them by heart:

### Data Patterns

| Pattern | When To Use |
|---------|-------------|
| **Sharding** | Database too big for one machine |
| **Replication** | Need read scaling or high availability |
| **Denormalization** | Read-heavy, complex joins are bottleneck |
| **Event Sourcing** | Need audit trail, undo, temporal queries |
| **CQRS** | Read and write models differ significantly |

### Reliability Patterns

| Pattern | What It Does |
|---------|-------------|
| **Circuit Breaker** | Stop calling a failing service; fail fast |
| **Bulkhead** | Isolate components so one failure doesn't cascade |
| **Retry with Backoff** | Retry transient failures with exponential delay |
| **Idempotency** | Make operations safe to retry (use idempotency keys) |
| **Graceful Degradation** | Return partial results instead of failing entirely |

### Scaling Patterns

| Pattern | What It Does |
|---------|-------------|
| **Horizontal Scaling** | Add more machines |
| **Auto-Scaling** | Add/remove machines based on load |
| **Read Replicas** | Offload reads from the primary DB |
| **Cache-Aside** | Cache hot data in Redis/Memcached |
| **CDN** | Push static content close to users |
| **Queue-Based Load Leveling** | Buffer bursty traffic through message queues |

### Communication Patterns

| Pattern | When To Use |
|---------|-------------|
| **Pub/Sub** | One-to-many, decoupled event distribution |
| **Request/Reply** | Synchronous API calls |
| **Fan-Out / Fan-In** | Distribute work, then aggregate results |
| **API Gateway** | Single entry point for multiple services |

---

## 10. Classic Mistakes to Avoid

| Mistake | Why It's Bad | What To Do Instead |
|---------|-------------|-------------------|
| Diving into details immediately | Shows no structure | Always start with requirements |
| Not asking clarifying questions | You'll design the wrong thing | Ask at least 3-5 questions first |
| One-size-fits-all database | Shows lack of depth | Justify SQL vs NoSQL for each use case |
| Ignoring failure modes | Real systems break | Discuss what happens when X fails |
| Over-engineering from day one | YAGNI | Start simple, scale when needed |
| Forgetting about monitoring | Can't fix what you can't see | Always mention logging, metrics, alerts |
| Ignoring data consistency | Leads to corrupt data | Explicitly choose your consistency model |
| No back-of-envelope math | Hand-wavy capacity planning | Calculate QPS, storage, bandwidth |
| Single points of failure | One crash = total outage | Redundancy at every layer |
| Forgetting about security | Instant red flag | Mention TLS, auth, input validation |

---

## 11. The One-Page Framework

Use this mental model for ANY system design question:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM DESIGN SKELETON                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌─────┐    ┌───────────┐    ┌──────────────┐  │
│  │ Clients  │───→│ DNS │───→│ CDN       │    │ Object Store │  │
│  │ (Web/App)│    └─────┘    │ (static)  │    │ (S3/Blob)    │  │
│  └────┬─────┘               └───────────┘    └──────────────┘  │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐                                                │
│  │ API Gateway │  ← Rate Limit, Auth, Routing                   │
│  │ / Load Bal. │                                                │
│  └──────┬──────┘                                                │
│         │                                                       │
│    ┌────┴────┐                                                  │
│    ▼         ▼                                                  │
│  ┌─────┐  ┌─────┐    ┌───────────┐                             │
│  │App 1│  │App 2│───→│ Cache     │ ← Redis / Memcached         │
│  │     │  │     │    │ (Read)    │                              │
│  └──┬──┘  └──┬──┘    └───────────┘                             │
│     │        │                                                  │
│     └───┬────┘                                                  │
│         ▼                                                       │
│  ┌────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ Database   │───→│ Read Replicas│    │ Message Queue       │ │
│  │ (Primary)  │    │              │    │ (Kafka/SQS/RabbitMQ)│ │
│  └────────────┘    └──────────────┘    └─────────┬───────────┘ │
│                                                   │             │
│                                         ┌─────────▼───────────┐│
│                                         │ Workers / Consumers ││
│                                         │ (async processing)  ││
│                                         └─────────────────────┘│
│                                                                 │
│  Monitoring & Observability: Logs + Metrics + Traces            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### For Every Component, Ask Yourself:

1. **What** does it do?
2. **Why** did I choose this over alternatives?
3. **How** does it scale?
4. **What happens** when it fails?
5. **What are the trade-offs** I'm accepting?

---

## 12. Specialized Infrastructure Quick Reference

> Deep dives: [26](26-Unique-ID-Generation.md) · [27](27-Proximity-Location-Services.md) · [28](28-Search-Systems.md) · [29](29-Blob-Object-Storage.md) · [30](30-Distributed-Locking.md)

### Unique ID Generation ([Full Notes](26-Unique-ID-Generation.md))

| Method | Bits | Sortable | Coordination | Use Case |
|--------|------|----------|-------------|----------|
| **UUID v4** | 128 | No | None | Simple, universal |
| **Snowflake** | 64 | Yes (time) | Clock sync | Twitter, Discord |
| **ULID** | 128 | Yes (time) | None | Sortable UUID replacement |
| **DB Auto-Increment** | 64 | Yes | Single DB | Small scale |
| **Ticket Server** | 64 | Yes | Centralized | Flickr-style |

- Snowflake: `[1 unused][41 timestamp][10 machine][12 sequence]` = 4096 IDs/ms per machine
- Use UUIDv7 or ULID for new projects (sortable + no coordination)

### Proximity & Location Services ([Full Notes](27-Proximity-Location-Services.md))

| Technique | How It Works | Used By |
|-----------|-------------|---------|
| **Geohashing** | Encode lat/lng into string prefix; nearby = shared prefix | Redis, Elasticsearch |
| **Quadtree** | Recursively divide space into 4 quadrants | Yelp |
| **S2 Geometry** | Map sphere to cells via Hilbert curve | Google Maps |
| **H3** | Hexagonal grid hierarchy | Uber |

- Geohash precision: 6 chars ≈ 1.2km × 600m — good for "nearby" queries
- Edge case: adjacent cells may have completely different prefixes → always query neighbors

### Search Systems ([Full Notes](28-Search-Systems.md))

```
Inverted Index:  "word" → [doc1:pos3, doc2:pos7, doc5:pos1]

Ranking: BM25 (standard) → considers term frequency, doc length, rarity
Elasticsearch: Distributed inverted index on top of Apache Lucene
```

- Write path: Document → Tokenize → Stem → Build inverted index
- Read path: Query → Parse → Score (BM25) → Rank → Return
- Typeahead: Trie + top-k results per prefix, precomputed

### Blob & Object Storage ([Full Notes](29-Blob-Object-Storage.md))

```
Object Storage (S3):  PUT/GET by key, no hierarchy, infinite scale
Block Storage (EBS):  Volumes attached to VMs, filesystem on top
File Storage (EFS):   Shared filesystem (NFS), mounted by multiple VMs
```

- **Pre-signed URLs**: Upload directly to S3 (bypass your servers)
- **Multipart upload**: Required for files > 5GB, recommended > 100MB
- Durability: S3 = 99.999999999% (11 nines) via erasure coding

### Distributed Locking ([Full Notes](30-Distributed-Locking.md))

| Approach | Mechanism | Tradeoff |
|----------|-----------|----------|
| **Redis SET NX EX** | Single-node atomic lock | Fast, not fully safe (no fencing) |
| **Redlock** | Majority quorum across N Redis instances | Controversial (clock issues) |
| **ZooKeeper** | Sequential ephemeral znodes | Strong, but higher latency |
| **etcd** | Lease-based with revision fencing | Strong, Kubernetes-native |

- Always use **fencing tokens** to prevent stale lock holders from corrupting data
- Always set TTL/expiry — never create locks that can live forever

---

## 13. Cloud, DevOps & Ops Excellence Quick Reference

> Deep dives: [31](31-Serverless-FaaS.md) · [32](32-Cloud-Architecture-Patterns.md) · [33](33-Infrastructure-as-Code.md) · [34](34-CICD-Deployment-Pipelines.md) · [35](35-Disaster-Recovery-Business-Continuity.md) · [36](36-Cost-Optimization-Capacity-Planning.md) · [37](37-Workflow-Orchestration.md)

### Serverless ([Full Notes](31-Serverless-FaaS.md))

```
Serverless = you write functions, cloud manages everything else
Cold start: 100ms-10s depending on runtime and package size
```

- Best for: Event-driven, bursty, low-traffic workloads
- Avoid for: Long-running tasks, latency-sensitive, very high throughput
- Cost model: Pay per invocation + duration + memory — free at low scale, expensive at high scale

### Cloud Architecture Patterns ([Full Notes](32-Cloud-Architecture-Patterns.md))

| Pattern | What It Solves |
|---------|---------------|
| **Multi-region active-active** | Global availability, low latency worldwide |
| **Multi-region active-passive** | DR with lower cost |
| **Well-Architected Framework** | 6 pillars: Operational Excellence, Security, Reliability, Performance, Cost, Sustainability |
| **12-Factor App** | Cloud-native best practices for deployable apps |

### Deployment Strategies ([Full Notes](34-CICD-Deployment-Pipelines.md))

| Strategy | Risk | Rollback | Use Case |
|----------|------|----------|----------|
| **Rolling** | Medium | Slow | Default Kubernetes |
| **Blue-Green** | Low | Instant (switch) | Databases, critical services |
| **Canary** | Lowest | Fast | High-traffic consumer apps |
| **A/B Testing** | Low | Fast | Feature experiments |

- **Feature flags** decouple deploy from release — ship dark, enable gradually
- **GitOps**: Git as single source of truth → ArgoCD/Flux auto-sync to cluster

### Disaster Recovery ([Full Notes](35-Disaster-Recovery-Business-Continuity.md))

| Strategy | RTO | Cost | Setup |
|----------|-----|------|-------|
| **Backup & Restore** | Hours | $ | S3 + snapshots |
| **Pilot Light** | 10-30 min | $$ | Core infra always on |
| **Warm Standby** | Minutes | $$$ | Scaled-down copy running |
| **Active-Active** | Near zero | $$$$ | Full capacity in 2+ regions |

- **RPO** = how much data loss is acceptable
- **RTO** = how fast must you recover
- **3-2-1 backup rule**: 3 copies, 2 media types, 1 offsite

### Workflow Orchestration ([Full Notes](37-Workflow-Orchestration.md))

```
Orchestration: Central coordinator drives steps (Temporal, Step Functions)
Choreography: Each service reacts to events (event-driven, no coordinator)
```

- Temporal: Durable execution — functions survive crashes, OOM, deploys
- Saga pattern: Sequence of local transactions + compensating actions for rollback

---

## 14. Domain-Specific & Cross-Cutting Quick Reference

> Deep dives: [38](38-ML-System-Design.md) · [39](39-Advanced-Data-Modeling.md) · [40](40-Graph-Databases-Social-Graphs.md) · [41](41-Content-Moderation-Trust-Safety.md) · [42](42-SLO-SLA-SLI-Error-Budgets.md)

### ML System Design ([Full Notes](38-ML-System-Design.md))

```
Two-stage pattern: Candidate Generation (recall 1000) → Ranking (top 10)
Feature Store: Same features for training (batch) and serving (online)
MLOps: Experiment tracking → Training → Registry → Serving → Monitoring
```

- Monitor for **data drift** (input distribution changes) and **concept drift** (relationship changes)
- A/B test every model change — offline metrics ≠ online impact
- Start simple (logistic regression) → iterate to complex (deep learning)

### Advanced Data Modeling ([Full Notes](39-Advanced-Data-Modeling.md))

| Pattern | When To Use |
|---------|-------------|
| **DynamoDB single-table** | Well-defined access patterns, need joins-without-joins |
| **Cassandra bucketing** | Time-series, prevent unbounded partition growth |
| **Fan-out on write** | Precompute feeds for fast reads (small fan-out) |
| **Fan-out on read** | Defer computation to read time (large fan-out / celebrities) |
| **Event sourcing** | Full audit trail, temporal queries, undo |

- NoSQL rule: **Model for access patterns**, not entities
- Schema evolution: Always maintain backward + forward compatibility for zero-downtime deploys

### Graph Databases ([Full Notes](40-Graph-Databases-Social-Graphs.md))

```
Graph = Nodes + Edges (both have properties)
Index-free adjacency: O(1) per hop (vs O(log n) for SQL JOIN)
Use when: Deep traversals (3+ hops), relationship-heavy queries
```

- Neo4j + Cypher is the most common combo
- Facebook TAO: Custom graph store with heavy caching layer
- Hard to scale (partitioning cuts edges) → limit traversal depth, cache hot subgraphs

### Content Moderation ([Full Notes](41-Content-Moderation-Trust-Safety.md))

```
Pipeline: Upload → Auto-detect (hash + ML) → Score → Route
  High confidence bad  → auto-block
  Low confidence       → auto-allow
  Medium confidence    → human review queue
```

- Cascade: Fast regex → ML classifier → human review (expensive/accurate last)
- PhotoDNA / perceptual hashing for known-bad content (CSAM — legally required)
- Graduated enforcement: Warning → restriction → suspension → ban

### SLO/SLA/SLI & Error Budgets ([Full Notes](42-SLO-SLA-SLI-Error-Budgets.md))

```
SLI = what you measure    (ratio of good events / total events)
SLO = what you target     (99.95% availability — internal)
SLA = what you promise    (99.9% or we refund — external contract)
Error Budget = 1 - SLO    (99.9% SLO → 43 min/month allowed downtime)
```

| Budget Remaining | Action |
|-----------------|--------|
| > 50% | Ship features at full speed |
| 25-50% | Slow down, extra review |
| < 25% | Focus on reliability |
| 0% | Feature freeze |

- **Burn rate alerting** > threshold alerting: "Will we exhaust budget in 3 days?" not "Is error rate > 1%?"
- SLO should be stricter than SLA (internal buffer)
- 100% reliability is the wrong target — diminishing returns

---

## Quick Reference Cards

### URL Shortener (e.g., TinyURL)

```
Write: Long URL → Hash (Base62) → Store in KV Store → Return short URL
Read:  Short URL → Look up in KV Store (cache first) → 301 Redirect

Scale: Cache popular URLs, shard by hash prefix
DB: NoSQL (simple KV lookup), Redis for hot cache
Estimation: 100M new URLs/day → ~1,160 writes/sec
```

### Chat System (e.g., WhatsApp)

```
Connection: WebSocket for real-time, long-polling as fallback
Message Flow: Sender → Chat Server → Message Queue → Recipient's Chat Server
Storage: Recent messages in cache, older in DB (Cassandra for scale)
Group Chat: Fan-out on write (small groups) or fan-out on read (large groups)
Presence: Heartbeat every 30s, gossip protocol for status propagation
```

### News Feed (e.g., Twitter/Instagram)

```
Fan-Out on Write: Pre-compute feed on post → fast reads, slow writes
Fan-Out on Read: Compute feed at read time → fast writes, slow reads
Hybrid: Fan-out on write for normal users, on read for celebrities

Timeline: Merge & rank posts from followed users
Storage: Redis sorted sets for timeline, Cassandra for posts
```

### Rate Limiter

```
Distributed: Use Redis (INCR + EXPIRE per key)
Algorithm: Token Bucket or Sliding Window Counter
Where: API Gateway level (centralized) + per-service (defense-in-depth)
Response: 429 + Retry-After header + X-RateLimit-Remaining
```

---

> **Remember**: The interviewer cares about your **thought process**, not a perfect answer. Communicate clearly, state trade-offs, and drive the conversation.

> **Last tip**: Practice drawing these diagrams on a whiteboard or in a tool like Excalidraw — muscle memory matters.
