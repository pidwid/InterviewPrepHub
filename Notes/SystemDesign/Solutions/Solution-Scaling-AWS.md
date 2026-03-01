# Design a System that Scales to Millions of Users on AWS

This is a progressive system design problem: start with a single server and evolve it step-by-step to handle millions of users. The focus is on understanding **when** and **why** each scaling technique is introduced, mirroring how real startups grow their architecture.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What kind of application is this?  
**Interviewer:** A generic web application — could be a social app, e-commerce, or SaaS. Focus on the infrastructure and scaling patterns, not the business logic.

**Candidate:** What's the growth trajectory?  
**Interviewer:** Start with a few hundred users and scale to millions.

**Candidate:** Should we use specific AWS services or stay generic?  
**Interviewer:** Use AWS services where appropriate. Show how each scaling step addresses a specific bottleneck.

### The Journey

| Stage | Users | Key Challenge |
|-------|-------|---------------|
| 1 | 1 - 100 | Get it running |
| 2 | 100 - 1K | Separate concerns |
| 3 | 1K - 10K | Database bottleneck |
| 4 | 10K - 100K | App server bottleneck |
| 5 | 100K - 1M | Performance optimization |
| 6 | 1M+ | Global scale |

---

## Step 2 — Evolution from Single Server to Millions

### Stage 1: Single Server (1-100 Users)

Everything on one machine: web server, application, database.

```
┌─────────────────────────────┐
│     Single EC2 Instance     │
│                             │
│  ┌─────────┐ ┌───────────┐ │
│  │  Web    │ │ Database  │ │
│  │  App    │ │ (MySQL)   │ │
│  │ (Node/ │ │           │ │
│  │  Django)│ │           │ │
│  └─────────┘ └───────────┘ │
│                             │
│     t3.medium ($30/mo)      │
└─────────────────────────────┘
         │
    Route 53 (DNS)
    example.com → IP
```

**AWS Services:**
- EC2 (t3.medium) — app + DB on one instance
- Route 53 — DNS
- Elastic IP — static IP address

**This works until:** DB and app compete for CPU/memory on the same machine.

### Stage 2: Separate App and Database (100-1K Users)

Split the database to its own server.

```
┌──────────────┐     ┌──────────────┐
│  EC2         │     │  RDS         │
│  (App Server)│────▶│  (MySQL)     │
│              │     │              │
│  t3.medium   │     │  db.t3.medium│
└──────────────┘     └──────────────┘
```

**Why:** Independent scaling — app is CPU-bound, DB is I/O-bound. They need different instance types and can be tuned separately.

**AWS Services:**
- Amazon RDS (MySQL or PostgreSQL) — managed database, auto backups, failover
- EC2 — app server only

**SQL vs NoSQL decision:**

| Choose SQL (RDS) | Choose NoSQL (DynamoDB) |
|-------------------|------------------------|
| Structured data with relationships | Super low latency at any scale |
| Complex queries with JOINs | Massive write throughput |
| ACID transactions needed | Schemaless / rapidly changing data |
| Most web applications | IoT, gaming leaderboards, sessions |

**For most applications: Start with SQL (RDS).** You can always add NoSQL later for specific use cases.

### Stage 3: Vertical Scaling + Read Replicas (1K-10K Users)

The database becomes the bottleneck (reads >> writes for most apps).

```
                    ┌──────────────┐
            ┌──────▶│  RDS Read    │
            │       │  Replica 1   │
┌──────────┐│       └──────────────┘
│  EC2     ├┤
│  (App)   ││       ┌──────────────┐
│          ├┼──────▶│  RDS Read    │
└──────────┘│       │  Replica 2   │
            │       └──────────────┘
     writes │
            │       ┌──────────────┐
            └──────▶│  RDS Primary │
                    │  (Master)    │
                    └──────────────┘
```

**Pattern:** Write to primary, read from replicas (read/write splitting).

```
Application code:
  // Writes → primary
  db.primary.query("INSERT INTO users ...")

  // Reads → replica (round-robin)
  db.replica.query("SELECT * FROM users WHERE ...")
```

**AWS:** RDS supports up to 5 read replicas. Each replica is an independent RDS instance with async replication.

**Also at this stage — Add caching:**

```
┌──────────┐     ┌────────────────┐     ┌──────────────┐
│  EC2     │────▶│  ElastiCache   │────▶│  RDS         │
│  (App)   │     │  (Redis)       │     │  (on miss)   │
└──────────┘     └────────────────┘     └──────────────┘

Cache strategy: Cache-Aside (Lazy Loading)

def get_user(user_id):
    # 1. Check cache
    user = redis.get(f"user:{user_id}")
    if user:
        return deserialize(user)  # Cache hit
    
    # 2. Cache miss → query DB
    user = db.query("SELECT * FROM users WHERE id = ?", user_id)
    
    # 3. Store in cache with TTL
    redis.setex(f"user:{user_id}", 3600, serialize(user))
    return user
```

**AWS Services Added:**
- ElastiCache (Redis) — session storage, query caching
- RDS Read Replicas — scale reads

### Stage 4: Horizontal Scaling + Load Balancer (10K-100K Users)

