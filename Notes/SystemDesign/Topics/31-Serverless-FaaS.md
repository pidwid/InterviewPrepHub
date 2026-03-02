# Serverless & Functions as a Service (FaaS)

<abbr title="FaaS (Functions as a Service): run small stateless functions on demand, billed per invocation/time. The provider handles servers.">FaaS</abbr>

## Table of Contents

1. [Overview](#1-overview)
2. [How Serverless Works](#2-how-serverless-works)
3. [Cold Starts](#3-cold-starts)
4. [Serverless Platforms](#4-serverless-platforms)
5. [Event-Driven Serverless Patterns](#5-event-driven-serverless-patterns)
6. [Backend as a Service (BaaS)](#6-backend-as-a-service-baas)
7. [When to Use vs When to Avoid](#7-when-to-use-vs-when-to-avoid)
8. [Serverless vs Containers](#8-serverless-vs-containers)
9. [Cost Model & Optimization](#9-cost-model--optimization)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Serverless doesn't mean "no servers." It means **you don't manage servers.**
The cloud provider handles provisioning, scaling, patching, and capacity planning.
You only write functions and define triggers.

```
Traditional:                      Serverless:
┌─────────────────┐               ┌─────────────────┐
│ Your code       │               │ Your code       │
├─────────────────┤               └─────────────────┘
│ Runtime (Node)  │                 Everything below
├─────────────────┤                 managed by cloud:
│ OS (Linux)      │               ┌─────────────────┐
├─────────────────┤               │ Runtime          │
│ VM / Container  │               │ OS               │
├─────────────────┤               │ Scaling          │
│ Hardware        │               │ Patching         │
└─────────────────┘               │ Availability     │
 You manage ALL of this            └─────────────────┘
```

---

## 2. How Serverless Works

### Function Lifecycle

```
1. DEPLOY: Upload your function code + configuration
2. TRIGGER: An event fires (HTTP request, queue message, schedule, etc.)
3. PROVISION: Cloud spins up a container (micro-VM) with your runtime
4. EXECUTE: Your function runs, processes the event, returns a result
5. SCALE: If 1000 events arrive, 1000 instances spin up in parallel
6. IDLE: After execution, container stays warm briefly, then destroyed

  Event ──► ┌─────────────────────┐ ──► Response
            │  Lambda Function    │
            │  Max runtime: 15min │
            │  Max memory: 10 GB  │
            │  Stateless          │
            └─────────────────────┘
                    │
            Runs then terminates.
            No persistent state.
            No background threads.
```

### Execution Model

```
Request 1 ──► Instance A (created) ──► Response
Request 2 ──► Instance B (created) ──► Response    Parallel execution
Request 3 ──► Instance C (created) ──► Response

  ... 5 minutes of no traffic ...

Request 4 ──► Instance A (reused — warm) ──► Response
Request 5 ──► Instance D (created — cold) ──► Response

Instances are reused when possible (warm start)
but you can NEVER depend on this.
```

---

## 3. Cold Starts

The biggest operational concern with serverless.

```
Cold Start: New container must be provisioned from scratch.

  ┌────────────────────────────────────────────┐
  │ Cold Start Timeline                        │
  │                                            │
  │ Download code ──► Init runtime ──► Init    │
  │   (50ms)          (100-500ms)     handler │
  │                                    (varies)│
  │                                            │
  │ Total: 200ms - 5+ seconds                 │
  └────────────────────────────────────────────┘

Warm Start:
  Handler already initialized → ~1-10ms overhead

Factors affecting cold start duration:
  Language:  Python/Node (fast) vs Java/C# (slow — JVM/CLR startup)
  Package:   Smaller deployment → faster download
  VPC:       Lambda in VPC adds ~1s (ENI attachment), improved recently
  Memory:    More memory → more CPU → faster init
```

### Cold Start Mitigation

| Strategy               | Description                                      |
|-----------------------|--------------------------------------------------|
| Provisioned concurrency| Pre-warm N instances (costs more)               |
| Keep-alive pinging    | Schedule a ping every 5 min to keep warm          |
| Smaller packages      | Remove unused dependencies, use layers            |
| Faster runtimes       | Python/Node/Go over Java for latency-sensitive    |
| Snapstart (AWS)       | Snapshot after init, restore instead of cold start |

---

## 4. Serverless Platforms

| Platform | Provider | Max Runtime | Max Memory | Languages |
|---------|---------|------------|-----------|-----------|
| Lambda | AWS | 15 min | 10 GB | Node, Python, Java, Go, .NET, Ruby, custom |
| Cloud Functions | GCP | 60 min (2nd gen) | 32 GB | Node, Python, Java, Go, .NET, Ruby, PHP |
| Azure Functions | Azure | Unlimited (premium) | 14 GB | Node, Python, Java, C#, PowerShell, custom |
| Cloudflare Workers | Cloudflare | 30s (free), 15min (paid) | 128 MB | JS/TS, WASM |

### Beyond FaaS: Serverless Services

```
Compute:   Lambda, Cloud Functions, Cloud Run
Storage:   S3, DynamoDB, Firestore
Queues:    SQS, EventBridge, Cloud Tasks
API:       API Gateway, Cloud Endpoints
Auth:      Cognito, Firebase Auth
DB:        Aurora Serverless, Neon, PlanetScale
Streaming: Kinesis, Pub/Sub
Workflow:  Step Functions, Cloud Workflows
```

---

## 5. Event-Driven Serverless Patterns

### Pattern 1: API Backend

```
Client ──► API Gateway ──► Lambda ──► DynamoDB
               │
               ├── GET /users/{id}  → Lambda → DynamoDB read
               ├── POST /users      → Lambda → DynamoDB write
               └── DELETE /users/{id}→ Lambda → DynamoDB delete
```

### Pattern 2: Event Processing Pipeline

```
S3 Upload ──► Lambda (thumbnail) ──► S3 (thumbnails)
    │
    └──► SNS ──► Lambda (metadata) ──► DynamoDB
              └► Lambda (virus scan)──► SQS (quarantine)
```

### Pattern 3: Scheduled Jobs (Cron)

```
CloudWatch Events (cron: 0 2 * * *)
    │
    └──► Lambda (nightly report)
            │
            ├──► Query DynamoDB
            ├──► Generate PDF
            └──► Send via SES email
```

### Pattern 4: Stream Processing

```
Kinesis Stream ──► Lambda (batch of records)
                     │
                     ├── Transform
                     ├── Enrich
                     └── Write to S3 / DynamoDB
                     
  Lambda reads batches (up to 10,000 records)
  Automatic retry on failure
  Checkpointing via sequence numbers
```

### Pattern 5: Fan-Out

```
SNS Topic ──► Lambda A (send email)
           ├► Lambda B (send push notification)
           └► Lambda C (update analytics)
           
One event triggers multiple parallel functions.
```

---

## 6. Backend as a Service (BaaS)

Serverless isn't just functions — it's also managed services that replace
server-side code entirely.

```
Traditional stack:              BaaS stack:
┌──────────────┐                ┌──────────────┐
│ React App    │                │ React App    │
├──────────────┤                └──────┬───────┘
│ Express API  │                       │
│  - Auth      │                ┌──────┴───────┐
│  - DB queries│                │ Firebase     │
│  - File      │                │  Auth        │
│    upload    │                │  Firestore   │
├──────────────┤                │  Storage     │
│ PostgreSQL   │                │  Cloud Func  │
│ S3           │                └──────────────┘
└──────────────┘                 No custom backend!
```

| BaaS Service | Replaces                    |
|-------------|------------------------------|
| Firebase    | Auth, DB, storage, hosting    |
| Supabase    | Auth, PostgreSQL, storage, edge functions |
| AWS Amplify | Auth (Cognito), DB (DynamoDB), storage (S3) |
| Clerk       | Auth                          |

---

## 7. When to Use vs When to Avoid

### Use Serverless When:

| Scenario | Why |
|---------|-----|
| Variable/unpredictable traffic | Auto-scales to zero, no idle cost |
| Event-driven processing | Natural fit (S3 upload → process) |
| Microservices / small functions | Each function is independent |
| Rapid prototyping | Focus on logic, not infrastructure |
| Batch / scheduled jobs | Run for seconds, pay for seconds |
| Low-traffic APIs | Pay nothing when idle |

### Avoid Serverless When:

| Scenario | Why |
|---------|-----|
| Latency-critical (< 50ms p99) | Cold starts are unpredictable |
| Long-running processes (> 15 min) | Lambda has a hard timeout |
| Stateful workloads | Functions are stateless |
| High steady-state traffic | Containers/VMs cheaper at scale |
| GPU / ML inference | Limited compute options |
| WebSocket long connections | Functions are request-response |
| Complex local development | Harder to test/debug locally |

---

## 8. Serverless vs Containers

```
┌──────────────────┬──────────────────┬──────────────────┐
│                  │    Serverless    │    Containers    │
├──────────────────┼──────────────────┼──────────────────┤
│ Scaling          │ Auto (0 to ∞)    │ Auto (min to max)│
│ Idle cost        │ $0               │ Min instance cost│
│ Cold start       │ 200ms - 5s       │ None (if running)│
│ Max runtime      │ 15 min (Lambda)  │ Unlimited        │
│ State            │ Stateless        │ Stateful possible│
│ Complexity       │ Low (code only)  │ Medium (Dockerfile)│
│ Vendor lock-in   │ High             │ Low (portable)   │
│ Local dev        │ Challenging      │ Identical to prod│
│ Cost at scale    │ Can be expensive │ More predictable │
└──────────────────┴──────────────────┴──────────────────┘
```

### Hybrid: Container-Based Serverless

```
Cloud Run (GCP) / App Runner (AWS) / Azure Container Apps:
  - Deploy containers, but auto-scale to zero
  - No cold start management (pre-warmed)
  - Longer runtimes than Lambda
  - Portable (standard Docker images)
  
  Best of both worlds for many use cases.
```

---

## 9. Cost Model & Optimization

### Pricing Structure

```
AWS Lambda pricing:
  Requests:   $0.20 per 1M requests
  Duration:   $0.0000166667 per GB-second
  
Example:
  1M requests/month × 200ms average × 256MB memory
  = 1,000,000 × 0.2s × 0.25GB
  = 50,000 GB-seconds
  = $0.83 (duration) + $0.20 (requests)
  = ~$1.03/month
  
  Same on a t3.micro EC2: ~$7.50/month (running 24/7)
```

### When Serverless Gets Expensive

```
Breakeven analysis:
  Light traffic:  Lambda wins (pay per request, $0 idle)
  Medium traffic: Roughly equal
  Heavy traffic:  EC2/ECS wins (Lambda per-request costs add up)
  
  Rough rule of thumb:
    < 1M requests/month → Serverless is cheaper
    > 10M+ requests/month → Consider containers
    
  But also consider: do you need to hire someone to manage servers?
  Operational cost matters too.
```

### Cost Optimization Tips

| Tip | Impact |
|-----|--------|
| Right-size memory | More memory = more CPU but higher cost |
| Use ARM (Graviton) | 20% cheaper, often faster |
| Minimize cold starts | Reduce wasted compute during init |
| Use provisioned concurrency wisely | Only for latency-critical paths |
| Batch operations | Process 100 records per invocation vs 1 |
| Use reserved concurrency | Cap max instances to control cost |

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Serverless = managed compute | You write code, cloud handles everything else |
| Cold starts are the main challenge | Mitigate with provisioned concurrency, smaller packages, fast runtimes |
| Perfect for event-driven workloads | S3 triggers, queue processing, webhooks, scheduled jobs |
| Not ideal for all workloads | Long-running, stateful, latency-critical → use containers |
| Pricing favors spiky/low traffic | Scale to zero is the killer feature |
| Vendor lock-in is real | Lambda + DynamoDB + SQS → hard to migrate |
| Containers are the escape hatch | Cloud Run / App Runner gives serverless UX with container portability |
| Think functions, not servers | Each function does one thing, triggered by one event type |
