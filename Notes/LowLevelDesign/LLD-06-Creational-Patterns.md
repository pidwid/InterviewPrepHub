# Creational Design Patterns

Creational design patterns deal with **object creation mechanisms** — how objects are instantiated. Instead of creating objects directly with `new`, these patterns provide flexibility, control, and decoupling in how objects are constructed. (<abbr title="Creational patterns: focus on how objects are created (e.g., Singleton, Factory, Builder) so construction is flexible and controlled.">definition</abbr>)

---

## Why Creational Patterns?

- **Decouple** client code from the concrete classes it instantiates
- **Control** how and when objects are created
- **Hide** the complexity of construction logic
- **Enforce** constraints (e.g., only one instance, immutable after creation)

---

## 1. <abbr title="Singleton: ensures a class has exactly one instance and provides a global access point to it.">Singleton Pattern</abbr>

### Intent
Ensure a class has **exactly one instance** and provide a global point of access to it.

### Real-World Analogy
A country has only one president at any given time. No matter who asks, they get the same president. The presidency is a singleton.

### When to Use
- Database connection pools
- Configuration managers
- Logger instances
- Thread pools
- Caches

### Structure

```
┌─────────────────────────┐
│       Singleton          │
├─────────────────────────┤
│ - instance: Singleton   │
│ - data: ...             │
├─────────────────────────┤
│ - Singleton()           │
│ + getInstance(): Singleton│
│ + businessMethod()      │
└─────────────────────────┘
```

### Implementation (Java)

```java
// Thread-safe Singleton using double-checked locking
public class DatabaseConnectionPool {
    // volatile ensures visibility across threads
    private static volatile DatabaseConnectionPool instance;
    
    private final List<Connection> connections;
    
    // Private constructor — prevents external instantiation
    private DatabaseConnectionPool() {
        connections = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            connections.add(createConnection());
        }
    }
    
    public static DatabaseConnectionPool getInstance() {
        if (instance == null) {                    // First check (no lock)
            synchronized (DatabaseConnectionPool.class) {
                if (instance == null) {            // Second check (with lock)
                    instance = new DatabaseConnectionPool();
                }
            }
        }
        return instance;
    }
    
    public Connection getConnection() {
        // Return an available connection from pool
    }
    
    public void releaseConnection(Connection conn) {
        // Return connection back to pool
    }
}

// Usage
DatabaseConnectionPool pool = DatabaseConnectionPool.getInstance();
Connection conn = pool.getConnection();
```

**Alternative: Enum Singleton (Simplest, recommended by Joshua Bloch)**
```java
public enum Logger {
    INSTANCE;
    
    public void log(String message) {
        System.out.println("[LOG] " + message);
    }
}

// Usage
Logger.INSTANCE.log("Server started");
```

**Alternative: Bill Pugh Singleton (Lazy, thread-safe, no synchronization)**
```java
public class AppConfig {
    private AppConfig() { }
    
    // Inner static class — loaded only when getInstance() is called
    private static class Holder {
        private static final AppConfig INSTANCE = new AppConfig();
    }
    
    public static AppConfig getInstance() {
        return Holder.INSTANCE;
    }
}
```

### When NOT to Use
- When you need testability (singletons are hard to mock)
- When objects have different state in different contexts
- In multi-threaded environments without proper synchronization
- When it's disguising a global variable

### Common Pitfalls
- **Thread safety**: Naive implementations break in multi-threaded code
- **Testing difficulty**: Singleton state persists across tests
- **Hidden dependencies**: Code depends on singleton without it being obvious
- **Serialization**: Deserializing can create a second instance (use `readResolve()`)

### Interview Q&A
**Q: How do you prevent a second instance via reflection?**
A: Throw an exception in the constructor if instance already exists. Enum singletons handle this automatically.

**Q: What's the difference between Singleton and static class?**
A: Singleton can implement interfaces, be lazily initialized, and be passed as a parameter. Static classes cannot.

---

## 2. <abbr title="Factory Method: defines an interface for creating objects, but lets subclasses decide which concrete class to instantiate.">Factory Method Pattern</abbr>

### Intent
Define an interface for creating objects, but let **subclasses** decide which class to instantiate. Factory Method defers instantiation to subclasses.

### Real-World Analogy
A logistics company has a fleet of vehicles. Land logistics uses Trucks, sea logistics uses Ships. The logistics planner doesn't decide the vehicle type — each branch office (subclass) creates the appropriate vehicle.

