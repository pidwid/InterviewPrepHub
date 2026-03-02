# OOP Fundamentals

> Object-Oriented Programming is the foundation of all low-level design. Mastering classes, objects, and the four pillars — encapsulation, abstraction, inheritance, and polymorphism — is essential before tackling design patterns or system modeling.

---

## Table of Contents

1. [Classes and Objects](#1-classes-and-objects)
2. [Enums](#2-enums)
3. [Interfaces](#3-interfaces)
4. [Encapsulation](#4-encapsulation)
5. [Abstraction](#5-abstraction)
6. [Inheritance](#6-inheritance)
7. [Polymorphism](#7-polymorphism)
8. [The Four Pillars Summary](#8-the-four-pillars-summary)
9. [Interview Tips](#9-interview-tips)

---

## 1. Classes and Objects

A **class** is a blueprint that defines the structure (fields) and behavior (methods) of a type. An **object** is a concrete instance of a class.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Class** | Template defining fields + methods |
| **Object** | Runtime instance created from a class |
| **<abbr title="Constructor: a special method that runs when you create a new object, used to initialize fields.">Constructor</abbr>** | Special method called at object creation |
| **`this` / `self`** | Reference to the current instance |
| **<abbr title="Static members: fields or methods that belong to the class itself, shared by all instances (not per-object).">Static members</abbr>** | Belong to the class itself, not instances |

### Example

```java
public class BankAccount {
    private String owner;
    private double balance;

    public BankAccount(String owner, double balance) {
        this.owner = owner;
        this.balance = balance;
    }

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException();
        this.balance += amount;
    }

    public double getBalance() { return balance; }
}
```

### When to Create a Class

- When you need to model a **real-world entity** (User, Order, Vehicle)
- When you need to **group data with behavior** that operates on it
- When the same structure appears **multiple times** in your code

---

## 2. Enums

Enums represent a **fixed set of named constants**. They make code more readable and prevent invalid values.

```java
public enum OrderStatus {
    PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED;
}
```

### When to Use Enums

| Use Case | Example |
|----------|---------|
| Status codes | `OrderStatus.PENDING` |
| Types / categories | `VehicleType.SUV` |
| Directions / positions | `Direction.NORTH` |
| Configuration options | `LogLevel.DEBUG` |

### Enum vs Constants

- Enums are **type-safe** — you can't pass an arbitrary string where an enum is expected
- Enums are **self-documenting** — IDE autocomplete shows valid values
- Enums can have **associated behavior** (methods) in Java/Python

---

## 3. Interfaces

An **interface** defines a contract — a set of method signatures that implementing classes must provide. Interfaces enable **programming to abstractions**, not implementations.

```java
public interface PaymentProcessor {
    boolean charge(double amount);
    boolean refund(String transactionId);
}

public class StripeProcessor implements PaymentProcessor {
    @Override
    public boolean charge(double amount) { /* Stripe API call */ }
    @Override
    public boolean refund(String txnId) { /* Stripe refund */ }
}
```

### Interface vs Abstract Class

| Feature | Interface | Abstract Class |
|---------|-----------|---------------|
| Multiple inheritance | Yes (implement many) | No (extend one) |
| Instance fields | No (Java) / N/A | Yes |
| Constructor | No | Yes |
| Default methods | Yes (Java 8+) | Yes |
| Use when | Defining a **capability** | Sharing **common implementation** |

---

## 4. <abbr title="Encapsulation: bundling data with the methods that operate on it, while hiding internal state behind a public API.">Encapsulation</abbr>

Encapsulation is **bundling data and the methods that operate on that data** together, while **restricting direct access** to internal state.

### The Three Levels

| Access | Java Keyword | Python Convention | Meaning |
|--------|-------------|-------------------|---------|
| Public | `public` | `method()` | Accessible everywhere |
| Protected | `protected` | `_method()` | Accessible in subclasses |
| Private | `private` | `__method()` | Accessible only within the class |

### Why Encapsulation Matters

1. **Controlled access** — Validate data before setting (e.g., balance can't be negative)
2. **Hide complexity** — Internal data structures can change without breaking callers
3. **Maintainability** — Single place to add logging, validation, caching

```java
public class Temperature {
    private double celsius;

    public Temperature(double celsius) {
        setCelsius(celsius);
    }

    public double getCelsius() { return celsius; }

    public void setCelsius(double value) {
        if (value < -273.15)
            throw new IllegalArgumentException("Below absolute zero");
        this.celsius = value;
    }

    public double getFahrenheit() {
        return celsius * 9.0 / 5 + 32;
    }
}
```

### Encapsulation Checklist

- ✅ Make fields **private** by default
- ✅ Provide **getters/setters** only when needed
- ✅ **Validate** in setters
- ✅ Return **copies** of mutable collections, not references
- ❌ Don't expose internal data structures

---

## 5. <abbr title="Abstraction: exposing only the essential behavior while hiding implementation details.">Abstraction</abbr>

Abstraction is about **exposing only what is necessary** and hiding the implementation details. It answers: *"What does this do?"* without revealing *"How does it do it?"*

### Abstraction vs Encapsulation

| Aspect | Encapsulation | Abstraction |
|--------|--------------|-------------|
| Focus | **Hiding data** | **Hiding complexity** |
| Mechanism | Access modifiers, getters/setters | Interfaces, abstract classes |
| Goal | Protect internal state | Simplify usage |
| Example | Private fields with public methods | `List` interface hides ArrayList vs LinkedList |

### Real-World Example

```java
// The user sees this simple interface (abstraction)
public interface EmailService {
    boolean send(String to, String subject, String body);
}

// The implementation hides all SMTP complexity (abstraction + encapsulation)
public class SmtpEmailService implements EmailService {
    private final Connection connection;

    public SmtpEmailService(String host, int port, String user, String pass) {
        this.connection = connect(host, port);  // hidden
        authenticate(user, pass);                // hidden
    }

    @Override
    public boolean send(String to, String subject, String body) {
        Message msg = buildMime(to, subject, body);  // hidden
        return connection.send(msg);                  // hidden
    }
}
```

---

## 6. <abbr title="Inheritance: a class (child) derives from another class (parent) and reuses or overrides its fields and methods. Represents an IS-A relationship.">Inheritance</abbr>

Inheritance allows a class to **derive from another class**, inheriting its fields and methods. The child class can **extend or override** parent behavior.

### Types of Inheritance

| Type | Description | Example |
|------|-------------|---------|
| **Single** | One parent class | `Dog extends Animal` |
| **Multi-level** | Chain of inheritance | `Puppy → Dog → Animal` |
| **Hierarchical** | Multiple children, one parent | `Dog, Cat → Animal` |
| **Multiple** | Multiple parents (Python, not Java) | `FlyingFish(Flying, Fish)` |

### Example

```java
public class Vehicle {
    protected String make;
    protected String model;

    public Vehicle(String make, String model) {
        this.make = make;
        this.model = model;
    }

    public void start() {
        System.out.println(make + " " + model + " starting...");
    }
}

public class ElectricVehicle extends Vehicle {
    private double batteryKwh;

    public ElectricVehicle(String make, String model, double batteryKwh) {
        super(make, model);
        this.batteryKwh = batteryKwh;
    }

    @Override
    public void start() {  // Override
        System.out.println(make + " " + model + " starting silently...");
    }

    public void charge() {  // New method
        System.out.println("Charging...");
    }
}
```

### Inheritance Pitfalls

- **Fragile base class** — Changes to parent break children
- **Tight coupling** — Child depends on parent's implementation
- **Diamond problem** — Ambiguity with multiple inheritance
- **Prefer composition over inheritance** — Use "has-a" instead of "is-a" when possible

---

## 7. <abbr title="Polymorphism: the same interface or method call can behave differently depending on the object's actual type.">Polymorphism</abbr>

Polymorphism means **"many forms"** — the same method call behaves differently depending on the object type.

### Types of Polymorphism

| Type | Mechanism | Binding |
|------|-----------|---------|
| **Compile-time (Overloading)** | Same method name, different parameters | Static |
| **Runtime (Overriding)** | Subclass provides its own implementation | Dynamic |
| **Duck typing** (Python) | If it walks like a duck... | Dynamic |

### Runtime Polymorphism Example

```java
public abstract class Shape {
    public abstract double area();
}

public class Circle extends Shape {
    private double radius;
    public Circle(double radius) { this.radius = radius; }
    public double area() { return Math.PI * radius * radius; }
}

public class Rectangle extends Shape {
    private double width, height;
    public Rectangle(double w, double h) { this.width = w; this.height = h; }
    public double area() { return width * height; }
}

// Polymorphic usage — same method, different behavior
public static void printArea(Shape shape) {
    System.out.println("Area: " + shape.area());
}

printArea(new Circle(5));       // Area: 78.54
printArea(new Rectangle(4, 6)); // Area: 24.0
```

### Why Polymorphism Matters in LLD

- **Open/Closed Principle** — Add new types without changing existing code
- **Strategy Pattern** — Swap algorithms at runtime
- **Factory Pattern** — Create objects without knowing exact types
- **Plugin architectures** — Extend without modifying core

---

## 8. The Four Pillars Summary

| Pillar | One-liner | Interview Keyword |
|--------|-----------|-------------------|
| **Encapsulation** | Bundle data + methods, restrict access | "Data hiding, access modifiers" |
| **Abstraction** | Expose what, hide how | "Interfaces, abstract classes" |
| **Inheritance** | Derive from parent, reuse + extend | "IS-A relationship, extends" |
| **Polymorphism** | Same interface, different behavior | "Method overriding, runtime dispatch" |

---

## 9. Interview Tips

1. **Always start LLD answers with class identification** — "The key entities are User, Order, and Payment"
2. **Show encapsulation** — Make fields private, expose via methods
3. **Use interfaces** — Define contracts before implementations
4. **Prefer composition over inheritance** — "A Car HAS-A Engine" vs "A Car IS-A Vehicle"
5. **Apply polymorphism** — When you see "different types behaving differently," use polymorphism
6. **Justify access modifiers** — Explain *why* something is private/public
