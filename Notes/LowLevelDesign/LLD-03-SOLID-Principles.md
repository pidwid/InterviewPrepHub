# SOLID Principles

> SOLID is the most important set of design principles in object-oriented programming. Almost every LLD interview question can be improved by applying one or more SOLID principles.

---

## Table of Contents

1. [Overview](#1-overview)
2. [S — Single Responsibility Principle (SRP)](#2-s--single-responsibility-principle-srp)
3. [O — Open/Closed Principle (OCP)](#3-o--openclosed-principle-ocp)
4. [L — Liskov Substitution Principle (LSP)](#4-l--liskov-substitution-principle-lsp)
5. [I — Interface Segregation Principle (ISP)](#5-i--interface-segregation-principle-isp)
6. [D — Dependency Inversion Principle (DIP)](#6-d--dependency-inversion-principle-dip)
7. [SOLID in Practice](#7-solid-in-practice)
8. [Interview Tips](#8-interview-tips)

---

## 1. Overview

| Principle | One-liner | Violation Smell |
|-----------|-----------|-----------------|
| **<abbr title="Single Responsibility Principle: a class should have one reason to change.">SRP</abbr>** | A class should have only one reason to change | God class, class doing too much |
| **<abbr title="Open/Closed Principle: software should be open to extension but closed to modification.">OCP</abbr>** | Open for extension, closed for modification | `if/else` chains for types |
| **<abbr title="Liskov Substitution Principle: subtypes must be substitutable for their base types without breaking behavior.">LSP</abbr>** | Subtypes must be substitutable for base types | Override that throws exceptions |
| **<abbr title="Interface Segregation Principle: clients should not depend on methods they do not use.">ISP</abbr>** | No client should depend on methods it doesn't use | Fat interface with unused methods |
| **<abbr title="Dependency Inversion Principle: high-level modules depend on abstractions, not concrete implementations.">DIP</abbr>** | Depend on abstractions, not concretions | `new ConcreteClass()` inside business logic |

---

## 2. S — Single Responsibility Principle (SRP)

> **A class should have only one reason to change.**

Each class should do **one thing well**. If a class changes for two different reasons, split it.

### ❌ Violation

```java
public class Employee {
    public void calculatePay() { /* ... */ }       // Reason 1: payroll rules change
    public void saveToDatabase() { /* ... */ }     // Reason 2: database schema changes
    public void generateReport() { /* ... */ }     // Reason 3: report format changes
}
```

### ✅ Fixed

```java
public class Employee {
    private String name;
    private double salary;

    public Employee(String name, double salary) {
        this.name = name;
        this.salary = salary;
    }
}

public class PayrollCalculator {
    public double calculatePay(Employee employee) { /* ... */ return 0; }
}

public class EmployeeRepository {
    public void save(Employee employee) { /* ... */ }
}

public class EmployeeReportGenerator {
    public String generate(Employee employee) { /* ... */ return ""; }
}
```

### How to Identify SRP Violations

- The class has **too many imports**
- The class name contains **"And"** or **"Manager"** or **"Handler"** doing multiple things
- You can describe the class's purpose with **two sentences** joined by "and"

---

## 3. O — Open/Closed Principle (OCP)

> **Software entities should be open for extension, but closed for modification.**

You should be able to add new behavior **without changing existing code**.

### ❌ Violation

```java
public class DiscountCalculator {
    public double calculate(String customerType, double amount) {
        if ("regular".equals(customerType))
            return amount * 0.95;
        else if ("premium".equals(customerType))
            return amount * 0.90;
        else if ("vip".equals(customerType))     // Adding a new type requires
            return amount * 0.80;                 // modifying this class!
        return amount;
    }
}
```

### ✅ Fixed — Using Strategy Pattern

```java
public interface DiscountStrategy {
    double apply(double amount);
}

public class RegularDiscount implements DiscountStrategy {
    public double apply(double amount) { return amount * 0.95; }
}

public class PremiumDiscount implements DiscountStrategy {
    public double apply(double amount) { return amount * 0.90; }
}

public class VIPDiscount implements DiscountStrategy {
    public double apply(double amount) { return amount * 0.80; }
}

// New discounts can be added WITHOUT modifying existing code
public class DiscountCalculator {
    public double calculate(DiscountStrategy strategy, double amount) {
        return strategy.apply(amount);
    }
}
```

### <abbr title="OCP enablers: design techniques that let you add new behavior without modifying existing code.">OCP Enablers</abbr>

| Mechanism | When to Use |
|-----------|-------------|
| **Strategy Pattern** | Swappable algorithms |
| **Template Method** | Same flow, different steps |
| **Decorator** | Adding behavior dynamically |
| **Plugin architecture** | Extensible at runtime |

---

## 4. L — Liskov Substitution Principle (LSP)

> **If S is a subtype of T, objects of type T can be replaced with objects of type S without altering correctness.**

Subclasses must honor the **contract** of the parent class.

### ❌ Classic Violation — Square/Rectangle Problem

```java
public class Rectangle {
    protected int width, height;

    public Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    public void setWidth(int w) { this.width = w; }
    public void setHeight(int h) { this.height = h; }
    public int area() { return width * height; }
}

public class Square extends Rectangle {
    public Square(int side) { super(side, side); }

    @Override
    public void setWidth(int w) {
        this.width = w;
        this.height = w;  // Forces height = width, breaking Rectangle's contract!
    }

    @Override
    public void setHeight(int h) {
        this.width = h;
        this.height = h;
    }
}

// Client code expects Rectangle behavior
public static void resize(Rectangle rect) {
    rect.setWidth(5);
    rect.setHeight(10);
    assert rect.area() == 50;  // FAILS for Square! (area = 100)
}
```

### ✅ Fixed

```java
public abstract class Shape {
    public abstract double area();
}

public class Rectangle extends Shape {
    private double width, height;

    public Rectangle(double width, double height) {
        this.width = width;
        this.height = height;
    }

    public double area() { return width * height; }
}

public class Square extends Shape {
    private double side;
    public Square(double side) { this.side = side; }
    public double area() { return side * side; }
}
```

### <abbr title="LSP violation checklist: common signs that a subtype breaks the base type's contract.">LSP Violation Checklist</abbr>

- ❌ Subclass **throws exceptions** the parent doesn't
- ❌ Subclass **ignores** parent method (empty override)
- ❌ Subclass **strengthens preconditions** (stricter input)
- ❌ Subclass **weakens postconditions** (weaker guarantees)

---

## 5. I — Interface Segregation Principle (ISP)

> **No client should be forced to depend on methods it does not use.**

Split fat interfaces into smaller, focused ones.

### ❌ Violation — Fat Interface

```java
public interface Worker {
    void work();
    void eat();
    void sleep();
}

public class Robot implements Worker {
    public void work() { /* ... */ }
    public void eat() { }   // Robot doesn't eat!
    public void sleep() { }  // Robot doesn't sleep!
}
```

### ✅ Fixed — Segregated Interfaces

```java
public interface Workable {
    void work();
}

public interface Eatable {
    void eat();
}

public interface Sleepable {
    void sleep();
}

public class Human implements Workable, Eatable, Sleepable {
    public void work() { /* ... */ }
    public void eat() { /* ... */ }
    public void sleep() { /* ... */ }
}

public class Robot implements Workable {  // Only implements what it needs
    public void work() { /* ... */ }
}
```

### Signs of ISP Violations

- Classes implementing interfaces with **empty/dummy methods**
- Interface with **more than 5-7 methods** (consider splitting)
- Different clients use **different subsets** of the same interface

---

## 6. D — <abbr title="Dependency Inversion Principle (DIP): high-level modules depend on abstractions, not on low-level concrete implementations.">Dependency Inversion Principle (DIP)</abbr>

> **High-level modules should not depend on low-level modules. Both should depend on abstractions.**

### ❌ Violation — High-level depends on low-level

```java
public class MySQLDatabase {
    public void save(Object data) { /* ... */ }
}

public class UserService {
    private final MySQLDatabase db = new MySQLDatabase();  // Direct dependency on MySQL!

    public void createUser(User user) {
        db.save(user);  // Can't switch to PostgreSQL without changing this
    }
}
```

### ✅ Fixed — Both depend on abstraction

```java
public interface Database {
    void save(Object data);
}

public class MySQLDatabase implements Database {
    public void save(Object data) { /* MySQL implementation */ }
}

public class PostgreSQLDatabase implements Database {
    public void save(Object data) { /* PostgreSQL implementation */ }
}

public class UserService {
    private final Database db;  // Depends on abstraction!

    public UserService(Database db) {
        this.db = db;
    }

    public void createUser(User user) {
        db.save(user);
    }
}

// Inject the dependency
UserService service = new UserService(new MySQLDatabase());
// Easy to switch:
service = new UserService(new PostgreSQLDatabase());
```

### DIP Enables

| Benefit | How |
|---------|-----|
| **Testability** | Inject mock implementations |
| **Flexibility** | Swap implementations without changing business logic |
| **Decoupling** | High-level policy independent of low-level details |

---

## 7. SOLID in Practice

### How SOLID Principles Work Together

```
Design a Notification System:

SRP → Separate classes: NotificationService, EmailSender, SMSSender, PushSender
OCP → New notification types via new classes, not if/else
LSP → All senders are substitutable via NotificationSender interface
ISP → EmailSender doesn't implement SMS-specific methods
DIP → NotificationService depends on NotificationSender interface, not concrete senders
```

### SOLID Prioritization for Interviews

| Priority | Principle | Why |
|----------|-----------|-----|
| 🔴 Must mention | **SRP, OCP** | Most commonly tested, easy to demonstrate |
| 🟡 Often asked | **DIP** | Shows understanding of dependency injection |
| 🟢 Mention if relevant | **LSP, ISP** | Show depth of knowledge |

---

## 8. Interview Tips

1. **Don't just define** — Show a violation and fix it
2. **SRP is the easiest to demonstrate** — Split your "God class" early in the interview
3. **OCP + Strategy pattern** — Your go-to combo for extensibility
4. **DIP = Dependency Injection** — Always inject dependencies via constructor
5. **Name the principle** — "I'm applying OCP here so we can add new payment types without modifying the processor"
6. **Don't over-apply** — Not every class needs five interfaces. SOLID is a guideline, not a law
