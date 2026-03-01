# 🛠️ Design Concurrent HashMap (LLD)

Standard `HashMap` in Java is not thread-safe. If two threads call `put()` simultaneously, they can corrupt the linked lists, causing infinite loops during a `get()`. `HashTable` or `Collections.synchronizedMap()` is thread-safe, but it locks the *entire* map for every operation. If Thread A is reading "apple", Thread B cannot read "banana".

Designing a `ConcurrentHashMap` tests your knowledge of **Lock Striping**.

---

## 1. Requirements

### Functional Requirements
- `put(K key, V value)`
- `get(K key)`
- `remove(K key)`

### Non-Functional Requirements
- **High Concurrency:** Multiple threads should be able to read and write simultaneously without blocking each other (unless they are modifying the exact same segment).
- No `ConcurrentModificationException` during reads.

---

## 2. Core Concepts: Lock Striping

Instead of using one massive lock for the whole array `buckets[16]`, we divide the array into "Segments" or "Stripes".
For example, we create 4 Locks.
- Lock 0 protects buckets `[0, 1, 2, 3]`
- Lock 1 protects buckets `[4, 5, 6, 7]`
- Lock 2 protects buckets `[8, 9, 10, 11]`
- Lock 3 protects buckets `[12, 13, 14, 15]`

If Thread A writes to bucket 1, it acquires Lock 0. Thread B can simultaneously write to bucket 5 (acquiring Lock 1) with zero contention.

*(Note: Java 8+ ConcurrentHashMap moved away from Segments to using `synchronized` on the very first Node of each individual bucket array index, plus Compare-And-Swap (CAS) operations. Lock Striping is the Java 7 approach, which is much easier to implement and explain in an interview).*

---

## 3. Implementation (Java 7 Lock Striping Style)

### 1. The Segment Class

A Segment is essentially a mini-HashMap protected by its own `ReentrantLock`.

```java
import java.util.concurrent.locks.ReentrantLock;

class Segment<K, V> extends ReentrantLock {
    private Entry<K, V>[] table;
    private int count;

    @SuppressWarnings("unchecked")
    public Segment(int capacity) {
        table = new Entry[capacity];
    }

    public V get(K key, int hash) {
        // Reads generally do not need locking if nodes are immutable,
        // but for simplicity in interviews, we lock or use volatile.
        lock();
        try {
            int index = hash % table.length;
            Entry<K, V> e = table[index];
            while (e != null) {
                if (e.key.equals(key)) {
                    return e.value;
                }
                e = e.next;
            }
            return null;
        } finally {
            unlock();
        }
    }

    public void put(K key, V value, int hash) {
        lock();
        try {
            int index = hash % table.length;
            Entry<K, V> e = table[index];
            
            // Check for update
            while (e != null) {
                if (e.key.equals(key)) {
                    e.value = value;
                    return;
                }
                e = e.next;
            }
            
            // Insert new node at head
            Entry<K, V> newEntry = new Entry<>(key, value);
            newEntry.next = table[index];
            table[index] = newEntry;
            count++;
            
        } finally {
            unlock();
        }
    }
}
```

### 2. The Main Map

The main map holds an array of Segments. When a key comes in, we hash it once to find the Segment, and the Segment hashes it again to find the bucket.

```java
public class MyConcurrentHashMap<K, V> {
    private final int concurrencyLevel = 16; // 16 independent locks
    private Segment<K, V>[] segments;

    @SuppressWarnings("unchecked")
    public MyConcurrentHashMap(int initialCapacity) {
        segments = new Segment[concurrencyLevel];
        int segmentCapacity = initialCapacity / concurrencyLevel;
        
        for (int i = 0; i < concurrencyLevel; i++) {
            segments[i] = new Segment<>(segmentCapacity);
        }
    }

    // Helper to prevent negative hashes
    private int hash(K key) {
        return Math.abs(key.hashCode());
    }

    // Determine which of the 16 locks this key belongs to
    private Segment<K, V> getSegment(int hash) {
        int segmentIndex = hash % concurrencyLevel;
        return segments[segmentIndex];
    }

    public void put(K key, V value) {
        if (key == null || value == null) throw new NullPointerException();
        
        int hash = hash(key);
        Segment<K, V> segment = getSegment(hash);
        segment.put(key, value, hash);
    }

    public V get(K key) {
        int hash = hash(key);
        Segment<K, V> segment = getSegment(hash);
        return segment.get(key, hash);
    }
}

// Basic Entry Node
class Entry<K, V> {
    final K key;
    volatile V value; // Volatile ensures thread visibility for lockless reads
    Entry<K, V> next;

    Entry(K key, V value) {
        this.key = key;
        this.value = value;
    }
}
```

### 3. Handling Global Operations (like `size()`)
If someone calls `size()`, you have a problem. You must lock *all 16 segments simultaneously*, sum their counts, and unlock them. If you only lock them one by one, the count might change behind your back while you are iterating.
`java.util.concurrent.ConcurrentHashMap` uses advanced probabilistic counters (like `LongAdder`) to estimate size to avoid this global locking penalty.