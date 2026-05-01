# When NOT To Use Design Patterns

> Applying patterns for the sake of using a pattern is the most-cited senior interview red flag. KISS is the most violated principle in LLD interviews. Start simple; add structure only when simplicity stops working.

---

## Table of Contents

1. [The Universal Rule: YAGNI](#1-the-universal-rule-yagni-you-arent-gonna-need-it)
2. [Anti-Pattern Cheat Sheet](#2-anti-pattern-cheat-sheet)
3. [The Five Most Misused Patterns](#3-the-five-most-misused-patterns)
4. [Smell-Driven Refactoring](#4-smell-driven-refactoring-the-right-direction)
5. [Senior Interview Heuristic](#5-senior-interview-heuristic)
6. ["I'll Add It Later" Defense](#6-the-ill-add-it-later-defense)
7. [Self-Check Before Adding a Pattern](#7-quick-self-check-before-adding-a-pattern)

---

## 1. The Universal Rule: YAGNI (You Aren't Gonna Need It)

Before introducing any pattern, ask:
1. **Does the current code have a real pain point?** (duplication, conditional explosion, hard to test, hard to extend)
2. **Will the pattern reduce that pain *measurably*?**
3. **Is the cost of indirection (extra classes, harder to read) worth the benefit?**

If you can't answer "yes" to all three, **don't use the pattern**.

---

## 2. Anti-Pattern Cheat Sheet

| Pattern | When NOT to Use | Why It's Wrong | Use Instead |
|---------|----------------|----------------|-------------|
| **Singleton** | Anywhere you can pass it as a parameter | Hidden dependency, untestable, breaks DI, global mutable state | Dependency Injection |
| **Singleton** | Multi-threaded if you didn't think about it | Race in lazy init, false sharing | `enum` singleton in Java; class-level lock or DI |
| **Factory** | Only one concrete type and no plans for more | Pure ceremony; class explosion | Plain `new` |
| **Abstract Factory** | Single product family | Over-engineered Factory | Simple Factory or `new` |
| **Builder** | < 4 constructor params, no optional fields | Boilerplate that hurts readability | Constructor or named-arg language |
| **Prototype** | Object construction is cheap | Wasted complexity | `new` or copy constructor |
| **Adapter** | You control both sides | Extra layer for nothing | Just change the interface |
| **Bridge** | Hierarchy isn't actually 2-dimensional | Speculative abstraction | Plain inheritance |
| **Composite** | Tree depth = 1 (just a list) | Misuse of recursion | List/iteration |
| **Decorator** | Adds *one* responsibility, won't compose | Wrapper that's never wrapped | Plain subclass or method |
| **Facade** | Underlying API is already simple | Adds a class that just delegates | Use the API directly |
| **Flyweight** | Object count is small or memory isn't tight | Premature optimization | Plain objects |
| **Proxy** | No cross-cutting concern (caching/logging/access) | Indirection without purpose | Direct call |
| **Strategy** | Only one algorithm exists and it won't change | Pattern theater | Inline method or function |
| **Observer** | Synchronous, single subscriber | Complexity for no benefit | Direct method call |
| **Command** | No undo, no queueing, no logging needed | Method-as-class for no reason | Just call the method |
| **Iterator** | Language has built-in iteration | Wheel reinvention | `for-each`, generators |
| **State** | Only 2-3 states with simple transitions | Overhead exceeds benefit | Enum + switch |
| **Chain of Responsibility** | Order is fixed and known | Complexity without flexibility | Sequential method calls |
| **Mediator** | Few components, simple interactions | Centralizes accidental complexity | Direct references |
| **Memento** | No undo/restore needed | Memory cost without payoff | Don't snapshot |
| **Visitor** | Object hierarchy changes more than operations | Adding a class becomes nightmarish | Polymorphism on the hierarchy |
| **Template Method** | Base class is abstract for one subclass | Inheritance that means nothing | Composition + Strategy |

---

## 3. The Five Most Misused Patterns

### #1 Singleton — The "Anti-Pattern of Patterns"

```java
// ❌ Bad
class Logger {
    private static Logger instance = new Logger();
    public static Logger getInstance() { return instance; }
}
class OrderService { void place() { Logger.getInstance().log("..."); } }
```

```java
// ✅ Good — inject it
class OrderService {
    private final Logger logger;
    OrderService(Logger logger) { this.logger = logger; }
    void place() { logger.log("..."); }
}
```

You can still wire a single instance via your DI container — but the *code* doesn't know it's a singleton, and it's testable.

### #2 Factory When You Have One Type

```java
// ❌ Bad
class ButtonFactory {
    Button create() { return new Button(); }
}
```

If you're never going to return anything other than `Button`, just say `new Button()`.

### #3 Builder for Simple Constructors

```java
// ❌ Bad
User u = new User.Builder().setName("Alice").setAge(30).build();
```

When the object has 2-3 required fields, a constructor is fine:

```java
// ✅ Good
User u = new User("Alice", 30);
```

Builders shine when you have **5+ params, many optional**, or need immutability with a complex assembly.

### #4 Strategy for One Algorithm

```java
// ❌ Bad
interface PricingStrategy { Money price(Item i); }
class StandardPricing implements PricingStrategy { ... }
// ... no other implementations exist
```

If there's only one pricing rule, just write a method. Introduce Strategy when you actually have a second strategy or you want to test by injecting a mock.

### #5 Observer When You Need a Method Call

```java
// ❌ Bad — using event bus for synchronous one-listener case
eventBus.publish(new OrderPlacedEvent(order));
// ...elsewhere
@Subscribe void on(OrderPlacedEvent e) { sendEmail(e.order); }
```

Decoupling has a real cost in debuggability. If you have one synchronous handler, just call `emailService.send(order)`.

---

## 4. Smell-Driven Refactoring (the Right Direction)

Patterns should emerge from **smells**, not be planned upfront:

| Smell | Likely Pattern |
|-------|----------------|
| Long if-else chain on a type code | Strategy or Polymorphism |
| Switch on `state` field | State |
| Repeated wrapping (`new Loggable(new Caching(new Real()))` is fine; doing it ad-hoc isn't) | Decorator |
| Code duplicated across families of classes | Template Method |
| Many fine-grained classes that need creation choreography | Builder or Factory |
| Many small objects, lots of memory | Flyweight |
| Need undo/redo or audit | Command + Memento |
| Subsystem too painful to call | Facade |
| Object hierarchy needs new operations often | Visitor (with caveats) |

**Rule**: refactor TOWARD a pattern when you feel pain. Don't write code in patterns.

---

## 5. Senior Interview Heuristic

When the interviewer asks "Why did you use the X pattern?":

✅ Good answer: *"Because I have three pricing rules that vary independently and I want to A/B test them. Strategy lets me swap them at runtime and test each in isolation."*

❌ Bad answer: *"Because Strategy is a behavioral pattern that encapsulates algorithms."*

The first shows engineering judgment; the second shows you read a book.

---

## 6. The "I'll Add It Later" Defense

Don't pre-build for hypothetical future needs. **Patterns are easy to add when you actually need them** — the refactor is local. The cost of premature patterns is paid every day in:
- More files to navigate.
- More indirection to follow.
- Harder onboarding for new engineers.
- Slower IDE go-to-definition.

---

## 7. Quick Self-Check Before Adding a Pattern

- [ ] Does production code already have the pain this pattern solves?
- [ ] Have I tried the simpler approach first?
- [ ] Will adding this pattern make tests easier or harder?
- [ ] Could a junior engineer understand why this pattern is here?
- [ ] If I removed the pattern tomorrow, would the codebase get worse?

If you can't tick all five boxes, drop the pattern.
