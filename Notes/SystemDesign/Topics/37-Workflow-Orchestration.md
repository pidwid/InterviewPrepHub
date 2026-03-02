# Workflow Orchestration

## Table of Contents

1. [Overview](#1-overview)
2. [Why Workflow Orchestration?](#2-why-workflow-orchestration)
3. [Orchestration vs Choreography](#3-orchestration-vs-choreography)
4. [Temporal](#4-temporal)
5. [AWS Step Functions](#5-aws-step-functions)
6. [Apache Airflow](#6-apache-airflow)
7. [Saga Pattern](#7-saga-pattern)
8. [Comparison & Trade-offs](#8-comparison--trade-offs)
9. [Design Patterns](#9-design-patterns)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Many business processes involve multiple steps, services, and failure
scenarios that need to be coordinated reliably. Workflow orchestration
is the pattern for managing these multi-step processes.

```
Example: E-commerce Order Processing

  Order Placed
      │
      ├── 1. Validate order
      ├── 2. Reserve inventory
      ├── 3. Process payment
      ├── 4. Send confirmation email
      ├── 5. Notify warehouse
      └── 6. Update analytics

  What if step 3 fails?
    → Must undo step 2 (release inventory)
    → Must NOT do steps 4-6
    → Must notify customer of failure
    
  Without orchestration: Spaghetti of retries, error handling, state tracking
  With orchestration: Declarative workflow handles all of this
```

---

## 2. Why Workflow Orchestration?

| Challenge              | Without Orchestration         | With Orchestration           |
|-----------------------|-------------------------------|------------------------------|
| Multi-step processes  | Manual coordination code      | <abbr title="Declarative workflow: you describe the steps and branching logic; the orchestrator handles state persistence, retries, and failure compensation.">Declarative workflow</abbr>         |
| Failure handling      | Custom retry/rollback logic   | Built-in retries + <abbr title="Compensation: a rollback-like action that undoes a previously completed step when a later step fails (used instead of traditional DB transactions in distributed systems).">compensation</abbr> |
| State tracking        | Database + custom code        | Automatic state persistence  |
| Visibility            | Grep logs across services     | Dashboard with step status   |
| Long-running processes| Cron jobs + polling           | <abbr title="Durable timers: workflow timers that survive server restarts; the orchestrator resumes the workflow after the delay without needing a polling loop.">Durable timers</abbr> + continuations|
| Human-in-the-loop     | Email + polling DB            | Built-in approval steps      |

---

## 3. Orchestration vs Choreography

```
Orchestration (central coordinator):

  ┌──────────────┐
  │ Orchestrator │ ← Knows the entire workflow
  │              │
  │ Step 1 ──────┼──► Service A
  │ Step 2 ──────┼──► Service B
  │ Step 3 ──────┼──► Service C
  └──────────────┘
  
  Pros: Easy to understand, centralized error handling, visible flow
  Cons: Single point of coordination, orchestrator coupling

Choreography (event-based, no central coordinator):

  Service A ──event──► Service B ──event──► Service C
      │                    │                    │
      └──event──► Service D                    │
                                               │
  Each service reacts to events independently   │
                                               ▼
  
  Pros: Loosely coupled, each service autonomous
  Cons: Hard to track overall flow, distributed error handling,
        implicit dependencies (hard to see the big picture)
```

### When to Use Which

| Criteria              | Orchestration                 | Choreography                 |
|----------------------|-------------------------------|------------------------------|
| Process complexity   | Complex (many steps, branches)| Simple (linear, few steps)   |
| Error handling       | Central compensation          | Each service handles own     |
| Visibility           | Dashboard shows full workflow | Must correlate events/logs   |
| Coupling            | Services coupled to orchestrator| Services coupled to events |
| Team structure       | One team owns the workflow    | Each team owns their service |

---

## 4. Temporal

The most powerful open-source workflow orchestration platform.
Founded by ex-Uber engineers (<abbr title="Cadence: Uber's internal workflow orchestration system that inspired Temporal; Temporal is the open-source successor built by the same team.">Cadence</abbr> → Temporal).

```
Temporal Architecture:

  ┌──────────────────────────────────────────────────┐
  │                Temporal Server                    │
  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
  │  │ Frontend │  │ History   │  │ Matching     │  │
  │  │ Service  │  │ Service   │  │ Service      │  │
  │  └──────────┘  └───────────┘  └──────────────┘  │
  │  ┌──────────────────────────────────────────┐    │
  │  │          Persistence (DB)                │    │
  │  │  PostgreSQL / MySQL / Cassandra          │    │
  │  └──────────────────────────────────────────┘    │
  └──────────────────────────────────────────────────┘
           │                      │
  ┌────────┴────────┐    ┌───────┴────────┐
  │ Workflow Worker │    │ Activity Worker│
  │ (your code)     │    │ (your code)    │
  │                 │    │                │
  │ Defines the     │    │ Executes the   │
  │ workflow logic  │    │ actual work    │
  └─────────────────┘    └────────────────┘
```

### Temporal Workflow Example

```python
# Workflow definition (the orchestration logic)
@workflow.defn
class OrderWorkflow:
    @workflow.run
    async def run(self, order: Order) -> OrderResult:
        # Step 1: Validate
        await workflow.execute_activity(
            validate_order, order,
            start_to_close_timeout=timedelta(seconds=10),
        )
        
        # Step 2: Reserve inventory (with compensation on failure)
        reservation = await workflow.execute_activity(
            reserve_inventory, order,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        try:
            # Step 3: Process payment
            payment = await workflow.execute_activity(
                process_payment, order,
                start_to_close_timeout=timedelta(seconds=60),
            )
        except Exception:
            # Compensation: release inventory if payment fails
            await workflow.execute_activity(
                release_inventory, reservation,
            )
            raise
        
        # Step 4: Send confirmation (async, don't wait)
        workflow.start_activity(
            send_confirmation_email, order,
        )
        
        return OrderResult(success=True, payment_id=payment.id)

# Activity definition (the actual work)
@activity.defn
async def reserve_inventory(order: Order) -> Reservation:
    # Call inventory service
    return await inventory_client.reserve(order.items)
```

### Temporal Key Concepts

| Concept          | Description                                           |
|-----------------|-------------------------------------------------------|
| Workflow        | The orchestration logic (deterministic code)           |
| Activity        | A unit of work (API call, DB write, etc.)             |
| Worker          | Process that executes workflows/activities             |
| Signal          | Send data to a running workflow                        |
| Query           | Read state from a running workflow                     |
| Timer           | Durable sleep (can last days/months)                   |
| Child Workflow  | Workflow started by another workflow                   |
| <abbr title="Continue-As-New: a Temporal mechanism that completes the current workflow execution and immediately starts a new one with fresh state, preventing unbounded event history growth.">Continue-As-New</abbr> | Restart workflow with new state (avoid large history)  |

### Why Temporal is Powerful

```
Durability:
  Server crashes mid-workflow → workflow resumes exactly where it left off.
  Your code doesn't need any persistence logic.

Deterministic replay:
  Workflow code is replayed from event history.
  Activities are NOT re-executed — their results are replayed from history.
  
  This means:
    ✓ Workflow can run for days/months
    ✓ Server can crash and restart
    ✓ Network can go down temporarily
    ✓ Workflow always makes progress
```

---

## 5. AWS Step Functions

Managed orchestration service from AWS. Uses JSON-based state machine language (<abbr title="ASL (Amazon States Language): the JSON-based language used to define AWS Step Functions state machines, including tasks, choices, parallel branches, and error handling.">ASL</abbr>).

```
State Machine:

  ┌──────────────┐
  │  Validate    │ (Task: Lambda)
  │  Order       │
  └──────┬───────┘
         │
  ┌──────┴───────┐
  │  Choice:     │ (Choice state)
  │  Valid?      │
  └──┬───────┬───┘
     │ Yes   │ No
     ▼       ▼
  ┌──────┐  ┌──────────┐
  │Process│  │  Notify  │
  │Payment│  │  Error   │
  └──┬────┘  └──────────┘
     │
  ┌──┴───────┐
  │ Parallel │ (Parallel state)
  │  ┌─────┐ │
  │  │Email│ │
  │  ├─────┤ │
  │  │Ship │ │
  │  └─────┘ │
  └──────────┘
```

### Step Functions ASL Example

```json
{
  "StartAt": "ValidateOrder",
  "States": {
    "ValidateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:validate",
      "Next": "IsValid",
      "Retry": [{
        "ErrorEquals": ["ServiceUnavailable"],
        "IntervalSeconds": 2,
        "MaxAttempts": 3,
        "BackoffRate": 2
      }]
    },
    "IsValid": {
      "Type": "Choice",
      "Choices": [{
        "Variable": "$.valid",
        "BooleanEquals": true,
        "Next": "ProcessPayment"
      }],
      "Default": "OrderFailed"
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:payment",
      "Next": "ParallelNotification",
      "Catch": [{
        "ErrorEquals": ["PaymentFailed"],
        "Next": "OrderFailed"
      }]
    },
    "ParallelNotification": {
      "Type": "Parallel",
      "Branches": [
        {"StartAt": "SendEmail", "States": {...}},
        {"StartAt": "NotifyWarehouse", "States": {...}}
      ],
      "End": true
    }
  }
}
```

### Step Functions Pricing

```
Standard: $0.025 per 1,000 state transitions
Express:  $0.00001667 per request + duration

Standard: Long-running (up to 1 year), exactly-once
Express:  Short (up to 5 min), at-least-once, cheaper
```

---

## 6. Apache Airflow

Workflow orchestration for data pipelines. Python-based <abbr title="DAG (Directed Acyclic Graph): a graph of tasks where edges show dependencies and there are no cycles — Airflow uses DAGs to define the order and dependencies of pipeline steps.">DAGs</abbr>.

```
Airflow Architecture:

  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  Web Server  │    │  Scheduler   │    │  Workers     │
  │  (UI)        │    │  (triggers   │    │  (execute    │
  │              │    │   DAGs)      │    │   tasks)     │
  └──────────────┘    └──────┬───────┘    └──────────────┘
                             │
                      ┌──────┴───────┐
                      │  Metadata    │
                      │  Database    │
                      │  (PostgreSQL)│
                      └──────────────┘
```

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

with DAG(
    'daily_etl',
    start_date=datetime(2024, 1, 1),
    schedule_interval='@daily',
    catchup=False,
) as dag:
    
    extract = PythonOperator(
        task_id='extract',
        python_callable=extract_data,
    )
    
    transform = PythonOperator(
        task_id='transform',
        python_callable=transform_data,
    )
    
    load = PythonOperator(
        task_id='load',
        python_callable=load_data,
    )
    
    extract >> transform >> load
```

**Best for**: Data pipelines, <abbr title="ETL (Extract, Transform, Load): a pipeline that extracts data from sources, transforms it into the desired format, then loads it into a target (data warehouse, lake, etc.).">ETL</abbr>, batch processing, scheduled jobs.
**Not ideal for**: Real-time orchestration, long-running business workflows.

---

## 7. Saga Pattern

The <abbr title="Saga pattern: manages distributed transactions across microservices by breaking them into a sequence of local transactions, each paired with a compensating transaction that undoes it on failure.">Saga pattern</abbr> — managing distributed transactions across microservices.

```
Order Saga (orchestration-based):

  ┌──────────────────────────────────────────────────────────┐
  │ Saga Orchestrator                                        │
  │                                                          │
  │  Forward:                    Compensation:               │
  │  1. Reserve Inventory   ←→  Release Inventory           │
  │  2. Process Payment     ←→  Refund Payment              │
  │  3. Ship Order          ←→  Cancel Shipment             │
  │  4. Send Notification   ←→  (N/A)                       │
  │                                                          │
  │  If step 3 fails:                                        │
  │    Run compensation for step 2 → Refund Payment          │
  │    Run compensation for step 1 → Release Inventory       │
  │    Notify customer of failure                            │
  └──────────────────────────────────────────────────────────┘

Success path:       Step 1 → Step 2 → Step 3 → Step 4 → Done ✓

Failure at step 3:  Step 1 → Step 2 → Step 3 ✗
                    Compensate: Undo 2 → Undo 1 → Notify failure
```

### Saga Types

| Type            | How It Works                           | Pros              | Cons                  |
|----------------|----------------------------------------|--------------------|-----------------------|
| Orchestration  | Central coordinator drives steps       | Visible, testable  | Coordinator coupling  |
| Choreography   | Each service triggers the next via events | Decoupled       | Hard to track/debug   |

---

## 8. Comparison & Trade-offs

| Feature           | Temporal     | Step Functions | Airflow       |
|------------------|-------------|----------------|---------------|
| Type             | General     | General        | Data/batch    |
| Language         | Any (SDK)   | JSON (ASL)     | Python (DAGs) |
| Managed          | Cloud (or self-host) | AWS managed | Self-host or MWAA |
| Max duration     | Unlimited   | 1 year         | Unlimited     |
| Pricing          | Self-host: free | Per transition | Self-host: free |
| Debugging        | Excellent   | Good           | Good          |
| Complex logic    | Code-based  | JSON (limited) | Python-based  |
| Best for         | Business workflows | AWS event pipelines | Data pipelines |

### Decision Guide

```
Need to orchestrate microservice business logic?
  └── Temporal (most powerful, code-as-workflow)

Already on AWS, simple workflows?
  └── Step Functions (managed, integrate with AWS services)

Data/ETL pipelines with scheduling?
  └── Airflow (industry standard for data engineering)

Need saga pattern across microservices?
  └── Temporal (built for this use case)
```

---

## 9. Design Patterns

### Pattern 1: Idempotent Activities

```
Activities MUST be idempotent (safe to retry):

  Non-idempotent:
    charge_credit_card(order)  ← If retried, charges TWICE!
    
  Idempotent (using idempotency key):
    charge_credit_card(order, idempotency_key=order.id)
    ← If retried with same key, payment provider returns same result
```

### Pattern 2: Human-in-the-Loop

```
Workflow pauses for human approval:

  ┌──────────┐    ┌───────────────┐    ┌──────────────┐
  │ Process  │───►│ Wait for      │───►│ Execute      │
  │ Request  │    │ Approval      │    │ Approved     │
  │          │    │ (Signal)      │    │ Action       │
  └──────────┘    │ Timeout: 48h  │    └──────────────┘
                  └───────────────┘
                        │ Timeout
                        ▼
                  ┌──────────────┐
                  │ Auto-Reject  │
                  └──────────────┘

  Manager clicks "Approve" in UI → Signal sent to workflow → Workflow continues
```

### Pattern 3: Polling with Backoff

```
Wait for external system to complete:

  ┌────────────┐    ┌──────────────┐    ┌────────────┐
  │ Start      │───►│ Check Status │───►│ Complete?  │
  │ External   │    │ (Activity)   │    │            │
  │ Process    │    └──────────────┘    └─┬──────┬───┘
  └────────────┘         ▲               │ No   │ Yes
                         │               ▼      ▼
                    ┌────┴────┐    ┌──────────────┐
                    │ Wait    │    │ Process      │
                    │ (Timer) │    │ Result       │
                    │ 30s,60s │    └──────────────┘
                    │ 120s... │
                    └─────────┘
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Orchestration for complex flows | When you need visibility and central error handling |
| Choreography for simple, decoupled flows | When services operate independently |
| Temporal is the modern standard | Code-as-workflow, durable execution, any language |
| Step Functions for AWS-native | Great for Lambda + AWS service integration |
| Airflow for data pipelines | Industry standard for ETL/batch orchestration |
| Saga pattern for distributed transactions | Compensating transactions instead of rollback |
| Activities must be idempotent | Retries will happen — design for them |
| Workflows can run for days/months | Durable timers handle long-running processes |
| Start with orchestration | Switch to choreography when services are mature |
