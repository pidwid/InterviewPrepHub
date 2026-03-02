# Structural Design Patterns

> Structural patterns deal with **how classes and objects are composed** to form larger structures. They simplify design by identifying simple ways to realize relationships between entities. (<abbr title="Structural patterns: focus on how classes/objects are combined (e.g., Adapter, Decorator, Facade) to form bigger structures.">definition</abbr>)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Adapter](#2-adapter)
3. [Bridge](#3-bridge)
4. [Composite](#4-composite)
5. [Decorator](#5-decorator)
6. [Facade](#6-facade)
7. [Flyweight](#7-flyweight)
8. [Proxy](#8-proxy)
9. [Comparison & When to Use](#9-comparison--when-to-use)
10. [Interview Tips](#10-interview-tips)

---

## 1. Overview

| Pattern | Intent | Analogy |
|---------|--------|---------|
| **<abbr title="Adapter: converts one interface into another that clients expect.">Adapter</abbr>** | Convert one interface to another | Power plug adapter |
| **<abbr title="Bridge: separates abstraction from implementation so both can vary independently.">Bridge</abbr>** | Separate abstraction from implementation | Remote control → Device |
| **<abbr title="Composite: treat individual objects and groups uniformly using a tree structure.">Composite</abbr>** | Treat individual objects and groups uniformly | File/Folder tree |
| **<abbr title="Decorator: add behavior to an object dynamically without changing its class.">Decorator</abbr>** | Add behavior dynamically without changing the class | Toppings on pizza |
| **<abbr title="Facade: provide a simplified interface to a complex subsystem.">Facade</abbr>** | Simplified interface to a complex subsystem | Hotel concierge |
| **<abbr title="Flyweight: share common state across many objects to save memory.">Flyweight</abbr>** | Share common state across many objects | Character glyphs in a text editor |
| **<abbr title="Proxy: a stand-in object that controls access to another object.">Proxy</abbr>** | Surrogate that controls access to another object | Credit card as proxy for bank account |

---

## 2. Adapter

> **Convert the interface of a class into another interface clients expect.**

### When to Use
- Integrating a third-party library with an incompatible interface
- Wrapping legacy code to work with new code
- Normalizing different APIs into a single interface

### Implementation

```java
// Target interface (what our code expects)
public interface PaymentGateway {
    boolean charge(String customerId, double amount, String currency);
    boolean refund(String transactionId);
}

// Adaptee — third-party Stripe SDK with a different interface
public class StripeSdk {
    public StripeCharge createCharge(int amountInCents, String cur, String custToken) {
        // Stripe-specific logic
        return new StripeCharge("ch_123", true);
    }

    public StripeRefund createRefund(String chargeId) {
        return new StripeRefund(chargeId, true);
    }
}

// Adapter — bridges our interface to Stripe's interface
public class StripeAdapter implements PaymentGateway {
    private final StripeSdk stripe;

    public StripeAdapter(StripeSdk stripe) {
        this.stripe = stripe;
    }

    @Override
    public boolean charge(String customerId, double amount, String currency) {
        int cents = (int) (amount * 100);  // Convert dollars to cents
        StripeCharge charge = stripe.createCharge(cents, currency, customerId);
        return charge.isSuccessful();
    }

    @Override
    public boolean refund(String transactionId) {
        StripeRefund refund = stripe.createRefund(transactionId);
        return refund.isSuccessful();
    }
}

// Usage — client code works with our clean interface
PaymentGateway gateway = new StripeAdapter(new StripeSdk());
gateway.charge("cust_456", 29.99, "USD");
```

### Real-World Analogy
A travel power adapter lets your US plug work in a European socket. It doesn't change the plug or the socket — it simply translates between two incompatible interfaces.

### When NOT to Use
- The interfaces are already compatible — just use them directly
- You need to add new behavior (use **Decorator** instead)
- The adaptee's API changes frequently — the adapter becomes a maintenance burden

### Common Pitfalls
- Creating adapters for trivially different interfaces — just refactor instead
- Fat adapters that contain business logic — an adapter should ONLY translate, not process
- Not handling edge cases in the translation (e.g., null values, different error semantics)

### Interview Q&A

**Q: Class Adapter vs Object Adapter?**  
Class adapter uses inheritance (extends adaptee), object adapter uses composition (wraps adaptee). Object adapter is **preferred** — it follows composition over inheritance and can adapt multiple adaptees.

**Q: Adapter vs Facade?**  
Adapter makes an existing interface work where it's expected (1:1 wrapping). Facade creates a NEW simplified interface for an entire subsystem (1:many simplification).

---

## 3. Bridge

> **Decouple an abstraction from its implementation so the two can vary independently.**

### When to Use
- You want to avoid a **Cartesian product** of classes (e.g., 3 shapes × 3 renderers = 9 classes)
- Abstraction and implementation should evolve independently

### Implementation

```java
// Implementation interface
public interface MessageSender {
    void send(String message, String recipient);
}

public class EmailSender implements MessageSender {
    @Override
    public void send(String message, String recipient) {
        System.out.println("Email to " + recipient + ": " + message);
    }
}

public class SmsSender implements MessageSender {
    @Override
    public void send(String message, String recipient) {
        System.out.println("SMS to " + recipient + ": " + message);
    }
}

// Abstraction
public abstract class Notification {
    protected MessageSender sender;  // Bridge to implementation

    public Notification(MessageSender sender) {
        this.sender = sender;
    }

    public abstract void notify(String recipient);
}

public class UrgentNotification extends Notification {
    private final String urgentMessage;

    public UrgentNotification(MessageSender sender, String message) {
        super(sender);
        this.urgentMessage = "[URGENT] " + message;
    }

    @Override
    public void notify(String recipient) {
        sender.send(urgentMessage, recipient);
    }
}

public class RegularNotification extends Notification {
    private final String message;

    public RegularNotification(MessageSender sender, String message) {
        super(sender);
        this.message = message;
    }

    @Override
    public void notify(String recipient) {
        sender.send(message, recipient);
    }
}

// Usage — mix any notification type with any sender
Notification urgentEmail = new UrgentNotification(new EmailSender(), "Server down!");
Notification regularSms = new RegularNotification(new SmsSender(), "Weekly report ready");

urgentEmail.notify("admin@example.com");  // Email: [URGENT] Server down!
regularSms.notify("+1234567890");          // SMS: Weekly report ready
```

### Without Bridge: Class Explosion

```
UrgentEmailNotification, UrgentSmsNotification, UrgentPushNotification,
RegularEmailNotification, RegularSmsNotification, RegularPushNotification
= 6 classes (2 types × 3 senders), and grows multiplicatively!
```

### Real-World Analogy
A TV remote (abstraction) works with any TV brand (implementation). You can change the remote style independently from the TV brand. Without this separation, you'd need SamsungBasicRemote, SamsungSmartRemote, LGBasicRemote, LGSmartRemote...

### When NOT to Use
- Only one implementation exists and is unlikely to change
- The abstraction and implementation don't vary independently
- Adds unnecessary complexity for simple hierarchies

### Common Pitfalls
- Confusing Bridge with Strategy — Bridge separates abstraction from implementation at the **class design** level; Strategy swaps algorithms at runtime
- Over-engineering — if you only have one dimension of variation, you don't need Bridge
- Forgetting that Bridge is a **design-time** pattern — it prevents class explosion before it happens (unlike Adapter which fixes it after)

### Interview Q&A

**Q: Bridge vs Adapter?**  
Bridge is used **upfront** during design to prevent class explosion. Adapter is used **after the fact** to make incompatible things work together.

**Q: How does Bridge support OCP?**  
New abstractions (e.g., `PriorityNotification`) and new implementations (e.g., `PushSender`) can be added independently without modifying existing code.

---

## 4. Composite

> **Compose objects into tree structures. Let clients treat individual objects and compositions uniformly.**

### When to Use
- **Tree structures**: File system (File/Folder), UI (Widget/Panel), organization chart
- You want to treat a group of objects the **same as a single object**

### Implementation

```java
// Component interface
public interface FileSystemItem {
    String getName();
    long getSize();
    void display(String indent);
}

// Leaf
public class File implements FileSystemItem {
    private final String name;
    private final long size;

    public File(String name, long size) {
        this.name = name;
        this.size = size;
    }

    @Override
    public String getName() { return name; }

    @Override
    public long getSize() { return size; }

    @Override
    public void display(String indent) {
        System.out.println(indent + "📄 " + name + " (" + size + " bytes)");
    }
}

// Composite
public class Directory implements FileSystemItem {
    private final String name;
    private final List<FileSystemItem> children = new ArrayList<>();

    public Directory(String name) {
        this.name = name;
    }

    public void add(FileSystemItem item) { children.add(item); }
    public void remove(FileSystemItem item) { children.remove(item); }

    @Override
    public String getName() { return name; }

    @Override
    public long getSize() {
        return children.stream().mapToLong(FileSystemItem::getSize).sum();
    }

    @Override
    public void display(String indent) {
        System.out.println(indent + "📁 " + name + " (" + getSize() + " bytes)");
        for (FileSystemItem child : children) {
            child.display(indent + "  ");
        }
    }
}

// Usage
Directory root = new Directory("src");
Directory models = new Directory("models");
models.add(new File("User.java", 1200));
models.add(new File("Order.java", 800));
root.add(models);
root.add(new File("App.java", 500));

root.display("");
// 📁 src (2500 bytes)
//   📁 models (2000 bytes)
//     📄 User.java (1200 bytes)
//     📄 Order.java (800 bytes)
//   📄 App.java (500 bytes)
```

### Real-World Analogy
An army: a General gives a command to a Division, which passes it to Brigades, then to Platoons, then to individual Soldiers. Each level responds to the same "execute order" command, whether it's a group or an individual.

### When NOT to Use
- Your objects don't form a natural tree/hierarchy
- Leaf and composite behaviors are fundamentally different — forcing a uniform interface would be awkward
- You need type-specific operations that don't make sense on both leaves and composites

### Common Pitfalls
- Violating LSP — putting `add()/remove()` in the component interface forces leaves to implement meaningless methods
- Not considering thread safety when modifying the tree concurrently
- Deep recursion on very large trees — consider iterative traversal for production code

### Interview Q&A

**Q: How do you handle operations that only apply to composites?**  
Two approaches: (1) Put `add()/remove()` only in the Composite class (type-safe but requires casting), or (2) Put them in the Component interface with default no-op/exception (uniform but less safe). Prefer approach 1.

**Q: Where does Java use Composite?**  
`java.awt.Container` (holds Components, which can be other Containers), `javax.swing.JComponent` hierarchy, and conceptually `java.io.File` (represents both files and directories).

---

## 5. Decorator

> **Attach additional responsibilities to an object dynamically. More flexible than subclassing.**

### When to Use
- Adding features to objects **at runtime** without inheritance
- When subclassing would lead to **class explosion**
- Java I/O streams are classic Decorator examples: `new BufferedInputStream(new FileInputStream(...))`

### Implementation

```java
// Component interface
public interface DataSource {
    void writeData(String data);
    String readData();
}

// Concrete component
public class FileDataSource implements DataSource {
    private final String filename;

    public FileDataSource(String filename) {
        this.filename = filename;
    }

    @Override
    public void writeData(String data) {
        // Write to file
        System.out.println("Writing to " + filename + ": " + data);
    }

    @Override
    public String readData() {
        return "raw-data-from-" + filename;
    }
}

// Base decorator
public abstract class DataSourceDecorator implements DataSource {
    protected DataSource wrappee;

    public DataSourceDecorator(DataSource source) {
        this.wrappee = source;
    }
}

// Concrete decorators
public class EncryptionDecorator extends DataSourceDecorator {
    public EncryptionDecorator(DataSource source) {
        super(source);
    }

    @Override
    public void writeData(String data) {
        String encrypted = encrypt(data);
        wrappee.writeData(encrypted);
    }

    @Override
    public String readData() {
        return decrypt(wrappee.readData());
    }

    private String encrypt(String data) { return "ENC(" + data + ")"; }
    private String decrypt(String data) { return data.replace("ENC(", "").replace(")", ""); }
}

public class CompressionDecorator extends DataSourceDecorator {
    public CompressionDecorator(DataSource source) {
        super(source);
    }

    @Override
    public void writeData(String data) {
        String compressed = compress(data);
        wrappee.writeData(compressed);
    }

    @Override
    public String readData() {
        return decompress(wrappee.readData());
    }

    private String compress(String data) { return "ZIP(" + data + ")"; }
    private String decompress(String data) { return data.replace("ZIP(", "").replace(")", ""); }
}

// Usage — stack decorators!
DataSource source = new CompressionDecorator(
    new EncryptionDecorator(
        new FileDataSource("data.txt")
    )
);

source.writeData("Hello World");
// Compresses → Encrypts → Writes to file
```

### Real-World Analogy
Ordering coffee: you start with a base coffee, then add decorators — milk, whipped cream, caramel. Each addition wraps the previous one, adding cost and description. You can combine them in any order and quantity.

### When NOT to Use
- The order of wrapping matters and is error-prone — hard to enforce correct decoration order
- You need to remove a specific decorator from the middle of the stack (decorators don't easily unwrap)
- Simple cases where inheritance or configuration would suffice

### Common Pitfalls
- Decorator explosion — too many small decorator classes become hard to manage
- Identity checks breaking — `decorated != original` even though they wrap the same object (`equals` must be carefully implemented)
- Debugging difficulty — stack traces through 5 layers of decorators are hard to follow

### Interview Q&A

**Q: Decorator vs Proxy?**  
Both wrap an object, but intent differs. Decorator **adds** behavior/responsibilities. Proxy **controls access** (caching, security, lazy loading). Proxy usually creates the wrapped object itself; Decorator receives it from the client.

**Q: How does Java I/O use Decorator?**  
`BufferedInputStream(new FileInputStream(new File("f.txt")))` — `FileInputStream` is the component, `BufferedInputStream` is a decorator adding buffering. You can freely combine `BufferedReader`, `InputStreamReader`, `GZIPInputStream`, etc.

---

## 6. Facade

> **Provide a unified, simplified interface to a set of interfaces in a subsystem.**

### When to Use
- Simplify interaction with a complex library or subsystem
- Reduce coupling between client code and subsystem classes
- Layer your application (presentation → facade → business logic → data)

### Implementation

```java
// Complex subsystem classes
public class InventoryService {
    public boolean checkStock(String productId, int quantity) {
        System.out.println("Checking stock for " + productId);
        return true;
    }

    public void reserve(String productId, int quantity) {
        System.out.println("Reserved " + quantity + " of " + productId);
    }
}

public class PaymentService {
    public String processPayment(String customerId, double amount) {
        System.out.println("Charged $" + amount + " to " + customerId);
        return "txn_" + System.currentTimeMillis();
    }
}

public class ShippingService {
    public String createShipment(String orderId, String address) {
        System.out.println("Shipment created for order " + orderId);
        return "ship_" + orderId;
    }
}

public class NotificationService {
    public void sendOrderConfirmation(String email, String orderId) {
        System.out.println("Confirmation sent to " + email + " for " + orderId);
    }
}

// Facade — one simple method for a complex workflow
public class OrderFacade {
    private final InventoryService inventory;
    private final PaymentService payment;
    private final ShippingService shipping;
    private final NotificationService notification;

    public OrderFacade() {
        this.inventory = new InventoryService();
        this.payment = new PaymentService();
        this.shipping = new ShippingService();
        this.notification = new NotificationService();
    }

    public String placeOrder(String customerId, String productId,
                             int quantity, String address, String email) {
        // Step 1: Check inventory
        if (!inventory.checkStock(productId, quantity)) {
            throw new RuntimeException("Out of stock");
        }

        // Step 2: Reserve inventory
        inventory.reserve(productId, quantity);

        // Step 3: Process payment
        String txnId = payment.processPayment(customerId, quantity * 29.99);

        // Step 4: Create shipment
        String shipmentId = shipping.createShipment(txnId, address);

        // Step 5: Send notification
        notification.sendOrderConfirmation(email, txnId);

        return txnId;
    }
}

// Client — simple!
OrderFacade orderFacade = new OrderFacade();
orderFacade.placeOrder("cust_1", "prod_42", 2, "123 Main St", "user@example.com");
```

### Real-World Analogy
A hotel concierge: you say "I need dinner reservations, a taxi at 7pm, and theater tickets." They coordinate with three different services behind the scenes. You don't call the restaurant, taxi company, and box office yourself.

### When NOT to Use
- Clients genuinely need fine-grained control over subsystems
- The facade becomes a "God object" that does everything — that's a design smell
- There's only one subsystem class — no simplification needed

### Common Pitfalls
- Turning the facade into a God class that couples to everything
- Not allowing direct subsystem access when needed — facade should be **optional**, not a gatekeeper
- Putting business logic in the facade instead of keeping it in subsystem classes

### Interview Q&A

**Q: Facade vs Adapter?**  
Facade simplifies a complex subsystem (many classes → one simple interface). Adapter translates one existing interface to another. Facade creates a **new** interface; Adapter converts an **existing** one.

**Q: Can a system have multiple facades?**  
Yes! You might have `OrderFacade`, `ReportFacade`, and `AdminFacade` — each exposing a different simplified view of the same subsystems for different client types.

---

## 7. Flyweight

> **Use sharing to support large numbers of fine-grained objects efficiently.**

### When to Use
- Thousands of similar objects consuming too much memory
- Most object state can be **shared** (intrinsic) vs. **unique** (extrinsic)

### Implementation

```java
// Flyweight — shared, immutable state
public class TreeType {
    private final String name;
    private final String color;
    private final String texture;  // Large bitmap data

    public TreeType(String name, String color, String texture) {
        this.name = name;
        this.color = color;
        this.texture = texture;
    }

    public void draw(int x, int y) {
        System.out.println("Drawing " + name + " (" + color + ") at (" + x + "," + y + ")");
    }
}

// Flyweight factory — ensures sharing
public class TreeFactory {
    private static final Map<String, TreeType> treeTypes = new HashMap<>();

    public static TreeType getTreeType(String name, String color, String texture) {
        String key = name + "_" + color;
        return treeTypes.computeIfAbsent(key, k -> new TreeType(name, color, texture));
    }
}

// Context — unique state (position per tree)
public class Tree {
    private final int x, y;
    private final TreeType type;  // Shared flyweight

    public Tree(int x, int y, TreeType type) {
        this.x = x;
        this.y = y;
        this.type = type;
    }

    public void draw() {
        type.draw(x, y);
    }
}

// Usage — 1,000,000 trees but only a few TreeType objects in memory
public class Forest {
    private final List<Tree> trees = new ArrayList<>();

    public void plantTree(int x, int y, String name, String color, String texture) {
        TreeType type = TreeFactory.getTreeType(name, color, texture);
        trees.add(new Tree(x, y, type));
    }
}
```

### Memory Savings

```
Without Flyweight: 1,000,000 trees × (name + color + texture + x + y) = ~1 GB
With Flyweight:    1,000,000 trees × (x + y + reference) + 5 TreeTypes = ~20 MB
```

### Real-World Analogy
Characters in a printed book: the letter "e" appears thousands of times, but a typesetter doesn't create a new physical mold for each occurrence. One "e" mold (flyweight) is shared; only the position on the page (extrinsic state) varies per usage.

### When NOT to Use
- Objects don't share significant common state
- The number of objects is small enough that memory isn't a concern
- Object state is mostly unique (extrinsic) — sharing won't save meaningful memory

### Common Pitfalls
- **Mutating shared flyweight state** — flyweights MUST be immutable, or one change affects all users
- Premature optimization — only use when profiling confirms memory is the actual bottleneck
- Complex extrinsic state management — tracking what state belongs where adds cognitive overhead

### Interview Q&A

**Q: Intrinsic vs Extrinsic state?**  
Intrinsic = shared, immutable, stored inside the flyweight (e.g., tree type, color, texture). Extrinsic = unique per context, stored outside (e.g., x/y position). The client passes extrinsic state to the flyweight when needed.

**Q: Where does Java use Flyweight?**  
`Integer.valueOf()` caches instances for -128 to 127. `String.intern()` pools string literals. `Boolean.valueOf()` returns cached `TRUE`/`FALSE` instances.

---

## 8. Proxy

> **Provide a surrogate or placeholder for another object to control access to it.**

### Types of Proxy

| Type | Purpose | Example |
|------|---------|---------|
| **Virtual Proxy** | Lazy initialization | Load heavy object on first use |
| **Protection Proxy** | Access control | Check permissions before delegating |
| **Caching Proxy** | Cache results | Return cached responses |
| **Logging Proxy** | Logging | Log method calls before delegating |
| **Remote Proxy** | Network access | Stand-in for remote object (RMI) |

### Implementation — Caching Proxy

```java
public interface DatabaseQuery {
    List<Map<String, Object>> execute(String sql);
}

public class RealDatabase implements DatabaseQuery {
    @Override
    public List<Map<String, Object>> execute(String sql) {
        System.out.println("Executing expensive query: " + sql);
        // Simulate slow database call
        return List.of(Map.of("id", 1, "name", "Alice"));
    }
}

public class CachingProxy implements DatabaseQuery {
    private final RealDatabase realDb;
    private final Map<String, List<Map<String, Object>>> cache = new HashMap<>();

    public CachingProxy(RealDatabase realDb) {
        this.realDb = realDb;
    }

    @Override
    public List<Map<String, Object>> execute(String sql) {
        if (cache.containsKey(sql)) {
            System.out.println("Cache hit for: " + sql);
            return cache.get(sql);
        }

        List<Map<String, Object>> result = realDb.execute(sql);
        cache.put(sql, result);
        return result;
    }

    public void invalidate(String sql) {
        cache.remove(sql);
    }
}
```

### Protection Proxy

```java
public class SecuredDatabaseProxy implements DatabaseQuery {
    private final RealDatabase realDb;
    private final User currentUser;

    public SecuredDatabaseProxy(RealDatabase realDb, User currentUser) {
        this.realDb = realDb;
        this.currentUser = currentUser;
    }

    @Override
    public List<Map<String, Object>> execute(String sql) {
        if (sql.trim().toUpperCase().startsWith("DROP") && !currentUser.isAdmin()) {
            throw new SecurityException("Only admins can execute DROP statements");
        }
        return realDb.execute(sql);
    }
}
```

### Real-World Analogy
A credit card is a proxy for your bank account. It has the same "pay" interface as cash, but adds access control (PIN verification), logging (transaction history), and lazy loading (doesn't carry the actual money).

### When NOT to Use
- No access control, caching, or lazy loading is needed — direct access is simpler
- The proxy adds latency or complexity that outweighs its benefits
- You need to add new behavior (use **Decorator** instead) rather than control access

### Common Pitfalls
- Proxy becoming too smart — a proxy should control access, not add business logic (that's Decorator territory)
- Not implementing the same interface — the client should be unaware it's using a proxy
- Stale cache in caching proxy — always provide an invalidation strategy

### Interview Q&A

**Q: Proxy vs Decorator?**  
Both wrap an object with the same interface. Proxy **controls access** (lazy init, caching, auth). Decorator **adds behavior**. Proxy often manages the wrappee's lifecycle; Decorator receives it from the client.

**Q: How does Spring use Proxy?**  
Spring AOP creates dynamic proxies for `@Transactional`, `@Cacheable`, `@Async` annotations. JDK dynamic proxy (interface-based) or CGLIB proxy (subclass-based) intercepts method calls to add cross-cutting concerns.

---

## 9. Comparison & When to Use

| Pattern | Key Question | Example |
|---------|-------------|---------|
| **Adapter** | "How to make X work with Y?" | Legacy API integration |
| **Bridge** | "How to avoid class explosion?" | Shape/Renderer, Notification/Sender |
| **Composite** | "Tree structure?" | File system, UI components, menus |
| **Decorator** | "Add behavior without subclassing?" | Java I/O, middleware |
| **Facade** | "Simplify a complex subsystem?" | Order processing, library wrapper |
| **Flyweight** | "Too many similar objects?" | Game entities, text characters |
| **Proxy** | "Control access to an object?" | Caching, auth, lazy loading |

---

## 10. Interview Tips

1. **Decorator vs Inheritance** — "Decorator is preferred because it's composable at runtime"
2. **Adapter vs Bridge** — Adapter fixes existing incompatibility; Bridge prevents it upfront
3. **Facade is everywhere** — Any service class that orchestrates multiple subsystems
4. **Composite = trees** — If you see a tree structure, use Composite
5. **Proxy = same interface** — Proxy and real object implement the same interface
6. **Combine patterns** — Decorator + Composite is very common (tree of decorated objects)
