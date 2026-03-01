# 🛠️ Producer-Consumer with Bounded Buffer (LLD/Concurrency)

The Producer-Consumer problem is the foundational concurrency problem. It is identical in logic to the Thread-Safe Blocking Queue puzzle, but here we focus on implementing it cleanly without utilizing Java's `java.util.concurrent` package (no `BlockingQueue`, no `ReentrantLock`), just primitives to prove understanding.

---

## 1. Requirements

### Functional Requirements
- A shared buffer (queue) of fixed size $N$.
- **Producer Thread:** Generates data and puts it in the buffer. If the buffer is full, the producer must wait.
- **Consumer Thread:** Takes data from the buffer. If the buffer is empty, the consumer must wait.

### Non-Functional Requirements
- Avoid race conditions (two threads writing to the same array index).
- Avoid deadlocks.

---

## 2. Approach: wait() and notifyAll()

We will implement this using a standard `LinkedList` (or an array) protected by a single intrinsic lock (`synchronized`).

**The Rules of `wait()`:**
- You can only call `wait()` if you currently hold the lock (inside a `synchronized` block).
- When a thread calls `wait()`, it instantaneously gives up the lock and goes to sleep.
- When it wakes up, it must wait its turn to re-acquire the lock before executing the next line of code.
- Always call `wait()` inside a `while (condition)` loop to defend against spurious wakeups.

---

## 3. Implementation (Java)

```java
import java.util.LinkedList;
import java.util.Queue;

public class BoundedBuffer<T> {
    private Queue<T> buffer = new LinkedList<>();
    private final int capacity;

    public BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    public synchronized void produce(T item) throws InterruptedException {
        // MUST be a while loop. 
        // If it was an 'if', a spurious OS wakeup could skip the bounds check
        // and add item 11 to a capacity 10 queue.
        while (buffer.size() == capacity) {
            System.out.println("Buffer is full. Producer is waiting...");
            wait();
        }
        
        buffer.add(item);
        System.out.println("Produced: " + item + " | Size: " + buffer.size());
        
        // Wake up consumers who might be waiting on an empty queue
        notifyAll();
    }

    public synchronized T consume() throws InterruptedException {
        while (buffer.isEmpty()) {
            System.out.println("Buffer is empty. Consumer is waiting...");
            wait();
        }
        
        T item = buffer.poll();
        System.out.println("Consumed: " + item + " | Size: " + buffer.size());
        
        // Wake up producers who might be waiting on a full queue
        notifyAll();
        
        return item;
    }
}
```

### The Driver (Testing it)

```java
public class ProducerConsumerDemo {
    public static void main(String[] args) {
        BoundedBuffer<Integer> buffer = new BoundedBuffer<>(5);

        // Producer Thread
        Thread producer = new Thread(() -> {
            int count = 0;
            while (true) {
                try {
                    buffer.produce(count++);
                    Thread.sleep(100); // Produce fast
                } catch (InterruptedException e) { }
            }
        });

        // Consumer Thread
        Thread consumer = new Thread(() -> {
            while (true) {
                try {
                    buffer.consume();
                    Thread.sleep(1000); // Consume slow
                } catch (InterruptedException e) { }
            }
        });

        producer.start();
        consumer.start();
    }
}
```
*Behavior expected:* The producer will quickly fill the buffer to 5. Then it will hit `wait()`. Every 1 second, the consumer will take 1. The producer will instantly wake up, fill it back to 5, and sleep again.

---

## 4. Alternative Approach: Semaphores

Instead of a lock and `wait/notify`, this problem is elegantly solved using two Semaphores and one Mutex.
Edsger Dijkstra originally solved it this way.

- `Semaphore emptySlots = new Semaphore(N);` (Initial permits = Capacity)
- `Semaphore filledSlots = new Semaphore(0);` (Initial permits = 0)
- `Semaphore mutex = new Semaphore(1);` (Protects array manipulation)

**Producer Logic:**
```java
emptySlots.acquire();  // decrement empty slots. Blocks if 0.
mutex.acquire();       // Lock the array
buffer.add(item);
mutex.release();
filledSlots.release(); // increment filled slots.
```

**Consumer Logic:**
```java
filledSlots.acquire(); // decrement filled slots. Blocks if 0.
mutex.acquire();
T item = buffer.poll();
mutex.release();
emptySlots.release();  // increment empty slots
```

This approach cleanly separates the "blocking on capacity constraints" from the "blocking for thread-safety" logic.