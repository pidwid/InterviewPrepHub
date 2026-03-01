# System Design Study Guide

> A comprehensive, structured guide for System Design interviews at the **Senior Engineer / Senior Architect** level.
> Each topic has its own dedicated file with thorough notes, real-world examples, and diagrams.

---

## How to Use This Guide

1. **Deep Study:** Go through each topic file individually — they are self-contained and ordered from foundational to advanced.
2. **Practice Q&A:** Each topic file has 10 senior interview questions at the end. Test yourself, then check your answers in the [QnA Answer Key](QnA-Answer-Key.md).
3. **Quick Review:** Use the [Interview Cheat Sheet](Interview-Cheat-Sheet.md) for a last-minute refresher before your interview.
4. **Format:** Every file follows the same structure — concepts explained in plain English, ASCII diagrams, real-world examples, trade-offs, and key takeaways.

---

## Table of Contents

### Part 1: Core Fundamentals

| # | Topic | File |
|---|-------|------|
| 01 | Performance vs Scalability | [01-Performance-vs-Scalability.md](01-Performance-vs-Scalability.md) |
| 02 | Latency vs Throughput | [02-Latency-vs-Throughput.md](02-Latency-vs-Throughput.md) |
| 03 | Availability vs Consistency (CAP Theorem) | [03-Availability-vs-Consistency.md](03-Availability-vs-Consistency.md) |
| 04 | Consistency Patterns | [04-Consistency-Patterns.md](04-Consistency-Patterns.md) |
| 05 | Availability Patterns | [05-Availability-Patterns.md](05-Availability-Patterns.md) |

### Part 2: Infrastructure & Networking

| # | Topic | File |
|---|-------|------|
| 06 | Domain Name System (DNS) | [06-Domain-Name-System.md](06-Domain-Name-System.md) |
| 07 | Content Delivery Networks (CDN) | [07-Content-Delivery-Networks.md](07-Content-Delivery-Networks.md) |
| 08 | Load Balancers | [08-Load-Balancers.md](08-Load-Balancers.md) |
| 09 | Reverse Proxy | [09-Reverse-Proxy.md](09-Reverse-Proxy.md) |
| 10 | Application Layer & Microservices | [10-Application-Layer.md](10-Application-Layer.md) |

### Part 3: Data & Storage

| # | Topic | File |
|---|-------|------|
| 11 | Databases (SQL, NoSQL, Replication, Sharding) | [11-Databases.md](11-Databases.md) |
| 12 | Caching | [12-Caching.md](12-Caching.md) |

### Part 4: Async, Communication & APIs

| # | Topic | File |
|---|-------|------|
| 13 | Asynchronism (Queues, Back Pressure) | [13-Asynchronism.md](13-Asynchronism.md) |
| 14 | Communication Protocols (TCP, UDP, HTTP, RPC, REST, GraphQL) | [14-Communication-Protocols.md](14-Communication-Protocols.md) |
| 15 | API Design & API Gateways | [15-API-Design.md](15-API-Design.md) |

### Part 5: Security & Reliability

| # | Topic | File |
|---|-------|------|
| 16 | Security | [16-Security.md](16-Security.md) |
| 17 | Rate Limiting & Throttling | [17-Rate-Limiting.md](17-Rate-Limiting.md) |

### Part 6: Advanced / Architect-Level Topics

| # | Topic | File |
|---|-------|------|
| 18 | Distributed Systems Deep Dive | [18-Distributed-Systems.md](18-Distributed-Systems.md) |
| 19 | Event-Driven Architecture (Event Sourcing, CQRS) | [19-Event-Driven-Architecture.md](19-Event-Driven-Architecture.md) |
| 20 | Observability (Logging, Monitoring, Tracing) | [20-Observability.md](20-Observability.md) |
| 21 | Data Pipelines & Stream Processing | [21-Data-Pipelines.md](21-Data-Pipelines.md) |
| 22 | Containers & Orchestration (Docker, Kubernetes) | [22-Containers-Orchestration.md](22-Containers-Orchestration.md) |
| 23 | Networking Deep Dive | [23-Networking-Deep-Dive.md](23-Networking-Deep-Dive.md) |
| 24 | Back-of-the-Envelope Estimation | [24-Estimation-Numbers.md](24-Estimation-Numbers.md) |

### Part 7: Specialized Infrastructure

