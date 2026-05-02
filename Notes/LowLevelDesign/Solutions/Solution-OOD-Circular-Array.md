# 🛠️ Design a Circular Array / Ring Buffer

## Executive Summary

The **Circular Array** (also called **Ring Buffer** or **Circular Buffer**) is a fixed-capacity data structure that efficiently manages a bounded queue of elements using a single contiguous array, providing **O(1)** operations for enqueue, dequeue, random access, and iteration. The **CTCI Q7 variant** emphasizes the **Iterator pattern challenge**: producing elements in insertion order despite physical wraparound via modulo arithmetic. This solution covers functional & non-functional requirements, OOP entities, key algorithms, design patterns, thread-safety strategies, and real-world use cases.

---

## 1. Requirements Analysis

### Functional Requirements

- **Fixed-Capacity Storage**: Holds exactly N elements in a pre-allocated contiguous array; capacity is immutable after construction
- **Queue Semantics**: Supports add/enqueue at tail, remove/dequeue/poll at head  
- **Bounded Overflow Behavior**:
  - **Lossy Mode** (default in metrics/telemetry): When full, next `add()` overwrites the oldest element (auto-rotates head)
  - **Strict Mode** (bounded queue): When full, `add()` throws exception or blocks (returns false)
- **Random Access**: `get(int index)` returns element at logical position 0..size-1 in insertion order, O(1)
- **Iterator in Insertion Order**: **CTCI Core Insight**—iterator must yield elements in the order they were added, even though physical storage wraps around the array. This is the design question's defining challenge.
- **Generic Type Support**: `CircularArray<T>` to work with any type
- **Query Operations**: `size()`, `capacity()`, `isEmpty()`, `isFull()`

### Non-Functional Requirements

- **Time Complexity**: O(1) worst-case for all operations (no resizing, no searching, constant-factor operations)
- **Space Complexity**: O(N) for N elements + O(1) overhead (3 fields: head, size, capacity)
- **Cache Locality**: Contiguous array layout (unlike linked lists) ensures better CPU cache utilization for high-frequency access patterns
- **Deterministic Latency**: No dynamic allocation after initialization; no garbage collection pauses in hot paths
- **Thread-Safe Variants**: Synchronized wrappers for multi-threaded use; lock-free designs for ultra-low-latency scenarios
- **Memory Efficiency**: No per-element allocation overhead; bounded memory footprint

---

## 2. Core Entities & Class Design

### Primary Entity: `CircularArray<T>`

```
CircularArray<T>
├─ Fields (Minimal Design):
│  ├─ items: T[]              // Fixed array of capacity N
│  ├─ head: int               // Index of oldest/first element (dequeue position)
│  ├─ size: int               // Current count of elements (0..capacity)
│  └─ capacity: int           // Fixed capacity (N, immutable)
│
└─ Computed Property (NOT stored):
   └─ tail: int = (head + size) % capacity  // Position of next enqueue
```

### Why Only 3 Fields? (Design Insight)

Storing both `head` and `tail` independently creates a synchronization bug:
- If `head` and `tail` are updated separately, one could advance while the other is stale
- **Single source of truth**: `size` + `head` uniquely determine `tail` via modulo arithmetic
- **Benefit**: Eliminates redundancy; reduces cognitive load; makes the invariant clear

### Supporting Interfaces & Strategies

```
OverwritePolicy (Strategy Pattern)
├─ LossyOverwrite: 
│  └─ When full: overwrite items[head]; head = (head+1) % capacity
└─ RejectOnFull: 
   └─ When full: throw OverflowException or return false

Iterator<T> (GoF Pattern)
├─ hasNext(): boolean
├─ next(): T
└─ Implementation: CircularArrayIterator<T>
   ├─ currentLogicalIndex: int  // 0..size-1
   └─ Translates to physical via: (head + currentLogicalIndex) % capacity
```

---

## 3. Key Algorithms & Data Structure Operations

