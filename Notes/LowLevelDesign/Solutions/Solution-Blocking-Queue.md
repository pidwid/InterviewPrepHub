# 🛠️ Design Thread-Safe Blocking Queue (LLD)

This relies on the exact same concurrency primitives explored in the Thread Pool design. Designing a Thread-Safe Bounded Blocking Queue is the quintessential Producer-Consumer interview problem.

---

## 1. Requirements

### Functional Requirements
- **Enqueue(item):** Add an item to the queue. If the queue is at maximum capacity, the thread attempting to add the item must *block (wait)* until space becomes available.
- **Dequeue():** Remove and return an item from the queue. If the queue is empty, the thread attempting to read must *block (wait)* until an item becomes available.
- **Bounded Capacity:** The queue is initialized with a maximum size `N`.

### Non-Functional Requirements
- **Thread Safety:** Multiple producer threads and multiple consumer threads can operate on the queue simultaneously without corrupting the data or encountering race conditions.
- **Efficiency:** Waiting threads must not consume CPU cycles (No busy-waiting/spin-locking).

---

## 2. Core Concepts

To solve this, we need three things:
1. A regular data structure (like a `LinkedList`, or an `Array` with head/tail pointers).
2. A **Lock / Mutex** to ensure only one thread modifies the data structure at a time.
3. A **Condition Variable** (or Monitor `wait()/notify()`) to put threads to sleep and wake them up when state changes.

---

## 3. Implementation 1: Using synchronized (wait/notify)

This is the classic, older Java way. It uses the object's intrinsic monitor lock.

```java
import java.util.LinkedList;
import java.util.Queue;

public class MyBlockingQueue<T> {
    private Queue<T> queue;
    private int capacity;

    public MyBlockingQueue(int capacity) {
        this.queue = new LinkedList<>();
        this.capacity = capacity;
    }

    public synchronized void enqueue(T item) throws InterruptedException {
        // MUST be a while loop to protect against "Spurious Wakeups"
        while (queue.size() == capacity) {
            // Give up the lock resulting in sleep
            wait(); 
        }
        
        queue.add(item);
        
        // Wake up ONE waiting consumer thread. 
        // We use notifyAll() instead of notify() to prevent deadlocks 
        // in multi-producer / multi-consumer setups where notify() might 
        // accidentally wake up another producer instead of a consumer.
        notifyAll(); 
    }

    public synchronized T dequeue() throws InterruptedException {
        while (queue.isEmpty()) {
            wait(); // Sleep until data is available
        }
        
        T item = queue.poll();
        
        // Wake up ONE waiting producer thread
        notifyAll(); 
        
        return item;
    }
}
```

### The Problem with `wait/notifyAll()`
If you have 100 sleeping Producers and 100 sleeping Consumers, calling `notifyAll()` wakes up *all 200 threads*. 199 of them will immediately fail the `while` loop condition and go back to sleep. This causes massive CPU overhead known as the **Thundering Herd** problem.

---

## 4. Implementation 2: Using ReentrantLock & Conditions (Modern & Optimal)

To fix the Thundering Herd, we use `ReentrantLock` and create *two separate* Conditions (`notFull` and `notEmpty`).
If a Consumer pulls an item, it specifically signals `notFull.signal()`, which only wakes up a Producer. This is exactly how `java.util.concurrent.ArrayBlockingQueue` is implemented.

```java
import java.util.LinkedList;
import java.util.Queue;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class OptimalBlockingQueue<T> {
    private Queue<T> queue;
    private int capacity;
    
    private Lock lock = new ReentrantLock();
    // Condition to wait on if queue is completely full
    private Condition notFull = lock.newCondition();
    // Condition to wait on if queue is completely empty
    private Condition notEmpty = lock.newCondition();

    public OptimalBlockingQueue(int capacity) {
        this.queue = new LinkedList<>();
        this.capacity = capacity;
    }

    public void enqueue(T item) throws InterruptedException {
        lock.lock(); // Explicitly acquire lock
        try {
            while (queue.size() == capacity) {
                notFull.await();  // Wait until a consumer says "not full"
            }
            
            queue.add(item);
            
            notEmpty.signal(); // specifically wake up ONE waiting consumer
            
        } finally {
            lock.unlock(); // ALWAYS unlock in a finally block to prevent permanent deadlocks
        }
    }

    public T dequeue() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await(); // Wait until a producer says "not empty"
            }
            
            T item = queue.poll();
            
            notFull.signal(); // specifically wake up ONE waiting producer
            
            return item;
            
        } finally {
            lock.unlock();
        }
    }
}
```

### Key Takeaways for the Interviewer
1. **Explain the `while` loop:** Always use `while (condition) wait();` instead of `if (condition) wait();`. The OS can sometimes wake threads up for no reason (Spurious Wakeup). If using an `if`, the thread would proceed to pop from an empty queue and throw an Exception. The `while` loop forces it to re-check the condition upon waking.
2. **Explain `finally`:** If an Exception occurs inside the `try` block, the thread crashes. If you don't use `finally { lock.unlock(); }`, the crashed thread takes the lock to its grave, and the queue is permanently deadlocked forever.
3. **Contrast `notifyAll()` vs `signal()`:** Highlight your knowledge of efficiency by explaining that using segmented `Condition` variables prevents the Thundering Herd.