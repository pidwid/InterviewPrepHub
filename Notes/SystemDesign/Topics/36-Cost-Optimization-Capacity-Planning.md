# Cost Optimization & Capacity Planning

## Table of Contents

1. [Overview](#1-overview)
2. [Cloud Pricing Models](#2-cloud-pricing-models)
3. [Compute Optimization](#3-compute-optimization)
4. [Storage Optimization](#4-storage-optimization)
5. [Network Cost Optimization](#5-network-cost-optimization)
6. [Database Cost Optimization](#6-database-cost-optimization)
7. [Capacity Planning](#7-capacity-planning)
8. [FinOps Practices](#8-finops-practices)
9. [Cost Monitoring & Alerting](#9-cost-monitoring--alerting)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Cloud costs are the #1 concern for CTOs and the #1 topic Solutions Architects
are asked to optimize. Unlike on-premise, cloud costs are variable and can
grow unchecked without governance.

```
On-Premise:                       Cloud:
  Buy server: $10,000              Pay per hour: $0.10/hr
  Lifespan: 3-5 years              Scale up instantly
  Fixed cost regardless of usage   Pay for what you use
  Capacity planning: months ahead  Capacity planning: minutes
  
  Waste = idle servers you bought   Waste = running resources
                                         nobody turned off

Common wastes:
  ├── Oversized instances (t3.2xlarge when t3.medium suffices)
  ├── Idle resources (dev instances running 24/7)
  ├── Unattached storage volumes
  ├── Unused Elastic IPs
  ├── Over-provisioned databases
  └── Cross-region data transfer
```

---

## 2. Cloud Pricing Models

### Compute Pricing

| Model             | Discount  | Commitment      | Best For                    |
|-------------------|-----------|-----------------|-----------------------------|
| On-Demand         | 0%        | None            | Unpredictable workloads     |
| <abbr title="Reserved Instances: commit to use a specific instance type for 1 or 3 years in exchange for up to 60% discount versus on-demand pricing.">Reserved (1yr)</abbr>    | ~40%      | 1 year          | Steady-state workloads      |
| Reserved (3yr)    | ~60%      | 3 years         | Long-term stable workloads  |
| <abbr title="Savings Plans: a flexible commitment to spend a fixed $/hr on compute for 1–3 years, applicable across instance types and sizes unlike Reserved Instances.">Savings Plans</abbr>     | ~40-60%   | $/hr commitment | Flexible across instance types|
| <abbr title="Spot Instances: spare AWS EC2 capacity offered at up to 90% discount; can be reclaimed by AWS with 2 minutes notice — suitable only for fault-tolerant workloads.">Spot Instances</abbr>    | ~60-90%   | None (can be revoked)| Fault-tolerant batch jobs |

### Spot Instances Deep Dive

```
Spot pricing: Use spare AWS capacity at steep discounts.

  On-Demand: $0.096/hr (m5.large)
  Spot:      $0.035/hr (m5.large) — 63% savings!
  
  BUT: AWS can terminate your instance with 2 minutes notice.

Good for:                         Bad for:
  ✓ Batch processing               ✗ Databases
  ✓ CI/CD build agents              ✗ Stateful applications
  ✓ Map-Reduce / Spark              ✗ Single-instance services
  ✓ Worker pools in ASG             ✗ Anything that can't be interrupted
  ✓ Dev/test environments           

Strategy: Mix spot + on-demand in Auto Scaling Group
  ┌────────────────────────────────────┐
  │ Auto Scaling Group                 │
  │  On-Demand: 30% (baseline)         │
  │  Spot:      70% (cost savings)     │
  │                                    │
  │  If spot reclaimed → ASG launches  │
  │  on-demand replacement             │
  └────────────────────────────────────┘
```

---

## 3. Compute Optimization

### <abbr title="Right-sizing: matching your instance type and size to actual CPU/memory usage so you're not paying for idle capacity.">Right-Sizing</abbr>

```
Right-sizing = matching instance type to actual usage.

  Current instance: m5.2xlarge (8 vCPU, 32 GB)
  Average CPU: 12%
  Average Memory: 25%
  
  Recommendation: m5.large (2 vCPU, 8 GB)
  Savings: 75%!

  ┌────────────────────────────────┐
  │ m5.2xlarge ($0.384/hr)         │
  │ ┌──────────────────────────┐   │
  │ │ CPU: 12% ▓░░░░░░░░░░░░│   │
  │ │ Mem: 25% ▓▓▓░░░░░░░░░░│   │
  │ └──────────────────────────┘   │
  │        WASTED CAPACITY         │
  └────────────────────────────────┘

Tools:
  - AWS Compute Optimizer
  - AWS Cost Explorer (right-sizing recommendations)
  - Datadog, CloudHealth
```

### Auto Scaling

```
Without auto-scaling:              With auto-scaling:
Provisioned for peak:              Scale based on demand:

  Capacity                          Capacity
    │  ┌──────────────────          │       ╭───╮
    │  │                            │    ╭──╯   ╰──╮
    │  │   Wasted $$$               │  ╭─╯  Actual  ╰─╮
    │  │  ╭──╮                      │ ╭╯    demand     ╰╮
    │  │╭╯  ╰──╮                    │╭╯                 ╰╮
    │  ╰╯       ╰──                 └──────────────────────
    └──────────────────              Minimal waste!
     You pay for the box             You pay for the line
```

### ARM-Based Instances

```
x86 (Intel/AMD):  m5.large  → $0.096/hr
ARM (Graviton):   m6g.large → $0.077/hr  ← 20% cheaper, often faster!

AWS Graviton (ARM) is cheaper AND more power-efficient.
Most workloads "just work" on ARM.
Always consider Graviton for new deployments.
```

---

## 4. Storage Optimization

### Storage Tiering

```
S3 Lifecycle Policy:
  
  Day 0-30:    S3 Standard       ($0.023/GB/mo)  ← Frequent access
  Day 30-90:   S3 Standard-IA    ($0.0125/GB/mo) ← Infrequent access
  Day 90-365:  S3 Glacier IR     ($0.004/GB/mo)  ← Archive
  Day 365+:    S3 Glacier Deep   ($0.00099/GB/mo)← Deep archive

  Example: 10 TB of logs
    All in Standard:    $230/month
    With lifecycle:     ~$40/month  ← 83% savings
```

### EBS Optimization

```
Common waste: Unattached EBS volumes (still billing!)

  gp3 vs gp2:
    gp2: $0.10/GB/mo, IOPS scales with size
    gp3: $0.08/GB/mo, 3000 IOPS baseline (free!)
    
    → Switch all gp2 to gp3 for instant 20% savings
    
  Over-provisioned volumes:
    500 GB provisioned, 50 GB used → resize to 100 GB
```

---

## 5. Network Cost Optimization

```
Data transfer is the hidden cloud cost killer.

  FREE:
    ├── Inbound to AWS (internet → AWS)
    ├── Within same AZ (EC2 to EC2, private IP)
    └── S3/DynamoDB via VPC endpoint (same region)
    
  CHEAP ($0.01/GB):
    ├── Cross-AZ within same region
    └── S3 to CloudFront (same region)
    
  EXPENSIVE ($0.02-0.09/GB):
    ├── AWS → Internet (outbound)
    ├── Cross-region data transfer
    └── NAT Gateway data processing ($0.045/GB!)

Cost reduction strategies:
  1. Use VPC endpoints for AWS services (avoid NAT Gateway)
  2. Keep services in the same AZ when possible
  3. Use CloudFront to reduce origin egress
  4. Compress data before transfer
  5. Use AWS PrivateLink instead of public endpoints
  6. Cache aggressively to reduce origin requests
  
  NAT Gateway trap:
    100 TB/month through NAT = $4,500 just for data processing!
    Solution: VPC endpoints for S3, DynamoDB → $0
```

---

## 6. Database Cost Optimization

```
Database is often the most expensive component.

Optimization strategies:
  
  1. Reserved Instances for production databases
     RDS On-Demand: $0.35/hr → Reserved: $0.20/hr (43% savings)
  
  2. Aurora Serverless for variable workloads
     Auto-scales from 0 to max ACUs
     Pay per ACU-second (no idle cost if scales to 0)
  
  3. Read replicas instead of scaling up primary
     Scale reads horizontally, not vertically
  
  4. DynamoDB On-Demand vs Provisioned
     Spiky traffic → On-Demand (higher per-request, no commitment)
     Steady traffic → Provisioned with auto-scaling (cheaper)
     
  5. Caching layer (ElastiCache/Redis)
     Reduce DB load by 80% → smaller, cheaper database
     
     Before cache: db.r5.4xlarge ($2.28/hr)
     After cache:  db.r5.large ($0.285/hr) + ElastiCache ($0.171/hr)
     Savings: ~80%!
```

---

## 7. Capacity Planning

### Estimation Framework

```
Step 1: Understand current usage
  - Requests per second (RPS)
  - Data storage (GB/TB)
  - Growth rate (% per month)

Step 2: Project future needs
  Current: 1,000 RPS, 500 GB storage
  Growth: 10% month-over-month
  In 12 months: 1,000 × 1.1¹² ≈ 3,140 RPS
  In 12 months: 500 × 1.1¹² ≈ 1,570 GB
  
Step 3: Add headroom
  Target: 70% utilization (30% headroom for spikes)
  Needed capacity: 3,140 / 0.7 ≈ 4,486 RPS capacity
  
Step 4: Map to resources
  Each server handles ~500 RPS → need 9 servers
  Database: need 2 TB storage provisioned
```

### Capacity Planning Signals

| Signal             | What It Tells You                           |
|-------------------|---------------------------------------------|
| CPU utilization   | Compute capacity                            |
| Memory utilization| Instance right-sizing                       |
| <abbr title="IOPS (Input/Output Operations Per Second): the rate at which a storage device can read or write data; critical for database and high-throughput workloads.">Disk IOPS</abbr>         | Storage performance needs                   |
| Network throughput| Bandwidth requirements                      |
| Queue depth       | Processing capacity vs demand               |
| <abbr title="p99 latency (99th percentile): 99% of requests complete within this time. A high p99 with a low p50 indicates tail-latency problems that affect a subset of users.">p99 latency</abbr>       | When capacity is becoming insufficient      |
| Error rate        | System under stress                         |

### Auto-Scaling Policies

```
Target Tracking:
  "Keep average CPU at 60%"
  Auto-scale adds/removes instances to maintain target.

Step Scaling:
  CPU > 70% → add 2 instances
  CPU > 85% → add 4 instances
  CPU < 30% → remove 1 instance

Scheduled Scaling:
  Mon-Fri 8am: min = 10 instances (business hours)
  Mon-Fri 6pm: min = 3 instances  (off-hours)
  
Predictive Scaling:
  ML-based: learns traffic patterns and pre-scales.
  Avoids the "scaling lag" during sudden ramps.
```

---

## 8. FinOps Practices

<abbr title="FinOps (Cloud Financial Operations): a practice that brings engineering, finance, and business together to take ownership of cloud spending through visibility, optimization, and governance.">Financial Operations (FinOps)</abbr> = collaboration between engineering, finance,
and business to manage cloud costs.

```
FinOps Lifecycle:

  ┌───────────┐     ┌────────────┐     ┌────────────┐
  │  Inform   │────►│  Optimize  │────►│  Operate   │
  │           │     │            │     │            │
  │ Visibility│     │ Right-size │     │ Governance │
  │ Allocation│     │ Reserved   │     │ Automation │
  │ Reporting │     │ Spot       │     │ Policies   │
  └───────────┘     └────────────┘     └────────────┘
       ▲                                     │
       └─────────────────────────────────────┘
                  Continuous loop
```

### Cost Allocation

```
Tagging Strategy (critical for cost visibility):

  Required tags:
    - Environment: prod / staging / dev
    - Team: payments / platform / data
    - Project: checkout-v2 / search-rewrite
    - Owner: team-email@company.com
    - CostCenter: CC-12345

  Untagged resources → flagged and remediated.
  
  Cost dashboard by team:
    ┌────────────────────────────────────┐
    │ Team          │ Monthly Cost │ Δ   │
    ├───────────────┼──────────────┼─────┤
    │ Payments      │ $45,000      │ +5% │
    │ Platform      │ $32,000      │ -3% │
    │ Data Pipeline │ $28,000      │ +12%│← Investigate!
    │ Search        │ $18,000      │ +2% │
    └───────────────┴──────────────┴─────┘
```

---

## 9. Cost Monitoring & Alerting

```
AWS Cost Tools:
  ├── Cost Explorer: Historical cost analysis, forecasting
  ├── Budgets: Set budget thresholds with alerts
  ├── Cost Anomaly Detection: ML-based unusual spend detection
  ├── Compute Optimizer: Right-sizing recommendations
  └── Trusted Advisor: Cost optimization checks

Alerting:
  Budget: $10,000/month
  Alert 1: 80% ($8,000) → email team lead
  Alert 2: 100% ($10,000) → email + Slack + PagerDuty
  Alert 3: 120% ($12,000) → automatic resource restrictions

  Anomaly detection:
    "Your EC2 spend increased 300% in the last 24 hours"
    → Likely: someone launched 50 instances and forgot
    → Action: Investigate + terminate
```

### Cost Governance Policies

| Policy | Implementation |
|--------|---------------|
| No untagged resources | AWS Config rule + remediation |
| Dev environments off at night | Lambda + EventBridge (cron) |
| Max instance size per team | <abbr title="SCP (Service Control Policy): an AWS Organizations policy that sets the maximum permissions available to accounts in an organizational unit.">Service Control Policy (SCP)</abbr> |
| Budget alerts per team | AWS Budgets per cost center |
| Spot for non-prod | ASG launch template policy |
| Review unused resources weekly | Trusted Advisor + automation |

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Right-size first | Most instances are 2-4x oversized |
| Reserved Instances for baseline | Savings Plans for flexibility, RIs for commitment |
| Spot for fault-tolerant workloads | 60-90% savings, but must handle interruptions |
| Storage lifecycle policies | Auto-tier to cheaper storage classes |
| Data transfer is the hidden cost | VPC endpoints, same-AZ, CloudFront reduce egress |
| Caching reduces DB costs dramatically | Smaller DB + cache cluster < bigger DB |
| Tag everything | No tags = no visibility = no accountability |
| Auto-scale to match demand | Never pay for idle capacity |
| FinOps is a practice, not a project | Continuous inform → optimize → operate loop |
| Plan for growth | Capacity plan quarterly, reserve annually |