### Algorithm 1: `add(T item)` — Enqueue (Add to Tail)

```
if (size < capacity) {
    // Space available: add to tail position
    int tailIndex = (head + size) % capacity
    items[tailIndex] = item
    size++
} else {
    // Buffer is full—apply overflow policy
    
    if (lossyMode) {
        // Strategy A: Lossy (overwrite oldest)
        items[head] = item
        head = (head + 1) % capacity
        // size remains at capacity
    } else {
        // Strategy B: Strict (reject or block)
        throw new OverflowException("Buffer full") 
        // or: return false
    }
}
```

**Time Complexity**: O(1)  
**Insight**: Modulo ensures we wrap around without special cases at capacity-1

### Algorithm 2: `get(int logicalIndex)` — Random Access

```
if (logicalIndex < 0 || logicalIndex >= size) {
    throw new IndexOutOfBoundsException()
}
int physicalIndex = (head + logicalIndex) % capacity
return items[physicalIndex]
```

**Time Complexity**: O(1)  
**Use Case**: Inspect buffer contents without removing; e.g., log buffer entries or metrics

### Algorithm 3: `remove()` / `poll()` — Dequeue (Remove from Head)

```
if (size == 0) {
    throw new NoSuchElementException()  // or return null
}
T item = items[head]
items[head] = null  // Help garbage collection (if T is reference type)
head = (head + 1) % capacity
size--
return item
```

**Time Complexity**: O(1)  
**Semantics**: FIFO—removes oldest element

### Algorithm 4: `iterator()` — The CTCI Magic (Iterator Pattern)

```java
public Iterator<T> iterator() {
    return new CircularArrayIterator<>(this);
}

private class CircularArrayIterator<T> implements Iterator<T> {
    private int currentLogicalIndex = 0;       // Logical position: 0..size-1
    private final int capturedSize;             // Snapshot at creation time
    
    CircularArrayIterator(CircularArray<T> buffer) {
        this.capturedSize = buffer.size;        // Capture size to handle concurrent adds
    }
    
    @Override
    public boolean hasNext() {
        return currentLogicalIndex < capturedSize;
    }
    
    @Override
    public T next() {
        if (!hasNext()) {
            throw new NoSuchElementException();
        }
        // Translate logical index to physical position via modulo
        int physicalIndex = (head + currentLogicalIndex) % capacity;
        T result = items[physicalIndex];
        currentLogicalIndex++;
        return result;
    }
}
```

**The CTCI Insight**: 
- Iterator maintains a **logical index** (0..size-1) that represents insertion order
- **Modulo translation**: `(head + logicalIndex) % capacity` unwraps the circular storage transparently
- **Snapshot size**: Capturing size at iterator creation provides consistency (prevents concurrent modification issues)
- **Time Complexity**: O(1) per `next()` call; O(N) to iterate all elements
- **This is the core design challenge**: The iterator must hide the wraparound logic, making the buffer appear as a normal list to the user

---

## 4. Design Patterns Applied

### Pattern 1: **Iterator (GoF Behavioral)**

**Why It's Essential Here**:
- The entire CTCI question centers on implementing `Iterable<T>` and `Iterator<T>`
- Without this pattern, users must manually handle the modulo arithmetic
- Pattern encapsulates the "unwrapping" logic

**Implementation**: 
- `CircularArray<T> implements Iterable<T>`
- Inner class `CircularArrayIterator<T> implements Iterator<T>`
- Modulo translation hidden inside `next()`

**Benefit**: Decouples iteration logic from storage; clean, familiar Java interface

---

### Pattern 2: **Strategy (GoF Behavioral)**

**Why It's Useful**:
- Overflow behavior is a policy choice (lossy vs. strict)
- Rather than hardcoding if-else, inject the strategy