### When to Use
- When the exact class to instantiate isn't known beforehand
- When a class wants its subclasses to specify the objects it creates
- When you want to localize the knowledge of which class gets created

### Structure

```
┌──────────────────┐          ┌──────────────────┐
│  Creator         │          │  Product         │
│  (abstract)      │          │  (interface)     │
├──────────────────┤          ├──────────────────┤
│ + factoryMethod()│─creates─▶│ + operation()    │
│ + someOperation()│          └────────┬─────────┘
└────────┬─────────┘                   │
         │                    ┌────────┴─────────┐
┌────────┴─────────┐   ┌─────┴──────┐  ┌────────┴───────┐
│ConcreteCreatorA  │   │ConcreteA   │  │ConcreteB       │
├──────────────────┤   └────────────┘  └────────────────┘
│+ factoryMethod() │
└──────────────────┘
```

### Implementation (Java)

```java
// Product interface
interface Notification {
    void send(String recipient, String message);
}

// Concrete products
class EmailNotification implements Notification {
    @Override
    public void send(String recipient, String message) {
        System.out.println("Sending email to " + recipient + ": " + message);
    }
}

class SMSNotification implements Notification {
    @Override
    public void send(String recipient, String message) {
        System.out.println("Sending SMS to " + recipient + ": " + message);
    }
}

class PushNotification implements Notification {
    @Override
    public void send(String recipient, String message) {
        System.out.println("Sending push to " + recipient + ": " + message);
    }
}

// Creator (abstract)
abstract class NotificationFactory {
    // Factory method — subclasses provide implementation
    public abstract Notification createNotification();
    
    // Template method using the factory
    public void notifyUser(String recipient, String message) {
        Notification notification = createNotification();
        notification.send(recipient, message);
    }
}

// Concrete creators
class EmailNotificationFactory extends NotificationFactory {
    @Override
    public Notification createNotification() {
        return new EmailNotification();
    }
}

class SMSNotificationFactory extends NotificationFactory {
    @Override
    public Notification createNotification() {
        return new SMSNotification();
    }
}

// Usage
NotificationFactory factory = new EmailNotificationFactory();
factory.notifyUser("user@example.com", "Welcome!");

// Can switch to SMS without changing client code:
factory = new SMSNotificationFactory();
factory.notifyUser("+1234567890", "Welcome!");
```

### Simple Factory (Not a GoF Pattern, but Very Common)

```java
// Simple factory — uses a method with conditional logic
class NotificationSimpleFactory {
    public static Notification create(String type) {
        return switch (type) {
            case "email" -> new EmailNotification();
            case "sms"   -> new SMSNotification();
            case "push"  -> new PushNotification();
            default      -> throw new IllegalArgumentException("Unknown type: " + type);
        };
    }
}

// Usage
Notification notif = NotificationSimpleFactory.create("email");
notif.send("user@example.com", "Hello!");
```

### When NOT to Use
- When there's only one type of product (overengineering)
- When the creation logic is trivial and won't change

### Common Pitfalls
- Creating a factory for every class (over-engineering)
- Confusing Simple Factory with Factory Method pattern
- Forgetting to make the factory method abstract (defeating the purpose)

### Interview Q&A
**Q: What's the difference between Simple Factory and Factory Method?**
A: Simple Factory uses a single method with conditional logic. Factory Method uses inheritance — each subclass provides its own creation logic. Factory Method follows OCP (open for extension).

---

## 3. <abbr title="Abstract Factory: creates families of related objects without specifying their concrete classes. Keeps product variants consistent.">Abstract Factory Pattern</abbr>

### Intent
Provide an interface for creating **families of related objects** without specifying their concrete classes.

### Real-World Analogy
A furniture shop sells sets of matching furniture: Modern (modern chair + modern table + modern sofa) or Victorian (Victorian chair + Victorian table + Victorian sofa). You pick a style, and all pieces match. That style selection is the Abstract Factory.

### When to Use
- When your system needs to create families of related products
- When products from one family shouldn't mix with products from another
- When you want to enforce consistency across related objects

### Structure