One app server can't handle the traffic. Add multiple servers behind a load balancer.

```
                     ┌──────────────┐
                     │  CloudFront  │  (CDN)
                     │  (Static)    │
                     └──────┬───────┘
                            │
          ┌─────────────────▼──────────────────┐
          │         ALB (Load Balancer)          │
          └────┬──────────┬──────────┬──────────┘
               │          │          │
         ┌─────▼───┐ ┌───▼─────┐ ┌─▼───────┐
         │  EC2    │ │  EC2    │ │  EC2    │
         │ App #1  │ │ App #2  │ │ App #3  │
         └─────────┘ └─────────┘ └─────────┘
               │          │          │
         ┌─────▼──────────▼──────────▼──────┐
         │        ElastiCache (Redis)        │
         └─────────────┬────────────────────┘
                       │
         ┌─────────────▼────────────────────┐
         │    RDS Primary + Read Replicas    │
         └──────────────────────────────────┘
```

**Critical: App servers must be STATELESS.**

```
Problem: If sessions are stored in server memory, user must
         always hit the same server (sticky sessions).

Solution: Store sessions externally:
  - ElastiCache (Redis) for session data
  - Any server can handle any request
  - Servers are interchangeable → easy to add/remove
```

**Auto Scaling Group:**

```
Auto Scaling Policy:
  - Min: 2 instances
  - Max: 10 instances
  - Scale up: when CPU > 70% for 5 minutes
  - Scale down: when CPU < 30% for 10 minutes
  - Health check: ALB health check on /health endpoint

Launch Template:
  - AMI: pre-baked with app code
  - Instance type: c5.xlarge (compute-optimized)
  - User data: pull latest code from S3, start app
```

**AWS Services Added:**
- ALB (Application Load Balancer) — distribute traffic
- Auto Scaling Group — scale EC2 instances based on demand
- CloudFront — CDN for static assets (images, CSS, JS)
- S3 — store static files, uploaded content

### Stage 5: Performance Optimization (100K-1M Users)

Multiple optimizations layered together:

#### 5a. CDN for Static + Dynamic Content

```
CloudFront Configuration:
  Origin 1: S3 bucket (static assets — CSS, JS, images)
    TTL: 1 year (versioned filenames: app.abc123.js)
  
  Origin 2: ALB (dynamic API)
    TTL: 0 (no caching for API, or short TTL for public data)
    
  Edge locations: 400+ worldwide
  Benefit: Users download static content from nearest edge location
```

#### 5b. Database Sharding

When a single RDS primary can't handle writes:

```
Sharding Strategy: Hash-based on user_id

Shard 1 (users 0-33%):    RDS instance in us-east-1
Shard 2 (users 34-66%):   RDS instance in us-east-1
Shard 3 (users 67-100%):  RDS instance in us-west-2

Routing: shard = hash(user_id) % 3

Or use Amazon Aurora with auto-scaling:
  - Aurora automatically handles read replicas (up to 15)
  - Aurora Serverless for unpredictable workloads
  - Multi-AZ for high availability
```

#### 5c. Message Queues for Async Processing

```
Before: API handles everything synchronously
  POST /signup → create user → send welcome email → send SMS → return 200
  Time: 3000ms (slow!)

After: API publishes events, workers process async
  POST /signup → create user → publish to SQS → return 200 (fast!)

  SQS Queue "user-signup":
    Worker 1: send welcome email (SES)
    Worker 2: send SMS (SNS)
    Worker 3: create analytics event

  Time: 200ms (fast response, background processing)

AWS Services:
  - SQS (Simple Queue Service) — message queuing
  - SNS (Simple Notification Service) — pub/sub
  - SES (Simple Email Service) — transactional email
  - Lambda — serverless workers for queue processing
```

#### 5d. Database Optimization

```
Monitoring:
  - RDS Performance Insights — identify slow queries
  - CloudWatch metrics — CPU, connections, IOPS

Optimizations:
  - Add indexes based on query patterns
  - Connection pooling (RDS Proxy)
  - Query optimization (EXPLAIN ANALYZE)
  - Denormalize hot tables
  - Archive old data to S3 (data lifecycle)

RDS Proxy:
  - Pools and shares DB connections
  - Reduces connection overhead (important with Lambda)
  - Handles failover transparently
```

### Stage 6: Global Scale (1M+ Users)

#### 6a. Multi-Region Deployment

```
┌─────────────────────────────────────────────┐
│              Route 53 (Latency Routing)      │
│   user → nearest region based on latency     │
└─────────┬──────────────────┬────────────────┘
          │                  │
  ┌───────▼───────┐  ┌──────▼────────┐
  │  US-EAST-1    │  │  EU-WEST-1    │
  │               │  │               │
  │  ALB          │  │  ALB          │
  │  EC2 (ASG)    │  │  EC2 (ASG)    │
  │  ElastiCache  │  │  ElastiCache  │
  │  Aurora       │  │  Aurora       │
  │  (Primary)    │  │  (Read Replica)│
  └───────────────┘  └───────────────┘
          │                  ▲
          │  Async Replication│
          └──────────────────┘
```

