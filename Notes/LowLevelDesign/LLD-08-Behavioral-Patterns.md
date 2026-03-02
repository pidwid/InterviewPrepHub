# Behavioral Design Patterns

> Behavioral patterns define **how objects interact and communicate**. They describe patterns of communication between objects, assigning responsibilities and controlling flow. (<abbr title="Behavioral patterns: focus on communication and responsibility between objects (e.g., Strategy, Observer, State).">definition</abbr>)

---

## Table of Contents

- [Behavioral Design Patterns](#behavioral-design-patterns)
  - [Table of Contents](#table-of-contents)
  - [1. Overview](#1-overview)
  - [2. Strategy](#2-strategy)
    - [Implementation](#implementation)
    - [Common Interview Applications](#common-interview-applications)
  - [3. Observer](#3-observer)
    - [Implementation](#implementation-1)
  - [4. State](#4-state)
    - [Implementation](#implementation-2)
    - [State vs Strategy](#state-vs-strategy)
  - [5. Command](#5-command)
    - [Implementation](#implementation-3)
  - [6. Template Method](#6-template-method)
    - [Implementation](#implementation-4)
    - [Template Method vs Strategy](#template-method-vs-strategy)
  - [7. Iterator](#7-iterator)
    - [Implementation](#implementation-5)
  - [8. Chain of Responsibility](#8-chain-of-responsibility)
    - [Implementation](#implementation-6)
  - [9. Mediator](#9-mediator)
    - [Implementation](#implementation-7)
  - [10. Memento](#10-memento)
    - [Implementation](#implementation-8)
  - [11. Visitor](#11-visitor)
    - [Implementation](#implementation-9)
  - [12. Comparison \& When to Use](#12-comparison--when-to-use)
  - [13. Interview Tips](#13-interview-tips)

---

## 1. Overview

| Pattern | Intent | One-liner |
|---------|--------|-----------|
| **<abbr title="Strategy: encapsulate interchangeable algorithms and swap them at runtime.">Strategy</abbr>** | Encapsulate interchangeable algorithms | "Swap algorithm at runtime" |
| **<abbr title="Observer: one-to-many dependency where observers are notified when the subject changes.">Observer</abbr>** | One-to-many dependency notification | "When X changes, notify all listeners" |
| **<abbr title="State: behavior changes when internal state changes, often via state objects.">State</abbr>** | Object behavior changes with internal state | "Object acts differently per state" |
| **<abbr title="Command: encapsulate a request as an object so it can be queued, logged, or undone.">Command</abbr>** | Encapsulate a request as an object | "Undo/replay actions" |
| **<abbr title="Template Method: define a fixed algorithm skeleton with overridable steps.">Template Method</abbr>** | Define algorithm skeleton, defer steps | "Same flow, different details" |
| **<abbr title="Iterator: provides sequential access to elements without exposing internal representation.">Iterator</abbr>** | Sequential access without exposing internals | `for (item : collection)` |
| **<abbr title="Chain of Responsibility: pass a request along a chain of handlers until one handles it.">Chain of Responsibility</abbr>** | Pass request along a chain of handlers | "Middleware pipeline" |
| **<abbr title="Mediator: centralizes communication between objects to reduce direct dependencies.">Mediator</abbr>** | Central hub for object communication | "Chat room, air traffic control" |
| **<abbr title="Memento: capture and restore an object's internal state without exposing details.">Memento</abbr>** | Capture and restore object state | "Ctrl+Z / undo" |
| **<abbr title="Visitor: add new operations to a set of classes without modifying those classes (uses double dispatch).">Visitor</abbr>** | Add operations without changing classes | "Double dispatch" |

---

## 2. Strategy

> **Define a family of algorithms, encapsulate each one, and make them interchangeable.**

This is the **most commonly used** behavioral pattern in interviews. It directly implements OCP.

### Implementation

```java
// Strategy interface
public interface SortingStrategy {
    <T extends Comparable<T>> void sort(List<T> data);
}

public class QuickSortStrategy implements SortingStrategy {
    @Override
    public <T extends Comparable<T>> void sort(List<T> data) {
        Collections.sort(data);  // Simplified
        System.out.println("QuickSort applied");
    }
}

public class MergeSortStrategy implements SortingStrategy {
    @Override
    public <T extends Comparable<T>> void sort(List<T> data) {
        // Merge sort implementation
        System.out.println("MergeSort applied");
    }
}

// Context
public class DataProcessor {
    private SortingStrategy strategy;

    public DataProcessor(SortingStrategy strategy) {
        this.strategy = strategy;
    }

    public void setStrategy(SortingStrategy strategy) {
        this.strategy = strategy;
    }

    public void process(List<Integer> data) {
        System.out.println("Processing " + data.size() + " items...");
        strategy.sort(data);
    }
}

// Usage
DataProcessor processor = new DataProcessor(new QuickSortStrategy());
processor.process(data);

processor.setStrategy(new MergeSortStrategy());  // Switch at runtime!
processor.process(moreData);
```

### Common Interview Applications
- **Payment processing**: CreditCardPayment, PayPalPayment, CryptoPayment
- **Discount calculation**: RegularDiscount, SeasonalDiscount, LoyaltyDiscount
- **Compression**: ZipCompression, GzipCompression, Lz4Compression
- **Routing**: ShortestPath, FastestRoute, CheapestRoute

### Real-World Analogy
Google Maps route options: you choose between "fastest route", "shortest distance", or "avoid tolls." The navigation app (context) stays the same — only the routing algorithm (strategy) is swapped.

### When NOT to Use
- Only one algorithm exists and won't change — unnecessary abstraction
- The algorithms need to share state or interact with the context's internals heavily
- A simple `if-else` with 2-3 cases is clearer than a full Strategy hierarchy

### Common Pitfalls
- Over-engineering with Strategy when a simple lambda or `switch` would suffice
- Clients needing to know which strategy to pick defeats the purpose — consider combining with Factory
- Forgetting that in Java, `Function<T,R>` or lambdas can replace simple single-method strategies

### Interview Q&A

**Q: Strategy vs Template Method?**  
Strategy uses **composition** — swap the entire algorithm at runtime. Template Method uses **inheritance** — override specific steps of a fixed algorithm skeleton. Strategy is more flexible; Template Method is simpler when the overall flow is fixed.

**Q: How does Java use Strategy?**  
`Comparator` is a strategy for sorting. `Collections.sort(list, comparator)` — the sort algorithm is fixed, but the comparison strategy is swappable. Also: `LayoutManager` in Swing, `Executor` implementations.

---

## 3. Observer

> **Define a one-to-many dependency so that when one object changes state, all dependents are notified.**

### Implementation

```java
// Observer interface
public interface EventListener {
    void update(String eventType, String data);
}

// Subject (publisher)
public class EventManager {
    private final Map<String, List<EventListener>> listeners = new HashMap<>();

    public EventManager(String... eventTypes) {
        for (String type : eventTypes) {
            listeners.put(type, new ArrayList<>());
        }
    }

    public void subscribe(String eventType, EventListener listener) {
        listeners.get(eventType).add(listener);
    }

    public void unsubscribe(String eventType, EventListener listener) {
        listeners.get(eventType).remove(listener);
    }

    public void notify(String eventType, String data) {
        for (EventListener listener : listeners.get(eventType)) {
            listener.update(eventType, data);
        }
    }
}

// Concrete observers
public class EmailAlertListener implements EventListener {
    private final String email;

    public EmailAlertListener(String email) { this.email = email; }

    @Override
    public void update(String eventType, String data) {
        System.out.println("Email to " + email + ": [" + eventType + "] " + data);
    }
}

public class SlackAlertListener implements EventListener {
    private final String channel;

    public SlackAlertListener(String channel) { this.channel = channel; }

    @Override
    public void update(String eventType, String data) {
        System.out.println("Slack #" + channel + ": [" + eventType + "] " + data);
    }
}

// Concrete subject
public class StockMarket {
    private final EventManager events;
    private final Map<String, Double> prices = new HashMap<>();

    public StockMarket() {
        events = new EventManager("PRICE_UP", "PRICE_DOWN");
    }

    public void subscribe(String eventType, EventListener listener) {
        events.subscribe(eventType, listener);
    }

    public void updatePrice(String symbol, double newPrice) {
        Double oldPrice = prices.get(symbol);
        prices.put(symbol, newPrice);

        if (oldPrice != null) {
            String data = symbol + ": $" + oldPrice + " → $" + newPrice;
            if (newPrice > oldPrice) {
                events.notify("PRICE_UP", data);
            } else {
                events.notify("PRICE_DOWN", data);
            }
        }
    }
}

// Usage
StockMarket market = new StockMarket();
market.subscribe("PRICE_UP", new EmailAlertListener("trader@example.com"));
market.subscribe("PRICE_DOWN", new SlackAlertListener("trading-alerts"));

market.updatePrice("AAPL", 150.0);
market.updatePrice("AAPL", 145.0);  // Triggers Slack notification
market.updatePrice("AAPL", 155.0);  // Triggers Email notification
```

### Real-World Analogy
A newspaper subscription: when a new edition is published, all subscribers receive a copy automatically. Subscribers can opt in or out at any time without affecting the newspaper or other subscribers.

### When NOT to Use
- Only one listener exists — a direct method call is simpler
- Order of notification matters (Observer doesn't guarantee order)
- Observers need to respond synchronously and you can't tolerate the cascading update cost

### Common Pitfalls
- **Memory leaks** — forgetting to unsubscribe listeners (especially in GC languages where the subject holds strong references)
- **Cascading updates** — observer A updates state, triggering observer B, which triggers observer A again (infinite loop)
- **Thread safety** — concurrent subscribe/unsubscribe while notifying causes `ConcurrentModificationException`

### Interview Q&A

**Q: Observer vs Pub-Sub?**  
Observer is direct — subject knows its observers. Pub-Sub uses a message broker/event bus as intermediary — publishers and subscribers are fully decoupled and don't know about each other. Pub-Sub scales better in distributed systems.

**Q: How does Java support Observer?**  
`java.util.Observer`/`Observable` (deprecated since Java 9). Modern alternatives: `PropertyChangeListener`, `Flow.Publisher`/`Flow.Subscriber` (Java 9+ reactive streams), or event frameworks like Spring's `ApplicationEvent`.

---

## 4. State

> **Allow an object to alter its behavior when its internal state changes. The object will appear to change its class.**

### Implementation

```java
// State interface
public interface VendingMachineState {
    void insertCoin(VendingMachine machine);
    void selectItem(VendingMachine machine, String item);
    void dispense(VendingMachine machine);
}

// Concrete states
public class IdleState implements VendingMachineState {
    @Override
    public void insertCoin(VendingMachine machine) {
        System.out.println("Coin accepted");
        machine.setState(new HasCoinState());
    }

    @Override
    public void selectItem(VendingMachine machine, String item) {
        System.out.println("Please insert a coin first");
    }

    @Override
    public void dispense(VendingMachine machine) {
        System.out.println("Please insert a coin and select an item");
    }
}

public class HasCoinState implements VendingMachineState {
    @Override
    public void insertCoin(VendingMachine machine) {
        System.out.println("Coin already inserted");
    }

    @Override
    public void selectItem(VendingMachine machine, String item) {
        if (machine.hasItem(item)) {
            System.out.println("Item " + item + " selected");
            machine.setSelectedItem(item);
            machine.setState(new DispensingState());
        } else {
            System.out.println("Item not available. Returning coin.");
            machine.setState(new IdleState());
        }
    }

    @Override
    public void dispense(VendingMachine machine) {
        System.out.println("Please select an item first");
    }
}

public class DispensingState implements VendingMachineState {
    @Override
    public void insertCoin(VendingMachine machine) {
        System.out.println("Please wait, dispensing in progress");
    }

    @Override
    public void selectItem(VendingMachine machine, String item) {
        System.out.println("Please wait, dispensing in progress");
    }

    @Override
    public void dispense(VendingMachine machine) {
        System.out.println("Dispensing " + machine.getSelectedItem());
        machine.removeItem(machine.getSelectedItem());
        machine.setState(new IdleState());
    }
}

// Context
public class VendingMachine {
    private VendingMachineState state;
    private final Map<String, Integer> inventory = new HashMap<>();
    private String selectedItem;

    public VendingMachine() {
        this.state = new IdleState();
    }

    public void setState(VendingMachineState state) { this.state = state; }
    public void setSelectedItem(String item) { this.selectedItem = item; }
    public String getSelectedItem() { return selectedItem; }
    public boolean hasItem(String item) { return inventory.getOrDefault(item, 0) > 0; }
    public void removeItem(String item) { inventory.merge(item, -1, Integer::sum); }

    public void insertCoin() { state.insertCoin(this); }
    public void selectItem(String item) { state.selectItem(this, item); }
    public void dispense() { state.dispense(this); }
}
```

### State vs Strategy

| Aspect | State | Strategy |
|--------|-------|----------|
| **What varies** | Behavior changes based on internal state | Algorithm is selected externally |
| **Who triggers change** | State objects transition themselves | Client sets the strategy |
| **Awareness** | States know about each other | Strategies are independent |
| **Example** | Vending machine, order lifecycle | Payment method, sort algorithm |

### Real-World Analogy
A traffic light: it behaves differently in each state (Red → stop, Green → go, Yellow → slow down). The light transitions between states automatically based on rules, and the same "car arrives" event produces different behavior depending on the current state.

### When NOT to Use
- Only 2-3 states with trivial transitions — a simple `enum` + `switch` is clearer
- States don't have meaningfully different behavior — just different data
- State transitions are purely linear with no branching (a simple sequence, not a state machine)

### Common Pitfalls
- State classes accumulating too much logic — keep them focused on behavior for that state only
- Tight coupling between states — each state knows about specific other states for transitions
- Not handling invalid transitions gracefully (e.g., calling `dispense()` in `IdleState`)

### Interview Q&A

**Q: State vs Strategy — how to decide?**  
Ask: "Does the object change its own behavior internally?" → State. "Does the client choose the behavior externally?" → Strategy. State transitions are **automatic and internal**; Strategy selection is **explicit and external**.

**Q: Where is State used in real systems?**  
Order lifecycle (Placed → Paid → Shipped → Delivered), TCP connection states, UI workflows (Draft → Review → Published), game character states (Idle → Walking → Attacking).

---

## 5. Command

> **Encapsulate a request as an object, enabling parameterization, queuing, logging, and undo.**

### Implementation

```java
// Command interface
public interface Command {
    void execute();
    void undo();
}

// Receiver
public class TextEditor {
    private StringBuilder content = new StringBuilder();

    public void insertText(int position, String text) {
        content.insert(position, text);
    }

    public void deleteText(int position, int length) {
        content.delete(position, position + length);
    }

    public String getContent() { return content.toString(); }
}

// Concrete commands
public class InsertCommand implements Command {
    private final TextEditor editor;
    private final int position;
    private final String text;

    public InsertCommand(TextEditor editor, int position, String text) {
        this.editor = editor;
        this.position = position;
        this.text = text;
    }

    @Override
    public void execute() { editor.insertText(position, text); }

    @Override
    public void undo() { editor.deleteText(position, text.length()); }
}

public class DeleteCommand implements Command {
    private final TextEditor editor;
    private final int position;
    private final int length;
    private String deletedText; // For undo

    public DeleteCommand(TextEditor editor, int position, int length) {
        this.editor = editor;
        this.position = position;
        this.length = length;
    }

    @Override
    public void execute() {
        deletedText = editor.getContent().substring(position, position + length);
        editor.deleteText(position, length);
    }

    @Override
    public void undo() { editor.insertText(position, deletedText); }
}

// Invoker with undo history
public class CommandHistory {
    private final Deque<Command> history = new ArrayDeque<>();

    public void execute(Command cmd) {
        cmd.execute();
        history.push(cmd);
    }

    public void undo() {
        if (!history.isEmpty()) {
            Command cmd = history.pop();
            cmd.undo();
        }
    }
}

// Usage
TextEditor editor = new TextEditor();
CommandHistory history = new CommandHistory();

history.execute(new InsertCommand(editor, 0, "Hello "));
history.execute(new InsertCommand(editor, 6, "World"));
// editor.getContent() = "Hello World"

history.undo();
// editor.getContent() = "Hello "
```

### Real-World Analogy
A restaurant order ticket: the waiter writes down your order (command object), pins it on the board (queue), the chef executes it when ready, and the ticket serves as a record (logging). If you change your mind, the waiter can tear up the ticket (undo).

### When NOT to Use
- Simple direct method calls with no need for undo, queuing, or logging
- Commands are always executed immediately and never need to be stored or replayed
- The overhead of wrapping every action in an object is unjustified

### Common Pitfalls
- Commands storing too much state — only store what's needed for execute/undo
- Forgetting to implement `undo()` properly — each command must be fully reversible
- Not considering command serialization if you need to persist or transmit commands

### Interview Q&A

**Q: Command vs Strategy?**  
Both encapsulate behavior in objects, but Command represents a **request/action** (with undo, queue, log). Strategy represents an **algorithm choice**. Commands are typically stored and replayed; strategies are swapped and used immediately.

**Q: What are the four things Command enables?**  
1. **Parameterization** — pass commands as method arguments. 2. **Queuing** — store commands for later execution. 3. **Logging** — record commands for audit/replay. 4. **Undo/Redo** — reverse commands using stored state.

---

## 6. Template Method

> **Define the skeleton of an algorithm in a base class, letting subclasses override specific steps.**

### Implementation

```java
public abstract class DataMiner {
    // Template method — defines the algorithm skeleton (final = can't override)
    public final void mine(String path) {
        openFile(path);
        String rawData = extractData();
        String parsed = parseData(rawData);
        analyzeData(parsed);
        generateReport(parsed);
        closeFile();
    }

    // Steps to be implemented by subclasses
    protected abstract void openFile(String path);
    protected abstract String extractData();
    protected abstract void closeFile();

    // Optional hooks — subclasses CAN override
    protected String parseData(String rawData) {
        return rawData.trim();
    }

    // Common steps — shared implementation
    private void analyzeData(String data) {
        System.out.println("Analyzing " + data.length() + " chars of data...");
    }

    private void generateReport(String data) {
        System.out.println("Report generated.");
    }
}

public class CsvDataMiner extends DataMiner {
    @Override
    protected void openFile(String path) { System.out.println("Opening CSV: " + path); }

    @Override
    protected String extractData() { return "csv,data,here"; }

    @Override
    protected void closeFile() { System.out.println("Closing CSV file"); }
}

public class JsonDataMiner extends DataMiner {
    @Override
    protected void openFile(String path) { System.out.println("Opening JSON: " + path); }

    @Override
    protected String extractData() { return "{\"key\": \"value\"}"; }

    @Override
    protected void closeFile() { System.out.println("Closing JSON file"); }

    @Override
    protected String parseData(String rawData) {
        return rawData.replace("{", "").replace("}", "");
    }
}
```

### Template Method vs Strategy

| Template Method | Strategy |
|----------------|----------|
| Uses **inheritance** | Uses **composition** |
| Parent controls the algorithm flow | Client controls which algorithm |
| Override **steps** | Replace **entire** algorithm |
| Compile-time binding | Runtime binding |

### Real-World Analogy
A corporate onboarding process: every new hire goes through the same steps (paperwork → badge photo → desk setup → team intro), but certain steps vary: an engineer gets a dev machine, a designer gets a drawing tablet, a manager gets access to HR tools.

### When NOT to Use
- The algorithm has no fixed skeleton — steps vary completely between subclasses
- You need runtime flexibility (use **Strategy** — composition over inheritance)
- The template has too many abstract steps — subclasses become complex to implement

### Common Pitfalls
- Forgetting to make the template method `final` — subclasses could accidentally override the entire flow
- Too many hooks/abstract methods — the template becomes hard to implement correctly
- Tight coupling through inheritance — changes to the base class ripple to all subclasses

### Interview Q&A

**Q: Template Method vs Strategy — when to use which?**  
Template Method when the **overall flow is fixed** and only specific steps vary (inheritance). Strategy when the **entire algorithm is swappable** (composition). Template Method is simpler but less flexible.

**Q: What are "hooks" in Template Method?**  
Optional methods with a default (often empty) implementation that subclasses CAN override but don't have to. They provide extension points without forcing implementation. Example: `beforeSave()`, `afterSave()` hooks.

---

## 7. Iterator

> **Provide sequential access to elements of a collection without exposing its underlying structure.**

### Implementation

```java
public class PaginatedList<T> implements Iterable<T> {
    private final List<List<T>> pages = new ArrayList<>();
    private final int pageSize;

    public PaginatedList(List<T> items, int pageSize) {
        this.pageSize = pageSize;
        for (int i = 0; i < items.size(); i += pageSize) {
            pages.add(items.subList(i, Math.min(i + pageSize, items.size())));
        }
    }

    @Override
    public Iterator<T> iterator() {
        return new PaginatedIterator();
    }

    private class PaginatedIterator implements Iterator<T> {
        private int pageIndex = 0;
        private int itemIndex = 0;

        @Override
        public boolean hasNext() {
            return pageIndex < pages.size();
        }

        @Override
        public T next() {
            if (!hasNext()) throw new NoSuchElementException();
            T item = pages.get(pageIndex).get(itemIndex);
            itemIndex++;
            if (itemIndex >= pages.get(pageIndex).size()) {
                pageIndex++;
                itemIndex = 0;
            }
            return item;
        }
    }
}

// Usage — client doesn't know about pages
PaginatedList<String> users = new PaginatedList<>(allUsers, 10);
for (String user : users) {
    System.out.println(user);
}
```

### Real-World Analogy
A TV remote's channel buttons: you press ▶ Next and ◀ Previous to browse channels without knowing how they're stored internally (satellite, cable, streaming). The remote provides a uniform way to traverse any channel source.

### When NOT to Use
- The collection is simple and Java's built-in `Iterable`/`Iterator` already covers your needs
- You need random access rather than sequential traversal
- The traversal logic is trivial (just use a `for` loop over a `List`)

### Common Pitfalls
- **Concurrent modification** — modifying the collection while iterating causes `ConcurrentModificationException`
- Not implementing `remove()` correctly (or at all) — use `UnsupportedOperationException` if not supported
- Creating iterator objects for every traversal — can cause GC pressure in tight loops

### Interview Q&A

**Q: Internal vs External Iterator?**  
External: client controls iteration (`hasNext()`/`next()`). Internal: collection controls iteration, client provides a callback (e.g., `forEach(Consumer)`). Java supports both — `Iterator` is external, `Iterable.forEach()` is internal.

**Q: How does Java's enhanced for-loop work?**  
`for (T item : collection)` is syntactic sugar for `Iterator<T> it = collection.iterator(); while (it.hasNext()) { T item = it.next(); }`. Any class implementing `Iterable<T>` works with enhanced for.

---

## 8. Chain of Responsibility

> **Pass a request along a chain of handlers. Each handler decides to process or pass it along.**

### Implementation

```java
public abstract class RequestHandler {
    private RequestHandler next;

    public RequestHandler setNext(RequestHandler next) {
        this.next = next;
        return next; // For chaining
    }

    public void handle(HttpRequest request) {
        if (next != null) {
            next.handle(request);
        }
    }
}

public class AuthenticationHandler extends RequestHandler {
    @Override
    public void handle(HttpRequest request) {
        if (request.getHeader("Authorization") == null) {
            throw new SecurityException("Missing auth token");
        }
        System.out.println("✓ Authenticated");
        super.handle(request); // Pass to next handler
    }
}

public class RateLimitHandler extends RequestHandler {
    private final Map<String, Integer> requestCounts = new HashMap<>();
    private static final int MAX_REQUESTS = 100;

    @Override
    public void handle(HttpRequest request) {
        String ip = request.getClientIp();
        int count = requestCounts.merge(ip, 1, Integer::sum);
        if (count > MAX_REQUESTS) {
            throw new RuntimeException("Rate limit exceeded for " + ip);
        }
        System.out.println("✓ Rate limit OK (" + count + "/" + MAX_REQUESTS + ")");
        super.handle(request);
    }
}

public class LoggingHandler extends RequestHandler {
    @Override
    public void handle(HttpRequest request) {
        System.out.println("LOG: " + request.getMethod() + " " + request.getPath());
        super.handle(request);
    }
}

// Usage — build the chain
RequestHandler chain = new LoggingHandler();
chain.setNext(new AuthenticationHandler())
     .setNext(new RateLimitHandler());

chain.handle(incomingRequest);
```

### Real-World Analogy
Customer support escalation: your call starts with a chatbot, then a frontline agent, then a specialist, then a manager. Each handler either resolves your issue or passes it up the chain.

### When NOT to Use
- Every request must be handled by a specific known handler — direct dispatch is simpler
- The chain is so long that performance degrades from traversing many handlers
- You need guaranteed handling — requests can fall off the end of the chain unhandled

### Common Pitfalls
- **Unhandled requests** — if no handler processes the request, it silently disappears. Add a default/fallback handler at the end
- Circular chains — handler A passes to B, which passes to A (infinite loop)
- Debugging difficulty — tracing which handler processed (or skipped) a request through a long chain

### Interview Q&A

**Q: Chain of Responsibility vs Decorator?**  
Both chain objects, but CoR can **stop** the chain (only one handler processes). Decorator always passes through the **full chain**, each adding behavior. CoR = "who handles this?"; Decorator = "everyone adds something."

**Q: Real-world examples?**  
Servlet Filters, Spring Security filter chain, logging frameworks (handlers with severity levels), exception handling (catch blocks try to handle, or rethrow up the call stack).

---

## 9. Mediator

> **Define an object that encapsulates how a set of objects interact. Objects communicate through the mediator, not directly.**

### Implementation

```java
// Mediator
public class ChatRoom {
    private final Map<String, User> users = new HashMap<>();

    public void register(User user) {
        users.put(user.getName(), user);
        user.setChatRoom(this);
    }

    public void sendMessage(String message, String from, String to) {
        User recipient = users.get(to);
        if (recipient != null) {
            recipient.receive(message, from);
        }
    }

    public void broadcast(String message, String from) {
        users.values().stream()
             .filter(u -> !u.getName().equals(from))
             .forEach(u -> u.receive(message, from));
    }
}

// Colleague
public class User {
    private final String name;
    private ChatRoom chatRoom;

    public User(String name) { this.name = name; }

    public String getName() { return name; }
    public void setChatRoom(ChatRoom room) { this.chatRoom = room; }

    public void send(String message, String to) {
        chatRoom.sendMessage(message, name, to);
    }

    public void broadcast(String message) {
        chatRoom.broadcast(message, name);
    }

    public void receive(String message, String from) {
        System.out.println("[" + name + "] Message from " + from + ": " + message);
    }
}
```

### Real-World Analogy
An air traffic control tower: planes don't communicate directly with each other. They all talk to the tower (mediator), which coordinates takeoffs, landings, and routing. This prevents chaos from n² direct communication channels.

### When NOT to Use
- Only 2-3 objects communicate — direct references are simpler
- The mediator becomes a God object that knows too much about every colleague
- Communication patterns are simple and don't change

### Common Pitfalls
- **God mediator** — the mediator accumulates all the logic and becomes the most complex class in the system
- Tight coupling to the mediator — colleagues become useless without their specific mediator
- Over-centralizing — not every interaction needs to go through a mediator

### Interview Q&A

**Q: Mediator vs Observer?**  
Mediator centralizes communication (colleagues → mediator → colleagues). Observer is decentralized (subject notifies all observers directly). Use Mediator when interactions are complex and bidirectional; Observer when it's simple one-to-many notification.

**Q: Where is Mediator used?**  
`java.util.Timer` (coordinates TimerTasks), dialog boxes (mediator coordinates buttons, text fields, checkboxes), Spring's `DispatcherServlet` (mediates between request and appropriate controller).

---

## 10. Memento

> **Capture and externalize an object's internal state so it can be restored later.**

### Implementation

```java
// Memento — immutable snapshot
public record EditorMemento(String content, int cursorPosition) {}

// Originator
public class Editor {
    private String content = "";
    private int cursorPosition = 0;

    public void type(String text) {
        content = content.substring(0, cursorPosition) + text + content.substring(cursorPosition);
        cursorPosition += text.length();
    }

    public EditorMemento save() {
        return new EditorMemento(content, cursorPosition);
    }

    public void restore(EditorMemento memento) {
        this.content = memento.content();
        this.cursorPosition = memento.cursorPosition();
    }

    public String getContent() { return content; }
}

// Caretaker
public class UndoManager {
    private final Deque<EditorMemento> history = new ArrayDeque<>();

    public void save(EditorMemento memento) {
        history.push(memento);
    }

    public EditorMemento undo() {
        if (history.isEmpty()) throw new RuntimeException("Nothing to undo");
        return history.pop();
    }
}

// Usage
Editor editor = new Editor();
UndoManager undoManager = new UndoManager();

undoManager.save(editor.save());
editor.type("Hello");

undoManager.save(editor.save());
editor.type(" World");
// content = "Hello World"

editor.restore(undoManager.undo());
// content = "Hello"
```

### Real-World Analogy
Saving a video game: you create a save file (memento) that captures your character's position, health, inventory, and quest progress. You can load any previous save to restore that exact state, without the save system understanding the game's internals.

### When NOT to Use
- Object state is trivially small and can be recalculated rather than stored
- Creating mementos is too expensive (large state that's saved frequently)
- You don't need undo/restore — the overhead of storing snapshots isn't justified

### Common Pitfalls
- **Memory bloat** — storing too many full snapshots. Consider incremental/delta mementos for large states
- Exposing internal state through the memento — memento should be opaque to the caretaker (use package-private or inner classes)
- Forgetting to make mementos immutable — if the originator modifies objects shared with the memento, the snapshot is corrupted

### Interview Q&A

**Q: Memento vs Command for undo?**  
Command stores the **action** and reverses it (`undo()`). Memento stores the **full state** and restores it. Command is memory-efficient (stores deltas). Memento is simpler but stores full snapshots. Often combined: Command for undo logic, Memento for state snapshots.

**Q: How to handle large state?**  
Use incremental mementos (store only the diff/delta from the previous state), or use serialization with compression. Java's `Serializable` can help, but consider deep-copy pitfalls with mutable nested objects.

---

## 11. Visitor

> **Represent an operation to be performed on elements of an object structure. Add new operations without modifying the classes.**

### Implementation

```java
// Element interface
public interface Shape {
    void accept(ShapeVisitor visitor);
}

public class Circle implements Shape {
    private final double radius;
    public Circle(double radius) { this.radius = radius; }
    public double getRadius() { return radius; }

    @Override
    public void accept(ShapeVisitor visitor) { visitor.visit(this); }
}

public class RectangleShape implements Shape {
    private final double width, height;
    public RectangleShape(double w, double h) { this.width = w; this.height = h; }
    public double getWidth() { return width; }
    public double getHeight() { return height; }

    @Override
    public void accept(ShapeVisitor visitor) { visitor.visit(this); }
}

// Visitor interface
public interface ShapeVisitor {
    void visit(Circle circle);
    void visit(RectangleShape rectangle);
}

// Concrete visitors — new operations without modifying Shape classes
public class AreaCalculator implements ShapeVisitor {
    private double totalArea = 0;

    @Override
    public void visit(Circle c) { totalArea += Math.PI * c.getRadius() * c.getRadius(); }

    @Override
    public void visit(RectangleShape r) { totalArea += r.getWidth() * r.getHeight(); }

    public double getTotalArea() { return totalArea; }
}

public class JsonExporter implements ShapeVisitor {
    private final List<String> elements = new ArrayList<>();

    @Override
    public void visit(Circle c) {
        elements.add("{\"type\":\"circle\",\"radius\":" + c.getRadius() + "}");
    }

    @Override
    public void visit(RectangleShape r) {
        elements.add("{\"type\":\"rect\",\"w\":" + r.getWidth() + ",\"h\":" + r.getHeight() + "}");
    }

    public String export() { return "[" + String.join(",", elements) + "]"; }
}
```

### Real-World Analogy
A tax inspector visiting different types of businesses: the inspector (visitor) applies a different audit procedure to a restaurant, a factory, and an office. New audit types (fire safety, health inspection) can be added without changing the businesses themselves.

### When NOT to Use
- The element class hierarchy changes frequently — adding a new element type requires updating **every** visitor
- The operations are simple enough to put directly in the element classes
- Double dispatch complexity isn't justified for the use case

### Common Pitfalls
- **Breaking encapsulation** — visitors often need access to element internals, which can violate encapsulation
- Adding new element types is painful — every existing visitor must be updated (violates OCP for elements)
- Overusing Visitor for simple operations that could be polymorphic methods on the elements themselves

### Interview Q&A

**Q: What is double dispatch?**  
Normally, the method called depends only on the object type (single dispatch). With Visitor, the method called depends on BOTH the element type AND the visitor type. `element.accept(visitor)` dispatches on element type, then `visitor.visit(element)` dispatches on visitor type.

**Q: Visitor vs adding methods directly?**  
Visitor is better when: (1) the element hierarchy is **stable** (rarely new types), (2) you frequently add **new operations**, and (3) operations don't belong in the element classes (separation of concerns). Otherwise, just add methods to the elements.

---

## 12. Comparison & When to Use

| Pattern | Key Signal | Example |
|---------|-----------|---------|
| **Strategy** | "Different ways to do X" | Payment methods, sort algorithms |
| **Observer** | "Notify when X changes" | Event systems, pub-sub |
| **State** | "Behavior depends on current state" | Vending machine, order lifecycle |
| **Command** | "Undo, queue, or log actions" | Text editor, transaction log |
| **Template Method** | "Same flow, different steps" | Data parsers, test fixtures |
| **Iterator** | "Traverse a collection" | Custom collections, pagination |
| **Chain of Responsibility** | "Pipeline of handlers" | Middleware, validation |
| **Mediator** | "Many objects need to communicate" | Chat room, air traffic control |
| **Memento** | "Save and restore state" | Undo, checkpoints |
| **Visitor** | "Add operations to class hierarchy" | Serialization, analysis |

---

## 13. Interview Tips

1. **Strategy + Observer + State** are the top 3 to know deeply
2. **Command** — Mention it whenever undo/redo is needed
3. **Chain of Responsibility** — Middleware, request validation, logging pipelines
4. **State vs Strategy** — Know the difference (state transitions itself, strategy is set externally)
5. **Combine patterns** — Observer + Mediator for chat systems, Command + Memento for undo
6. **Name the pattern** — "I'm using Observer here because multiple components need to react to price changes"
