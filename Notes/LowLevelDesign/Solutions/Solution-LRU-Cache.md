# 🛠️ Design LRU Cache (LLD)

The Least Recently Used (LRU) Cache is one of the most frequently asked low-level design and algorithmic questions. It tests your ability to combine two disparate data structures to achieve $O(1)$ time complexity for both reading and writing, while automatically evicting old data when memory is full.

---

## 1. Requirements

### Functional Requirements
- **Initialize:** Accept a specific `capacity` (maximum number of items).
- **Put(key, value):** Insert or update a Key-Value pair. If the cache reaches capacity, the *least recently used* item must be evicted *before* the new item is inserted.
- **Get(key):** Return the value if the key exists, otherwise return `-1` (or null). Accessing a key makes it the *most recently used*.

### Non-Functional Requirements
- **Performance:** Both `get` and `put` must execute in exactly $O(1)$ constant time.
- **Memory:** Strict adherence to the `capacity` constraint.

---

## 2. Core Concept & Data Structures

To achieve $O(1)$ for both retrieval and eviction, we must combine two data structures:

1. **HashMap (Dictionary):** 
   - Provides $O(1)$ lookup to find checking if a key exists and retrieving its memory location.
2. **Doubly Linked List (DLL):**
   - Provides $O(1)$ insertion and deletion of nodes (provided you already have the pointer to the node). 
   - We use the list to explicitly track recency. The `Head` of the list will represent the *Most Recently Used*, and the `Tail` will represent the *Least Recently Used*.
   - We *must* use a Doubly Linked List (with `prev` and `next` pointers), not a Singly Linked List, because when we perform a `get(node)`, we must pluck that node out of the middle of the list and move it to the head. Detaching a node in $O(1)$ requires knowing its `prev` node.

---

## 3. Implementation Details

We will define a custom `Node` class that holds *both* the `key` and the `value`. Why does it need the `key` if the HashMap already knows the key?
Because when the cache is full, we must chop off the Tail node of the linked list. But we *also* have to delete that entry from the HashMap. If the Tail node only holds the `value`, we wouldn't know which `key` to delete from the HashMap!

### The Node Class
```java
class Node {
    int key;
    int value;
    Node prev;
    Node next;
    
    public Node(int key, int value) {
        this.key = key;
        this.value = value;
    }
}
```

### Setup with Dummy Head & Tail
A brilliant trick to avoid writing dozens of `if (head == null)` null-check edge cases is to initialize the DLL with two dummy/sentinel nodes: a `head` and a `tail`. Real data is only ever inserted *between* them.

```java
import java.util.HashMap;
import java.util.Map;

public class LRUCache {
    private final int capacity;
    private final Map<Integer, Node> map;
    private final Node head;
    private final Node tail;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.map = new HashMap<>();
        
        // Setup dummy head and tail
        this.head = new Node(-1, -1);
        this.tail = new Node(-1, -1);
        head.next = tail;
        tail.prev = head;
    }
```

### Doubly Linked List Helper Methods
These are private methods to keep the list manipulation clean.

```java
    // Always add right after the dummy head (Making it Most Recently Used)
    private void addNodeToHead(Node node) {
        Node nextNode = head.next;
        
        head.next = node;
        node.prev = head;
        
        node.next = nextNode;
        nextNode.prev = node;
    }

    // Unlink an existing node from its current position
    private void removeNode(Node node) {
        Node prevNode = node.prev;
        Node nextNode = node.next;
        
        prevNode.next = nextNode;
        nextNode.prev = prevNode;
    }

    // Move a node to the head (Combine remove + add)
    private void moveToHead(Node node) {
        removeNode(node);
        addNodeToHead(node);
    }
```

### The Core Logic: GET and PUT

```java
    public int get(int key) {
        Node node = map.get(key);
        if (node == null) {
            return -1; // Cache miss
        }
        
        // Cache hit. It is now the most recently used, so move it to head.
        moveToHead(node);
        return node.value;
    }

    public void put(int key, int value) {
        Node existingNode = map.get(key);

        if (existingNode != null) {
            // Update existing value and make it MRU
            existingNode.value = value;
            moveToHead(existingNode);
        } else {
            // It's a new key. We must create a new node.
            Node newNode = new Node(key, value);
            
            // Check capacity before adding
            if (map.size() >= capacity) {
                // The Least Recently Used is the one right before the dummy tail
                Node lruNode = tail.prev;
                
                removeNode(lruNode);      // Remove from the linked list
                map.remove(lruNode.key);  // Remove from the HashMap (Why node needs .key)
            }
            
            // Add new node to Head and Map
            addNodeToHead(newNode);
            map.put(key, newNode);
        }
    }
}
```

---

## 4. Alternative Approaches (Language Built-ins)

If you are asked this in a system design context rather than a strict Data Structures round, many languages have native structures that already do this. However, you should **always** ask the interviewer before using them!

**Java: `LinkedHashMap`**
Java's `LinkedHashMap` natively maintains a doubly linked list through all its entries. You can instruct it to order by *access* (rather than insertion) and override the `removeEldestEntry` method to automatically create an LRU cache in 5 lines of code.

```java
import java.util.LinkedHashMap;
import java.util.Map;

class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int capacity;

    public LRUCache(int capacity) {
        // capacity, load factor, accessOrder = true
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }

    public int get(int key) {
        return super.getOrDefault(key, -1); // Automatically moves to end
    }

    public void put(int key, int value) {
        super.put(key, value); // Automatically moves to end
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
        return size() > capacity; // Automatically kicks in when map gets too big
    }
}
```

**Python: `collections.OrderedDict`**
Similarly, Python's `OrderedDict` maintains insertion order. When you `get` or `put`, you can `move_to_end(key)` to mark it as MRU, and `popitem(last=False)` to evict the LRU. Python also offers the `@lru_cache` decorator in `functools` for literal single-line caching of function returns.