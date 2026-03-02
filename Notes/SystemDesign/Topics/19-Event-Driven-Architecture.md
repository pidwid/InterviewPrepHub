# Event-Driven Architecture

## Table of Contents

1. [Overview](#1-overview)
2. [Event Types](#2-event-types)
3. [Event-Driven Architecture Patterns](#3-event-driven-architecture-patterns)
4. [Event Sourcing](#4-event-sourcing)
5. [CQRS (Command Query Responsibility Segregation)](#5-cqrs-command-query-responsibility-segregation)
6. [Event Sourcing + CQRS Together](#6-event-sourcing--cqrs-together)
7. [Event Schema Design](#7-event-schema-design)
8. [Challenges and Pitfalls](#8-challenges-and-pitfalls)
9. [Key Takeaways](#9-key-takeaways)

---

## 1. Overview

Event-driven architecture (<abbr title="EDA (Event-Driven Architecture): a design style where services emit events (state changes) and other services react to those events asynchronously, instead of making direct synchronous calls.">EDA</abbr>) is a design paradigm where the flow of the program
is determined by **events** — significant changes in state. Instead of services
calling each other directly, they communicate by producing and consuming events.

### Traditional vs Event-Driven

```
Traditional (synchronous, coupled):
  Order Service ──HTTP──► Inventory Service
                 ──HTTP──► Payment Service
                 ──HTTP──► Notification Service
  
  Order Service must know about all downstream services.
  If Notification Service is down, the whole flow fails.

Event-Driven (asynchronous, decoupled):
  Order Service ──[OrderCreated]──► Event Bus ──► Inventory Service
                                              ──► Payment Service
                                              ──► Notification Service
  
  Order Service just publishes an event. It doesn't know or care
  who consumes it. Adding a new consumer requires no code changes
  in the Order Service.
```

### Benefits

| Benefit           | Description                                              |
|-------------------|----------------------------------------------------------|
| Loose coupling    | Services don't need to know about each other             |
| Scalability       | Producers and consumers scale independently              |
| Resilience        | Consumer failure doesn't affect producer                 |
| Extensibility     | Add new consumers without changing existing code         |
| Real-time         | Events are processed as they happen                      |
| Audit trail       | Events provide a natural history of what happened        |

---

## 2. Event Types

### Event Notification

A minimal event that says "something happened." Contains minimal data.
Consumers must call back to get details.

```json
{
  "event_type": "order.created",
  "order_id": "order_123",
  "timestamp": "2024-01-15T10:00:00Z"
}

// Consumer needs to call: GET /orders/order_123 to get full details
```

**Pros**: Small events, producer controls data access.
**Cons**: Consumers must make extra calls, coupling to producer's API.

### Event-Carried State Transfer

Event contains all the data the consumer needs. No callback required.

```json
{
  "event_type": "order.created",
  "order_id": "order_123",
  "timestamp": "2024-01-15T10:00:00Z",
  "customer": {
    "id": "cust_456",
    "name": "Alice",
    "email": "alice@example.com"
  },
  "items": [
    {"product_id": "prod_789", "name": "Widget", "quantity": 2, "price": 9.99}
  ],
  "total": 19.98
}
```

**Pros**: Consumer is fully independent, no callback needed.
**Cons**: Larger events, data duplication, harder to change event schema.

### Domain Event

Expresses something meaningful that happened in the domain. Named in past tense.

```
Good domain events:
  OrderPlaced, OrderShipped, PaymentReceived, UserRegistered,
  InventoryReserved, InvoiceGenerated

Bad (too technical, not domain-meaningful):
  DatabaseUpdated, RowInserted, CacheInvalidated
```

---

## 3. Event-Driven Architecture Patterns

### Broker Topology (Choreography)

No central coordinator. Each service reacts to events and produces new events.

```
OrderService                   InventoryService              PaymentService
  │                              │                              │
  │──[OrderPlaced]──► Broker ───►│                              │
  │                              │──[InventoryReserved]──► Broker
  │                              │                         │
  │                              │                         └──► PaymentService
  │                              │                              │
  │                              │               [PaymentProcessed]──► Broker
  │                              │                              │
  │◄─────────────────── Broker ◄─────────────── Broker ◄────────┘
  │ (OrderConfirmed)             │                              │
```

**Pros**: Highly decoupled, each service is autonomous.
**Cons**: Hard to see the overall flow, distributed logic, debugging is difficult.

### Mediator Topology (Orchestration)

A central orchestrator coordinates the event flow.

```
                    ┌──────────────────┐
                    │  Order Saga      │
                    │  Orchestrator    │
                    └───────┬──────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
   ┌───────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
   │ Inventory    │ │ Payment      │ │ Notification │
   │ Service      │ │ Service      │ │ Service      │
   └──────────────┘ └──────────────┘ └──────────────┘
   
The orchestrator:
  1. Sends "ReserveInventory" command to Inventory Service
  2. Waits for "InventoryReserved" event
  3. Sends "ProcessPayment" command to Payment Service
  4. Waits for "PaymentProcessed" event
  5. Sends "SendConfirmation" command to Notification Service
  
On failure at any step → sends compensating commands
```

**Pros**: Easy to see the full flow, centralized error handling.
**Cons**: Orchestrator is a single point of coordination (not failure if built well).

### Choreography vs Orchestration

| Aspect            | Choreography              | Orchestration              |
|-------------------|---------------------------|----------------------------|
| Coupling          | Very loose                | Orchestrator coupled to all services |
| Visibility        | Hard to see full flow     | Flow is clear in orchestrator        |
| Error handling    | Each service handles own  | Centralized compensation             |
| Complexity        | Grows with event chains   | Concentrated in orchestrator         |
| Testing           | Hard (distributed logic)  | Easier (test orchestrator)           |
| Best for          | Simple flows, 2-3 services| Complex flows, many steps            |

---

### <abbr title="Event Sourcing: store every state change as an immutable event in an append-only log. The current state is rebuilt by replaying events in order.">Event Sourcing</abbr>

Instead of storing the **current state** of an entity, store the **sequence of 
events** that led to the current state. The current state is derived by replaying
all events.

### Traditional CRUD vs Event Sourcing

```
CRUD (stores current state):
┌─────────────────────────────────┐
│ accounts table                  │
│ id    │ name  │ balance         │
│ 123   │ Alice │ 150.00          │  ← Only current balance
└─────────────────────────────────┘

Event Sourcing (stores all events):
┌──────────────────────────────────────────────────────┐
│ account_events                                        │
│ seq │ account_id │ event_type       │ data            │
│ 1   │ 123        │ AccountCreated   │ {name: "Alice"} │
│ 2   │ 123        │ MoneyDeposited   │ {amount: 200}   │
│ 3   │ 123        │ MoneyWithdrawn   │ {amount: 50}    │
│ 4   │ 123        │ MoneyDeposited   │ {amount: 100}   │
│ 5   │ 123        │ MoneyWithdrawn   │ {amount: 100}   │
└──────────────────────────────────────────────────────┘

Current balance = replay events:
  0 + 200 - 50 + 100 - 100 = 150 ✓

But now you also know the FULL HISTORY of how you got there.
```

### Event Store

The event store is an append-only log of events.

```
┌───────────────────────────────────────────────────────────┐
│                     Event Store                            │
│                                                            │
│  Stream: account-123                                       │
│  ┌─────┬─────┬─────┬─────┬─────┐                         │
│  │ E1  │ E2  │ E3  │ E4  │ E5  │  ← Append only, immutable│
│  └─────┴─────┴─────┴─────┴─────┘                         │
│                                                            │
│  Stream: order-456                                         │
│  ┌─────┬─────┬─────┐                                     │
│  │ E1  │ E2  │ E3  │                                     │
│  └─────┴─────┴─────┘                                     │
│                                                            │
│  Properties:                                               │
│    - Append-only (never update or delete events)           │
│    - Ordered per stream                                    │
│    - Events are immutable facts                            │
│    - Can replay from any point                             │
└───────────────────────────────────────────────────────────┘

Event Store implementations: EventStoreDB, Axon, Marten (PostgreSQL)
Or use: Kafka (as the event log), PostgreSQL (append-only table)
```

### Rebuilding State (Projections)

```
To get the current state, replay all events for an entity:

def get_account_balance(account_id):
    events = event_store.get_events(f"account-{account_id}")
    balance = 0
    for event in events:
        if event.type == "MoneyDeposited":
            balance += event.data["amount"]
        elif event.type == "MoneyWithdrawn":
            balance -= event.data["amount"]
    return balance
```

### Snapshots

Replaying thousands of events for every read is expensive.
Snapshots periodically save the current state.

```
Events:  [E1] [E2] [E3] ... [E100] [Snapshot: balance=500] [E101] [E102]

To rebuild state:
  1. Load latest snapshot (balance=500)
  2. Replay only events AFTER the snapshot (E101, E102)
  
  Much faster than replaying all 102 events!
```

### Event Sourcing Trade-offs

| Advantage                              | Disadvantage                              |
|----------------------------------------|-------------------------------------------|
| Complete audit trail                   | More complex than CRUD                    |
| Can rebuild state at any point in time | Event schema evolution is tricky          |
| Natural fit for event-driven systems   | Querying current state requires projections|
| Debugging: replay events to see what happened | Storage grows indefinitely          |
| Supports temporal queries              | Eventual consistency (if projections lag) |
| No data loss (events are immutable)    | Learning curve for the team               |

### When to Use Event Sourcing

| Good Fit                                    | Bad Fit                                   |
|---------------------------------------------|-------------------------------------------|
| Financial systems (audit trail required)    | Simple CRUD apps                          |
| Complex domain logic (DDD)                  | UI-heavy forms with simple persistence    |
| Systems where "what happened" matters       | When team is unfamiliar with the pattern  |
| Need to replay/rebuild state                | When real-time queries on current state are essential |
| Regulatory compliance                       | Prototyping / MVP                         |

---

## 5. <abbr title="CQRS (Command Query Responsibility Segregation): a pattern that separates write operations (commands) from read operations (queries), often using different data models or databases optimized for each.">CQRS</abbr> (Command Query Responsibility Segregation)

CQRS separates the **write model** (commands) from the **read model** (queries).
Instead of one model for both reads and writes, you have two specialized models.

### Traditional vs CQRS

```
Traditional (single model):
  ┌────────────┐
  │            │──── Read Query ────► Database ────► Response
  │ Application│
  │            │──── Write Command ──► Database
  └────────────┘

CQRS (separate models):
  ┌────────────┐
  │            │──── Read Query ────► Read Database ────► Response
  │ Application│                     (optimized for reads)
  │            │──── Write Command ──► Write Database
  │            │                     (optimized for writes)
  └────────────┘                          │
                                          │ Sync (events, CDC, etc.)
                                          ▼
                                     Read Database is updated
```

### Why CQRS?

Reads and writes often have very different requirements:

| Aspect    | Reads                              | Writes                             |
|-----------|------------------------------------|------------------------------------|
| Scale     | Usually 10-100x more reads         | Fewer writes                       |
| Schema    | Denormalized (for fast queries)    | Normalized (for consistency)       |
| Database  | Could use Elasticsearch, Redis     | Could use PostgreSQL, MongoDB      |
| Latency   | Must be fast                       | Can be slightly slower             |
| Consistency| Can be eventually consistent      | Must be strongly consistent        |

### CQRS Implementation

```
Write Side:
  Client ──[CreateOrderCommand]──► Command Handler ──► Write DB (PostgreSQL)
                                         │
                                   Publish Event
                                         │
                                         ▼
                                    Event Bus (Kafka)
                                         │
                                         ▼
Read Side:
  Event Handler ──► Update Read Model ──► Read DB (Elasticsearch)
  
  Client ──[Query]──► Query Handler ──► Read DB ──► Response
```

```python
# Command Side
class CreateOrderCommandHandler:
    def handle(self, command):
        order = Order(
            customer_id=command.customer_id,
            items=command.items,
            total=command.total
        )
        self.write_db.save(order)
        self.event_bus.publish(OrderCreated(
            order_id=order.id,
            customer_id=order.customer_id,
            items=order.items,
            total=order.total
        ))

# Query Side (Event Handler updates the read model)
class OrderProjection:
    def on_order_created(self, event):
        # Denormalized view optimized for reading
        self.read_db.index({
            "order_id": event.order_id,
            "customer_name": self.lookup_customer_name(event.customer_id),
            "items": event.items,
            "total": event.total,
            "status": "created"
        })

# Query Handler
class GetOrdersQueryHandler:
    def handle(self, query):
        return self.read_db.search(
            customer_id=query.customer_id,
            status=query.status
        )
```

### CQRS Trade-offs

| Advantage                              | Disadvantage                            |
|----------------------------------------|-----------------------------------------|
| Reads and writes scale independently   | More complex architecture               |
| Read model optimized for queries       | Eventual consistency between models     |
| Different databases for read/write     | More infrastructure to manage           |
| Simplifies complex domain logic        | Overkill for simple CRUD               |
| Can have multiple read models          | Debugging is harder                     |

---

## 6. Event Sourcing + CQRS Together

Event Sourcing and CQRS complement each other naturally:

```
                Command Side                          Query Side
                                                      
Client ──[Command]──► Command Handler                 Client ──[Query]──► Query Handler
                         │                                                    │
                    Validate                                                   │
                    Apply business logic                                       ▼
                         │                                              Read Database
                         ▼                                              (denormalized)
                    Event Store                                               ▲
                    (append events)                                            │
                         │                                               Event Handler
                    [OrderPlaced]                                         (projection)
                    [OrderShipped]                                             │
                         │                                                    │
                         └────────── Event Bus ────────────────────────────────┘
```

**Event Sourcing** handles the write side — all state changes are stored as events.
**CQRS** separates the read side — materialized views built from events for fast queries.

### Multiple Read Models from Same Events

```
Event: OrderPlaced
         │
         ├──► Orders Read Model (for order tracking UI)
         │    {order_id, customer, items, status, tracking}
         │
         ├──► Analytics Read Model (for dashboards)
         │    {daily_revenue, orders_per_category, avg_order_value}
         │
         ├──► Search Read Model (for product search)
         │    Elasticsearch: {product names, categories, prices}
         │
         └──► Recommendation Model (for ML)
              {user_purchase_history, product_affinities}

Each read model is independently built, scaled, and optimized.
```

---

## 7. Event Schema Design

### <abbr title="Event envelope: a consistent wrapper around every event that includes metadata like event_id, type, version, timestamp, and correlation/causation IDs. Makes events traceable, versioned, and easier to process.">Event Envelope</abbr>

```json
{
  "event_id": "evt_abc123",
  "event_type": "order.placed",
  "version": 2,
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "order-service",
  "correlation_id": "req_xyz789",
  "causation_id": "evt_prev456",
  "metadata": {
    "user_id": "user_123",
    "trace_id": "trace_abc"
  },
  "data": {
    "order_id": "order_456",
    "customer_id": "cust_789",
    "items": [...],
    "total": 99.99
  }
}
```

| Field          | Purpose                                             |
|----------------|-----------------------------------------------------|
| event_id       | Unique identifier for deduplication                 |
| event_type     | Classification (namespace.action)                   |
| version        | Schema version for evolution                        |
| timestamp      | When the event occurred                             |
| source         | Which service produced it                           |
| correlation_id | Links all events in a user's request journey        |
| causation_id   | Which event caused this one                         |
| data           | The event payload                                   |

### Schema Evolution

Events are immutable. You can't change old events. How do you evolve the schema?

| Strategy        | Description                                              |
|-----------------|----------------------------------------------------------|
| Upcasting       | Transform old events to new format when reading          |
| Versioned events| New event type: `order.placed.v2`                        |
| Weak schema     | New fields optional, old fields never removed            |
| Schema registry | Centralized schema management (Confluent Schema Registry)|

---

## 8. Challenges and Pitfalls

### Common Pitfalls

| Pitfall                          | Solution                                     |
|----------------------------------|----------------------------------------------|
| Using EDA for everything         | Not everything needs to be async/event-driven|
| Event naming (verbs, not past tense)| Always name events in past tense: OrderPlaced, not PlaceOrder |
| No event versioning              | Version from day 1; it's hard to add later   |
| Giant events                     | Keep events focused; one event per state change |
| No correlation IDs               | Always include correlation/causation IDs for tracing |
| Ignoring eventual consistency    | UI must handle stale reads gracefully         |
| No DLQ for failed events         | Always have a dead letter queue for failed processing |
| Event ordering assumptions       | Only guaranteed within a partition (Kafka) or stream |

### Eventual Consistency in the UI

```
User creates order → UI shows "Order placed!"
User refreshes → Read model hasn't caught up → Order not visible!

Solutions:
  1. Optimistic UI: Show the result immediately (before read model catches up)
  2. Read-your-writes: After a write, read from the write DB (not read replica)
  3. Polling: Poll the read model until the data appears
  4. WebSocket: Push an update to the UI when the read model is ready
```

---

## 9. Key Takeaways

### Decision Guide

```
Do I need Event-Driven Architecture?
  │
  ├── Simple CRUD, single service → No (REST/RPC is simpler)
  │
  ├── Microservices that need to react to each other → Yes (Event Notifications)
  │
  ├── Need complete audit trail / undo / replay → Event Sourcing
  │
  ├── Read and write workloads are very different → CQRS
  │
  └── Complex domain + audit trail + different read views → Event Sourcing + CQRS

Do I need an orchestrator?
  │
  ├── Simple flow (2-3 services, linear) → Choreography
  │
  └── Complex flow (many services, branching, compensation) → Orchestration
```

### Golden Rules

1. **Events are facts about the past.** Name them in past tense: OrderPlaced, not PlaceOrder.
2. **Don't use event sourcing for everything.** It adds complexity. Only use it where
   audit trails, replay, or temporal queries are genuinely valuable.
3. **CQRS without event sourcing** is useful on its own — separate read and write models.
4. **Event sourcing without CQRS** is possible but painful — querying an event log directly
   is slow.
5. **Schema evolution is not optional.** Plan for it from day one.
6. **Eventual consistency is the norm** in event-driven systems. Design UIs accordingly.
7. **Use correlation IDs everywhere** to trace events across services.
8. **Idempotent consumers** — events will be delivered more than once.

---

## 🔥 Senior Interview Questions

1. Compare choreography vs orchestration for a saga that involves Order, Payment, Inventory, and Shipping services. Walk through the happy path, failure path, and compensating transactions for each approach. When would you choose one over the other? [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

2. You're using event sourcing for an order management system. The event store has 500 million events. Rebuilding aggregate state by replaying all events takes 30 seconds. How do you optimize this? Discuss snapshots, projection stores, and event archiving. [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

3. An interviewer asks: "What's the difference between an event, a command, and a query?" Then follows with: "Can a consumer of an event emit another event?" Walk through the implications of event chains and how to prevent infinite loops. [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

4. Your event-driven system has 20 services publishing to a shared Kafka cluster. A new event schema version breaks 3 downstream consumers. How do you prevent this? Discuss schema registries, backward/forward compatibility, and contract testing. [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

5. Compare Kafka, RabbitMQ, and AWS EventBridge as event brokers. You need durable event storage, replay capability, and exactly-once processing. Which do you choose and why? [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

6. You implement CQRS with separate read and write databases. The read projection is 5 seconds behind the write database. A user creates an order and immediately views "My Orders" but doesn't see it. How do you solve this UX problem without sacrificing the benefits of CQRS? [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

7. An interviewer says: "Event sourcing means you never delete data." But your application needs GDPR's right-to-erasure. How do you reconcile these? Discuss crypto-shredding, tombstone events, and personal data stores. [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

8. You're debugging a production incident where an order was double-charged. The event logs show the PaymentProcessed event was consumed twice. How did this happen (at-least-once delivery) and how do you prevent it from causing real-world damage? [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

9. Compare event-driven architecture with request-driven (REST) architecture for a food delivery system (like DoorDash). Which parts of the system benefit from events and which should remain synchronous? Draw the boundary. [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

10. You have an event-sourced system that needs to support reports ("show me all orders last month by region"). Querying the event store directly is impractical. Design the projection/materialized view strategy, including how you handle projection failures, schema evolution, and rebuilding projections from scratch. [Answer](QnA-Answer-Key.md#19-event-driven-architecture)

---

## 📚 Further Reading

- [Event Sourcing Pattern — Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html) — Foundational article on event sourcing by the man who named it.
- [The Many Meanings of Event-Driven Architecture (Martin Fowler, YouTube)](https://www.youtube.com/watch?v=STKCRSUsyP0) — Clarifies event notification, event-carried state transfer, event sourcing, and CQRS.
- [Designing Event-Driven Systems (Confluent, Free eBook)](https://www.confluent.io/designing-event-driven-systems/) — Practical guide to building event-driven systems with Kafka.