**Route 53 routing policies:**
- **Latency-based:** Route to region with lowest latency for user
- **Geolocation:** Route EU traffic to EU region (data compliance)
- **Failover:** If primary region is down, route all traffic to secondary

#### 6b. Microservices Decomposition

At this scale, a monolith becomes a bottleneck for development velocity:

```
Monolith → Microservices

┌─────────────┐
│  API Gateway │ (Amazon API Gateway)
└─────┬───────┘
      │
┌─────┼──────────┬──────────┬──────────┐
▼     ▼          ▼          ▼          ▼
User  Auth      Product    Order     Payment
Svc   Svc       Svc        Svc       Svc
│     │         │          │         │
▼     ▼         ▼          ▼         ▼
RDS  Cognito   DynamoDB   Aurora    Stripe
                                    +SQS

Each service:
  - Has its own database (Database per Service)
  - Deployed independently (ECS/EKS)
  - Auto-scales independently
  - Communicates via API calls or events (SQS/SNS)
```

**AWS Services for Microservices:**
- ECS (Elastic Container Service) or EKS (Kubernetes) — container orchestration
- API Gateway — routing, auth, rate limiting
- SQS/SNS — inter-service communication
- X-Ray — distributed tracing
- CloudWatch — centralized logging and monitoring

#### 6c. Full AWS Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     AWS Architecture                      │
│                                                           │
│  Internet ──▶ Route 53 ──▶ CloudFront (CDN)              │
│                               │                           │
│                          WAF (Web App Firewall)           │
│                               │                           │
│                          API Gateway                      │
│                               │                           │
│                    ┌──────────┼──────────┐                │
│                    ▼          ▼          ▼                │
│                  ALB        ALB        ALB               │
│                    │          │          │                │
│              ┌─────┴────┐┌───┴──────┐┌──┴───────┐       │
│              │ECS Fargate││ECS Fargate││ECS Fargate│      │
│              │(User Svc) ││(Order Svc)││(Prod Svc) │      │
│              └─────┬────┘└───┬──────┘└──┬───────┘       │
│                    │          │          │                │
│              ┌─────┴──────┐  │   ┌──────┴─────┐         │
│              │Aurora      │  │   │DynamoDB    │         │
│              │(User DB)   │  │   │(Product DB)│         │
│              └────────────┘  │   └────────────┘         │
│                              │                           │
│              ┌───────────────┴──────────────┐            │
│              │ ElastiCache (Redis Cluster)   │            │
│              └──────────────────────────────┘            │
│                                                           │
│              SQS (async jobs)     S3 (file storage)      │
│              Lambda (workers)     CloudWatch (monitoring) │
│              Cognito (auth)       KMS (encryption)       │
└──────────────────────────────────────────────────────────┘
```

---

## Step 3 — Key Scaling Techniques Summary

| Technique | When to Apply | AWS Service |
|-----------|---------------|-------------|
| Vertical scaling | First bottleneck | Resize EC2/RDS |
| Horizontal scaling | Multiple app servers needed | ALB + ASG |
| Database replication | Read bottleneck | RDS Read Replicas |
| Caching | Repeated expensive queries | ElastiCache (Redis) |
| CDN | Static content delivery | CloudFront |
| Async processing | Long-running tasks | SQS + Lambda |
| Database sharding | Write bottleneck | Aurora or manual sharding |
| Microservices | Team/deploy bottleneck | ECS/EKS |
| Multi-region | Global user base | Multi-region Aurora + Route 53 |

---

## Step 4 — Wrap Up

### Scaling Progression Summary

```
Stage 1: Single Server
  └──▶ Split app and DB

Stage 2: App + RDS
  └──▶ Add read replicas + cache

Stage 3: Read Replicas + ElastiCache
  └──▶ Add load balancer + auto scaling

Stage 4: ALB + ASG + CDN
  └──▶ Database sharding + async queues

Stage 5: Sharded DB + Message Queues
  └──▶ Multi-region + microservices

Stage 6: Global Scale Multi-Region Architecture
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Start with RDS (SQL) | Familiar, ACID, flexible |
| Scaling first step | Vertical, then horizontal | Simplest; switch when limits hit |
| Caching | ElastiCache (Redis) | Reduce DB load by 80%+ |
| Sessions | Redis (not server memory) | Enables stateless app servers |
| Async processing | SQS + Lambda | Decouple work, improve response time |
| Static content | S3 + CloudFront | Offload from app servers |
| Monitoring | CloudWatch + X-Ray | Essential for identifying bottlenecks |

### Additional Talking Points

- **Cost optimization** — Use Reserved Instances (1-3 year) for baseline, Spot Instances for batch workers
- **Blue/green deployments** — CodeDeploy for zero-downtime releases
- **Database migration** — DMS (Database Migration Service) for lift-and-shift
- **Serverless option** — API Gateway + Lambda + DynamoDB for fully serverless (no servers to manage)
- **Disaster recovery** — Pilot light (minimal standby in second region) or warm standby
- **Security layers** — WAF, Shield (DDoS), VPC, Security Groups, IAM, KMS encryption
- **Infrastructure as Code** — CloudFormation or Terraform for reproducible environments
