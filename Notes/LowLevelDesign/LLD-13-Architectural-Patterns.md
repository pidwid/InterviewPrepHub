# Architectural Patterns

> While GoF design patterns operate at the class level, **architectural patterns** organize the entire codebase. Senior engineers are expected to discuss these fluently — "which architecture would you use?" is a common follow-up to any LLD problem.

---

## Table of Contents

1. [MVC (Model-View-Controller)](#1-mvc-model-view-controller)
2. [MVP (Model-View-Presenter)](#2-mvp-model-view-presenter)
3. [MVVM (Model-View-ViewModel)](#3-mvvm-model-view-viewmodel)
4. [Hexagonal Architecture (Ports & Adapters)](#4-hexagonal-architecture-ports--adapters)
5. [Clean Architecture](#5-clean-architecture-uncle-bob)
6. [Event Sourcing](#6-event-sourcing)
7. [CQRS](#7-cqrs-command-query-responsibility-segregation)
8. [Layered (N-Tier)](#8-layered-n-tier)
9. [Microservices vs Monolith](#9-microservices-vs-monolith-architecture-of-architectures)
10. [Quick Decision Matrix](#10-quick-decision-matrix)
11. [Senior Interview Talking Points](#11-senior-interview-talking-points)
12. [Common Pitfalls](#12-common-pitfalls)

---

## 1. MVC (Model-View-Controller)

The original UI architecture from Smalltalk-80, now ubiquitous in web frameworks (Rails, Django, Spring MVC, ASP.NET).

```
┌──────────┐   user input    ┌────────────┐   updates    ┌──────────┐
│   View   │ ───────────────▶│ Controller │ ────────────▶│  Model   │
│  (UI)    │◀────────────────│            │◀─────────────│ (state)  │
└──────────┘   renders        └────────────┘   reads      └──────────┘
```

- **Model**: data + business logic; framework-agnostic.
- **View**: rendering only; no logic.
- **Controller**: receives input, orchestrates Model and View.

**Pros**: clear separation, easy to test Model independently.
**Cons**: views and models can become tightly coupled in complex UIs; "fat controller" anti-pattern.

---

## 2. MVP (Model-View-Presenter)

A variant where the **View is dumb** and the **Presenter** has the logic.

- View exposes an interface (`IUserView { showName(); showError(); }`).
- Presenter calls View methods directly; never reaches into the View's UI internals.

**Why use it?** Easier to unit-test the Presenter (mock the View interface). Common in legacy Android (pre-Jetpack), WinForms, GWT.

---

## 3. MVVM (Model-View-ViewModel)

Used by **React, Vue, Angular, SwiftUI, WPF, Jetpack Compose**.

```
┌──────────┐  binds (data + commands)  ┌───────────┐   reads   ┌──────────┐
│   View   │ ◀────────────────────────▶│ ViewModel │ ─────────▶│  Model   │
└──────────┘                           └───────────┘           └──────────┘
```

- **ViewModel** exposes observable state (`Observable`, `LiveData`, React `useState`).
- **View** declaratively binds to it; updates automatically when state changes.
- No imperative `setText`/`updateUI` — the framework handles re-render.

**Pros**: declarative, reactive, highly testable.
**Cons**: learning curve; over-binding can make data flow opaque.

---

## 4. Hexagonal Architecture (Ports & Adapters)

Coined by Alistair Cockburn. The application core is **completely isolated** from infrastructure (DB, HTTP, message brokers).

```
                         ┌─────────────────┐
                         │   HTTP Adapter  │
                         └────────┬────────┘
                                  │
                       ┌──────────▼──────────┐
                       │  Application Core   │
                       │  ┌───────────────┐  │
   DB ◀── Adapter ◀───▶│  │ Domain Logic  │  │◀───▶ Adapter ──▶ Kafka
                       │  └───────────────┘  │
                       │   uses Ports        │
                       └──────────▲──────────┘
                                  │
                         ┌────────┴────────┐
                         │ CLI Adapter     │
                         └─────────────────┘
```

- **Ports**: interfaces the core defines (e.g., `UserRepository`, `EmailSender`).
- **Adapters**: implementations (e.g., `PostgresUserRepository`, `SmtpEmailSender`).
- **The dependency arrow always points inward** toward the core.

**Why it matters for senior interviews**: "How would you swap your DB from Postgres to DynamoDB?" → "I'd write a new adapter; the core is untouched."

---

## 5. Clean Architecture (Uncle Bob)

A close cousin of Hexagonal, with stricter layering:

```
┌─────────────────────────────────────┐
│   Frameworks & Drivers (UI, DB)     │  ← outermost
│  ┌───────────────────────────────┐  │
│  │ Interface Adapters            │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Application Use Cases   │  │  │
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │ Enterprise Entities│  │  │  ← innermost
│  │  │  └───────────────────┘  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**The Dependency Rule**: source code dependencies only point inward. The outer layers know about inner; the inner know nothing about the outer.

---

## 6. Event Sourcing

Don't store the *current state*; store the *sequence of events that produced it*.

```
Events:    Created(acc=42, balance=0)  →  Deposited(50)  →  Withdrew(20)
State:                                                                    Balance = 30
```

**Pros**:
- Perfect audit log (free).
- Time-travel debugging — replay events to any prior state.
- Easy to add new read models — just replay events into a new projection.

**Cons**:
- Schema evolution is hard (events are immutable forever).
- Snapshots needed for performance after millions of events.
- Eventual consistency between projections.

**When to use**: financial systems, audit-heavy domains (medical records), source-of-truth systems.

---

## 7. CQRS (Command Query Responsibility Segregation)

Reads and writes go through completely **different models, code paths, and often different databases**.

- **Command side**: validates, applies business rules, writes to the source of truth (often event-sourced).
- **Query side**: denormalized read models tuned for specific UIs.
- Connected by an event stream.

**When to use**: heavy asymmetry between read and write workloads, complex domains where read shapes ≠ write shapes.

---

## 8. Layered (N-Tier)

The textbook architecture: Presentation → Business Logic → Data Access → Database. Easy to teach, easy to over-couple. Modern variants insert a **Service layer** and a **DTO layer**.

**Anti-pattern alert**: layered architectures often degenerate into the **anemic domain model** where the "Model" is just data classes and all logic lives in services. Domain-Driven Design is the antidote.

---

## 9. Microservices vs Monolith (Architecture-of-architectures)

| Aspect | Monolith | Microservices |
|--------|----------|---------------|
| Deploy | Single artifact | Many independent |
| DB | Shared schema | Per-service (DB-per-service) |
| Communication | In-process calls | HTTP/gRPC/queue |
| Failure isolation | Weak | Strong (with care) |
| Operational cost | Low | High (observability, infra) |
| Best for | Small team, early product | Mature org, well-bounded contexts |

**Senior insight**: "Start with a well-modularized monolith. Extract services only when team size or scaling needs demand it."

---

## 10. Quick Decision Matrix

| Scenario | Use this |
|----------|----------|
| Single-page web app frontend | MVVM (React/Vue) |
| Enterprise web backend | Layered + DDD or Hexagonal |
| Long-lived event-driven system | Event Sourcing + CQRS |
| Mobile app needing testable UI | MVVM or MVP |
| Traditional CRUD | MVC + Active Record |
| Complex domain, multiple read shapes | Hexagonal + CQRS |
| Real-time collaboration | Event Sourcing + CRDT |

---

## 11. Senior Interview Talking Points

- **Avoid "architecture astronauting"** — don't propose Hexagonal + CQRS + Event Sourcing for a CRUD app. Match complexity to need.
- **Justify the layering boundary**: why does this thing live in `domain/` vs `application/`? If you can't articulate it, the boundary is wrong.
- **Discuss testing**: a good architecture lets you write fast unit tests for business logic with no infrastructure.
- **Discuss change**: "If we needed to swap Postgres for DynamoDB, what changes?" — your architecture should make this localized.

---

## 12. Common Pitfalls

- **Anemic domain model**: data classes + service classes with all the logic. Use rich domain objects.
- **Leaky abstractions**: returning `ResultSet` from a "repository" makes the rest of the app know about JDBC.
- **Big-bang rewrites**: introducing Clean Architecture into a legacy code base in one PR. Strangle gradually.
- **Reverse dependency direction**: domain importing infrastructure types (`@Entity` JPA annotations on domain classes is a classic offender — fix with a separate persistence model).
