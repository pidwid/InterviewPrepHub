# LLD Interview Cheat Sheet

> Quick-reference guide for Low-Level Design interviews. Use this as a final review before your interview.

---

## Table of Contents

1. [LLD Interview Framework](#1-lld-interview-framework)
2. [OOP Quick Reference](#2-oop-quick-reference)
3. [SOLID Quick Reference](#3-solid-quick-reference)
4. [Design Patterns Quick Reference](#4-design-patterns-quick-reference)
5. [Common Class Relationships](#5-common-class-relationships)
6. [Concurrency Checklist](#6-concurrency-checklist)
7. [Problem-Solving Template](#7-problem-solving-template)
8. [Common Mistakes](#8-common-mistakes)

---

## 1. LLD Interview Framework

Follow this **5-step approach** for every LLD question:

| Step | Action | Time |
|------|--------|------|
| **1. Clarify Requirements** | Ask questions, define scope, list use cases | 3-5 min |
| **2. Identify Core Entities** | Nouns = classes, Verbs = methods | 3-5 min |
| **3. Define Relationships** | Inheritance, composition, association | 2-3 min |
| **4. Draw Class Diagram** | Classes, methods, relationships, interfaces | 5-10 min |
| **5. Write Key Code** | Focus on core logic, patterns, data structures | 15-20 min |

### Requirements Gathering Checklist

- What are the main **actors/users**?
- What are the core **use cases**?
- What are the **constraints**? (Concurrency? Scale? Real-time?)
- Should we handle **edge cases**? (Error handling, validation)
- Any **non-functional requirements**? (Thread safety, extensibility)

---

## 2. OOP Quick Reference

| Pillar | One-liner | Interview Signal |
|--------|-----------|-----------------|
| **Encapsulation** | Private fields + public methods | "Data hiding" |
| **Abstraction** | Interface defines what, impl defines how | "Program to interfaces" |
| **Inheritance** | Child extends parent's behavior | "IS-A relationship" |
| **Polymorphism** | Same method, different behavior per type | "Runtime dispatch" |

**Default rule**: Fields = private, Methods = public, Use interfaces.

---

## 3. SOLID Quick Reference

| Principle | Quick Test |
|-----------|-----------|
| **SRP** | Can you describe the class in one sentence without "and"? |
| **OCP** | Can you add a new type without modifying existing code? |
| **LSP** | Can you replace parent with child without breaking anything? |
| **ISP** | Does any implementor have empty/dummy methods? |
| **DIP** | Does your business logic reference concrete classes? |

---

## 4. Design Patterns Quick Reference

### Creational

| Pattern | When | Signal |
|---------|------|--------|
| **Singleton** | One instance globally | Config, Logger, Pool |
| **Factory** | Type decided at runtime | "Create different types of X" |
| **Abstract Factory** | Family of related objects | UI themes, cross-platform |
| **Builder** | Many optional parameters | Complex object construction |
| **Prototype** | Clone cheaper than create | Template objects |

### Structural

| Pattern | When | Signal |
|---------|------|--------|
| **Adapter** | Incompatible interfaces | Third-party integration |
| **Decorator** | Add behavior dynamically | Middleware, I/O streams |
| **Facade** | Simplify complex subsystem | Service orchestration |
| **Composite** | Tree structure | File system, menus |
| **Proxy** | Control access | Caching, auth, lazy loading |

### Behavioral

| Pattern | When | Signal |
|---------|------|--------|
| **Strategy** | Swap algorithms | Payment, sorting, discounts |
| **Observer** | Notify on changes | Events, pub-sub |
| **State** | Behavior varies by state | Order lifecycle, vending machine |
| **Command** | Undo/queue actions | Text editor, transactions |
| **Chain of Resp.** | Pipeline of handlers | Middleware, validation |

---

## 5. Common Class Relationships

| Scenario | Relationship |
|----------|-------------|
| Car → Engine | **Composition** (engine can't exist without car) |
| University → Student | **Aggregation** (student exists independently) |
| Order → Payment | **Association** (knows about, independent) |
| Service → Logger | **Dependency** (uses temporarily) |
| Dog → Animal | **Inheritance** (IS-A) |
| Dog → Walkable | **Implementation** (CAN-DO) |

---

## 6. Concurrency Checklist

- [ ] Identified **shared mutable state**
- [ ] Chose synchronization: `synchronized` / `ReentrantLock` / `Atomic*`
- [ ] Used `try-finally` for lock release
- [ ] Checked for **deadlock** potential (lock ordering)
- [ ] Thread pool size: CPU-bound = `N_cores`, I/O-bound = `N_cores * 2+`
- [ ] Used `BlockingQueue` for producer-consumer
- [ ] Made immutable objects where possible

---

## 7. Problem-Solving Template

```java
// Step 1: Define the core interface
public interface PaymentProcessor {
    PaymentResult process(Payment payment);
}

// Step 2: Define enums for fixed values
public enum PaymentStatus {
    PENDING, COMPLETED, FAILED, REFUNDED
}

// Step 3: Define data models  
public class Payment {
    private final String id;
    private final double amount;
    private final PaymentMethod method;
    private PaymentStatus status;
    
    // Builder pattern if many fields
    // Private constructor + getters
}

// Step 4: Implement with patterns
public class CreditCardProcessor implements PaymentProcessor {
    @Override
    public PaymentResult process(Payment payment) { ... }
}

// Step 5: Orchestrate via service (Facade)
public class PaymentService {
    private final Map<PaymentMethod, PaymentProcessor> processors;
    private final PaymentRepository repository;
    private final NotificationService notifier;
    
    public PaymentResult processPayment(Payment payment) {
        PaymentProcessor processor = processors.get(payment.getMethod());
        PaymentResult result = processor.process(payment);
        repository.save(payment);
        notifier.notify(payment.getUserId(), result);
        return result;
    }
}
```

---

## 8. Common Mistakes

| Mistake | Fix |
|---------|-----|
| God class doing everything | Split by responsibility (SRP) |
| `if/else` chain for types | Use Strategy or Factory pattern |
| Public fields | Make private + getters/setters |
| Hardcoded dependencies | Inject via constructor (DIP) |
| No interfaces | Define contracts before implementations |
| Ignoring concurrency | Identify shared state, add synchronization |
| Over-engineering | YAGNI — don't build what isn't asked |
| No enums for fixed values | Use enums for status, type, direction |