```
┌─────────────────────┐
│  AbstractFactory     │
├─────────────────────┤
│+ createButton()      │
│+ createCheckbox()    │
│+ createTextField()   │
└─────────┬───────────┘
          │
┌─────────┴──────────┐  ┌────────────────────────┐
│  WindowsFactory     │  │  MacFactory             │
├────────────────────┤  ├────────────────────────┤
│+ createButton()    │  │+ createButton()         │
│  → WindowsButton   │  │  → MacButton            │
│+ createCheckbox()  │  │+ createCheckbox()       │
│  → WindowsCheckbox │  │  → MacCheckbox          │
└────────────────────┘  └────────────────────────┘
```

### Implementation (Java)

```java
// Abstract products
interface Button {
    void render();
    void onClick(Runnable action);
}

interface Checkbox {
    void render();
    boolean isChecked();
}

// Concrete products — Windows family
class WindowsButton implements Button {
    public void render() { System.out.println("Rendering Windows button"); }
    public void onClick(Runnable action) { action.run(); }
}

class WindowsCheckbox implements Checkbox {
    public void render() { System.out.println("Rendering Windows checkbox"); }
    public boolean isChecked() { return false; }
}

// Concrete products — Mac family
class MacButton implements Button {
    public void render() { System.out.println("Rendering Mac button"); }
    public void onClick(Runnable action) { action.run(); }
}

class MacCheckbox implements Checkbox {
    public void render() { System.out.println("Rendering Mac checkbox"); }
    public boolean isChecked() { return false; }
}

// Abstract factory
interface UIFactory {
    Button createButton();
    Checkbox createCheckbox();
}

// Concrete factories
class WindowsUIFactory implements UIFactory {
    public Button createButton() { return new WindowsButton(); }
    public Checkbox createCheckbox() { return new WindowsCheckbox(); }
}

class MacUIFactory implements UIFactory {
    public Button createButton() { return new MacButton(); }
    public Checkbox createCheckbox() { return new MacCheckbox(); }
}

// Client code — works with ANY factory
class Application {
    private final Button button;
    private final Checkbox checkbox;
    
    public Application(UIFactory factory) {
        this.button = factory.createButton();
        this.checkbox = factory.createCheckbox();
    }
    
    public void render() {
        button.render();
        checkbox.render();
    }
}

// Usage
UIFactory factory = System.getProperty("os.name").contains("Windows")
    ? new WindowsUIFactory()
    : new MacUIFactory();

Application app = new Application(factory);
app.render();
```

### Factory Method vs Abstract Factory

| Aspect | Factory Method | Abstract Factory |
|--------|---------------|------------------|
| Creates | One product | Family of products |
| Mechanism | Inheritance (subclass overrides) | Composition (factory passed in) |
| Adding new products | Add new subclass | Modify factory interface (harder) |
| Use case | Single product varies | Multiple related products vary together |

### When NOT to Use
- When you don't have families of related objects
- When the families are unlikely to grow (overengineering)

---

## 4. <abbr title="Builder: constructs complex objects step by step, allowing optional parameters and different representations without huge constructors.">Builder Pattern</abbr>

### Intent
Construct complex objects **step by step**. Allow the same construction process to create different representations.

### Real-World Analogy
Building a house: you don't call a constructor with 20 parameters. Instead, you tell the builder: "build walls," "install a roof," "add a garage," "add a swimming pool." Each step is optional, and the same process can build different houses.

### When to Use
- Objects with many optional parameters (telescoping constructor anti-pattern)
- Objects that require step-by-step construction
- When you need to create different representations of the same object
- Immutable objects that need many fields set at creation time

### <abbr title="Telescoping constructor: a constructor with many parameters (often booleans) that is hard to read and easy to misuse.">Anti-Pattern: Telescoping Constructor</abbr>

```java
// BAD — which parameter is which?
Pizza pizza = new Pizza("large", true, false, true, false, true, "thin", "tomato");

// What does the 4th 'true' mean? Impossible to read!
```

### Implementation (Java)

