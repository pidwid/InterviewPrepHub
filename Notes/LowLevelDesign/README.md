# Low-Level Design Study Guide

> A comprehensive, structured guide for Low-Level Design (LLD) / Object-Oriented Design (OOD) interviews at the **Senior Engineer / Staff Engineer** level.
> Each topic file is self-contained: concepts in plain English, code examples in Java, UML/Mermaid diagrams, design-pattern call-outs, and concurrency/edge-case discussion.

---

## How to Use This Guide

1. **Foundations first.** Read the numbered `LLD-01` … `LLD-14` topic files in order — they build on each other (OOP → relationships → SOLID → patterns → concurrency).
2. **Then practice.** The `Solutions/` folder contains 90+ worked LLD problems (parking lot, vending machine, chess, LRU cache, payment gateway, …) following a standard 7-section template: Requirements → Core Entities → Class Diagram → Key Methods → Design Patterns → Concurrency & Edge Cases → Sources / Cross-Refs.
3. **Quick refresher.** Use the [LLD Interview Cheat Sheet](LLD-10-Interview-Cheat-Sheet.md) for a final review the night before your interview — it has the 5-step LLD framework, the GoF pattern catalog at a glance, and a "common mistakes" checklist.
4. **Format.** Every solution file is structured the same way so you can pattern-match quickly during prep. Solutions cite real sources (GoF book pages, OpenJDK source, Stripe / Netflix / Apache docs, named papers).

---

## Table of Contents

### Part 1: OOP & Design Foundations

| # | Topic | File |
|---|-------|------|
| 01 | OOP Fundamentals (encapsulation, inheritance, polymorphism, abstraction) | [LLD-01-OOP-Fundamentals.md](LLD-01-OOP-Fundamentals.md) |
| 02 | Class Relationships (association, aggregation, composition, dependency) | [LLD-02-Class-Relationships.md](LLD-02-Class-Relationships.md) |
| 03 | SOLID Principles | [LLD-03-SOLID-Principles.md](LLD-03-SOLID-Principles.md) |
| 04 | Other Design Principles (DRY, KISS, YAGNI, Law of Demeter) | [LLD-04-Design-Principles.md](LLD-04-Design-Principles.md) |
| 05 | UML Diagrams (class, sequence, state) | [LLD-05-UML-Diagrams.md](LLD-05-UML-Diagrams.md) |
| 11 | Dependency Injection | [LLD-11-Dependency-Injection.md](LLD-11-Dependency-Injection.md) |

### Part 2: Design Patterns (GoF)

| # | Topic | File |
|---|-------|------|
| 06 | Creational Patterns (Singleton, Factory, Abstract Factory, Builder, Prototype) | [LLD-06-Creational-Patterns.md](LLD-06-Creational-Patterns.md) |
| 07 | Structural Patterns (Adapter, Decorator, Facade, Composite, Proxy, Bridge, Flyweight) | [LLD-07-Structural-Patterns.md](LLD-07-Structural-Patterns.md) |
| 08 | Behavioral Patterns (Strategy, Observer, State, Command, Iterator, Template, Chain of Responsibility, Visitor, Memento, Mediator, Interpreter) | [LLD-08-Behavioral-Patterns.md](LLD-08-Behavioral-Patterns.md) |
| 13 | Architectural Patterns (MVC, MVP, MVVM, Layered, Hexagonal/Ports & Adapters, Event-Driven) | [LLD-13-Architectural-Patterns.md](LLD-13-Architectural-Patterns.md) |
| 14 | When *Not* to Use Patterns (avoiding over-engineering) | [LLD-14-When-Not-To-Use-Patterns.md](LLD-14-When-Not-To-Use-Patterns.md) |

### Part 3: Concurrency & Multi-threading

| # | Topic | File |
|---|-------|------|
| 09 | Concurrency Fundamentals (threads, locks, mutex, semaphores, deadlock) | [LLD-09-Concurrency.md](LLD-09-Concurrency.md) |
| 12 | Concurrency Deep Dive (`ConcurrentHashMap`, `BlockingQueue`, atomic primitives, JMM, happens-before) | [LLD-12-Concurrency-Deep-Dive.md](LLD-12-Concurrency-Deep-Dive.md) |

### Quick Reference

