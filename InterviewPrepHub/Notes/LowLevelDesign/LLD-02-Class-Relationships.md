# Class Relationships

> Understanding how classes relate to each other — association, aggregation, composition, and dependency — is critical for drawing UML diagrams and explaining your design in interviews.

---

## Table of Contents

1. [Overview of Relationships](#1-overview-of-relationships)
2. [Association](#2-association)
3. [Aggregation](#3-aggregation)
4. [Composition](#4-composition)
5. [Dependency](#5-dependency)
6. [Aggregation vs Composition](#6-aggregation-vs-composition)
7. [Multiplicity](#7-multiplicity)
8. [Interview Tips](#8-interview-tips)

---

## 1. Overview of Relationships

| Relationship | Strength | Lifecycle | Keyword | UML Arrow |
|-------------|----------|-----------|---------|-----------|
| **Dependency** | Weakest | None | "uses" | Dashed arrow `-->` |
| **Association** | Weak | Independent | "knows about" | Solid line `—` |
| **Aggregation** | Medium | Independent | "has-a" (shared) | Open diamond `◇—` |
| **Composition** | Strongest | Dependent | "has-a" (owned) | Filled diamond `◆—` |

The key question: **What happens to the child when the parent is destroyed?**

---

## 2. Association

Association is a **"knows about"** relationship. Two classes are aware of each other but have **independent lifecycles**.

```java
public class Doctor {
    private String name;
    private List<Patient> patients = new ArrayList<>();

    public Doctor(String name) { this.name = name; }

    public void addPatient(Patient patient) {
        patients.add(patient);
    }
}

public class Patient {
    private String name;
    private List<Doctor> doctors = new ArrayList<>();

    public Patient(String name) { this.name = name; }
}
```

- A Doctor **knows about** Patients and vice versa
- Deleting a Doctor does NOT delete the Patients
- This is a **bidirectional, many-to-many** association

### Types of Association

| Direction | Example |
|-----------|---------|
| **Unidirectional** | Order → Customer (Order knows Customer, not vice versa) |
| **Bidirectional** | Doctor ↔ Patient (both know each other) |

---

## 3. Aggregation

Aggregation is a **"has-a" relationship where the child can exist independently** of the parent. The parent contains a reference, but doesn't own the child's lifecycle.

```java
public class Department {
    private String name;
    private List<Employee> employees = new ArrayList<>();

    public Department(String name) { this.name = name; }

    public void addEmployee(Employee employee) {
        employees.add(employee);
    }
}

public class Employee {
    private String name;
    public Employee(String name) { this.name = name; }
}

// Employee exists independently
Employee emp = new Employee("Alice");
Department dept = new Department("Engineering");
dept.addEmployee(emp);

dept = null;  // Department destroyed, but emp still exists!
```

### Key Characteristics
- **"Whole-Part"** relationship
- Part **can exist** without the whole
- Part **can belong to multiple** wholes
- Represented by **open diamond** (◇) in UML

---

## 4. Composition

Composition is a **strong "has-a" relationship where the child cannot exist without the parent**. The parent **owns** the child's lifecycle.

```java
public class House {
    private String address;
    private List<Room> rooms;

    public House(String address, int numRooms) {
        this.address = address;
        // Rooms are CREATED by House — they don't exist independently
        this.rooms = new ArrayList<>();
        for (int i = 0; i < numRooms; i++) {
            rooms.add(new Room("Room-" + i));
        }
    }
}

public class Room {
    private String name;
    public Room(String name) { this.name = name; }
}

House house = new House("123 Main St", 3);
// If house is destroyed, all rooms are destroyed too
```

```java
public class Car {
    private final Engine engine;  // Composition: Car OWNS the Engine

    public Car() {
        this.engine = new Engine();  // Created inside Car
    }
    // When Car is garbage collected, Engine goes too
}
```

### Key Characteristics
- Part **cannot exist** without the whole
- Part belongs to **exactly one** whole
- Whole **creates and destroys** the part
- Represented by **filled diamond** (◆) in UML

---

## 5. Dependency

Dependency is the **weakest relationship** — one class **uses** another temporarily, typically as a method parameter, local variable, or return type.

```java
public class OrderService {
    // EmailService is a DEPENDENCY — used temporarily, not stored
    public void placeOrder(Order order, EmailService emailService) {
        order.confirm();
        emailService.send(order.getCustomerEmail(), "Order confirmed!");
    }
}
```

```java
public class ReportGenerator {
    // JsonFormatter is a dependency — used only in this method
    public String generate(Data data) {
        JsonFormatter formatter = new JsonFormatter();
        return formatter.format(data);
    }
}
```

### Key Characteristics
- **No persistent relationship** — used and discarded
- Changes in the dependency **may affect** the dependent class
- Represented by **dashed arrow** (-->) in UML

---

## 6. Aggregation vs Composition

This is a very common interview question. The key distinction is **lifecycle ownership**.

| Aspect | Aggregation (◇) | Composition (◆) |
|--------|-----------------|-----------------|
| **Lifecycle** | Independent | Dependent (child dies with parent) |
| **Ownership** | Shared / borrowed | Exclusive |
| **Creation** | Child created externally | Child created by parent |
| **Multiplicity** | Child can belong to many | Child belongs to exactly one |
| **Example** | Team ◇— Player | House ◆— Room |
| **Example 2** | University ◇— Professor | Order ◆— OrderLineItem |
| **Example 3** | Playlist ◇— Song | Human ◆— Heart |

### Decision Framework

```
Does the child make sense without the parent?
├── YES → Aggregation (or maybe just Association)
│   Examples: Student without University, Song without Playlist
└── NO → Composition
    Examples: Room without House, OrderItem without Order
```

---

## 7. Multiplicity

Multiplicity describes **how many objects participate** in a relationship.

| Notation | Meaning | Example |
|----------|---------|---------|
| `1` | Exactly one | Order → 1 Customer |
| `0..1` | Zero or one | Person → 0..1 Spouse |
| `*` or `0..*` | Zero or more | Customer → * Orders |
| `1..*` | One or more | Order → 1..* LineItems |
| `3..5` | Range | Car → 3..5 Passengers |

---

## 8. Interview Tips

1. **When drawing class diagrams**, explicitly label relationships and justify your choice
2. **Common mistake**: Using inheritance when composition is more appropriate
3. **"Prefer composition over inheritance"** — Composition is more flexible and avoids tight coupling
4. **The lifecycle test**: Always ask "Does X exist without Y?" to distinguish aggregation from composition
5. **Real interview example**: "In a Parking Lot design, ParkingSpot has a **composition** relationship with ParkingFloor (spots don't exist without floors), but a **dependency** on Vehicle (temporarily parked)"
