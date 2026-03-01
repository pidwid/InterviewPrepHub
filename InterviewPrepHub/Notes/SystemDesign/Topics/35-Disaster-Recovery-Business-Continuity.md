# Disaster Recovery & Business Continuity

## Table of Contents

1. [Overview](#1-overview)
2. [RPO and RTO](#2-rpo-and-rto)
3. [DR Strategies](#3-dr-strategies)
4. [Backup Strategies](#4-backup-strategies)
5. [Multi-Region Failover](#5-multi-region-failover)
6. [Data Replication for DR](#6-data-replication-for-dr)
7. [Chaos Engineering](#7-chaos-engineering)
8. [DR Runbooks & Testing](#8-dr-runbooks--testing)
9. [Business Continuity Planning](#9-business-continuity-planning)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Disaster Recovery (DR) is the process of restoring systems after a failure.
Business Continuity (BC) is the broader strategy of keeping operations running
during and after a disaster. Every SA must be able to design for both.

```
Disasters:
  ├── Hardware: Disk failure, server failure, rack failure
  ├── Software: Bug causes data corruption, deployment breaks
  ├── Network: Region connectivity loss, DNS outage
  ├── External: Power outage, natural disaster, DDoS attack
  └── Human: Accidental deletion, misconfiguration

Key question: "What happens when X fails?"
  Follow-up: "How fast can we recover?" (RTO)
  Follow-up: "How much data can we afford to lose?" (RPO)
```

---

## 2. RPO and RTO

The two most critical metrics in disaster recovery.

```
                          Disaster
  ◄───── Data Loss ─────►│◄───── Downtime ─────────►
                          │
  ─────────────┬──────────┼──────────┬───────────────
  Last backup  │          │          │  System restored
               │          │          │
               ◄── RPO ──►│◄── RTO ──►
               
  RPO (Recovery Point Objective):
    Maximum acceptable data loss (measured in time).
    "How much data can we afford to lose?"
    RPO = 1 hour → must back up at least every hour.
    
  RTO (Recovery Time Objective):
    Maximum acceptable downtime.
    "How quickly must we recover?"
    RTO = 15 minutes → system must be back within 15 min.
```

### RPO/RTO Examples

| Application       | RPO         | RTO          | Strategy Needed      |
|-------------------|-------------|--------------|---------------------|
| Banking/payments  | 0 (zero)    | < 1 minute   | Multi-region active-active |
| E-commerce        | < 1 hour    | < 15 minutes | Warm standby + replicas |
| Email             | < 4 hours   | < 1 hour     | Pilot light + backups |
| Analytics/BI      | < 24 hours  | < 4 hours    | Backup and restore  |
| Archive/compliance| < 24 hours  | < 24 hours   | S3 cross-region     |

---

## 3. DR Strategies

Listed from cheapest/slowest recovery to most expensive/fastest recovery.

### 3.1 Backup and Restore

```
Cost: $                    RTO: Hours
RPO: Hours                 

  Production (us-east-1):       DR (eu-west-1):
  ┌──────────────┐              ┌──────────────┐
  │ Full stack   │  Periodic    │              │
  │ running      │──backup────►│   S3 Bucket  │
  │              │  (daily)     │   (backups)  │
  └──────────────┘              └──────────────┘
  
  Recovery: Restore from backups → Launch infrastructure → Restore data
  Time: Hours (depends on data size and infra complexity)
```

### 3.2 Pilot Light

```
Cost: $$                   RTO: 10s of minutes
RPO: Minutes               

  Production (us-east-1):       DR (eu-west-1):
  ┌──────────────┐              ┌──────────────┐
  │ Full stack   │  Continuous  │ DB replica   │
  │ running      │──replication─►│ (running)    │
  │              │              │              │
  │              │              │ Everything   │
  │              │              │ else OFF     │
  └──────────────┘              └──────────────┘
  
  Only the database is replicated and running ("pilot light").
  Recovery: Spin up compute, load balancers, etc. around the database.
  Time: 10-30 minutes to launch remaining infrastructure.
```

### 3.3 Warm Standby

```
Cost: $$$                  RTO: Minutes
RPO: Seconds-Minutes       

  Production (us-east-1):       DR (eu-west-1):
  ┌──────────────┐              ┌──────────────┐
  │ Full stack   │  Continuous  │ Scaled-down  │
  │ full scale   │──replication─►│ full stack   │
  │              │              │ (minimal)    │
  │              │              │ 1 of each    │
  └──────────────┘              └──────────────┘
  
  A smaller version of the full production environment is running.
  Recovery: Scale up the standby environment + switch DNS.
  Time: Minutes.
```

### 3.4 Multi-Site Active-Active

```
Cost: $$$$                 RTO: ~0 (near-instant)
RPO: ~0 (near-zero)        

  Region 1 (us-east-1):         Region 2 (eu-west-1):
  ┌──────────────┐               ┌──────────────┐
  │ Full stack   │◄─────────────►│ Full stack   │
  │ full scale   │  Bi-dir repl  │ full scale   │
  │ serving 50%  │               │ serving 50%  │
  └──────────────┘               └──────────────┘
         ▲                               ▲
         └────────── Global LB ──────────┘
  
  Both regions serve traffic simultaneously.
  Recovery: No recovery needed — the other region absorbs traffic.
  Time: Seconds (just a routing change).
```

### Strategy Comparison

| Strategy          | RTO           | RPO           | Cost       |
|------------------|---------------|---------------|------------|
| Backup/Restore   | Hours         | Hours         | $          |
| Pilot Light      | 10-30 min     | Minutes       | $$         |
| Warm Standby     | Minutes       | Seconds-Min   | $$$        |
| Active-Active    | Near-zero     | Near-zero     | $$$$       |

---

## 4. Backup Strategies

### Backup Types

```
Full Backup:
  Day 1: Backup ALL data (100 GB)
  Day 2: Backup ALL data (102 GB)
  Day 3: Backup ALL data (105 GB)
  
  Pro: Simple restore. Con: Slow, expensive.

Incremental Backup:
  Day 1: Full backup (100 GB)
  Day 2: Changes since Day 1 (2 GB)
  Day 3: Changes since Day 2 (3 GB)
  
  Restore: Day 1 + Day 2 + Day 3
  Pro: Fast, small. Con: Restore requires all increments.

Differential Backup:
  Day 1: Full backup (100 GB)
  Day 2: Changes since Day 1 (2 GB)
  Day 3: Changes since Day 1 (5 GB)  ← since FULL, not since last diff
  
  Restore: Day 1 + latest differential
  Pro: Faster restore than incremental. Con: Grows over time.
```

### The 3-2-1 Backup Rule

```
3 copies of your data
2 different storage media (e.g., disk + cloud)
1 offsite copy (different region/facility)

Example:
  Copy 1: Production database (EBS)
  Copy 2: Automated snapshots (S3 same region)
  Copy 3: Cross-region replication (S3 different region)
```

### Database Backup Strategies

| Database    | Backup Method                         |
|-----------|---------------------------------------|
| PostgreSQL | pg_dump, WAL archiving, pg_basebackup |
| MySQL     | mysqldump, binary log replication     |
| DynamoDB  | Point-in-time recovery (PITR), on-demand backups |
| MongoDB   | mongodump, oplog, Atlas backups       |
| Redis     | RDB snapshots, AOF (append-only file) |

---

## 5. Multi-Region Failover

### DNS-Based Failover

```
Route 53 Health Checks + Failover Routing:

  ┌──────────────┐    Health check
  │   Route 53   │───────────────────► Primary endpoint
  │              │    every 30s         (us-east-1)
  │  Primary: A  │         │
  │  Secondary: B│         │
  └──────────────┘         │
                           │
  If primary fails:        ▼
    DNS automatically      ┌──────────────┐
    routes to secondary ──►│ DR endpoint  │
                           │ (eu-west-1)  │
                           └──────────────┘
                           
  TTL considerations:
    Low TTL (60s) → fast failover but more DNS queries
    High TTL (300s) → slower failover, less DNS load
```

### Application-Level Failover

```
Database failover:
  1. Primary DB fails
  2. Health check detects failure
  3. Promote read replica to primary
  4. Update connection strings (or use proxy like RDS Proxy)
  5. Application reconnects to new primary

  ┌──────────┐   fails    ┌──────────┐
  │ Primary  │────────────│ Promoted │
  │ (down)   │            │ Replica  │
  └──────────┘            └──────────┘
                                ▲
                           App reconnects
```

---

## 6. Data Replication for DR

| Replication Type | RPO    | Use Case                          |
|-----------------|--------|-----------------------------------|
| Synchronous     | 0      | Zero data loss (slower writes)    |
| Asynchronous    | Seconds| Most common, slight lag           |
| Semi-synchronous| ~0     | At least 1 replica is in sync     |

### Cross-Region Replication

```
Services with built-in cross-region replication:
  - S3 Cross-Region Replication (CRR)
  - DynamoDB Global Tables
  - Aurora Global Database (< 1 second replication lag)
  - RDS Cross-Region Read Replicas
  - ElastiCache Global Datastore
```

---

## 7. Chaos Engineering

Intentionally injecting failures to test system resilience.

```
Principle: "The best way to test disaster recovery is to create disasters."

Netflix Chaos Monkey approach:
  ┌──────────────────────────────────────┐
  │ Chaos Engineering Experiments        │
  │                                      │
  │ 1. Define steady state (normal)      │
  │ 2. Hypothesize: "System will         │
  │    tolerate X failure"               │
  │ 3. Inject failure                    │
  │ 4. Observe: Did steady state hold?   │
  │ 5. Fix if it didn't                  │
  └──────────────────────────────────────┘
```

### Chaos Engineering Tools

| Tool              | What It Does                              |
|------------------|-------------------------------------------|
| Chaos Monkey     | Randomly kills EC2 instances               |
| Chaos Kong       | Simulates entire region failure            |
| Litmus Chaos     | Kubernetes-native chaos testing            |
| Gremlin          | Enterprise chaos platform                  |
| AWS FIS          | Fault Injection Simulator (managed)        |
| Toxiproxy        | Simulate network conditions (latency,etc.) |

### Types of Failure Injection

```
Infrastructure:
  - Kill an instance
  - Detach an EBS volume
  - Simulate AZ failure
  
Network:
  - Add latency (100ms, 500ms)
  - Drop packets (10%, 50%)
  - Partition network segments
  
Application:
  - Inject exceptions
  - Exhaust memory / CPU
  - Fill disk
  
Dependencies:
  - Return errors from downstream
  - Add latency on API calls
  - Timeout database connections
```

---

## 8. DR Runbooks & Testing

### DR Runbook Template

```
DR Runbook: Database Failover
────────────────────────────────────
Trigger: Primary DB unreachable for > 5 minutes
RTO: 15 minutes
RPO: < 1 minute

Steps:
  1. Verify primary is actually down (not a monitoring false positive)
  2. Notify incident commander and stakeholders
  3. Initiate failover:
     - RDS: Modify instance, enable Multi-AZ failover
     - Aurora: Failover to read replica
     - Custom: Promote replica, update DNS/config
  4. Verify new primary is accepting writes
  5. Update connection strings if needed
  6. Run smoke tests against the new primary
  7. Monitor for 30 minutes
  8. Post-incident: Root cause analysis

Owner: SRE Team
Last tested: 2024-01-15
Next test: 2024-04-15
```

### DR Testing Schedule

| Test Type          | Frequency  | Description                          |
|-------------------|-----------|--------------------------------------|
| Tabletop exercise | Quarterly | Walk through runbook verbally        |
| Component failover| Monthly   | Fail over one DB or service          |
| Full DR drill     | Annually  | Simulate complete region failure     |
| Chaos experiments | Weekly    | Random failure injection             |
| Backup restore    | Monthly   | Verify backups are actually usable   |

---

## 9. Business Continuity Planning

```
Business Impact Analysis (BIA):

  For each system, determine:
  ┌─────────────────────────────────────────────────┐
  │ System: Payment Processing                       │
  │ Business Impact: Revenue loss ($10K/minute)      │
  │ RPO: 0 (no transaction loss)                     │
  │ RTO: 5 minutes                                   │
  │ DR Strategy: Active-Active                       │
  │ Dependencies: Payment gateway, Bank API, DB      │
  │ Responsible team: Payments Engineering            │
  └─────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │ System: Marketing Website                        │
  │ Business Impact: Brand reputation                │
  │ RPO: 24 hours                                    │
  │ RTO: 4 hours                                     │
  │ DR Strategy: Backup/Restore                      │
  │ Dependencies: CMS, CDN                           │
  │ Responsible team: Marketing Engineering           │
  └─────────────────────────────────────────────────┘
```

### Communication Plan

```
Incident detected
    │
    ▼
Incident Commander assigned
    │
    ├── Internal: Slack #incident channel, PagerDuty
    ├── Engineering: Status bridge (Zoom/Slack huddle)
    ├── Leadership: Email summary every 30 min
    ├── Customers: Status page update (Statuspage.io)
    └── Post-incident: Blameless post-mortem within 48 hours
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Know RPO and RTO cold | These drive every DR architecture decision |
| DR strategy matches business value | $$$$ for payments, $ for internal tools |
| Active-active gives best RPO/RTO | But costs 2x+ and adds complexity |
| Untested DR plans are useless | Test regularly — quarterly at minimum |
| Chaos engineering builds confidence | Find weaknesses before real disasters do |
| Backups aren't DR | Backups = data copy. DR = full recovery plan |
| The 3-2-1 rule for backups | 3 copies, 2 media, 1 offsite |
| Cross-region replication is built-in | Most AWS/GCP/Azure services support it natively |
| Runbooks must be actionable | Step-by-step, no ambiguity, tested regularly |
| Recovery time includes human time | Detection + decision + execution = actual recovery time |
