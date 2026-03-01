# 🛠️ Design a HashMap from Scratch (LLD)

Designing a HashMap requires deep knowledge of core Data Structures (Arrays and Linked Lists/Trees) and understanding mathematical concepts like Hash Functions, Collision Resolution, and Array Resizing (rehashing).

---

## 1. Requirements

### Functional Requirements
- **Put(key, value):** Insert a key-value pair. If the key exists, update its value.
- **Get(key):** Return the value associated with the key, or `null`/`-1` if it doesn't exist.
- **Remove(key):** Remove the key-value pair from the map.
- **Generics (Optional but good):** Should ideally support generic types `<K, V>`.

### Non-Functional Requirements
- **Time Complexity:** Average case $O(1)$ for Put, Get, and Remove.
- **Collision Handling:** Must handle cases where two different keys yield the same hash code (Hash Collisions).

---

## 2. Core Concepts

1. **The Array (Buckets):** Under the hood, a HashMap is just an array of a specific size (e.g., 16).
2. **The Hash Function:** Converts an arbitrary Key (like a String "apple") into an integer index within the array's bounds.
   - `index = Math.abs(key.hashCode()) % array.length`
3. **Collision Resolution (Chaining):** If "apple" hashes to index 4, and "banana" also hashes to index 4, they have collided. We cannot overwrite "apple". Instead, index 4 will point to the `Head` of a **Linked List**. Both nodes will be appended to this list.

---

## 3. Implementation Details

### 1. The Entry Node
Because we are using "Separate Chaining" to handle collisions, our basic unit of storage must be a Linked List Node.

```java
class Entry<K, V> {
    K key;
    V value;
    Entry<K, V> next; // Pointer to next node

    public Entry(K key, V value) {
        this.key = key;
        this.value = value;
        this.next = null;
    }
}
```

### 2. The HashMap Skeleton

```java
public class MyHashMap<K, V> {
    private static final int INITIAL_CAPACITY = 16;
    private static final float LOAD_FACTOR = 0.75f; // When to resize
    
    // The array of Linked Lists
    private Entry<K, V>[] buckets;
    private int size = 0; // Number of actual key-value pairs stored

    @SuppressWarnings("unchecked")
    public MyHashMap() {
        buckets = new Entry[INITIAL_CAPACITY];
    }
    
    // Helper to calculate array index
    private int getBucketIndex(K key) {
        if (key == null) return 0;
        // Bitwise AND to prevent negative HashCodes
        return (key.hashCode() & 0x7FFFFFFF) % buckets.length;
    }
```

### 3. The `put(K key, V value)` Method

When putting an item:
1. Find the bucket (index).
2. Traverse the linked list at that bucket.
3. If the key already exists, overwrite the value.
4. If the key does not exist (we reach the end), append a new Node.

```java
    public void put(K key, V value) {
        int index = getBucketIndex(key);
        Entry<K, V> head = buckets[index];

        // 1. Traverse list to check if key already exists
        Entry<K, V> current = head;
        while (current != null) {
            if (current.key.equals(key)) {
                current.value = value; // Update existing value
                return;
            }
            current = current.next;
        }

        // 2. Key does not exist. Insert at the FRONT of the linked list (O(1))
        Entry<K, V> newEntry = new Entry<>(key, value);
        newEntry.next = head; // Point new node to current head
        buckets[index] = newEntry; // Make new node the new head
        size++;

        // 3. Resize if too full
        if ((float) size / buckets.length >= LOAD_FACTOR) {
            resize();
        }
    }
```

### 4. The `get(K key)` Method

Finding an item is essentially traversing the list.

```java
    public V get(K key) {
        int index = getBucketIndex(key);
        Entry<K, V> current = buckets[index];

        while (current != null) {
            if (current.key.equals(key)) {
                return current.value; // Cache hit
            }
            current = current.next;
        }

        return null; // Cache miss
    }
```

### 5. Resizing / Rehashing

If inserting 10,000 items into an array of size 16, every index will contain a Linked List of ~600 items. Calling `get()` would require traversing a 600-node list, taking $O(N)$ time instead of $O(1)$. 
To prevent this, we expand the array (usually doubling it) when it gets 75% full, and **rehash** all existing keys into the new array.

```java
    @SuppressWarnings("unchecked")
    private void resize() {
        Entry<K, V>[] oldBuckets = buckets;
        
        // Double the capacity
        buckets = new Entry[oldBuckets.length * 2];
        size = 0; // Reset size, put() will recalculate it
        
        // Iterate through old array
        for (Entry<K, V> headNode : oldBuckets) {
            Entry<K, V> current = headNode;
            // Iterate through the linked list at this bucket
            while (current != null) {
                // We MUST re-call put() because the modulo array length has changed
                // so the index location will be completely different!
                put(current.key, current.value);
                current = current.next;
            }
        }
    }
}
```

---

## 4. Advanced Concepts (Bonus points)

If the interviewer asks: *"What if an attacker tries to DDOS our server by passing in thousands of keys that all intentionally hash to the exact same bucket index?"*

**The Java 8 Optimization (Tree Buckets):**
If someone forces a massive collision, a 10,000 item Linked List is created. Fetching becomes $O(N)$.
In modern implementations (like Java 8's `HashMap`), if a specific bucket's linked list grows larger than a certain threshold (usually 8 nodes), the HashMap dynamically converts that specific Linked List into a **Red-Black Tree** (A balanced Binary Search Tree).
This drastically improves the worst-case lookup time from $O(N)$ down to $O(\log N)$, defending against hash-collision attacks while preserving performance.