**Implementation**:
```java
interface OverflowPolicy {
    void handleOverflow(CircularArray buffer);
}

class LossyOverwrite implements OverflowPolicy {
    public void handleOverflow(CircularArray buffer) {
        buffer.items[buffer.head] = newItem;
        buffer.head = (buffer.head + 1) % buffer.capacity;
    }
}

class RejectOnFull implements OverflowPolicy {
    public void handleOverflow(CircularArray buffer) throws OverflowException {
        throw new OverflowException();
    }
}

// Usage:
CircularArray<Integer> buffer = new CircularArray<>(10, new LossyOverwrite());
```

**Benefit**: 
- No branching in `add()` logic; policy injected at construction
- Easy to add new overflow strategies without modifying CircularArray
- Follows Open-Closed Principle

---

### Pattern 3: **Template Method (GoF Behavioral)**

**Why It's Useful** (for variants):
- If building synchronized or blocking versions, Template Method prevents code duplication

**Example**:
```java
abstract class AbstractCircularArray<T> {
    protected abstract void beforeAdd();
    protected abstract void afterAdd();
    
    public void add(T item) {
        beforeAdd();
        // ... add logic ...
        afterAdd();
    }
}

class SynchronizedCircularArray<T> extends AbstractCircularArray<T> {
    protected void beforeAdd() { lock.lock(); }
    protected void afterAdd() { lock.unlock(); }
}
```

**Benefit**: Avoids duplicating core logic across synchronized/unsynchronized variants

---

### Pattern 4: **Builder (GoF Creational)**

**Verdict**: **NOT USEFUL** here
- Constructor is simple: `CircularArray(int capacity)` or `CircularArray(int capacity, OverflowPolicy policy)`
- No complex initialization; no optional nested objects
- Adding a builder would be overengineering (YAGNI principle)

---

## 5. Thread Safety & Concurrency Strategies

### Strategy 1: **Simple Synchronized (Monitor Pattern)**

```java
public class SynchronizedCircularArray<T> {
    private CircularArray<T> buffer;
    
    public synchronized void add(T item) { buffer.add(item); }
    public synchronized T remove() { return buffer.remove(); }
    public synchronized T get(int i) { return buffer.get(i); }
    public synchronized Iterator<T> iterator() { return buffer.iterator(); }
}
```

**Pros**:
- Simple, straightforward; works for most applications
- No risk of race conditions
- Java's standard `Collections.synchronizedList()` pattern

**Cons**:
- Lock contention under high concurrency; all threads queue on one lock
- Not suitable for ultra-low-latency systems (trading, real-time)
- Throughput limited by serialization

**When to Use**: Multi-reader/multi-writer with acceptable latency (typical business apps, logging)

---

### Strategy 2: **Lock-Free SPSC (Single Producer, Single Consumer)**

**Design**:
- One thread only writes (producer)
- One thread only reads (consumer)
- Atomic fields (`AtomicInteger`) or `volatile` to ensure visibility

**Implementation Sketch**:
```java
public class SPSCCircularArray<T> {
    private T[] items;
    private int capacity;
    private volatile int head = 0;  // Consumer advances
    private volatile int tail = 0;  // Producer advances
    
    public void add(T item) {  // Producer only
        items[tail % capacity] = item;
        tail++;  // Publish via volatile write
    }
    
    public T remove() {  // Consumer only
        T result = items[head % capacity];
        head++;  // Publish via volatile write
        return result;
    }
}
```

**Pros**:
- **Zero lock overhead**; no contention
- **Ultra-low latency**: Millions of ops/sec with nanosecond consistency
- Highly predictable; no CAS retries or spinning
- Excellent for producer-consumer pipelines (data ingestion, event processing)

**Cons**:
- Only works for 1 producer + 1 consumer
- Requires careful memory ordering knowledge
- Java's memory model complexity

**Real-World Example**: **LMAX Disruptor**
- High-frequency trading: processes millions of orders/sec
- Lock-free SPSC + mechanical sympathy (cache-line padding)
- Latency: 100-200 nanoseconds; throughput: 6+ million events/sec
- URL: https://lmax-exchange.github.io/disruptor/

