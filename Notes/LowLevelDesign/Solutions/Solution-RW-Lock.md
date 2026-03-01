# 🛠️ Readers-Writers Lock Implementation (LLD/Concurrency)

The Readers-Writers problem is a classic synchronization design problem. You have a shared resource (like a database or a file). 
- Multiple threads can **read** from it simultaneously without causing issues.
- Only one thread can **write** to it at a time.
- If a thread is writing, no one else can read or write.

Java provides `ReentrantReadWriteLock`, but interviewers often ask you to build a custom one from scratch using primitive locks or semaphores to see if you understand the edge cases (specifically, Writer Starvation).

---

## 1. Requirements

- `lockRead()`: Blocks if a writer is currently writing or if a writer is waiting to write.
- `unlockRead()`: Decrements reader count. If 0, wakes up a waiting writer.
- `lockWrite()`: Blocks if any readers are currently reading or if another writer is writing.
- `unlockWrite()`: Wakes up waiting readers/writers.

**The "Writer Starvation" Problem:**
If we just let readers read as long as there is no active writer, what happens if we have a continuous stream of readers? 
R1 starts reading. Writer W1 wants to write, so it waits. R2 starts reading. R1 finishes. R3 starts reading. R2 finishes...
W1 will NEVER get to write because the number of active readers never hits exactly 0.
A correct implementation strictly prioritizes (or explicitly queues) waiting writers to prevent writer starvation.

---

## 2. Approach: wait() / notifyAll()

We maintain simple integer counters.
- `readersCount`: How many are currently reading.
- `writersCount`: How many are currently writing (either 0 or 1).
- `writeRequests`: How many writers are *waiting* to write. (This prevents reader starvation).

---

## 3. Implementation (Java)

```java
public class ReadWriteLock {
    private int readersCount = 0;
    private int writersCount = 0;
    private int writeRequests = 0;

    public synchronized void lockRead() throws InterruptedException {
        // A reader must wait if a writer is currently writing
        // OR if a writer is waiting to write (prevents writer starvation).
        while (writersCount > 0 || writeRequests > 0) {
            wait();
        }
        readersCount++;
    }

    public synchronized void unlockRead() {
        readersCount--;
        if (readersCount == 0) {
            notifyAll(); // Wake up any waiting writers
        }
    }

    public synchronized void lockWrite() throws InterruptedException {
        writeRequests++;

        // A writer must wait if anyone else is reading or writing
        while (readersCount > 0 || writersCount > 0) {
            try {
                wait();
            } catch (InterruptedException e) {
                // If interrupted while waiting, we must decrement our requested count
                writeRequests--;
                throw e;
            }
        }
        
        writeRequests--;
        writersCount++;
    }

    public synchronized void unlockWrite() {
        writersCount--;
        notifyAll(); // Wake up waiting readers AND writers
    }
}
```

---

## 4. Testing the Lock

Here is how the lock would be used in a shared resource scenario.

```java
public class SharedDictionary {
    private ReadWriteLock lock = new ReadWriteLock();
    // Some actual shared resource
    private Map<String, String> map = new HashMap<>();

    public String get(String key) throws InterruptedException {
        lock.lockRead();
        try {
            return map.get(key);
        } finally {
            lock.unlockRead();
        }
    }

    public void put(String key, String value) throws InterruptedException {
        lock.lockWrite();
        try {
            map.put(key, value);
        } finally {
            lock.unlockWrite();
        }
    }
}
```

### Note on Reentrancy
The lock above is **NOT Reentrant**. If Thread A calls `lockWrite()`, it gets it. If Thread A then calls `lockWrite()` again (e.g., in a recursive function), it will block *itself* forever because `writersCount > 0`. Making a primitive ReadWriteLock reentrant requires tracking `Thread.currentThread()` and a map of lock counts per thread, which is why `java.util.concurrent.locks.ReentrantReadWriteLock` is so complex under the hood.