| Resource | File |
|---|---|
| **LLD Interview Cheat Sheet** (read this before your interview) | [LLD-10-Interview-Cheat-Sheet.md](LLD-10-Interview-Cheat-Sheet.md) |

### Worked Solutions (Solutions/)

90+ end-to-end problem write-ups, organized by difficulty in the app sidebar. Examples:
- **Easy / classic OOD**: Parking Lot, Vending Machine, Coffee Vending, Tic-Tac-Toe, Snake & Ladder, Logging Framework, Traffic Signal, Stack Overflow, Task Management.
- **Medium**: Elevator, ATM, LRU Cache, Pub/Sub, Hotel Management, Library, LinkedIn, Meeting Room, Task Scheduler, Connect Four, Movie Booking, Splitwise, Ride Sharing.
- **Hard / staff-level**: Chess, Amazon, API Rate Limiter, In-Memory Cache, Distributed ID, Stripe Payment Processor, Order Matching Engine, Versioned Document Store, Distributed Counter, Notification Throttler.
- **Concurrency**: Blocking Queue, TTL Cache, Concurrent HashMap, Thread Pool, Connection Pool, Read-Write Lock, Producer-Consumer, FizzBuzz / FooBar / Zero-Even-Odd / H2O (LeetCode multi-thread set).
- **OOD (CTCI)**: Parking Lot, Deck of Cards, Hashmap, LRU Cache, Call Center, Chat Server, Circular Array.

Browse them in the **Categories** or **Practice** tabs of the app, or directly under [Solutions/](Solutions/).

---

## Suggested Study Order

### If you have 1 week (Tier 1 only)
Foundations: 01 → 03 → 05 → 06 → 07 → 08 → Cheat Sheet
Practice: Parking Lot → Vending Machine → Elevator → LRU Cache → Tic-Tac-Toe.

### If you have 2 weeks
Add: 02 → 11 → Solution-Hashmap, Solution-Thread-Pool, Solution-Stripe-Payment, Solution-Distributed-Counter, Solution-Notification-Throttler, plus 09 (Concurrency).

### If you have 1 month
Add: 04 (DRY/KISS/YAGNI) → 12 (Concurrency Deep Dive) → 14 (When not to use patterns) →
Practice: Pub/Sub, Coffee Vending, API Rate Limiter, Chess, Distributed ID, In-Memory Cache, Blocking Queue, Concurrent HashMap, Order Matching, Versioned Document Store.

### If you have 2+ months (full coverage)
Add: 13 (Architectural Patterns) and the remaining hard / specialized solutions (Online Auction, Spreadsheet, Spotify, Inventory, Food Delivery, Calendar, Card Game, Course Registration, Logistics, Cricinfo, Survey, Voting System, Restaurant, Bowling Alley, Truecaller, Concert Booking, ECommerce-Review, Stock Brokerage, Digital Wallet, JSON Parser, Text Editor, Merge Sort, FSM, Home Automation, In-Memory FS, In-Memory DB, Config Management, Connection Pool, Snake & Ladder, Bloom Filter, Amazon Locker, Car Rental).

---

## Key Principles to Remember

1. **Patterns are tools, not goals.** Don't shoehorn a Visitor into a 50-line problem. The interviewer cares whether the design *fits*, not whether it name-checks every GoF pattern.
2. **State the trade-offs.** "I'm using a HashMap for O(1) lookup at the cost of unordered iteration" lands far better than just picking a HashMap silently.
3. **Encapsulate state transitions.** Anywhere you find yourself writing `if (state == X)` repeatedly, reach for the **State** pattern.
4. **Concurrency is opt-in.** Start single-threaded, then add `synchronized` / `ReentrantLock` / `ConcurrentHashMap` / atomics only where the requirements force it. Premature locking causes more bugs than it prevents.
5. **Composition over inheritance.** Deep inheritance hierarchies are brittle; favor interfaces + composition. (Effective Java, Item 18.)
6. **Make invalid states unrepresentable.** Type the model so bad transitions don't compile (e.g., separate `Authorized` and `Captured` types for a payment instead of one `Payment` with a status enum).
7. **Code the "happy path" first, then ask about edge cases.** Interviewers love to interrupt with "what if X fails?" — leave time for that.