---

### Strategy 3: **Lock-Free MPMC (Multi-Producer, Multi-Consumer)**

**Design**:
- Multiple threads may produce or consume simultaneously
- Uses atomic Compare-And-Swap (CAS) loops to claim slots
- More complex; higher overhead than SPSC

**Implementation Sketch**:
```java
public class MPMCCircularArray<T> {
    private T[] items;
    private int capacity;
    private AtomicInteger head = new AtomicInteger(0);
    private AtomicInteger tail = new AtomicInteger(0);
    
    public boolean add(T item) {
        while (true) {
            int t = tail.get();
            if (t - head.get() >= capacity) return false;  // Full
            if (tail.compareAndSet(t, t + 1)) {
                items[t % capacity] = item;
                return true;
            }
            // CAS failed; retry
        }
    }
}
```

**Pros**:
- Supports arbitrary number of producers/consumers
- No lock waits or blocking
- Highest concurrency for multi-threaded scenarios

**Cons**:
- Very complex; ABA problem, memory ordering, CAS retry loops
- Higher overhead per operation than lock-free SPSC
- CAS failures increase under high contention (busy-waiting/spinning)
- Harder to reason about correctness

**When to Use**: Multi-threaded, high-throughput systems where lock-free semantics are critical (but less common than SPSC for ring buffers)

---

### Strategy 4: **ReentrantReadWriteLock (Selective Locking)**

**When Applicable**: Many readers, few writers  
**Trade-off**: Read operations don't block each other; write operations still exclusive  
**Not Ideal for Circular Buffers**: All operations are O(1) and simple; read-write separation doesn't provide much benefit

---

## 6. Real-World Use Cases & Examples

### Use Case 1: **Audit Log / Last N Entries**
- **Example**: Kafka brokers keep the last 100 committed messages for consumer lag tracking
- **Mode**: Lossy (auto-overwrite oldest)
- **Benefit**: Bounded memory; always have recent history without allocation
- **Capacity**: Typical 100-10K entries

### Use Case 2: **Metrics / Time-Series Rolling Window**
- **Example**: Prometheus scrape interval buffer, application latency percentiles (last 60 seconds)
- **Mode**: Lossy with time-based or size-based rotation
- **Benefit**: Cache-friendly, predictable memory, low allocation rate
- **Impact**: Smooth monitoring without GC pauses

### Use Case 3: **Network Packet Buffer (Hardware Ring Buffers)**
- **Example**: Kernel NIC driver RX/TX rings; Linux `net_device.rx_ring[]`
- **Mode**: Strict (drop packets if not consumed in time; firmware increments index)
- **Benefit**: Bounded memory on NIC; prevents buffer overflow from crashing hardware
- **Scale**: Typically 256-4096 slots per ring

### Use Case 4: **Video Frame Buffer**
- **Example**: Real-time video pipeline holds last N frames for fallback/interpolation
- **Mode**: Lossy (drop oldest frame if new frame arrives during processing)
- **Benefit**: Predictable latency, no memory spikes, smooth playback fallbacks
- **Typical Size**: 2-8 frames (24-48 MB for 1080p at 30fps)

