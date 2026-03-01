# Concurrency Deep Dive (Primitives, Deadlock, Patterns)

> This note expands on the concurrency fundamentals covered in LLD-09. It dives into synchronization primitives, common concurrency bugs, and reusable concurrency patterns — the building blocks you need for multi-threaded LLD problems.

---

## Table of Contents

1. [Concurrency vs Parallelism](#1-concurrency-vs-parallelism)
2. [Processes vs Threads](#2-processes-vs-threads)
3. [Thread Lifecycle & States](#3-thread-lifecycle--states)
4. [Race Conditions & Critical Sections](#4-race-conditions--critical-sections)
5. [Synchronization Primitives](#5-synchronization-primitives)
6. [Concurrency Challenges](#6-concurrency-challenges)
7. [Concurrency Patterns](#7-concurrency-patterns)
8. [Java Concurrency Utilities](#8-java-concurrency-utilities)
9. [Interview Tips](#9-interview-tips)

---

## 1. Concurrency vs Parallelism

```
Concurrency:                        Parallelism:
Multiple tasks make progress        Multiple tasks execute at the
within overlapping time periods.    exact same instant.

Single-core CPU:                    Multi-core CPU:
  Task A ██░░██░░                     Core 1: ████████ Task A
  Task B ░░██░░██                     Core 2: ████████ Task B
  (interleaved)                       (simultaneous)

Concurrency is about STRUCTURE.     Parallelism is about EXECUTION.
You can have concurrency without    You need concurrency to leverage
parallelism (single-core).          parallelism.
```

---

## 2. Processes vs Threads

| Feature          | Process                         | Thread                          |
|------------------|---------------------------------|---------------------------------|
| Memory           | Separate address space          | Shared address space            |
| Communication    | IPC (pipes, sockets, shared mem)| Direct memory access            |
| Creation cost    | Heavy (fork + copy)             | Lightweight                     |
| Crash isolation  | One crash doesn't kill others   | One crash can kill all threads  |
| Context switch   | Expensive                       | Cheaper                         |

```
Process (own memory):              Threads (shared memory):

┌─────────────────┐                ┌─────────────────────────────┐
│ Process A       │                │ Process A                   │
│ ┌─────────────┐ │                │                             │
│ │ Own Heap    │ │                │  ┌───────┐  ┌───────┐       │
│ │ Own Stack   │ │                │  │Thread1│  │Thread2│       │
│ └─────────────┘ │                │  │ Stack │  │ Stack │       │
└─────────────────┘                │  └───────┘  └───────┘       │
┌─────────────────┐                │         ▼    ▼              │
│ Process B       │                │    ┌──────────────┐         │
│ ┌─────────────┐ │                │    │ Shared Heap  │ ← DANGER│
│ │ Own Heap    │ │                │    └──────────────┘         │
│ │ Own Stack   │ │                └─────────────────────────────┘
│ └─────────────┘ │
└─────────────────┘
```

---

## 3. Thread Lifecycle & States

```
        ┌───────────────────────────────────────────────────────┐
        │                                                       │
        ▼                                                       │
    ┌────────┐   start()   ┌──────────┐   run() ends   ┌────────────┐
    │  NEW   │────────────►│ RUNNABLE │───────────────►│ TERMINATED │
    └────────┘             └──────────┘                └────────────┘
                               │    ▲
                  wait()       │    │  notify()
                  sleep()      ▼    │  sleep expires
                  I/O block  ┌──────────┐
                             │ BLOCKED / │
                             │ WAITING   │
                             └──────────┘
```

```java
Thread t = new Thread(() -> {
    System.out.println("Running in: " + Thread.currentThread().getName());
});
// State: NEW
t.start();
// State: RUNNABLE (OS schedules it)
t.join();
// State: TERMINATED (after run() completes)
```

---

## 4. Race Conditions & Critical Sections

### Race Condition

A race condition occurs when the correctness of a program depends on the
relative timing of thread execution.

```java
// Shared state
private int counter = 0;

// Thread 1                    // Thread 2
counter++;                     counter++;

// counter++ is NOT atomic. It compiles to:
// 1. READ counter (0)         // 1. READ counter (0)
// 2. ADD 1       (1)          // 2. ADD 1       (1)
// 3. WRITE counter (1)        // 3. WRITE counter (1)
//                              
// Expected: counter = 2       // Actual: counter = 1 (LOST UPDATE)
```

### Critical Section

The section of code that accesses shared mutable state. Must be protected.

```java
// Critical section protected by synchronized
public synchronized void increment() {
    counter++; // Only one thread at a time can execute this
}
```

---

## 5. Synchronization Primitives

### Mutex (Mutual Exclusion)

```java
// Only ONE thread can hold the lock at a time.
private final ReentrantLock mutex = new ReentrantLock();

public void criticalOperation() {
    mutex.lock();
    try {
        // Only one thread in here at a time
        sharedResource.update();
    } finally {
        mutex.unlock(); // ALWAYS unlock in finally
    }
}
```

### Semaphore

```java
// Allows up to N threads to access a resource concurrently.
private final Semaphore semaphore = new Semaphore(3); // 3 permits

public void accessPool() throws InterruptedException {
    semaphore.acquire(); // blocks if 3 threads already inside
    try {
        connectionPool.useConnection();
    } finally {
        semaphore.release();
    }
}

// Mutex is a semaphore with N=1 (binary semaphore)
```

### Condition Variables

```java
// Allow threads to wait for a specific condition to become true.
private final Lock lock = new ReentrantLock();
private final Condition notEmpty = lock.newCondition();
private final Queue<Item> queue = new LinkedList<>();

// Consumer
public Item take() throws InterruptedException {
    lock.lock();
    try {
        while (queue.isEmpty()) {
            notEmpty.await(); // releases lock and waits
        }
        return queue.poll();
    } finally {
        lock.unlock();
    }
}

// Producer
public void put(Item item) {
    lock.lock();
    try {
        queue.add(item);
        notEmpty.signal(); // wake up one waiting consumer
    } finally {
        lock.unlock();
    }
}
```

### Compare-and-Swap (CAS)

```java
// Lock-free atomic operation. Hardware-level instruction.
// "If the current value is X, set it to Y. Otherwise, do nothing."

AtomicInteger counter = new AtomicInteger(0);

// Lock-free increment:
int oldVal, newVal;
do {
    oldVal = counter.get();
    newVal = oldVal + 1;
} while (!counter.compareAndSet(oldVal, newVal));
// Retries if another thread changed the value between get and set.

// Java provides: AtomicInteger, AtomicLong, AtomicReference, etc.
// CAS is the foundation of java.util.concurrent lock-free data structures.
```

### Locking Strategies

| Strategy             | Description                                    | Trade-off             |
|---------------------|------------------------------------------------|------------------------|
| Coarse-grained      | One lock for entire data structure              | Simple but slow        |
| Fine-grained        | One lock per bucket/segment                    | Complex but fast       |
| Reentrant lock      | Same thread can re-acquire the lock            | Prevents self-deadlock |
| Try-lock (timed)    | Attempt lock with timeout, give up if failed   | Prevents indefinite waiting |
| Read-Write lock     | Multiple readers OR one writer                 | Great for read-heavy workloads |

```java
// Read-Write Lock
ReadWriteLock rwLock = new ReentrantReadWriteLock();

// Multiple readers can run concurrently
public String read(String key) {
    rwLock.readLock().lock();
    try { return map.get(key); }
    finally { rwLock.readLock().unlock(); }
}

// Writers get exclusive access
public void write(String key, String value) {
    rwLock.writeLock().lock();
    try { map.put(key, value); }
    finally { rwLock.writeLock().unlock(); }
}
```

---

## 6. Concurrency Challenges

### Deadlock

Two or more threads waiting for each other forever.

```
Thread 1: holds Lock A, waits for Lock B
Thread 2: holds Lock B, waits for Lock A

  Thread 1          Thread 2
  lock(A) ✓         lock(B) ✓
  lock(B) ⏳ wait    lock(A) ⏳ wait
  
  → DEADLOCK (circular wait)
```

**Four conditions (ALL must hold for deadlock):**

| Condition          | Description                                   |
|--------------------|-----------------------------------------------|
| Mutual exclusion   | Resource can only be held by one thread       |
| Hold and wait      | Thread holds one resource while waiting for another |
| No preemption      | Resources can't be forcibly taken away        |
| Circular wait      | Thread A waits for B, B waits for A           |

**Prevention strategies:**
```java
// 1. Lock ordering — always acquire locks in the same order
// Instead of: Thread1(A→B), Thread2(B→A)
// Enforce:    Thread1(A→B), Thread2(A→B)

// 2. Try-lock with timeout
if (lockA.tryLock(100, TimeUnit.MILLISECONDS)) {
    try {
        if (lockB.tryLock(100, TimeUnit.MILLISECONDS)) {
            try { /* critical section */ }
            finally { lockB.unlock(); }
        }
    } finally { lockA.unlock(); }
}

// 3. Single lock (coarse-grained — simple but less concurrent)
```

### Livelock

Threads are not blocked but keep changing state without making progress.

```
Two people in a hallway:
  Person A steps left → Person B steps right → they're still blocked
  Person A steps right → Person B steps left → still blocked
  (Both are "moving" but neither passes through)

In code: threads keep retrying an operation that always fails
because they react to each other's retries.

Fix: Add randomized backoff (like Ethernet CSMA/CD).
```

### Starvation

A thread never gets access to a shared resource because other threads keep
taking priority.

```
Reader-Writer problem:
  If readers keep arriving continuously, a waiting writer is starved
  because readers never stop to let the writer in.

Fix: Fair locks (FIFO ordering), or writer-priority policies.
```

---

## 7. Concurrency Patterns

### Producer-Consumer

```
┌──────────┐    ┌────────────────┐    ┌──────────┐
│ Producer │───►│ Bounded Buffer │───►│ Consumer │
│          │    │ (BlockingQueue)│    │          │
└──────────┘    └────────────────┘    └──────────┘

Producer blocks if buffer is full.
Consumer blocks if buffer is empty.
```

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

// Producer thread
queue.put(new Task()); // blocks if queue is full

// Consumer thread
Task task = queue.take(); // blocks if queue is empty
```

### Thread Pool

```
┌──────────────────────────────────────────┐
│              Thread Pool                 │
│                                          │
│  Task Queue: [T1][T2][T3][T4]            │
│                                          │
│  Worker Threads:                         │
│    Thread-1: executing T0                │
│    Thread-2: executing T5                │
│    Thread-3: idle (waiting for task)     │
│    Thread-4: executing T6                │
└──────────────────────────────────────────┘

Why: Creating/destroying threads is expensive.
     Pool reuses a fixed set of threads.
```

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
Future<Result> future = pool.submit(() -> computeResult());
Result result = future.get(); // blocks until done
```

### Reader-Writer

```
Multiple readers can access concurrently (read doesn't conflict with read).
Writers need exclusive access (write conflicts with everything).

Read request:  acquire readLock → read → release readLock
Write request: acquire writeLock → write → release writeLock
```

### Signaling (Wait/Notify)

```java
// One thread waits for a condition. Another thread signals it.
synchronized (monitor) {
    while (!conditionMet) {
        monitor.wait();  // release lock and sleep
    }
    // condition is now true, proceed
}

// Another thread:
synchronized (monitor) {
    conditionMet = true;
    monitor.notify();  // wake up one waiter
}
```

---

## 8. Java Concurrency Utilities

| Class/Interface          | Purpose                                         |
|--------------------------|-------------------------------------------------|
| `synchronized`           | Built-in monitor lock                           |
| `ReentrantLock`          | Explicit lock with tryLock, timed lock           |
| `ReadWriteLock`          | Separate read/write locks                        |
| `Semaphore`              | Counting permits                                 |
| `CountDownLatch`         | Wait for N events to complete                    |
| `CyclicBarrier`          | Wait for N threads to reach a point             |
| `BlockingQueue`          | Thread-safe queue with blocking put/take         |
| `ConcurrentHashMap`      | Thread-safe map with lock striping               |
| `AtomicInteger/Long/Ref` | Lock-free atomic operations via CAS              |
| `ExecutorService`        | Thread pool management                           |
| `CompletableFuture`      | Async computation with chaining                  |
| `volatile`               | Ensures visibility (no caching in registers)     |

### `volatile` vs `synchronized` vs `Atomic`

```java
// volatile: guarantees visibility, NOT atomicity
volatile boolean running = true;
// Thread 1: running = false; → Thread 2 immediately sees false
// But: volatile int x; x++ is still NOT atomic!

// synchronized: guarantees both visibility AND atomicity
synchronized void increment() { counter++; } // safe

// Atomic: lock-free atomicity via CAS
AtomicInteger counter = new AtomicInteger();
counter.incrementAndGet(); // atomic, no lock
```

---

## 9. Interview Tips

| Tip | Details |
|-----|---------|
| Identify shared mutable state first | Before writing any lock, ask: "What data is shared across threads?" |
| Prefer higher-level constructs | Use `BlockingQueue` instead of manual wait/notify. Use `ExecutorService` instead of raw threads |
| Always release locks in `finally` | Prevents lock leaks on exceptions |
| Use `while` not `if` with wait() | Spurious wakeups are real — always re-check the condition |
| Know the four deadlock conditions | And know at least two prevention strategies |
| CAS for low-contention hot paths | `AtomicInteger` beats `synchronized` when contention is low |
| Immutability eliminates races | If data doesn't change, no synchronization is needed |
| Name the pattern | "I'll use a Producer-Consumer pattern with a BlockingQueue" — interviewers love hearing pattern names |
