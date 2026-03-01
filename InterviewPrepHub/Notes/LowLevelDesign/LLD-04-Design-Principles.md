# Design Principles (DRY, KISS, YAGNI)

> Beyond SOLID, these pragmatic principles guide everyday coding decisions. They help you write clean, maintainable, and simple code that avoids over-engineering.

---

## Table of Contents

1. [DRY — Don't Repeat Yourself](#1-dry--dont-repeat-yourself)
2. [KISS — Keep It Simple, Stupid](#2-kiss--keep-it-simple-stupid)
3. [YAGNI — You Aren't Gonna Need It](#3-yagni--you-arent-gonna-need-it)
4. [Composition over Inheritance](#4-composition-over-inheritance)
5. [Law of Demeter (LoD)](#5-law-of-demeter-lod)
6. [Principle Comparison](#6-principle-comparison)
7. [Interview Tips](#7-interview-tips)

---

## 1. DRY — Don't Repeat Yourself

> **Every piece of knowledge must have a single, unambiguous, authoritative representation in a system.**

### ❌ Violation

```java
public class OrderService {
    public double calculateTotal(List<Item> items) {
        double total = items.stream().mapToDouble(i -> i.price * i.qty).sum();
        double tax = total * 0.08;  // Tax logic duplicated
        return total + tax;
    }
}

public class InvoiceService {
    public String generateInvoice(List<Item> items) {
        double total = items.stream().mapToDouble(i -> i.price * i.qty).sum();
        double tax = total * 0.08;  // Same tax logic here!
        return "Total: $" + (total + tax);
    }
}
```

### ✅ Fixed

```java
public class TaxCalculator {
    private static final double TAX_RATE = 0.08;

    public static double calculateTax(double subtotal) {
        return subtotal * TAX_RATE;
    }

    public static double calculateTotal(List<Item> items) {
        double subtotal = items.stream().mapToDouble(i -> i.price * i.qty).sum();
        return subtotal + calculateTax(subtotal);
    }
}
```

### DRY ≠ No Duplication

- DRY is about **knowledge duplication**, not just code duplication
- Two functions with similar code but **different reasons to change** are NOT DRY violations
- Over-applying DRY can lead to **premature abstraction** — sometimes a little repetition is fine

---

## 2. KISS — Keep It Simple, Stupid

> **The simplest solution that works is usually the best.**

### ❌ Over-engineered

```java
public class StringReverserFactory {
    public static StringReverser createReverser(String strategy) {
        if ("recursive".equals(strategy))
            return new RecursiveReverser();
        else if ("iterative".equals(strategy))
            return new IterativeReverser();
        throw new IllegalArgumentException("Unknown strategy: " + strategy);
    }
}

public class RecursiveReverser implements StringReverser {
    public String reverse(String s) {
        if (s.length() <= 1) return s;
        return reverse(s.substring(1)) + s.charAt(0);
    }
}
```

### ✅ Simple

```java
public static String reverseString(String s) {
    return new StringBuilder(s).reverse().toString();
}
```

### KISS Guidelines

| Do | Don't |
|----|-------|
| Use built-in data structures | Create custom collections for simple needs |
| Write straightforward loops | Nest ternaries 3 levels deep |
| Use simple if/else for 2-3 cases | Build a strategy pattern for 2 cases |
| Name variables clearly | Use single-letter names or abbreviations |

---

## 3. YAGNI — You Aren't Gonna Need It

> **Don't implement something until it is actually needed.**

### ❌ Premature Generalization

```java
public class UserRepository {
    private final Object db;

    // "We might need MongoDB support someday!"
    public UserRepository(String dbType) {
        if ("postgresql".equals(dbType))
            this.db = new PostgreSQL();
        else if ("mongodb".equals(dbType))      // Nobody asked for this
            this.db = new MongoDB();
        else if ("cassandra".equals(dbType))    // Why?
            this.db = new Cassandra();
        else throw new IllegalArgumentException();
    }
}
```

### ✅ Build What You Need

```java
public class UserRepository {
    private final Database db;

    public UserRepository(Database db) {
        this.db = db;  // Extensible via DIP, but only implemented for PostgreSQL now
    }
}
```

### YAGNI Checklist

- ✅ Build what the requirements ask for **today**
- ✅ Make code **easy to extend** later (via DIP, interfaces)
- ❌ Don't build **features nobody asked for**
- ❌ Don't add **abstract layers** for hypothetical future needs
- ❌ Don't create **configuration options** nobody will configure

---

## 4. Composition over Inheritance

> **Prefer "has-a" over "is-a" relationships. Compose behavior from small, focused objects rather than inheriting from a deep class hierarchy.**

### ❌ Inheritance-heavy Design

```java
public class Animal {
    public void eat() { System.out.println("Eating"); }
}

public class FlyingAnimal extends Animal {
    public void fly() { System.out.println("Flying"); }
}

public class SwimmingAnimal extends Animal {
    public void swim() { System.out.println("Swimming"); }
}

// Duck flies AND swims — can't extend both in Java!
// Multiple inheritance not supported:
// public class Duck extends FlyingAnimal, SwimmingAnimal { }  // WON'T COMPILE
```

### ✅ Composition-based Design

```java
public interface FlyBehavior {
    void fly();
}

public interface SwimBehavior {
    void swim();
}

public class CanFly implements FlyBehavior {
    public void fly() { System.out.println("Flying"); }
}

public class CanSwim implements SwimBehavior {
    public void swim() { System.out.println("Swimming"); }
}

public class Duck {
    private final FlyBehavior flyBehavior = new CanFly();
    private final SwimBehavior swimBehavior = new CanSwim();

    public void fly() { flyBehavior.fly(); }
    public void swim() { swimBehavior.swim(); }
}
```

### When to Use Inheritance vs Composition

| Use Inheritance When | Use Composition When |
|---------------------|---------------------|
| True "IS-A" relationship | "HAS-A" or "CAN-DO" relationship |
| Shared implementation needed | Need to combine multiple behaviors |
| Stable, shallow hierarchy (1-2 levels) | Deep or changing hierarchy |
| Framework requires it (e.g., Android Activity) | Runtime flexibility needed |

---

## 5. Law of Demeter (LoD)

> **"Don't talk to strangers."** A method should only call methods on: itself, its parameters, objects it creates, or its direct fields.

### ❌ Violation — Train Wreck

```java
// Reaching deep into object chains
String city = order.getCustomer().getAddress().getCity();
```

### ✅ Fixed — Tell, Don't Ask

```java
// Delegate to the direct collaborator
String city = order.getShippingCity();

public class Order {
    public String getShippingCity() {
        return customer.getShippingCity();
    }
}

public class Customer {
    public String getShippingCity() {
        return address.getCity();
    }
}
```

---

## 6. Principle Comparison

| Principle | Focus | Risk of Over-applying |
|-----------|-------|----------------------|
| **DRY** | Eliminate knowledge duplication | Premature abstraction, tight coupling |
| **KISS** | Simplicity | Under-engineering for complex problems |
| **YAGNI** | Build only what's needed | Not planning for obvious extensibility |
| **Composition > Inheritance** | Flexibility via composition | More boilerplate, indirection |
| **Law of Demeter** | Reduce coupling | Many wrapper/delegate methods |

### Finding Balance

These principles sometimes **conflict**:
- Making code DRY can violate KISS (abstracting too much)
- YAGNI says don't build, but DIP says depend on abstractions
- **Resolution**: Apply principles **pragmatically**, not dogmatically

---

## 7. Interview Tips

1. **Name principles when you apply them** — "I'm keeping this simple per KISS" shows awareness
2. **Don't over-engineer** — In a 45-minute interview, YAGNI is your friend
3. **Composition over inheritance** — Default to composition; use inheritance only for true IS-A
4. **If asked "how would you extend this?"** — Show OCP compliance, not YAGNI violations
5. **Trade-off discussions** — "I could make this more DRY, but it would add complexity. For now, KISS wins."