### Use Case 5: **Log4j Bounded Async Appender**
- **Example**: `AsyncAppender` decouples logging from I/O using a ring buffer
- **Mode**: Lossy (drop old log entries if I/O can't keep up) or blocking (wait for space)
- **Benefit**: Non-blocking logging up to capacity; prevents log storms from stalling app threads
- **Typical Size**: 256-10K entries

### Use Case 6: **Kafka In-Memory Partition**
- **Example**: Kafka's in-memory segment uses ring buffer principles for message batching
- **Mode**: Bounded with compaction/flush policies
- **Benefit**: Efficient batch I/O, predictable performance, memory control
- **Impact**: Enables low-latency pub-sub

### Use Case 7: **LMAX Disruptor (Ultra-High-Performance Ring Buffer)**
- **Domain**: High-frequency trading, financial tick engines, order routing
- **Architecture**: Lock-free SPSC/MPMC, mechanical sympathy (cache-line padding), batched processing
- **Performance**: 
  - Millions of operations per second
  - Consistent nanosecond latencies (100-200 ns)
  - Throughput: 6+ million events/sec on modern CPUs
- **Reference**: https://lmax-exchange.github.io/disruptor/
- **Key Innovation**: Cache-line padding to avoid false-sharing; event handler batching

---

## 7. Advanced Topics & Refinements

### Topic 1: **Capacity Resizing**
- **In CTCI**: Not required (fixed capacity by design)
- **In Production** (e.g., `ArrayDeque`): Dynamic growth when full (double capacity)
- **Trade-off**: 
  - Resizing is O(N); copies all elements; pauses the system
  - Fixed capacity avoids this; predictable latency
- **Decision**: CTCI stays fixed for simplicity; production code may need resizing

### Topic 2: **Concurrent Modification Exceptions**
- **Challenge**: If buffer is modified (add/remove) during iteration, iterator state becomes invalid
- **Solutions**:
  1. **Snapshot size at iterator creation** (used in CTCI): Protects against size changes; iterator sees consistent view
  2. **Version numbers**: Increment version on each modification; iterator checks version
  3. **Lock during iteration**: Entire buffer locked while iterating (slow)
- **CTCI Approach**: Document as a limitation; don't support concurrent modification

### Topic 3: **Cache-Line Alignment (Mechanical Sympathy)**
- **Problem**: False sharing—if `head` and `tail` share a CPU cache line (64 bytes), one thread's write invalidates the other's cache
- **Impact**: Severe performance degradation under high concurrency (10-100x slower)
- **Solution**: Pad fields to cache-line boundaries
- **LMAX Disruptor Example**:
  ```java
  private volatile long head = 0;
  private long pad1, pad2, pad3, pad4, pad5, pad6, pad7;  // 56 bytes padding
  private volatile long tail = 0;  // Now on separate cache line
  ```
- **CTCI Relevance**: Mention for awareness; not required for basic implementation

### Topic 4: **Generic Type Erasure in Java**
- **Limitation**: `new T[capacity]` doesn't work; Java erases type parameters at runtime
- **Workaround**: `(T[]) new Object[capacity]` with `@SuppressWarnings("unchecked")`
- **Trade-off**: Runtime type-safety (ClassCastException possible) vs. API clarity
- **CTCI Approach**: Show awareness of the limitation; use the cast with warning suppression

### Topic 5: **Empty & Full Detection**
- **Empty**: `size == 0`
- **Full**: `size == capacity`
- **Ambiguity in Some Designs**: If using only `head` and `tail` (no size field), can't distinguish empty (head==tail) from full (head==tail). Solution: reserve one unused slot or use a separate flag.
- **CTCI Design**: Avoid this by including explicit `size` field

---

## 8. Key Design Insights & Gotchas

| Insight | Impact | CTCI Relevance |
|---------|--------|----------------|
| **Store `size`, compute `tail`** | Avoids head-tail desync bugs | Critical—elegant solution |
| **Iterator captures size snapshot** | Handles concurrent adds safely | Core interview point |
| **Modulo wraparound is the magic** | Makes wraparound transparent to user | Key algorithm to explain |
| **Overflow policy is pluggable (Strategy)** | Supports both lossy and strict modes | Shows pattern knowledge |
| **Lock-free SPSC for ultra-low-latency** | Millions of ops/sec with nanosecond latency | Advanced; bonus knowledge |
| **False-sharing from shared cache lines** | 10-100x slowdown; fixable with padding | Advanced; not CTCI core |
| **No capacity resizing** | Predictable O(1) operations; bounded memory | Simplifies design |

---

## 9. References & Authority

### Primary Source: CTCI Question
- **Title**: "Design a Circular Array with Iterator" (OOD Question 7)
- **Author**: Gayle Laakmann McDowell
- **Book**: *Cracking the Coding Interview*, 6th Edition
- **ISBN**: 978-0984782857
- **Key Insight**: Implement `Iterable<T>` and `Iterator<T>` to handle wraparound transparently via modulo translation
- **Interview Difficulty**: Medium—tests understanding of iterators, modulo arithmetic, and OOP design

### Secondary Source: LMAX Disruptor
- **Purpose**: Production-grade, ultra-high-performance ring buffer for latency-sensitive systems
- **Architecture**: Lock-free SPSC/MPMC, mechanical sympathy (cache-line optimization), batched event processing
- **Performance**: 
  - Throughput: 6+ million events/sec
  - Latency: Consistent 100-200 nanoseconds
- **URL**: https://lmax-exchange.github.io/disruptor/
- **Research Paper**: Martin Thompson, et al. "LMAX Disruptor: A High-Performance Inter-Thread Messaging Library" (2012)
- **Open Source**: Apache 2.0 licensed; actively maintained

### Tertiary & Supporting References
- **Java Concurrency in Practice** (Brian Goetz et al.):
  - Chapter 15: "Lock-Free Algorithms"
  - Lock-free design patterns; ABA problem; memory ordering
- **The Art of Computer Programming Vol. 1** (Donald Knuth):
  - Ring buffers, circular queues
  - Mathematical foundations
- **Linux Kernel Source** (kernel/drivers/net/):
  - Real-world network RX/TX ring buffer implementations
  - Hardware-level buffer management
- **Kafka Architecture** (Apache Kafka documentation):
  - In-memory partition buffer; log segment design
  - Producer-consumer semantics
- **Prometheus Metrics** (Prometheus documentation):
  - Rolling window buffers for time-series aggregation
  - Bounded memory patterns

---

## 10. Summary Outline (~400 words)

**Circular Array / Ring Buffer** is a fixed-capacity queue stored in a single contiguous array, optimized for **O(1)** enqueue, dequeue, random access, and iteration. The **CTCI Q7** variant's novelty is the **Iterator Pattern challenge**: transparently yielding elements in insertion order despite physical wraparound using modulo arithmetic.

**Core Design**: Three minimal fields—`items[]` (the array), `head` (oldest element's index), and `size` (current count)—with computed tail: `(head + size) % capacity`. This avoids redundancy and potential desynchronization. The `add()` method places items at `(head + size) % capacity` when space is available, or overwrites the head (lossy mode) or rejects (strict mode) when full. `remove()` retrieves from head, advances it, and decrements size. All operations are constant-time.

**Iterator Magic** (CTCI Core): A dedicated `CircularArrayIterator<T>` captures the buffer's size at creation, then for each logical index `0..size-1`, computes the physical location via `(head + logicalIndex) % capacity`. This **modulo translation** is the design's centerpiece: iteration must unwrap the circular logic invisibly, making the buffer appear as a normal list to the user.

**Design Patterns**: **Iterator (GoF)**—the entire reason for the question; **Strategy**—for overflow policies (lossy vs. strict); **Template Method**—for synchronized variants. Builder is not useful (simple constructor).

**Non-Functional Characteristics**: **O(1) worst-case** for all operations (no resizing), **O(N) space**, **cache-friendly** contiguous storage, **deterministic performance** (no GC pauses in tight loops).

**Overflow Modes**: **Lossy** (default for metrics/telemetry)—overwrites oldest element, useful for audit logs, rolling metrics (Prometheus, Kafka, log4j); **Strict**—throws exception or blocks, used for bounded producer-consumer queues.

**Thread Safety**: **Simple synchronized** monitor for general use (acceptable latency); **Lock-free SPSC** (single producer, single consumer) with volatile head/tail for ultra-low-latency (LMAX Disruptor: millions of ops/sec, nanosecond latencies); **Lock-free MPMC** via CAS loops for arbitrary producer/consumer counts (more complex, higher contention under load).

**Real-World Examples**: Kernel network RX/TX rings, Kafka in-memory partitions, video frame buffers, log4j async appender, Prometheus rolling window metrics, LMAX Disruptor trading engines. All exploit bounded memory, predictable performance, and CPU cache locality.

**Advanced Topics**: Cache-line padding for false-sharing avoidance (Disruptor pattern); concurrent modification exception handling (snapshot size); Java generics workaround (cast Object[] to T[]).

**Key References**: 
- **Cracking the Coding Interview Q7** (Gayle Laakmann McDowell)
- **LMAX Disruptor** (https://lmax-exchange.github.io/disruptor/)
- **Java Concurrency in Practice** (Goetz et al., Ch. 15)

---

## YouTube Video Resource

**Search Query**: `"circular buffer ring buffer LLD interview"` or `"ring buffer data structure"`

**Recommended Channels for Interview Prep**:
- **CodeKarma**: LLD design patterns, iterator implementation
- **Tech Dummies**: Low-level design fundamentals
- **Jackson Gabbard**: System design, data structure interviews
- **NeetCode / AlgoExpert**: Coding interview preparation

**Expected Video Content**:
- Data structure overview (O(1) operations, modulo arithmetic)
- Iterator pattern implementation walkthrough
- Wraparound logic animation/visualization
- Thread-safety considerations (optional, advanced)
- Real-world use cases (metrics, logs, networks)

**Video Duration**: Typically 15-50 minutes for comprehensive coverage

*Note: Web search was unavailable during research. YouTube search directly for latest video recommendations.*

---

## Implementation Checklist

- [ ] **Basic CircularArray<T>**: add(), remove(), get(), size(), isEmpty(), isFull()
- [ ] **Iterator<T>**: Implement Iterable; CircularArrayIterator with modulo translation
- [ ] **Overflow Strategies**: Lossy (rotate head) and Strict (throw or return false)
- [ ] **Generics**: Handle type erasure with `(T[]) new Object[capacity]`
- [ ] **Thread Safety** (optional for CTCI, but good to discuss):
  - [ ] Synchronized wrapper
  - [ ] Lock-free SPSC (volatile fields)
  - [ ] LMAX Disruptor reference
- [ ] **Unit Tests**: Empty, full, wraparound, iterator, concurrent modification
- [ ] **Documentation**: Javadoc for all public methods; explain invariants

---

## Estimated Interview Flow

1. **Clarify Requirements** (5 min): Confirm fixed capacity, overflow mode, iterator necessity
2. **Design Entities** (5 min): Sketch head, size, capacity fields; explain why not storing tail
3. **Code Core Methods** (10 min): add(), remove(), get(), iterator()
4. **Iterator Deep Dive** (5 min): Explain modulo translation; draw diagram showing wraparound
5. **Overflow Policy** (3 min): Show Strategy pattern; mention lossy vs. strict
6. **Thread Safety** (5 min): Mention synchronized; bonus if you discuss lock-free SPSC
7. **Real-World Examples** (2 min): Kafka, Prometheus, log4j, LMAX Disruptor
8. **Testing & Edge Cases** (5 min): Empty, full, wraparound boundaries, iterator invalidation

**Total Interview Time**: 40-50 minutes (typical LLD session)


---

## Sources / Cross-Refs
- *Cracking the Coding Interview* (Gayle Laakmann McDowell, 6th ed.), **Q7.5** ("Design and implement a `CircularArray`").
- *Effective Java* (Joshua Bloch, 3rd ed.), Item 26 (Don't use raw types) & Item 31 (Use bounded wildcards) — generics design rationale.
- Java API docs — `Iterator` & `Iterable` contracts: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Iterator.html
- Java API docs — `ArrayDeque` (a real-world circular-buffer-backed deque): https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/ArrayDeque.html
- LLD-08 Behavioral Patterns (Iterator chapter).
- Solution-Blocking-Queue.md (a circular-buffer-backed bounded queue).
