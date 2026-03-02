# UML Diagrams

> <abbr title="Unified Modeling Language: a standard way to visualize software design using diagrams.">UML</abbr> diagrams are the visual language of Low-Level Design. In interviews, you'll draw class diagrams and sequence diagrams to communicate your design clearly and quickly.

---

## Table of Contents

1. [Why UML in Interviews](#1-why-uml-in-interviews)
2. [Class Diagrams](#2-class-diagrams)
3. [Use Case Diagrams](#3-use-case-diagrams)
4. [Sequence Diagrams](#4-sequence-diagrams)
5. [Activity Diagrams](#5-activity-diagrams)
6. [State Machine Diagrams](#6-state-machine-diagrams)
7. [Which Diagram to Use When](#7-which-diagram-to-use-when)
8. [Interview Tips](#8-interview-tips)

---

## 1. Why UML in Interviews

| Situation | Diagram to Draw |
|-----------|----------------|
| "Design a Parking Lot" | **Class diagram** (entities, relationships) |
| "Walk me through the flow" | **Sequence diagram** (object interactions over time) |
| "What are the states of an Order?" | **State machine diagram** |
| "What are the actors and features?" | **Use case diagram** |

> In most LLD interviews, you'll primarily use **class diagrams** and **sequence diagrams**.

---

## 2. <abbr title="Class diagram: shows classes, their fields/methods, and relationships. Used to visualize the static structure of a system.">Class Diagrams</abbr>

Class diagrams show the **static structure** of a system: classes, their attributes, methods, and relationships.

### Notation

```
┌───────────────────────────┐
│       <<ClassName>>       │
├───────────────────────────┤
│ - privateField: Type      │   (-) private
│ # protectedField: Type    │   (#) protected
│ + publicField: Type       │   (+) public
├───────────────────────────┤
│ + publicMethod(): RetType │
│ - privateMethod(): void   │
│ # protectedMethod(): Type │
└───────────────────────────┘
```

### Relationship Arrows

| Arrow | Meaning | Example |
|-------|---------|---------|
| `——————` | Association | Student — Course |
| `◇——————` | Aggregation (has-a, independent) | Team ◇— Player |
| `◆——————` | Composition (has-a, dependent) | Order ◆— LineItem |
| `- - - >` | Dependency (uses) | Service - - -> Logger |
| `——————▷` | Inheritance (extends) | Dog ——▷ Animal |
| `- - - ▷` | Implementation (implements) | Dog - - ▷ Walkable |

### Example: Parking Lot Class Diagram

```
┌──────────────────┐        ┌──────────────────┐
│   ParkingLot     │        │    <<enum>>       │
├──────────────────┤        │   VehicleType     │
│ - name: String   │        ├──────────────────┤
│ - floors: List   │◆───────│ CAR              │
├──────────────────┤        │ TRUCK             │
│ + parkVehicle()  │        │ MOTORCYCLE        │
│ + unparkVehicle()│        └──────────────────┘
└──────────────────┘
        ◆
        │
┌──────────────────┐         ┌──────────────────┐
│  ParkingFloor    │         │   ParkingSpot     │
├──────────────────┤    ◆    ├──────────────────┤
│ - floorNumber    │─────────│ - spotNumber      │
│ - spots: List    │         │ - type: SpotType  │
├──────────────────┤         │ - vehicle: Vehicle│
│ + findAvailable()│         ├──────────────────┤
└──────────────────┘         │ + isAvailable()   │
                             │ + park(Vehicle)   │
                             └──────────────────┘
```

---

## 3. <abbr title="Use case diagram: shows actors (users or external systems) and the actions or goals they can perform within the system boundary.">Use Case Diagrams</abbr>

Use case diagrams identify **actors** (users/systems) and the **actions** they can perform.

### Notation

- **Stick figure** = Actor (user, external system)
- **Oval** = Use case (action/feature)
- **Box** = System boundary

### Example: Library Management System

```
                ┌─────────────────────────────────────┐
                │       Library Management System      │
                │                                      │
  Librarian ────│──── Add Book                         │
       │        │                                      │
       │────────│──── Search Book ────────────── Member │
       │        │                              │       │
       │────────│──── Issue Book ──────────────│       │
                │                              │       │
                │     Return Book ─────────────│       │
                │                              │       │
                │     Pay Fine ────────────────│       │
                │                                      │
                └─────────────────────────────────────┘
```

### Use Case Relationships

| Relationship | Meaning | Example |
|-------------|---------|---------|
| `<<include>>` | Always happens | "Place Order" includes "Validate Payment" |
| `<<extend>>` | Optionally happens | "Place Order" may extend to "Apply Coupon" |
| Generalization | Actor inherits | "Admin" generalizes "User" |

---

## 4. <abbr title="Sequence diagram: shows how objects interact over time, with messages ordered from top to bottom.">Sequence Diagrams</abbr>

Sequence diagrams show **how objects interact over time** — the order of method calls and responses.

### Notation

```
  Actor      Object1      Object2      Object3
    │           │            │            │
    │──call()──>│            │            │
    │           │──method()─>│            │
    │           │            │──query()──>│
    │           │            │<──result───│
    │           │<──return───│            │
    │<──done────│            │            │
```

### Example: ATM Withdrawal Sequence

```
  User         ATM          Bank         Account
   │            │             │             │
   │─insertCard>│             │             │
   │<─askPIN────│             │             │
   │─enterPIN──>│             │             │
   │            │─validatePIN>│             │
   │            │             │─getAccount─>│
   │            │             │<─account────│
   │            │<─pinValid───│             │
   │<─askAmount─│             │             │
   │─enterAmt──>│             │             │
   │            │─withdraw()─>│             │
   │            │             │─debit()────>│
   │            │             │<─success────│
   │            │<─approved───│             │
   │<─cashOut───│             │             │
```

---

## 5. <abbr title="Activity diagram: shows workflow steps, decisions, and parallel paths. Useful for business processes and algorithm flows.">Activity Diagrams</abbr>

Activity diagrams show **workflow/process flow** — similar to flowcharts but with support for parallelism and swim lanes.

### Notation

| Symbol | Meaning |
|--------|---------|
| ● (filled circle) | Start |
| ◉ (bull's eye) | End |
| ▭ (rounded rectangle) | Activity/Action |
| ◇ (diamond) | Decision |
| ═══ (thick bar) | Fork/Join (parallel) |

### Example: Order Processing

```
    ●
    │
    ▼
┌─────────┐     ┌─────────────┐
│ Receive  │────>│  Validate   │
│  Order   │     │   Order     │
└─────────┘     └──────┬──────┘
                       ◇
                      / \
               [valid]   [invalid]
                /           \
    ┌──────────┐        ┌─────────┐
    │  Process │        │  Reject │
    │  Payment │        │  Order  │
    └────┬─────┘        └────┬────┘
         │                   │
    ═════╧═════              ◉
    ║         ║
┌───────┐ ┌───────┐
│ Pack  │ │ Send  │
│ Items │ │ Email │
└───┬───┘ └───┬───┘
    ═════╤═════
         │
    ┌─────────┐
    │  Ship   │
    │  Order  │
    └────┬────┘
         │
         ◉
```

---

## 6. <abbr title="State machine diagram: shows the states an object can be in and how it transitions between those states based on events.">State Machine Diagrams</abbr>

State machine diagrams show **the states an object can be in** and the **transitions** between them.

### Example: Order State Machine

```
                    ┌──────────┐
         ●─────────>│  CREATED │
                    └─────┬────┘
                          │ placeOrder()
                    ┌─────▼────┐
                    │ CONFIRMED│
                    └─────┬────┘
                          │ processPayment()
                     ◇────┤
                    / \   │
           [failed]/   \[success]
                  /     \
         ┌───────▼┐   ┌─▼────────┐
         │ FAILED │   │  PAID    │
         └────────┘   └─────┬────┘
                            │ ship()
                      ┌─────▼────┐
                      │ SHIPPED  │
                      └─────┬────┘
                            │ deliver()
                      ┌─────▼─────┐
                      │ DELIVERED │
                      └───────────┘
```

### Java Implementation of State Machine

```java
public enum OrderState {
    CREATED, CONFIRMED, PAID, SHIPPED, DELIVERED, FAILED, CANCELLED;
}

public class Order {
    private OrderState state = OrderState.CREATED;

    public void confirm() {
        if (state != OrderState.CREATED)
            throw new IllegalStateException("Cannot confirm from " + state);
        this.state = OrderState.CONFIRMED;
    }

    public void pay() {
        if (state != OrderState.CONFIRMED)
            throw new IllegalStateException("Cannot pay from " + state);
        this.state = OrderState.PAID;
    }

    public void ship() {
        if (state != OrderState.PAID)
            throw new IllegalStateException("Cannot ship from " + state);
        this.state = OrderState.SHIPPED;
    }

    public void cancel() {
        if (state == OrderState.SHIPPED || state == OrderState.DELIVERED)
            throw new IllegalStateException("Cannot cancel once shipped");
        this.state = OrderState.CANCELLED;
    }
}
```

---

## 7. Which Diagram to Use When

| Interview Prompt | Primary Diagram | Secondary |
|-----------------|----------------|-----------|
| "Design a Parking Lot" | Class Diagram | Sequence (park/unpark flow) |
| "Walk through user checkout" | Sequence Diagram | Activity (decision flow) |
| "What states can an order be in?" | State Machine | — |
| "What can admins vs users do?" | Use Case | Class Diagram |
| "Design an elevator system" | State Machine + Class | Sequence (request flow) |

---

## 8. Interview Tips

1. **Always start with a class diagram** — Identify entities, attributes, methods, and relationships
2. **Draw sequence diagrams for key flows** — "Let me walk through the happy path"
3. **Keep it clean** — Don't draw every method; focus on the important ones
4. **Label everything** — Arrows need method names, relationships need multiplicity
5. **Use state machines for stateful objects** — Order, Payment, Ticket, Elevator
6. **Don't spend too long on diagrams** — 5-10 minutes max, then move to code
7. **Practice drawing on a whiteboard** — Neatness and speed matter in onsite interviews
