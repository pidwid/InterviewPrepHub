# Dependency Injection & Inversion of Control

> <abbr title="Dependency Injection (DI): pass dependencies into a class rather than creating them inside. Inversion of Control (IoC): the framework controls object creation and lifecycle, calling your code when needed.">Dependency Injection (DI)</abbr> is a design technique where an object receives its dependencies from the outside rather than creating them internally. Inversion of Control (IoC) is the broader principle — you invert who controls the creation and binding of dependencies.

---

## Table of Contents

1. [The Problem: Tight Coupling](#1-the-problem-tight-coupling)
2. [What Is Dependency Injection?](#2-what-is-dependency-injection)
3. [Types of Injection](#3-types-of-injection)
4. [Inversion of Control (IoC)](#4-inversion-of-control-ioc)
5. [DI Containers & Frameworks](#5-di-containers--frameworks)
6. [DI in Practice — Real Examples](#6-di-in-practice--real-examples)
7. [When NOT to Use DI](#7-when-not-to-use-di)
8. [Interview Tips](#8-interview-tips)

---

## 1. The Problem: Tight Coupling

### ❌ Without DI — Hard-Coded Dependencies

```java
public class OrderService {
    private final MySqlDatabase db = new MySqlDatabase(); // hard-coded
    private final EmailNotifier notifier = new EmailNotifier(); // hard-coded

    public void placeOrder(Order order) {
        db.save(order);
        notifier.notify(order.getUserEmail(), "Order placed!");
    }
}
```

**Problems:**
- `OrderService` is permanently tied to `MySqlDatabase` and `EmailNotifier`.
- Can't swap to PostgreSQL or SMS notifications without modifying `OrderService`.
- Can't unit test — every test hits a real database and sends real emails.
- Violates **Open/Closed Principle** and **Dependency Inversion Principle**.

### ✅ With DI — Dependencies Injected

```java
public class OrderService {
    private final Database db;
    private final Notifier notifier;

    // Dependencies injected via constructor
    public OrderService(Database db, Notifier notifier) {
        this.db = db;
        this.notifier = notifier;
    }

    public void placeOrder(Order order) {
        db.save(order);
        notifier.notify(order.getUserEmail(), "Order placed!");
    }
}

// Now we can inject anything that implements the interface:
OrderService prod = new OrderService(new MySqlDatabase(), new EmailNotifier());
OrderService test = new OrderService(new InMemoryDatabase(), new MockNotifier());
```

---

## 2. What Is Dependency Injection?

```
Without DI:                        With DI:

┌──────────────┐                   ┌──────────────┐
│ OrderService │                   │ OrderService │
│              │                   │              │
│ creates ──►MySqlDB              │ uses ──► Database (interface)
│ creates ──►EmailNotifier        │ uses ──► Notifier (interface)
│              │                   │              │
└──────────────┘                   └──────────────┘
  Knows concrete types                 ▲         ▲
  Controls creation                    │         │
                                  Injected     Injected
                                  from outside from outside
```

> **Key Insight:** The class depends on abstractions (interfaces), not concrete implementations. Someone else (the "injector") provides the concrete implementations.

---

## 3. Types of Injection

### Constructor Injection (Preferred)

```java
public class PaymentService {
    private final PaymentGateway gateway;

    public PaymentService(PaymentGateway gateway) { // injected here
        this.gateway = gateway;
    }

    public void processPayment(Payment p) {
        gateway.charge(p);
    }
}
```

**Pros:** Immutable, all dependencies visible, object is always in valid state.
**Cons:** Constructor can get long with many dependencies (smell: class does too much).

### Setter Injection

```java
public class ReportService {
    private Formatter formatter;

    public void setFormatter(Formatter formatter) { // injected here
        this.formatter = formatter;
    }

    public String generateReport(Data data) {
        return formatter.format(data);
    }
}
```

**Pros:** Can change dependency at runtime, optional dependencies.
**Cons:** Object can be in invalid state (formatter is null until set), mutable.

### Interface Injection

```java
public interface FormatterAware {
    void setFormatter(Formatter formatter);
}

public class ReportService implements FormatterAware {
    private Formatter formatter;

    @Override
    public void setFormatter(Formatter formatter) {
        this.formatter = formatter;
    }
}
```

**Pros:** Explicit contract for injection.
**Cons:** Adds interface clutter, rarely used in practice.

### Which to Use?

| Type          | When to Use                           | Recommendation     |
|---------------|---------------------------------------|---------------------|
| Constructor   | Required dependencies                 | Default choice      |
| Setter        | Optional or changeable dependencies   | Use sparingly       |
| Interface     | Framework-level injection contracts   | Rarely needed       |

---

## 4. <abbr title="Inversion of Control (IoC): a design principle where the framework or container controls object creation and calls your code, rather than your code controlling the flow.">Inversion of Control (IoC)</abbr>

> IoC is the principle. DI is one implementation of IoC.

```
Normal Control Flow:
  Your code calls library code.
  
  main() → OrderService → MySqlDatabase.save()
  You control what gets called and when.

Inverted Control Flow (IoC):
  Framework calls your code.
  
  Framework creates OrderService, injects MySqlDatabase,
  calls your placeOrder() when an HTTP request arrives.
  Framework controls the lifecycle.
```

### IoC Techniques

| Technique              | Description                                              |
|------------------------|----------------------------------------------------------|
| Dependency Injection   | Framework/caller provides dependencies to your class     |
| Service Locator        | Class asks a registry for its dependencies               |
| Template Method        | Framework defines algorithm skeleton, you fill in steps  |
| Strategy Pattern       | Framework calls your strategy implementation             |
| Event-Driven / Observer| Framework notifies your listeners                        |

### <abbr title="Service Locator: a global registry that classes query to get dependencies. DI pushes dependencies in, making them explicit and easier to test.">DI vs Service Locator</abbr>

```java
// Service Locator — class pulls its own dependencies
public class OrderService {
    public void placeOrder(Order order) {
        Database db = ServiceLocator.get(Database.class); // pulls
        db.save(order);
    }
}

// DI — dependencies pushed in
public class OrderService {
    private final Database db;
    public OrderService(Database db) { this.db = db; } // pushed
}
```

**DI is preferred** because:
- Dependencies are explicit (visible in constructor).
- Easier to test (just pass mocks).
- Service Locator hides dependencies — hard to know what a class needs.

---

## 5. DI Containers & Frameworks

A DI Container (IoC Container) automates the creation and wiring of objects.

```java
// Spring Framework (Java) — the most popular DI framework
@Component
public class MySqlDatabase implements Database {
    public void save(Object entity) { /* ... */ }
}

@Component
public class EmailNotifier implements Notifier {
    public void notify(String to, String msg) { /* ... */ }
}

@Component
public class OrderService {
    private final Database db;
    private final Notifier notifier;

    @Autowired // Spring injects the right implementations
    public OrderService(Database db, Notifier notifier) {
        this.db = db;
        this.notifier = notifier;
    }
}

// Spring scans for @Component classes, creates instances,
// and wires them together automatically at startup.
```

### Common DI Frameworks

| Language | Framework                  | Annotation         |
|----------|----------------------------|--------------------|
| Java     | Spring, Guice, Dagger      | `@Inject`, `@Autowired` |
| C#       | ASP.NET Core built-in      | Constructor DI     |
| Python   | dependency-injector         | `@inject`          |
| TypeScript | NestJS, InversifyJS      | `@Injectable()`    |

---

## 6. DI in Practice — Real Examples

### Testing with DI

```java
// Production: real database and real email
OrderService prodService = new OrderService(
    new PostgresDatabase(prodConfig),
    new SmtpEmailNotifier(smtpConfig)
);

// Unit test: mock everything
@Test
void testPlaceOrder() {
    Database mockDb = mock(Database.class);
    Notifier mockNotifier = mock(Notifier.class);

    OrderService service = new OrderService(mockDb, mockNotifier);
    service.placeOrder(testOrder);

    verify(mockDb).save(testOrder);
    verify(mockNotifier).notify(any(), any());
}
// No real DB, no real email — fast, isolated, deterministic.
```

### Strategy Pattern + DI

```java
public interface PricingStrategy {
    double calculatePrice(Order order);
}

public class RegularPricing implements PricingStrategy { /* ... */ }
public class PremiumPricing implements PricingStrategy { /* ... */ }
public class HolidaySalePricing implements PricingStrategy { /* ... */ }

public class CheckoutService {
    private final PricingStrategy pricing;

    public CheckoutService(PricingStrategy pricing) {
        this.pricing = pricing; // injected — swap strategies easily
    }
}
```

---

## 7. When NOT to Use DI

| Situation                                | Why DI is overkill                          |
|------------------------------------------|--------------------------------------------|
| Simple scripts / small programs          | Adds unnecessary abstraction               |
| Value objects (Point, Money, Date)       | These are data, not services               |
| Utility classes (Math, StringUtils)      | Stateless, no dependencies to inject       |
| Performance-critical inner loops         | Interface dispatch has minor overhead      |

> **Rule of thumb:** Use DI for services/components that have behavior and dependencies. Don't use DI for data objects or pure functions.

---

## 8. Interview Tips

| Tip | Details |
|-----|---------|
| Always prefer constructor injection | Shows dependencies clearly, enables immutability |
| Depend on abstractions, not concretions | This is the D in SOLID (Dependency Inversion Principle) |
| DI makes testing trivial | Swap real implementations for mocks — this is a major selling point |
| Name the pattern when you use it | "I'll inject a PricingStrategy so we can swap algorithms" |
| Don't over-inject | If a class has 10 constructor params, it probably does too much — split it |
| Know the difference: DI vs IoC vs Service Locator | IoC is the principle, DI is the technique, Service Locator is an alternative |
