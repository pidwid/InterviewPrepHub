# Cloud Architecture Patterns

## Table of Contents

1. [Overview](#1-overview)
2. [Well-Architected Framework](#2-well-architected-framework)
3. [Multi-Tier Architecture](#3-multi-tier-architecture)
4. [Multi-Region Architecture](#4-multi-region-architecture)
5. [Multi-Cloud & Hybrid Cloud](#5-multi-cloud--hybrid-cloud)
6. [Landing Zones](#6-landing-zones)
7. [Cloud-Native Design Patterns](#7-cloud-native-design-patterns)
8. [Migration Strategies (The 7 Rs)](#8-migration-strategies-the-7-rs)
9. [Cloud Service Models (IaaS/PaaS/SaaS)](#9-cloud-service-models-iaaspaassaas)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Cloud architecture is about designing systems that leverage cloud services
to achieve scalability, reliability, security, and cost-efficiency. It's not
just about moving on-premise systems to the cloud — it's about re-thinking
how systems are built.

```
On-Premise Mindset:              Cloud-Native Mindset:
"Buy for peak capacity"          "Scale for actual demand"
"Prevent all failures"           "Design for failure"
"Monolithic deployment"          "Independent services"
"Manual provisioning"            "Infrastructure as Code"
"Fixed costs"                    "Pay per use"
"Pets (named servers)"           "Cattle (replaceable instances)"
```

---

## 2. Well-Architected Framework

AWS, GCP, and Azure each publish a Well-Architected Framework. AWS's has
6 pillars (the most widely referenced):

```
┌─────────────────────────────────────────────────────────────┐
│             AWS Well-Architected Framework                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Operational Excellence                                  │
│     Run and monitor systems, continually improve            │
│     ├── Infrastructure as Code                              │
│     ├── Frequent, small, reversible changes                 │
│     ├── Refine operations procedures frequently             │
│     ├── Anticipate failure                                  │
│     └── Learn from all operational events                   │
│                                                             │
│  2. Security                                                │
│     Protect data, systems, and assets                       │
│     ├── Implement strong identity foundation (IAM)          │
│     ├── Enable traceability                                 │
│     ├── Apply security at all layers                        │
│     ├── Automate security best practices                    │
│     └── Protect data in transit and at rest                 │
│                                                             │
│  3. Reliability                                             │
│     Recover from failures, meet demand                      │
│     ├── Automatically recover from failure                  │
│     ├── Test recovery procedures                            │
│     ├── Scale horizontally (no single resource)             │
│     ├── Stop guessing capacity                              │
│     └── Manage change through automation                    │
│                                                             │
│  4. Performance Efficiency                                  │
│     Use computing resources efficiently                     │
│     ├── Democratize advanced technologies                   │
│     ├── Go global in minutes                                │
│     ├── Use serverless architectures                        │
│     ├── Experiment more often                               │
│     └── Consider mechanical sympathy                        │
│                                                             │
│  5. Cost Optimization                                       │
│     Avoid unnecessary costs                                 │
│     ├── Implement cloud financial management                │
│     ├── Adopt a consumption model                           │
│     ├── Measure overall efficiency                          │
│     ├── Stop spending on undifferentiated heavy lifting     │
│     └── Analyze and attribute expenditure                   │
│                                                             │
│  6. Sustainability                                          │
│     Minimize environmental impact                           │
│     ├── Understand your impact                              │
│     ├── Establish sustainability goals                      │
│     ├── Maximize utilization                                │
│     └── Use managed services                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### GCP Equivalent Pillars

```
GCP Framework Pillars:
  1. Operational Excellence
  2. Security, Privacy & Compliance
  3. Reliability
  4. Performance & Cost Optimization
  5. System Design → architecture patterns
```

---

## 3. Multi-Tier Architecture

### Classic 3-Tier on Cloud

```
┌─────────────────────────────────────────────────────────────┐
│                      Region: us-east-1                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Presentation Tier (Public Subnet)                    │   │
│  │  ┌───────────┐  ┌───────────┐                        │   │
│  │  │ ALB       │  │ CloudFront│  CDN for static assets │   │
│  │  │           │  │ / CDN     │                        │   │
│  │  └─────┬─────┘  └───────────┘                        │   │
│  └────────┼─────────────────────────────────────────────┘   │
│           │                                                  │
│  ┌────────┼─────────────────────────────────────────────┐   │
│  │  Application Tier (Private Subnet)                    │   │
│  │        ▼                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ App      │  │ App      │  │ App      │  Auto     │   │
│  │  │ Server 1 │  │ Server 2 │  │ Server 3 │  Scaling  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  Group    │   │
│  └───────┼──────────────┼──────────────┼────────────────┘   │
│          │              │              │                     │
│  ┌───────┼──────────────┼──────────────┼────────────────┐   │
│  │  Data Tier (Private Subnet)                           │   │
│  │       ▼              ▼              ▼                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ RDS      │  │ Redis    │  │ S3       │           │   │
│  │  │ Primary  │──│ Cache    │  │ Storage  │           │   │
│  │  │ + Replica│  │ Cluster  │  │          │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### VPC Design

```
VPC: 10.0.0.0/16

  Public Subnets (internet-facing):
    10.0.1.0/24 (AZ-a) ← ALB, NAT Gateway, Bastion
    10.0.2.0/24 (AZ-b) ← ALB, NAT Gateway

  Private Subnets (application):
    10.0.11.0/24 (AZ-a) ← App servers
    10.0.12.0/24 (AZ-b) ← App servers

  Private Subnets (data):
    10.0.21.0/24 (AZ-a) ← RDS primary, ElastiCache
    10.0.22.0/24 (AZ-b) ← RDS replica

  Security Groups:
    ALB SG: Allow 80/443 from 0.0.0.0/0
    App SG: Allow traffic only from ALB SG
    DB SG:  Allow traffic only from App SG
```

---

## 4. Multi-Region Architecture

### Active-Passive (DR)

```
Primary (us-east-1):              DR (eu-west-1):
  ┌──────────────┐                ┌──────────────┐
  │ Full stack   │  Async repl.   │ DB replica   │
  │ (serving     │───────────────►│ (standby)    │
  │  traffic)    │                │              │
  └──────────────┘                └──────────────┘
  
  RTO: minutes to hours (DNS failover, promote replica)
  RPO: seconds (async replication lag)
  Cost: 1.3x of single-region
```

### Active-Active

```
Region 1 (us-east-1):            Region 2 (eu-west-1):
  ┌──────────────┐                ┌──────────────┐
  │ Full stack   │  Bi-directional│ Full stack   │
  │ (serving US  │◄──────────────►│ (serving EU  │
  │  traffic)    │  replication   │  traffic)    │
  └──────────────┘                └──────────────┘
         ▲                               ▲
         └───────────┬───────────────────┘
               ┌─────┴─────┐
               │   Route53  │  Latency-based or
               │   / Global │  geolocation routing
               │   LB       │
               └────────────┘
               
  RTO: ~0 (already running)
  RPO: ~0 (with conflict resolution)
  Cost: 2x+ of single-region
  Challenge: Data consistency across regions!
```

### Data Consistency in Multi-Region

```
Write conflicts when both regions accept writes:

  User updates profile in US:  name = "Alice"
  User updates profile in EU:  name = "Alicia"
  
  Conflict resolution strategies:
    1. Last-writer-wins (timestamp-based, simple, lossy)
    2. Application-level resolution (custom merge logic)
    3. CRDTs (Conflict-free Replicated Data Types)
    4. Single-leader per entity (route writes to one region)
```

---

## 5. Multi-Cloud & Hybrid Cloud

### Multi-Cloud

```
Why multi-cloud?
  ├── Avoid vendor lock-in
  ├── Best-of-breed services (GCP for ML, AWS for breadth)
  ├── Regulatory requirements (data sovereignty)
  └── Negotiating leverage

Why NOT multi-cloud?
  ├── Operational complexity (2x+ tooling, training)
  ├── Lowest common denominator (can't use cloud-native features)
  ├── Cross-cloud networking costs
  └── Inconsistent security posture

  ┌──────────────┐    ┌──────────────┐
  │     AWS      │    │     GCP      │
  │ • Compute    │    │ • ML/AI      │
  │ • Storage    │◄──►│ • BigQuery   │
  │ • Databases  │    │ • Analytics  │
  └──────────────┘    └──────────────┘
         │                    │
    ┌────┴────────────────────┴────┐
    │    Kubernetes (portable)     │
    │    Terraform (multi-cloud)   │
    │    Service Mesh (Istio)      │
    └─────────────────────────────┘
```

### Hybrid Cloud

```
On-Premise ◄──── VPN / Direct Connect ────► Cloud
                                             
  Keep in on-prem:                Move to cloud:
  • Sensitive data (compliance)   • Variable workloads
  • Legacy systems (hard to move) • New applications
  • Low-latency requirements      • Disaster recovery
  
  Tools: AWS Outposts, Azure Arc, Google Anthos
```

---

## 6. Landing Zones

A pre-configured, secure, multi-account cloud environment following best practices.

```
Organization Root
├── Security OU
│   ├── Log Archive Account (centralized logging)
│   └── Security Tooling Account (GuardDuty, SecurityHub)
├── Infrastructure OU
│   ├── Networking Account (Transit Gateway, VPN)
│   └── Shared Services Account (CI/CD, artifact repos)
├── Sandbox OU
│   └── Developer Sandbox Accounts (experimentation)
├── Workloads OU
│   ├── Production Account (prod workloads)
│   ├── Staging Account (pre-prod)
│   └── Development Account (dev workloads)
└── Suspended OU
    └── Decommissioned accounts

Key Guardrails:
  • SCPs (Service Control Policies) restrict what each account can do
  • Centralized logging (CloudTrail → Log Archive)
  • Network transit via shared VPC / Transit Gateway
  • SSO for all accounts (one identity provider)
```

---

## 7. Cloud-Native Design Patterns

### The Twelve-Factor App

```
1.  Codebase:       One repo, many deploys
2.  Dependencies:   Explicitly declare (package.json, requirements.txt)
3.  Config:         Store in environment variables
4.  Backing services: Treat as attached resources (DB, cache, queue)
5.  Build/Release/Run: Strictly separate stages
6.  Processes:       Stateless, share-nothing
7.  Port binding:    Self-contained, export via port
8.  Concurrency:     Scale via process model
9.  Disposability:   Fast startup, graceful shutdown
10. Dev/Prod parity: Keep environments as similar as possible
11. Logs:            Treat as event streams (stdout)
12. Admin processes: Run as one-off processes
```

### Common Cloud-Native Patterns

| Pattern | Description |
|---------|-------------|
| Strangler Fig | Gradually replace legacy with new services behind a facade |
| Sidecar | Attach helper container alongside main container (logging, proxy) |
| Ambassador | Proxy outbound connections (circuit breaker, retry) |
| Circuit Breaker | Fail fast when downstream is unhealthy |
| Bulkhead | Isolate failure domains (separate pools/instances) |
| Retry with Backoff | Exponential backoff + jitter for transient failures |
| Queue-Based Load Leveling | Buffer requests via queue to smooth spikes |
| Competing Consumers | Multiple workers process from same queue |
| CQRS | Separate read and write models for different scale requirements |
| Event Sourcing | Store events, not state — rebuild state from event log |

### Resilience Patterns in Detail

```
Circuit Breaker:
  ┌────────┐    success     ┌────────┐
  │ CLOSED │───────────────►│ CLOSED │  (normal operation)
  │        │                │        │
  │        │   N failures   │        │
  │        │───────────────►│  OPEN  │  (reject all requests)
  │        │                │        │
  │        │   timeout      │        │
  │        │◄───────────────│  HALF  │  (try one request)
  │        │                │  OPEN  │
  └────────┘                └────────┘

Bulkhead:
  ┌───────────────────────────────────────┐
  │ Service                               │
  │  ┌──────────┐  ┌──────────┐          │
  │  │ Pool A   │  │ Pool B   │          │
  │  │ (orders) │  │ (users)  │          │
  │  │ 10 conn  │  │ 10 conn  │          │
  │  └──────────┘  └──────────┘          │
  │  If orders DB is slow, only Pool A   │
  │  is affected. Pool B still works.    │
  └───────────────────────────────────────┘
```

---

## 8. Migration Strategies (The 7 Rs)

```
┌──────────────┬────────────────────────────────────────────────────┐
│ Strategy     │ Description                                        │
├──────────────┼────────────────────────────────────────────────────┤
│ Rehost       │ "Lift and shift" — move as-is to cloud VMs        │
│ Replatform   │ Minor optimizations (e.g., managed DB instead of  │
│              │ self-managed, but same architecture)               │
│ Repurchase   │ Switch to SaaS (e.g., on-prem CRM → Salesforce)  │
│ Refactor     │ Re-architect for cloud-native (microservices,     │
│              │ serverless, containers)                            │
│ Retire       │ Decommission — not needed anymore                 │
│ Retain       │ Keep on-premise (compliance, too complex to move) │
│ Relocate     │ Move to cloud without changes (VMware → VMware   │
│              │ Cloud on AWS)                                     │
└──────────────┴────────────────────────────────────────────────────┘

Migration approach:
  Phase 1: Rehost/Replatform (quick wins, ≤ 6 months)
  Phase 2: Refactor high-value applications (6-18 months)
  Phase 3: Retire/Retain remaining (ongoing)
```

---

## 9. Cloud Service Models (IaaS/PaaS/SaaS)

```
┌─────────────────────────────────────────────────────────────┐
│              You Manage Less →                               │
│                                                              │
│  On-Premise │   IaaS    │    PaaS    │    SaaS     │        │
│             │           │           │             │        │
│  ┌────────┐ │ ┌────────┐│ ┌────────┐│ ┌──────────┐│        │
│  │App     │ │ │App     ││ │App     ││ │Everything││        │
│  ├────────┤ │ ├────────┤│ ├────────┤│ │managed   ││        │
│  │Runtime │ │ │Runtime ││ │ Managed││ │by vendor ││        │
│  ├────────┤ │ ├────────┤│ │        ││ │          ││        │
│  │OS      │ │ │OS      ││ │        ││ │          ││        │
│  ├────────┤ │ ├────────┤│ │        ││ │          ││        │
│  │Hardware│ │ │ Cloud  ││ │ Cloud  ││ │          ││        │
│  └────────┘ │ └────────┘│ └────────┘│ └──────────┘│        │
│  You manage │ You manage│ You manage│ You manage  │        │
│  everything │ App+OS    │ App only  │ Nothing     │        │
│             │           │           │             │        │
│  Examples:  │ EC2, GCE  │ Heroku,   │ Gmail,      │        │
│  Your DC    │ Azure VMs │ App Engine│ Salesforce   │        │
│             │ DigitalO. │ Elastic BS│ Slack        │        │
└─────────────┴───────────┴───────────┴─────────────┘
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Learn the Well-Architected Framework | The 6 pillars are the language SA interviewers speak |
| Design for failure | Everything fails — auto-healing, multi-AZ, backups |
| Multi-region ≠ just replication | Active-active needs conflict resolution; active-passive needs fast failover |
| Multi-cloud is organizational, not technical | The operational overhead is rarely worth it unless mandated |
| Landing zones enable governance at scale | Multi-account strategy with guardrails |
| 12-Factor App is the cloud-native checklist | Stateless, config in env vars, disposable processes |
| Know the 7 Rs for migration questions | Not everything should be refactored — rehost quick wins first |
| Cloud-native ≠ cloud-only | The same patterns work on-premise with Kubernetes |
