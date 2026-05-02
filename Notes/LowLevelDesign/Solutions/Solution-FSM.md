# 🛠️ Design a Generic Finite State Machine (FSM) Library — LLD

> **Sources**: Gamma, Helm, Johnson, Vlissides — *Design Patterns: Elements of Reusable Object-Oriented Software* (1994), §**State Pattern** pp. 305–313; [Spring Statemachine](https://spring.io/projects/spring-statemachine) reference docs (states, transitions, guards, actions, listeners, hierarchical states); [AWS Step Functions developer guide](https://docs.aws.amazon.com/step-functions/) (cloud-scale state-machine analogue); David Harel — *Statecharts: A Visual Formalism for Complex Systems* (1987) (hierarchical/orthogonal extensions).

## 1. Requirements

### Functional
- Define **named states** and **transitions** between them, triggered by **named events**.
- Per-transition **guards** (`Predicate<Context>`): only fire when the predicate returns true.
- Per-state **onEntry / onExit** callbacks; per-transition **action** callbacks.
- `getCurrentState()`; `fire(event, context)` returning the new state or rejecting.
- **Serialise / deserialise** machine state for durable persistence.

### Non-Functional
- **Thread-safe** — concurrent `fire()` calls must remain consistent.
- **O(1)** lookup of `(currentState, event) → Transition`.
- **Domain-agnostic library** — generic over `<S, E>`.

## 2. Core Entities

| Entity | Role |
|---|---|
| `StateMachine<S, E>` | The machine: holds `currentState`, the transition table, and a lock. |
| `State<S>` | `id`, optional `onEntry: Action`, optional `onExit: Action`. |
| `Transition<S, E>` | `(fromState, event, toState, guard?, action?)`. |
| `Context` | Mutable bag passed to guards and actions (user, request, timestamp, …). |
| `Builder<S, E>` | Fluent DSL for construction. |
| `StateChangeListener<S>` | Observer; receives `(from, to, event, context)` after every successful transition. |

## 3. Two Implementation Approaches

### 3.1 Table-driven (recommended default)
```java
Map<Pair<S, E>, List<Transition<S, E>>> table;   // O(1) lookup by (state, event)
```
- **Simple, declarative, the textbook approach.**
- All transitions live in one place — trivial to print/visualise the entire machine.
- Behaviour lives in `guard` (Strategy) and `action` (Strategy/Command) lambdas.

### 3.2 GoF State pattern (one class per state)
Each state is a class implementing `handle(event, ctx)`. Polymorphic, but more boilerplate and the machine isn't visible in any one place. Useful when state-specific behaviour is too rich for guard predicates alone (e.g., a TCP connection's many message handlers).

**Recommendation**: start table-driven; switch to per-state classes only when guards become a soup of `if/else`.

## 4. The `fire()` Algorithm

```java
public S fire(E event, Context ctx) {
  lock.lock();
  try {
    List<Transition<S, E>> candidates = table.getOrDefault(key(currentState, event), List.of());
    for (Transition<S, E> t : candidates) {
      if (t.guard == null || t.guard.test(ctx)) {
        State<S> from = states.get(currentState);
        State<S> to   = states.get(t.toState);
        if (from.onExit  != null) from.onExit.accept(ctx);
        if (t.action     != null) t.action.accept(ctx);
        S prev = currentState;
        currentState = t.toState;
        if (to.onEntry   != null) to.onEntry.accept(ctx);
        listeners.forEach(l -> l.onTransition(prev, currentState, event, ctx));
        return currentState;
      }
    }
    if (rejectMode == THROW) throw new IllegalTransitionException(currentState, event);
    return currentState;                     // silent reject
  } finally {
    lock.unlock();
  }
}
```

The order **`onExit → action → setState → onEntry`** is the standard convention (UML state machines, Spring Statemachine).

## 5. Builder DSL

```java
StateMachine<OrderState, OrderEvent> sm = StateMachine.builder(OrderState.class, OrderEvent.class)
  .states(NEW, PAID, SHIPPED, DELIVERED, CANCELLED)
  .initial(NEW)
  .onEntry(PAID, ctx -> sendReceipt(ctx))
  .transition(NEW,    PAY,      PAID)
       .withGuard(ctx -> ctx.amount() > 0)
       .withAction(ctx -> charge(ctx))
  .transition(PAID,   SHIP,     SHIPPED)
  .transition(SHIPPED,DELIVER,  DELIVERED)
  .transition(NEW,    CANCEL,   CANCELLED)
  .transition(PAID,   REFUND,   CANCELLED)
       .withAction(ctx -> issueRefund(ctx))
  .listener(auditLogger)
  .build();
```

## 6. Design Patterns

| Pattern | Where | Why |
|---|---|---|
| **State** (GoF) | The whole abstraction | Encapsulate state-dependent behaviour. |
| **Strategy** | `guard: Predicate<Context>` and `action: Consumer<Context>` | Plug in arbitrary policies without subclassing. |
| **Command** | Each `Transition.action` | Queueable, replayable, auditable. |
| **Builder** | Fluent DSL above | Readable, validated construction. |
| **Observer** | `StateChangeListener` | Audit, metrics, side-channel notifications without coupling. |
| **Template Method** | `AbstractStateMachine` overridable hooks (`beforeTransition`, `afterTransition`) | Subclass extension. |
| ❌ **Memento** | Not useful — FSMs don't roll back; for persistence use serialization. | |

## 7. Edge Cases

- **No transition for `(state, event)`** — configurable: throw `IllegalTransitionException` or silently stay.
- **All guards return false** — same as no transition.
- **`onEntry` throws** *after* `setState` — leaves the machine in the new state with a half-initialised side-effect. **Make entry/exit actions idempotent** and prefer external compensation over rollback.
- **Re-entrant `fire()` from inside an action** — use `ReentrantLock` (not `synchronized`) so the same thread can re-enter; or queue the inner event for after the outer completes.
- **Self-transitions (A → A)** — valid; `onExit` and `onEntry` both fire (useful for timer resets).
- **Hierarchical state machines (Harel statecharts)** — out of scope for a basic library; Spring Statemachine and UML state diagrams support them. Mention as the next-level extension.

## 8. Concurrency

- **Default**: one `ReentrantLock` per machine — atomic transition lookup + execution.
- **High-throughput**: `AtomicReference<S>` with CAS for the state pointer; entry/exit actions become harder to order safely (must be idempotent or run outside the CAS loop).
- **Event ordering**: prefer a **single-threaded per-machine event queue** (actor model) over fine-grained locking when ordering matters more than throughput.

## 9. Persistence

Minimal serialisation = `currentState.name()`. Production systems also persist the **Context** (so handlers can resume after restart). For event-sourced systems, store the **event log** instead and replay it to reach the current state — this is exactly what AWS Step Functions does internally.

## 10. Sources / Cross-Refs
- LLD-08 Behavioral Patterns (State, Strategy, Observer, Command, Template Method)
- LLD-06 Creational Patterns (Builder)
- LLD-09 Concurrency.md (`ReentrantLock`, `AtomicReference`)
- Solution-Vending-Machine.md, Solution-Order-Matching-Engine.md, Solution-Concert-Booking.md (concrete machines)
- Solution-Jira.md (a generic configurable workflow engine = an FSM library applied to issue tracking)
- Spring Statemachine docs; AWS Step Functions docs; GoF *Design Patterns* (1994)