| # | Topic | File |
|---|-------|------|
| 26 | Unique ID Generation (Snowflake, UUID, ULID) | [26-Unique-ID-Generation.md](26-Unique-ID-Generation.md) |
| 27 | Proximity & Location-Based Services | [27-Proximity-Location-Services.md](27-Proximity-Location-Services.md) |
| 28 | Search Systems (Inverted Index, Elasticsearch) | [28-Search-Systems.md](28-Search-Systems.md) |
| 29 | Blob & Object Storage (S3, GFS, HDFS) | [29-Blob-Object-Storage.md](29-Blob-Object-Storage.md) |
| 30 | Distributed Locking (Redis, ZooKeeper, Fencing) | [30-Distributed-Locking.md](30-Distributed-Locking.md) |

### Part 8: Cloud, DevOps & Operational Excellence

| # | Topic | File |
|---|-------|------|
| 31 | Serverless & FaaS | [31-Serverless-FaaS.md](31-Serverless-FaaS.md) |
| 32 | Cloud Architecture Patterns | [32-Cloud-Architecture-Patterns.md](32-Cloud-Architecture-Patterns.md) |
| 33 | Infrastructure as Code (Terraform, CloudFormation) | [33-Infrastructure-as-Code.md](33-Infrastructure-as-Code.md) |
| 34 | CI/CD & Deployment Pipelines | [34-CICD-Deployment-Pipelines.md](34-CICD-Deployment-Pipelines.md) |
| 35 | Disaster Recovery & Business Continuity | [35-Disaster-Recovery-Business-Continuity.md](35-Disaster-Recovery-Business-Continuity.md) |
| 36 | Cost Optimization & Capacity Planning | [36-Cost-Optimization-Capacity-Planning.md](36-Cost-Optimization-Capacity-Planning.md) |
| 37 | Workflow Orchestration (Temporal, Step Functions) | [37-Workflow-Orchestration.md](37-Workflow-Orchestration.md) |

### Part 9: Domain-Specific & Cross-Cutting Concerns

| # | Topic | File |
|---|-------|------|
| 38 | ML System Design (Feature Stores, Serving, MLOps) | [38-ML-System-Design.md](38-ML-System-Design.md) |
| 39 | Advanced Data Modeling (DynamoDB, Cassandra, NoSQL) | [39-Advanced-Data-Modeling.md](39-Advanced-Data-Modeling.md) |
| 40 | Graph Databases & Social Graphs | [40-Graph-Databases-Social-Graphs.md](40-Graph-Databases-Social-Graphs.md) |
| 41 | Content Moderation & Trust and Safety | [41-Content-Moderation-Trust-Safety.md](41-Content-Moderation-Trust-Safety.md) |
| 42 | SLO, SLA, SLI & Error Budgets | [42-SLO-SLA-SLI-Error-Budgets.md](42-SLO-SLA-SLI-Error-Budgets.md) |

### Appendix & Quick Reference

| # | Topic | File |
|---|-------|------|
| 25 | Appendix (Powers of Two, Latency Numbers, Interview Questions, Real World Architectures, Engineering Blogs) | [25-Appendix.md](25-Appendix.md) |

### Quick Reference

| Resource | File |
|----------|------|
| **Interview Cheat Sheet** (read this before your interview) | [Interview-Cheat-Sheet.md](Interview-Cheat-Sheet.md) |
| **Q&A Answer Key** (240 questions with detailed answers) | [QnA-Answer-Key.md](QnA-Answer-Key.md) |

---

## Suggested Study Order

### If you have 1 week
Focus on: 01 → 03 → 08 → 11 → 12 → 13 → 14 → 24 → Cheat Sheet

### If you have 2-3 weeks
Add: 02 → 04 → 05 → 06 → 07 → 09 → 10 → 15 → 16 → 17

### If you have 1+ month
Cover everything including Part 6 advanced topics (18-24) and Part 7 specialized infrastructure (26-30)

### If you have 2+ months
Add Part 8 (31-37) and Part 9 (38-42) for full coverage of cloud, DevOps, ML systems, and SRE topics

---

## Key Principles to Remember

1. **Everything is a trade-off** — there is no "best" solution, only the "best fit" for your constraints.
2. **Start simple, then scale** — don't over-engineer from the start.
3. **Justify your decisions** — interviewers care about *why* you chose something, not just *what*.
4. **Know the numbers** — back-of-the-envelope estimation separates good from great candidates.
5. **Think about failure modes** — what happens when things break?
