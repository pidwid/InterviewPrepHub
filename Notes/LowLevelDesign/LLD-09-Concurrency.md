# Concurrency and Multi-threading

> Concurrency is a critical topic for senior engineering interviews. Understanding threads, synchronization primitives, and common concurrency problems separates mid-level from senior engineers.

---

## Table of Contents

1. [Introduction to Concurrency](#1-introduction-to-concurrency)
2. [Concurrency vs Parallelism](#2-concurrency-vs-parallelism)
3. [Processes vs Threads](#3-processes-vs-threads)
4. [Thread Lifecycle and States](#4-thread-lifecycle-and-states)
5. [Race Conditions and Critical Sections](#5-race-conditions-and-critical-sections)
6. [Synchronization Primitives](#6-synchronization-primitives)
7. [Locks and Locking Strategies](#7-locks-and-locking-strategies)
8. [Deadlock, Livelock, and Starvation](#8-deadlock-livelock-and-starvation)
9. [Concurrent Data Structures](#9-concurrent-data-structures)
10. [Common Concurrency Patterns](#10-common-concurrency-patterns)
11. [Java Concurrency Toolkit](#11-java-concurrency-toolkit)
12. [Interview Tips](#12-interview-tips)

---

## 1. Introduction to Concurrency

Concurrency is about **managing multiple tasks that can make progress** within overlapping time periods. It doesn't necessarily mean they run simultaneously.

| Concept | Definition |
|---------|------------|
| **Concurrency** | Structuring a program to handle multiple tasks (may interleave on a single core) |
| **Parallelism** | Actually executing multiple tasks simultaneously (requires multiple cores) |
| **Thread** | Lightweight unit of execution within a process |
| **Process** | Independent program with its own memory space |

### Why Concurrency Matters in LLD

- **Singleton** — Must be thread-safe (double-checked locking)
- **Observer** — Thread-safe notification publishing
- **Connection pools** — Multiple threads sharing limited resources
- **Any shared state** — Requires synchronization

---

## 2. Concurrency vs Parallelism

| Aspect | Concurrency | Parallelism |
|--------|------------|-------------|
| **Definition** | Dealing with multiple things at once | Doing multiple things at once |
| **CPU requirement** | Single core sufficient | Multiple cores required |
| **Analogy** | One chef, two dishes (alternating) | Two chefs, two dishes (simultaneous) |
| **Goal** | Structure, responsiveness | Throughput, speed |
| **Example** | Web server handling multiple requests | MapReduce processing data in parallel |

```java
// Concurrency — Thread interleaving (even on single core)
ExecutorService executor = Executors.newFixedThreadPool(2);
executor.submit(() -> handleRequest("A"));
executor.submit(() -> handleRequest("B"));

// Parallelism — Actual simultaneous execution
IntStream.range(0, 1000000)
    .parallel()
    .map(i -> heavyComputation(i))
    .sum();
```

---

## 3. Processes vs Threads

| Feature | Process | Thread |
|---------|---------|--------|
| **Memory** | Own address space | Share process memory |
| **Creation cost** | Expensive | Lightweight |
| **Communication** | IPC (pipes, sockets, shared memory) | Shared variables (with synchronization) |
| **Crash impact** | Other processes unaffected | Can crash entire process |
| **Context switch** | Expensive (TLB flush, page tables) | Cheaper (share address space) |

### Creating Threads in Java

```java
// Method 1: Extending Thread
public class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("Running in " + Thread.currentThread().getName());
    }
}

// Method 2: Implementing Runnable (preferred)
Runnable task = () -> System.out.println("Running in " + Thread.currentThread().getName());
Thread thread = new Thread(task);
thread.start();

// Method 3: Using ExecutorService (best practice)
ExecutorService executor = Executors.newFixedThreadPool(4);
Future<String> future = executor.submit(() -> {
    return "Result from background thread";
});
String result = future.get();  // Blocks until complete
```

---

## 4. Thread Lifecycle and States

```
        ┌──────────────┐
   new  │              │  start()
───────>│     NEW      │──────────┐
        │              │          │
        └──────────────┘          │
                                  ▼
        ┌──────────────┐   ┌──────────────┐
        │   BLOCKED    │<──│   RUNNABLE   │
        │ (waiting for │   │  (ready to   │
        │   monitor)   │──>│  run / running│
        └──────────────┘   └──────┬───────┘
                                  │
        ┌──────────────┐          │  wait() / sleep()
        │   WAITING    │<─────────┤
        │              │──────────│  notify() / timeout
        └──────────────┘          │
                                  │
        ┌──────────────┐          │  run() completes
        │  TERMINATED  │<─────────┘
        └──────────────┘
```

| State | Description |
|-------|-------------|
| **NEW** | Thread created but not started |
| **RUNNABLE** | Ready to run or currently running |
| **BLOCKED** | Waiting to acquire a monitor lock |
| **WAITING** | Waiting indefinitely for another thread |
| **TIMED_WAITING** | Waiting for a specified time |
| **TERMINATED** | Finished execution |

---

## 5. Race Conditions and Critical Sections

A **race condition** occurs when two threads access shared data and the outcome depends on the order of execution.

### ❌ Race Condition

```java
public class Counter {
    private int count = 0;

    public void increment() {
        count++;  // NOT atomic! Read → Modify → Write
    }

    // Thread 1: reads count=5, increments to 6
    // Thread 2: reads count=5 (before T1 writes), increments to 6
    // Expected: 7, Actual: 6 — LOST UPDATE!
}
```

### ✅ Fixed with Synchronization

```java
public class ThreadSafeCounter {
    private int count = 0;

    public synchronized void increment() {
        count++;  // Only one thread can execute this at a time
    }

    public synchronized int getCount() {
        return count;
    }
}
```

### ✅ Fixed with AtomicInteger (Lock-Free)

```java
public class AtomicCounter {
    private final AtomicInteger count = new AtomicInteger(0);

    public void increment() {
        count.incrementAndGet();  // CAS-based, no locks
    }

    public int getCount() {
        return count.get();
    }
}
```

---

## 6. Synchronization Primitives

### Mutex (synchronized / ReentrantLock)

A **mutex** provides mutual exclusion — only one thread can hold it at a time.

```java
public class BankAccount {
    private final ReentrantLock lock = new ReentrantLock();
    private double balance;

    public void transfer(BankAccount to, double amount) {
        lock.lock();
        try {
            if (balance >= amount) {
                balance -= amount;
                to.deposit(amount);
            }
        } finally {
            lock.unlock();  // ALWAYS unlock in finally!
        }
    }

    public void deposit(double amount) {
        lock.lock();
        try {
            balance += amount;
        } finally {
            lock.unlock();
        }
    }
}
```

### Semaphore

A **semaphore** allows up to N threads to access a resource simultaneously.

```java
public class ConnectionPool {
    private final Semaphore semaphore;
    private final Queue<Connection> pool;

    public ConnectionPool(int maxConnections) {
        this.semaphore = new Semaphore(maxConnections);
        this.pool = new ConcurrentLinkedQueue<>();
        for (int i = 0; i < maxConnections; i++) {
            pool.add(createConnection());
        }
    }

    public Connection acquire() throws InterruptedException {
        semaphore.acquire();  // Blocks if no permits available
        return pool.poll();
    }

    public void release(Connection conn) {
        pool.offer(conn);
        semaphore.release();  // Return permit
    }
}
```

### Condition Variables

**Condition variables** allow threads to wait for a specific condition to become true.

```java
public class BoundedBuffer<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    public BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (queue.size() == capacity) {
                notFull.await();  // Wait until space available
            }
            queue.offer(item);
            notEmpty.signal();  // Notify waiting consumers
        } finally {
            lock.unlock();
        }
    }

    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await();  // Wait until item available
            }
            T item = queue.poll();
            notFull.signal();  // Notify waiting producers
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

---

## 7. Locks and Locking Strategies

### Coarse-grained vs Fine-grained Locking

| Approach | Description | Trade-off |
|----------|-------------|-----------|
| **Coarse-grained** | One lock for the entire data structure | Simple but low concurrency |
| **Fine-grained** | Multiple locks for different parts | High concurrency but complex |

```java
// Coarse-grained — one lock for entire map
public class CoarseMap<K, V> {
    private final Map<K, V> map = new HashMap<>();
    private final ReentrantLock lock = new ReentrantLock();

    public void put(K key, V value) {
        lock.lock();
        try { map.put(key, value); }
        finally { lock.unlock(); }
    }
}

// Fine-grained — lock per bucket (like ConcurrentHashMap)
public class StripedMap<K, V> {
    private static final int NUM_STRIPES = 16;
    private final Map<K, V>[] buckets;
    private final ReentrantLock[] locks;

    @SuppressWarnings("unchecked")
    public StripedMap() {
        buckets = new HashMap[NUM_STRIPES];
        locks = new ReentrantLock[NUM_STRIPES];
        for (int i = 0; i < NUM_STRIPES; i++) {
            buckets[i] = new HashMap<>();
            locks[i] = new ReentrantLock();
        }
    }

    private int stripe(K key) {
        return Math.abs(key.hashCode() % NUM_STRIPES);
    }

    public void put(K key, V value) {
        int s = stripe(key);
        locks[s].lock();
        try { buckets[s].put(key, value); }
        finally { locks[s].unlock(); }
    }
}
```

### ReadWriteLock

When reads are much more frequent than writes:

```java
public class CachedData {
    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();
    private Map<String, String> cache = new HashMap<>();

    public String get(String key) {
        rwLock.readLock().lock();  // Multiple readers allowed
        try { return cache.get(key); }
        finally { rwLock.readLock().unlock(); }
    }

    public void put(String key, String value) {
        rwLock.writeLock().lock();  // Exclusive access
        try { cache.put(key, value); }
        finally { rwLock.writeLock().unlock(); }
    }
}
```

### Compare-and-Swap (CAS)

Lock-free synchronization using atomic operations:

```java
public class CASCounter {
    private final AtomicInteger value = new AtomicInteger(0);

    public void increment() {
        int expected;
        do {
            expected = value.get();
        } while (!value.compareAndSet(expected, expected + 1));
        // Retry if another thread modified value between get() and CAS
    }
}
```

---

## 8. Deadlock, Livelock, and Starvation

### Deadlock

Two or more threads waiting for each other to release locks.

```
Thread 1: lock(A) → waiting for lock(B)
Thread 2: lock(B) → waiting for lock(A)
→ Both blocked forever!
```

**Four necessary conditions (Coffman conditions):**
1. **Mutual exclusion** — Resource held exclusively
2. **Hold and wait** — Thread holds one lock, waits for another
3. **No preemption** — Locks can't be forcibly taken
4. **Circular wait** — Circular chain of dependencies

**Prevention — Ordered locking:**

```java
public class SafeTransfer {
    public void transfer(BankAccount from, BankAccount to, double amount) {
        // Always lock in a consistent order (e.g., by ID)
        BankAccount first = from.getId() < to.getId() ? from : to;
        BankAccount second = from.getId() < to.getId() ? to : from;

        synchronized (first) {
            synchronized (second) {
                from.debit(amount);
                to.credit(amount);
            }
        }
    }
}
```

### Livelock

Threads actively respond to each other but make no progress (like two people in a hallway dodging the same way).

### Starvation

A thread never gets CPU time because higher-priority threads monopolize the scheduler. Use `ReentrantLock(true)` for fair locking.

---

## 9. Concurrent Data Structures

| Data Structure | Thread-Safe Version | Use Case |
|---------------|-------------------|----------|
| `HashMap` | `ConcurrentHashMap` | Key-value cache |
| `ArrayList` | `CopyOnWriteArrayList` | Read-heavy, rare writes |
| `LinkedList` | `ConcurrentLinkedQueue` | Producer-consumer queue |
| `TreeMap` | `ConcurrentSkipListMap` | Sorted concurrent map |
| `HashSet` | `ConcurrentHashMap.newKeySet()` | Concurrent set |
| `Queue` | `LinkedBlockingQueue` | Bounded blocking queue |

---

## 10. Common Concurrency Patterns

### Producer-Consumer

```java
public class ProducerConsumer {
    private final BlockingQueue<String> queue;

    public ProducerConsumer(int capacity) {
        queue = new LinkedBlockingQueue<>(capacity);
    }

    public void produce(String item) throws InterruptedException {
        queue.put(item);  // Blocks if full
    }

    public String consume() throws InterruptedException {
        return queue.take();  // Blocks if empty
    }
}
```

### Thread Pool

```java
// Fixed thread pool — best for CPU-bound tasks
ExecutorService cpuPool = Executors.newFixedThreadPool(
    Runtime.getRuntime().availableProcessors()
);

// Cached thread pool — best for I/O-bound tasks
ExecutorService ioPool = Executors.newCachedThreadPool();

// Scheduled pool — for periodic tasks
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
scheduler.scheduleAtFixedRate(
    () -> System.out.println("Heartbeat"),
    0, 5, TimeUnit.SECONDS
);
```

### Reader-Writer Pattern

```java
// Use ReadWriteLock (see Section 7 above)
// Multiple readers can proceed concurrently
// Writers get exclusive access
```

---

## 11. Java Concurrency Toolkit

| Class | Purpose |
|-------|---------|
| `synchronized` | Built-in monitor lock |
| `ReentrantLock` | Explicit lock with tryLock, fairness |
| `ReadWriteLock` | Separate read/write locks |
| `Semaphore` | Counting permit system |
| `CountDownLatch` | Wait for N events to complete |
| `CyclicBarrier` | Wait for N threads to reach a point |
| `Phaser` | Advanced barrier for phases of computation |
| `CompletableFuture` | Async programming with chaining |
| `AtomicInteger/Long/Reference` | Lock-free atomic operations |
| `volatile` | Visibility guarantee (no caching) |

### CountDownLatch Example

```java
public class ServiceInitializer {
    public void startAll() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(3);

        new Thread(() -> { initDatabase(); latch.countDown(); }).start();
        new Thread(() -> { initCache(); latch.countDown(); }).start();
        new Thread(() -> { initMessageQueue(); latch.countDown(); }).start();

        latch.await();  // Wait for all 3 services to initialize
        System.out.println("All services ready!");
    }
}
```

---

## 12. Interview Tips

1. **Race condition → synchronized/Lock/Atomic** — Show you know multiple approaches
2. **Deadlock** — Know Coffman conditions and prevention (ordered locking, timeout)
3. **Producer-Consumer** — Use `BlockingQueue`, demonstrate with bounded buffer
4. **Thread pool sizing** — CPU-bound: `N_cores`, I/O-bound: `N_cores * (1 + wait_time/compute_time)`
5. **Always use try-finally** — `lock.lock(); try { ... } finally { lock.unlock(); }`  
6. **Prefer higher-level constructs** — `ExecutorService` over raw `Thread`, `AtomicInteger` over `synchronized`
7. **volatile vs synchronized** — volatile = visibility only; synchronized = visibility + atomicity
8. **Common question pattern**: "Make this class thread-safe" → identify shared mutable state, choose synchronization mechanism