```java
// Product
public class Pizza {
    private final String size;
    private final String crust;
    private final String sauce;
    private final boolean cheese;
    private final boolean pepperoni;
    private final boolean mushrooms;
    private final boolean onions;
    private final boolean bacon;
    
    // Private constructor — only Builder can create
    private Pizza(Builder builder) {
        this.size = builder.size;
        this.crust = builder.crust;
        this.sauce = builder.sauce;
        this.cheese = builder.cheese;
        this.pepperoni = builder.pepperoni;
        this.mushrooms = builder.mushrooms;
        this.onions = builder.onions;
        this.bacon = builder.bacon;
    }
    
    // Static inner Builder class
    public static class Builder {
        // Required parameters
        private final String size;
        
        // Optional parameters — initialized to defaults
        private String crust = "regular";
        private String sauce = "tomato";
        private boolean cheese = true;
        private boolean pepperoni = false;
        private boolean mushrooms = false;
        private boolean onions = false;
        private boolean bacon = false;
        
        public Builder(String size) {
            this.size = size;
        }
        
        public Builder crust(String crust) {
            this.crust = crust;
            return this;  // Return this for method chaining
        }
        
        public Builder sauce(String sauce) {
            this.sauce = sauce;
            return this;
        }
        
        public Builder pepperoni() {
            this.pepperoni = true;
            return this;
        }
        
        public Builder mushrooms() {
            this.mushrooms = true;
            return this;
        }
        
        public Builder onions() {
            this.onions = true;
            return this;
        }
        
        public Builder bacon() {
            this.bacon = true;
            return this;
        }
        
        // Validation happens here
        public Pizza build() {
            if (size == null || size.isEmpty()) {
                throw new IllegalStateException("Size is required");
            }
            return new Pizza(this);
        }
    }
    
    @Override
    public String toString() {
        return size + " pizza on " + crust + " crust with " + sauce + " sauce"
            + (pepperoni ? " + pepperoni" : "")
            + (mushrooms ? " + mushrooms" : "")
            + (bacon ? " + bacon" : "");
    }
}

// Usage — clean, readable, self-documenting
Pizza pizza = new Pizza.Builder("large")
    .crust("thin")
    .sauce("bbq")
    .pepperoni()
    .bacon()
    .mushrooms()
    .build();

System.out.println(pizza);
// Output: large pizza on thin crust with bbq sauce + pepperoni + mushrooms + bacon
```

### Builder with Director (Classic GoF)

```java
// Director controls the build process
class MealDirector {
    public Pizza buildVeggiePizza(Pizza.Builder builder) {
        return builder
            .crust("whole wheat")
            .sauce("pesto")
            .mushrooms()
            .onions()
            .build();
    }
    
    public Pizza buildMeatLoversPizza(Pizza.Builder builder) {
        return builder
            .crust("thick")
            .sauce("tomato")
            .pepperoni()
            .bacon()
            .build();
    }
}
```

### When NOT to Use
- Simple objects with few fields (use constructor)
- When object structure won't change

### Common Pitfalls
- Builder should validate in `build()`, not in setters
- Don't forget to make the product immutable (private constructor, no setters)
- Avoid mutable builders being reused accidentally

### Interview Q&A
**Q: Builder vs Factory?**
A: Factory creates objects in one step. Builder creates complex objects step by step with optional parameters. Factory controls "which" product; Builder controls "how" a product is configured.

**Q: Where is Builder used in Java standard library?**
A: `StringBuilder`, `Stream.Builder`, `HttpRequest.newBuilder()`, `Locale.Builder`.

---

## 5. <abbr title="Prototype: creates new objects by cloning an existing instance, useful when object creation is expensive.">Prototype Pattern</abbr>

### Intent
Create new objects by **cloning** an existing object (the prototype), rather than creating from scratch.

### Real-World Analogy
Mitosis in biology: a cell creates a copy of itself. The new cell starts as a clone and may then diverge. Similarly, a document template is a prototype — you start from a copy and modify it.

### When to Use
- When object creation is expensive (database fetch, network call, heavy computation)
- When you want to create objects without coupling to their concrete classes
- When objects differ only in small ways (clone and tweak)
- Game development: spawning many similar enemies/entities

### Implementation (Java)

