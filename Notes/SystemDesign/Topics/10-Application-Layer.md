# Application Layer & Microservices

> How to structure the application tier — monolith vs microservices, service discovery, and the trade-offs of each approach.

---

## Table of Contents

1. [Separating Web and Application Layers](#1-separating-web-and-application-layers)
2. [Monolithic Architecture](#2-monolithic-architecture)
3. [Microservices Architecture](#3-microservices-architecture)
4. [Monolith vs Microservices: Trade-offs](#4-monolith-vs-microservices-trade-offs)
5. [Service Discovery](#5-service-discovery)
6. [Inter-Service Communication](#6-inter-service-communication)
7. [API Gateway Pattern](#7-api-gateway-pattern)
8. [Service Mesh](#8-service-mesh)
9. [Decomposition Strategies](#9-decomposition-strategies)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Separating Web and Application Layers

The first step in scaling is separating the **web layer** (handling HTTP requests) from the **application layer** (business logic):

```
Coupled (basic):
  ┌─────────────────────────┐
  │  Single Server          │
  │  Web + App + Business   │
  │  Logic all in one       │
  └─────────────────────────┘

Separated (scalable):
  ┌──────────────┐         ┌──────────────┐
  │  Web Layer   │ ──────→ │  App Layer   │
  │  (Nginx,     │         │  (Business   │
  │   static     │         │   logic,     │
  │   files)     │         │   APIs)      │
  └──────────────┘         └──────────────┘
  Scale independently       Scale independently
```

### Why Separate?

- **Independent scaling:** Web layer might need 2 servers, App layer might need 10
- **Different resources:** Web is I/O-bound (serving files), App is CPU-bound (processing)
- **Team autonomy:** Different teams can own different layers
- **Tech flexibility:** Web layer could be Nginx, App could be Node/Python/Java

---

## 2. Monolithic Architecture

All application functionality is in a **single deployable unit.**

```
┌──────────────────────────────────────────────┐
│              Monolith Application             │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  User    │ │  Product │ │  Order   │     │
│  │  Module  │ │  Module  │ │  Module  │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Payment  │ │ Notif.   │ │  Search  │     │
│  │  Module  │ │  Module  │ │  Module  │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│              Shared Database                  │
│              ┌──────────────┐                │
│              │  PostgreSQL  │                │
│              └──────────────┘                │
└──────────────────────────────────────────────┘
```

### Advantages

- **Simple to develop:** One codebase, one IDE, one build
- **Simple to deploy:** One artifact (JAR, binary, Docker image)
- **Simple to test:** Integration testing with everything in one process
- **No network overhead:** All calls are in-process function calls (microseconds, not milliseconds)
- **Easy debugging:** Single stack trace, one set of logs
- **Transactions:** ACID transactions across all data in one database

### Disadvantages

- **Scaling is all-or-nothing:** Must replicate the entire app even if only one module is bottlenecked
- **Large codebase:** Becomes hard to understand, modify, and onboard new developers
- **Slow CI/CD:** Build and deploy times grow as codebase grows
- **Technology lock-in:** Entire app uses one language/framework
- **Fault isolation:** A bug in the payment module can crash the entire application
- **Team coupling:** Teams step on each other's toes; merge conflicts are frequent

### When Monolith Makes Sense

- **Early-stage startups** (< 10 engineers, < 1M users)
- **Small, well-defined domains** 
- When **speed of development** matters more than scalability
- When you **don't know your domain well** enough to define service boundaries

---

## 3. Microservices Architecture

Application is decomposed into **small, independent services,** each responsible for a specific business capability.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  User    │  │  Product │  │  Order   │
│ Service  │  │ Service  │  │ Service  │
│  (Node)  │  │  (Java)  │  │ (Python) │
│  ┌────┐  │  │  ┌────┐  │  │  ┌────┐  │
│  │ DB │  │  │  │ DB │  │  │  │ DB │  │
│  └────┘  │  │  └────┘  │  │  └────┘  │
└──────────┘  └──────────┘  └──────────┘
      ▲              ▲              ▲
      └──────────────┼──────────────┘
                     │
              ┌──────┴──────┐
              │ API Gateway │
              └─────────────┘
                     ▲
                     │
                  Client
```

### Key Characteristics

```
1. Each service is INDEPENDENTLY deployable
   Deploy user service without affecting order service.

2. Each service owns its DATA
   User service has its own database.
   No direct database access across services.

3. Each service has a SINGLE responsibility
   User service: registration, authentication, profiles
   Order service: cart, checkout, order tracking

4. Services communicate over the NETWORK
   HTTP/REST, gRPC, or messaging (Kafka, RabbitMQ)

5. Each service can use DIFFERENT technology
   User service in Node.js, ML service in Python, 
   high-performance service in Go.
```

### Advantages

- **Independent scaling:** Scale only the services that need it
- **Independent deployment:** Deploy 50 times/day without coordinating
- **Fault isolation:** Payment service crashes ≠ search is down
- **Technology diversity:** Best tool for each job
- **Team autonomy:** Small teams own services end-to-end
- **Easier to understand:** Each service's codebase is small

### Disadvantages

- **Distributed system complexity:** Network failures, partial failures, distributed transactions
- **Operational overhead:** 20 services = 20 deployments, 20 sets of logs, 20 monitoring dashboards
- **Inter-service latency:** Network calls (1-10ms) instead of function calls (µs)
- **Data consistency:** No ACID transactions across services; need eventual consistency, <abbr title="Sagas: a pattern for managing distributed transactions across microservices. Instead of one big transaction, you break it into a sequence of local transactions, each publishing an event/message to trigger the next step. If a step fails, compensating transactions undo previous steps.">sagas</abbr>
- **Testing difficulty:** Integration testing across services is hard
- **Debugging difficulty:** Request spans multiple services; need <abbr title="Distributed tracing: tracking a single request as it flows through multiple microservices, so you can see exactly where time was spent or where failures occurred. Tools: Jaeger, Zipkin, AWS X-Ray">distributed tracing</abbr>
- **API versioning:** Changing one service's API can break others

### Real-World Example: Netflix

```
Netflix: 700+ microservices

  API Gateway → routes to:
    ├── User Profile Service
    ├── Recommendation Service
    ├── Video Encoding Service
    ├── Billing Service
    ├── Playback Service
    ├── Content Discovery Service
    └── ... hundreds more

Each service:
  - Owned by a small team (2-pizza team)
  - Deployed independently (thousands of deployments/day)
  - Has its own data store
  - Communicates via REST or gRPC
```

---

## 4. Monolith vs Microservices: Trade-offs

| Factor | Monolith | Microservices |
|--------|----------|---------------|
| **Complexity** | Simple architecture, complex codebase | Complex architecture, simple codebases |
| **Deployment** | All-or-nothing | Independent per service |
| **Scaling** | Scale entire app | Scale individual services |
| **Data consistency** | ACID transactions | Eventual consistency / sagas |
| **Performance** | In-process calls (fast) | Network calls (slower) |
| **Team structure** | One big team (or overlapping) | Small, autonomous teams |
| **Time to first feature** | Fastest | Slower (infrastructure overhead) |
| **Technology** | One stack | Multiple stacks possible |
| **Debugging** | Easy (one process) | Hard (distributed tracing needed) |
| **Best for** | Small teams, early products | Large teams, mature products |

### The Recommended Path

```
Stage 1: Start with a monolith
  - Quick to build
  - Simple to deploy
  - Learn your domain

Stage 2: Modular monolith
  - Organize code into clear modules with defined interfaces
  - Each module could become a service later
  - Still one deployable unit

Stage 3: Extract services strategically
  - Identify modules that need independent scaling
  - Extract high-scale or frequently-changing modules first
  - Keep the rest as a monolith (the "majestic monolith")

"Don't start with microservices." — Martin Fowler
"Monolith first." — Almost every successful company
```

---

## 5. Service Discovery

In a microservice world, services need to **find each other.** IP addresses change (auto-scaling, deploys, crashes), so you can't hardcode them.

### Client-Side Discovery

```
┌──────────┐     query    ┌──────────────┐
│ Service A│ ───────────→ │  Service     │
│ (client) │              │  Registry    │
│          │ ←─────────── │  (Consul,    │
│          │  "B is at    │   Eureka)    │
│          │   10.0.1.5"  └──────────────┘
│          │                     ▲
│          │                     │ register
│          │              ┌──────┴──────┐
│          │ ───────────→ │  Service B  │
│          │  direct call │  10.0.1.5   │
└──────────┘              └─────────────┘

Service A asks the registry: "Where is Service B?"
Registry responds with the IP.
Service A calls Service B directly.

Pros: No extra hop; Service A can load-balance across instances
Cons: Each service needs discovery client library
```

### Server-Side Discovery

```
┌──────────┐             ┌──────────────┐     ┌──────────┐
│ Service A│ ──────────→ │  Load        │ ──→ │ Service B│
│ (client) │             │  Balancer    │     │ Instance │
│          │ ←────────── │  (knows all  │ ──→ │ Service B│
│          │             │   instances) │     │ Instance │
└──────────┘             └──────────────┘     └──────────┘
                               ▲ register
                         ┌─────┴─────┐
                         │  Service  │
                         │  Registry │
                         └───────────┘

Service A just calls the LB at a fixed address.
The LB knows all instances of Service B.

Pros: Simpler clients; LB handles load balancing
Cons: Extra network hop through the LB
```

### Service Discovery Tools

| Tool | Type | Key Feature |
|------|------|-------------|
| **Consul** | Registry + health checks | Multi-datacenter, key-value store, DNS interface |
| **Etcd** | Key-value store | Used by Kubernetes, strong consistency (Raft) |
| **Zookeeper** | Coordination service | Used by Kafka/Hadoop, leader election |
| **Eureka** | Registry | Netflix OSS, self-preservation mode |
| **Kubernetes DNS** | Built-in | Automatic: `service-name.namespace.svc.cluster.local` |

### Kubernetes Service Discovery (Most Common Today)

```
In Kubernetes, service discovery is automatic:

1. Deploy "user-service" with 3 replicas
2. Kubernetes creates a Service object
3. Any pod can reach it via: http://user-service:8080
4. Kubernetes DNS resolves the name
5. kube-proxy load-balances across the 3 pods

No external registry needed. It just works.
```

---

## 6. Inter-Service Communication

### Synchronous (Request-Response)

```
REST (HTTP):
  Service A → GET /api/users/123 → Service B
  Service B → { "id": 123, "name": "Alice" } → Service A

gRPC:
  Service A → GetUser(id=123) → Service B (via Protocol Buffers)
  Service B → UserResponse{id=123, name="Alice"} → Service A

When to use: When you need an immediate response.
  "I need the user's data RIGHT NOW to continue processing."
```

### Asynchronous (Event-Driven)

```
Message Queue / Event Bus:
  Service A → publish("order.created", {orderId: 456}) → Kafka
  
  Service B (inventory) → consumes "order.created" → update stock
  Service C (email)     → consumes "order.created" → send confirmation
  Service D (analytics) → consumes "order.created" → update dashboards

When to use: When you don't need an immediate response.
  "I created an order. Other services should react to it eventually."
```

---

## 7. API Gateway Pattern

An API Gateway is a single entry point for all clients. It routes requests to the appropriate microservice.

```
┌────────────────────────────────────────────────────┐
│                    API Gateway                      │
│                                                    │
│  Routes:                                           │
│    /api/users/*    → User Service                  │
│    /api/products/* → Product Service               │
│    /api/orders/*   → Order Service                 │
│                                                    │
│  Also handles:                                     │
│    - Authentication (verify JWT)                   │
│    - Rate limiting                                 │
│    - Request/response transformation               │
│    - Aggregation (combine multiple service calls)  │
│    - Caching                                       │
│    - Logging / Monitoring                          │
└────────────────────────────────────────────────────┘

Popular API Gateways:
  - Kong (open source, Nginx-based)
  - AWS API Gateway (managed)
  - Apigee (Google Cloud, enterprise)
  - Traefik (Kubernetes-native)
  - Envoy + Istio (service mesh approach)
```

### Backend for Frontend (BFF) Pattern

Different clients (web, mobile, IoT) have different API needs. Create separate gateways:

```
  Web App → Web BFF  → ┌──────────┐
                        │ Services │
  Mobile  → Mobile BFF → │          │
                        │          │
  IoT     → IoT BFF   → └──────────┘

Each BFF is optimized for its client:
  - Web BFF: Returns full data
  - Mobile BFF: Returns compressed, minimal data
  - IoT BFF: Returns tiny payloads
```

---

## 8. Service Mesh

A service mesh is an **infrastructure layer** that handles service-to-service communication transparently, using sidecar proxies.

```
Without service mesh:
  Service A ───→ Service B
  (must implement: retries, circuit breaker, TLS, tracing, metrics)

With service mesh (e.g., Istio + Envoy):
  ┌──────────────────┐         ┌──────────────────┐
  │ Pod A            │         │ Pod B            │
  │ ┌──────────────┐ │         │ ┌──────────────┐ │
  │ │ Service A    │ │         │ │ Service B    │ │
  │ │ (your code)  │ │         │ │ (your code)  │ │
  │ └──────┬───────┘ │         │ └──────────────┘ │
  │        ↕         │         │        ↕         │
  │ ┌──────┴───────┐ │ ─mTLS→ │ ┌──────────────┐ │
  │ │ Envoy proxy  │ │────────→│ │ Envoy proxy  │ │
  │ │ (sidecar)    │ │         │ │ (sidecar)    │ │
  │ └──────────────┘ │         │ └──────────────┘ │
  └──────────────────┘         └──────────────────┘

The sidecar handles:
  ✅ mTLS (mutual TLS) — encrypted communication
  ✅ Retries and timeouts
  ✅ Circuit breaking
  ✅ Load balancing
  ✅ Metrics collection
  ✅ Distributed tracing
  ✅ Traffic shaping (canary, A/B)

Your code just makes a simple HTTP call.
All the networking complexity is handled by the sidecar.
```

---

## 9. Decomposition Strategies

How do you decide what becomes a microservice?

### By Business Capability

```
E-commerce platform:
  ├── User Management Service (registration, auth, profiles)
  ├── Product Catalog Service (listings, categories, search)
  ├── Order Service (cart, checkout, order lifecycle)
  ├── Payment Service (charging, refunds, invoicing)
  ├── Shipping Service (tracking, rates, labels)
  ├── Notification Service (email, SMS, push)
  └── Analytics Service (reporting, dashboards)

Each service = one business capability
Maps well to organizational structure (<abbr title="Conway's Law: 'Any organization that designs a system will produce a design whose structure is a copy of the organization's communication structure.' Teams tend to build systems that mirror how they communicate — so organizing teams around services helps.">Conway's Law</abbr>)
```

### By Subdomain (<abbr title="Domain-Driven Design (DDD): a software approach that structures code around the business domain (the problem you're solving) rather than technical concerns. It uses concepts like Bounded Contexts, Aggregates, and Ubiquitous Language to keep code aligned with business needs.">Domain-Driven Design</abbr>)

```
Bounded Contexts from DDD:
  ├── Identity Context → Auth Service
  ├── Catalog Context → Product Service
  ├── Ordering Context → Order Service
  ├── Billing Context → Payment Service
  └── Fulfillment Context → Shipping Service

Each bounded context has its own domain model.
"Customer" in Billing might be different from "Customer" in Ordering.
```

### The <abbr title="Strangler Fig pattern: named after the strangler fig vine that gradually surrounds and replaces a host tree. You incrementally route more traffic to new microservices while the old monolith slowly 'dies'. Safe migration with no big-bang rewrite.">Strangler Fig Pattern</abbr> (Migration)

```
Gradually migrate from monolith to microservices:

Step 1: Route all traffic through a proxy
  Client → Proxy → Monolith

Step 2: Extract one feature as a service
  Client → Proxy → User Service (new)
                  → Monolith (everything else)

Step 3: Extract more features
  Client → Proxy → User Service
                  → Product Service
                  → Monolith (shrinking)

Step 4: Eventually, monolith is gone
  Client → Proxy → User Service
                  → Product Service
                  → Order Service
                  → Payment Service
```

---

## 10. Key Takeaways

1. **Separate web and application layers** for independent scaling. Web servers handle HTTP/static; app servers handle business logic.

2. **Start with a monolith.** Build a modular monolith first; extract microservices only when you need to. Premature microservices are the #1 mistake.

3. **Microservices trade development simplicity for operational complexity.** You need: service discovery, distributed tracing, circuit breakers, API gateways, and more.

4. **Service discovery** is how services find each other. In Kubernetes it's automatic. Otherwise, use Consul, Etcd, or Eureka.

5. **Use synchronous calls (REST/gRPC) when you need immediate responses.** Use asynchronous calls (events/queues) when you don't.

6. **API Gateway** is the single entry point for clients. It handles routing, auth, rate limiting, and aggregation.

7. **Service mesh** (Istio/Envoy) handles cross-cutting concerns (security, retries, tracing) transparently, keeping service code clean.

8. **Decompose by business capability** or DDD bounded contexts. If you can't define a clear boundary, it probably shouldn't be a separate service.

---

## 🔥 Senior Interview Questions

1. You're migrating a monolith to microservices. The monolith has 50 tightly-coupled modules. How do you decide what to extract first? Discuss the Strangler Fig pattern and bounded contexts. [Answer](QnA-Answer-Key.md#10-application-layer)

2. An interviewer says: "Microservices solve all scaling problems." What are the top 5 problems that microservices introduce that a monolith didn't have? When is a monolith actually the better choice? [Answer](QnA-Answer-Key.md#10-application-layer)

3. You have 100 microservices and a new feature requires changes to 7 of them deployed atomically. How do you handle cross-service transactions? Compare <abbr title="2PC (Two-Phase Commit): a distributed transaction protocol where a coordinator asks all participants to 'prepare' (phase 1), then tells them all to 'commit' or 'abort' (phase 2). Provides strong consistency but blocks if any participant fails.">2PC</abbr>, Saga (choreography vs orchestration), and eventual consistency. [Answer](QnA-Answer-Key.md#10-application-layer)

4. Service A calls Service B, which calls Service C. Service C is slow. How does this cascade, and what patterns (circuit breaker, timeout budget, bulkhead) prevent Service A from failing too? [Answer](QnA-Answer-Key.md#10-application-layer)

5. Compare Consul, Eureka, etcd, and Kubernetes DNS for service discovery. Which would you choose for a 500-service architecture running on Kubernetes, and what about a hybrid cloud/on-prem deployment? [Answer](QnA-Answer-Key.md#10-application-layer)

6. Your microservices architecture experiences the "distributed monolith" anti-pattern — services are technically separate but deploy and fail together. How do you detect this and fix it? [Answer](QnA-Answer-Key.md#10-application-layer)

7. An API gateway handles auth, rate limiting, routing, and request transformation. At what scale does the API gateway itself become a bottleneck? How do you scale it, and when would you consider a mesh approach instead? [Answer](QnA-Answer-Key.md#10-application-layer)

8. You're designing a greenfield system. The team has 5 engineers. An architect proposes starting with microservices. Make the case for starting with a modular monolith and define the criteria for when to split. [Answer](QnA-Answer-Key.md#10-application-layer)

9. How do you handle shared data (e.g., user data needed by 10 services) in a microservices architecture? Compare shared database, API calls, data replication via events, and data mesh. [Answer](QnA-Answer-Key.md#10-application-layer)

10. You're seeing high latency in a request that fans out to 12 microservices. How do you trace the request across services, identify the bottleneck, and optimize the call graph? Discuss distributed tracing, parallel vs sequential calls, and service aggregation. [Answer](QnA-Answer-Key.md#10-application-layer)

---

## 📚 Further Reading

- [Building Microservices by Sam Newman](https://samnewman.io/books/building_microservices_2nd_edition/) — The definitive guide for microservices architecture.
- [MonolithFirst — Martin Fowler](https://martinfowler.com/bliki/MonolithFirst.html) — Why starting with a monolith is often the right move.
- [Mastering Chaos: A Netflix Guide to Microservices (YouTube)](https://www.youtube.com/watch?v=CZ3wIuvmHeM) — How Netflix runs 700+ microservices at scale.