```java
// Prototype interface
interface GameUnit extends Cloneable {
    GameUnit clone();
    void setPosition(int x, int y);
}

// Concrete prototype
class Soldier implements GameUnit {
    private String type;
    private int health;
    private int attack;
    private int defense;
    private int x, y;
    private List<String> abilities;  // Deep copy needed!
    
    public Soldier(String type, int health, int attack, int defense) {
        this.type = type;
        this.health = health;
        this.attack = attack;
        this.defense = defense;
        this.abilities = new ArrayList<>();
    }
    
    // Copy constructor (deep copy)
    private Soldier(Soldier other) {
        this.type = other.type;
        this.health = other.health;
        this.attack = other.attack;
        this.defense = other.defense;
        this.x = 0;
        this.y = 0;
        this.abilities = new ArrayList<>(other.abilities);  // Deep copy list
    }
    
    @Override
    public GameUnit clone() {
        return new Soldier(this);
    }
    
    @Override
    public void setPosition(int x, int y) {
        this.x = x;
        this.y = y;
    }
    
    public void addAbility(String ability) {
        abilities.add(ability);
    }
}

// Prototype Registry
class UnitRegistry {
    private final Map<String, GameUnit> prototypes = new HashMap<>();
    
    public void register(String key, GameUnit prototype) {
        prototypes.put(key, prototype);
    }
    
    public GameUnit create(String key) {
        GameUnit proto = prototypes.get(key);
        if (proto == null) throw new IllegalArgumentException("Unknown unit: " + key);
        return proto.clone();
    }
}

// Usage
UnitRegistry registry = new UnitRegistry();

// Register prototypes (configured once, cloned many times)
Soldier infantry = new Soldier("Infantry", 100, 15, 10);
infantry.addAbility("march");
infantry.addAbility("melee");
registry.register("infantry", infantry);

Soldier archer = new Soldier("Archer", 75, 20, 5);
archer.addAbility("ranged_attack");
archer.addAbility("retreat");
registry.register("archer", archer);

// Spawn 100 infantry units — cloned, not constructed from scratch
for (int i = 0; i < 100; i++) {
    GameUnit unit = registry.create("infantry");
    unit.setPosition(i * 10, 0);
}
```

### Shallow vs Deep Copy

```
Shallow Copy:
  - Copies primitive fields by value
  - Copies reference fields by reference (both point to same object)
  - Problem: modifying a list in clone affects the original!

Deep Copy:
  - Copies primitives by value
  - Creates NEW objects for reference fields (recursively)
  - Safe: clone and original are fully independent

Always use DEEP COPY for the Prototype pattern.
```

### When NOT to Use
- When objects are simple to construct (cloning adds no benefit)
- When objects have circular references (deep copy is tricky)
- When the cost of cloning exceeds the cost of construction

### Common Pitfalls
- Forgetting to deep-copy mutable fields (lists, maps, nested objects)
- Using Java's default `clone()` which does shallow copy
- Not implementing `Cloneable` interface (Java-specific)

### Interview Q&A
**Q: Prototype vs calling a constructor?**
A: Prototype is better when: (1) construction is expensive, (2) you need many similar objects, (3) you don't know the concrete class (polymorphic cloning).

**Q: How does Prototype help with avoiding coupling?**
A: Client code calls `prototype.clone()` without knowing the concrete class. It works through the interface.

---

## Pattern Comparison Summary

| Pattern | Purpose | When to Use | Key Mechanism |
|---------|---------|-------------|---------------|
| **Singleton** | One instance only | Shared resources (DB pool, config) | Private constructor + static access |
| **Factory Method** | Delegate creation to subclass | Product type varies by context | Inheritance + polymorphism |
| **Abstract Factory** | Create families of objects | Related objects must be consistent | Factory of factories |
| **Builder** | Step-by-step construction | Complex objects, many parameters | Fluent API, method chaining |
| **Prototype** | Clone existing objects | Expensive construction, many similar objects | Copy constructor / clone |

### Common Interview Comparison Questions

**Factory Method vs Abstract Factory:**
- Factory Method creates ONE product type via subclass override
- Abstract Factory creates a FAMILY of related products via composition

**Builder vs Factory:**
- Factory: create in one step, client doesn't control construction
- Builder: create step-by-step, client controls what goes into the object

**Prototype vs Factory:**
- Factory: creates from scratch using `new`
- Prototype: creates by cloning an existing configured instance

---

## Design Patterns in Java Standard Library

| Pattern | Java Examples |
|---------|--------------|
| Singleton | `Runtime.getRuntime()`, `Desktop.getDesktop()` |
| Factory Method | `Calendar.getInstance()`, `NumberFormat.getInstance()` |
| Abstract Factory | `DocumentBuilderFactory`, `TransformerFactory` |
| Builder | `StringBuilder`, `HttpRequest.newBuilder()`, `Stream.builder()` |
| Prototype | `Object.clone()`, `ArrayList(Collection)` copy constructor |
