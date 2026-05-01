# 🛠️ Design a HashMap from Scratch (LLD)

> **Sources**: OpenJDK [`java.util.HashMap`](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/HashMap.java) source; [`java.util.concurrent.ConcurrentHashMap`](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/concurrent/ConcurrentHashMap.java); Joshua Bloch — *Effective Java*, Item 11 (`equals`/`hashCode` contract); JEP 180 (HashMap red-black tree treeify in Java 8).

## 1. Requirements

### Functional
- `put(K key, V value)` — insert or update
- `V get(K key)` — return value or `null`
- `V remove(K key)` — unlink and return prior value
- `boolean containsKey(K key)`
- `int size()`, `boolean isEmpty()`
- Iteration: `entrySet()`, `keySet()`, `values()`
- Generic over `<K, V>`; permits `null` keys/values (Java `HashMap` semantics)

### Non-Functional
- **O(1) average** for `put` / `get` / `remove`
- Dynamic **resize** when `size > capacity * loadFactor` (default `0.75`)
- Graceful **collision handling**
- Optional **thread-safety** (separate `ConcurrentHashMap`-style variant)

## 2. Core Entities

| Entity | Key Fields |
|---|---|
| `Node<K,V>` | `int hash`, `K key`, `V value`, `Node<K,V> next` |
| `HashMap<K,V>` | `Node<K,V>[] table`, `int size`, `int threshold`, `float loadFactor` |
| (Java 8+) `TreeNode<K,V>` extends `Node` | red-black tree node when a bucket exceeds `TREEIFY_THRESHOLD` (8) |

## 3. Reference Implementation (separate chaining)

```java
public class HashMap<K, V> {
  static final int DEFAULT_CAPACITY = 16;          // power of 2
  static final float LOAD_FACTOR    = 0.75f;
  static final int TREEIFY_THRESHOLD = 8;          // Java 8 trick

  static class Node<K, V> {
    final int hash; final K key; V value; Node<K, V> next;
    Node(int h, K k, V v, Node<K, V> n){ hash=h; key=k; value=v; next=n; }
  }

  Node<K, V>[] table;
  int size, threshold;

  @SuppressWarnings("unchecked")
  public HashMap() {
    table = (Node<K, V>[]) new Node[DEFAULT_CAPACITY];
    threshold = (int)(DEFAULT_CAPACITY * LOAD_FACTOR);
  }

  // Spread upper bits — same as JDK to avoid clustering when low bits are weak
  static int hash(Object key) {
    if (key == null) return 0;
    int h = key.hashCode();
    return h ^ (h >>> 16);
  }

  // Faster than `% capacity` when capacity is a power of 2
  static int indexFor(int hash, int n) { return hash & (n - 1); }

  public V put(K key, V value) {
    int h = hash(key);
    int i = indexFor(h, table.length);
    for (Node<K,V> n = table[i]; n != null; n = n.next) {
      if (n.hash == h && (n.key == key || (key != null && key.equals(n.key)))) {
        V old = n.value; n.value = value; return old;
      }
    }
    table[i] = new Node<>(h, key, value, table[i]);   // prepend
    if (++size > threshold) resize();
    return null;
  }

  public V get(K key) {
    int h = hash(key);
    for (Node<K,V> n = table[indexFor(h, table.length)]; n != null; n = n.next) {
      if (n.hash == h && (n.key == key || (key != null && key.equals(n.key))))
        return n.value;
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  void resize() {
    Node<K,V>[] old = table;
    int newCap = old.length << 1;                    // double
    table = (Node<K,V>[]) new Node[newCap];
    threshold = (int)(newCap * LOAD_FACTOR);
    for (Node<K,V> head : old) {
      for (Node<K,V> n = head; n != null; ) {
        Node<K,V> next = n.next;
        int j = indexFor(n.hash, newCap);
        n.next = table[j]; table[j] = n;             // re-insert
        n = next;
      }
    }
  }
}
```

## 4. Design Considerations

### 4.1 Hash spreading (`h ^ (h >>> 16)`)
With a power-of-2 capacity, `hash & (n − 1)` only uses the low bits of `hashCode()`. Many `hashCode()` implementations have weak entropy in the low bits. XOR-ing in the high bits **mixes them down**, dramatically reducing clustering. This is exactly what the JDK does.

### 4.2 Power-of-2 capacity
`hash & (n − 1)` is one cycle; `hash % n` is many. Mandating power-of-2 capacity makes the index calculation effectively free.

### 4.3 Separate chaining vs open addressing
| | Separate chaining | Open addressing (linear/quadratic/double-hash probing) |
|---|---|---|
| Memory overhead | + per-node `next` pointer | None beyond the array |
| Worst-case bucket | Linked list / tree | "Primary clustering" can degrade severely |
| Resize triggers | At load factor ~0.75 | Required earlier (~0.5 for linear probing) |
| JDK uses | Yes (`HashMap`) | No (different libraries do, e.g., Robin Hood hashing) |

### 4.4 The Java 8 treeify trick (JEP 180)
When a single bucket exceeds 8 entries (with capacity ≥ 64), the chain is converted to a **red-black tree**, dropping worst-case `get`/`put` from O(n) to **O(log n)**. This defends against intentional collision attacks (hash-DoS where many keys hash to the same bucket).

## 5. Thread-Safety Variants

| Variant | Mechanism | Notes |
|---|---|---|
| `Hashtable` | One coarse `synchronized` per method | Legacy; serializes all access. Avoid. |
| `Collections.synchronizedMap(map)` | Wrapper with method-level locks | Same coarseness as `Hashtable`. |
| **`ConcurrentHashMap` (Java 7)** | 16 *segments*, each its own lock — striping | Up to 16-way concurrency. |
| **`ConcurrentHashMap` (Java 8+)** | Per-bucket locking: CAS to insert into empty bin; `synchronized` on the *first node* otherwise | Reads are lock-free (`volatile` `Node.val` and `next`). Treeification still applies. |

`ConcurrentHashMap` does **not** allow `null` keys or values — ambiguous between "absent" and "present-but-null" without a separate `containsKey` lock.

## 6. Edge Cases

### 6.1 The `equals`/`hashCode` contract (*Effective Java* Item 11)
> Equal objects must produce equal hash codes.

Violating this corrupts the map: two equal keys could land in different buckets ⇒ `get` returns `null` for a key you just `put`. Always override `equals` and `hashCode` together.

### 6.2 Null keys
Java `HashMap` allows one null key (mapped to bucket 0). Easy to support: `hash(null) = 0`, then `key == null` is checked first in chain walks.

### 6.3 Fail-fast iterators
Java's iterators track a `modCount` field; structural mutations (put/remove/resize from another thread or during iteration) increment it. The iterator throws `ConcurrentModificationException` on the next `next()` if `modCount` differs from the snapshot — a best-effort guardrail, not a guarantee.

### 6.4 Hash-DoS
Untrusted keys with adversarial `hashCode()` can target a single bucket. Defenses: treeify (Java 8), random hash seed (Python `dict`), or use `IdentityHashMap` if reference equality is what you want.

## 7. Sources / Cross-Refs
- LLD-09 Concurrency.md (striped locks, CAS)
- Solution-Concurrent-HashMap.md (the concurrent variant)
- OpenJDK source — `HashMap.java`
- *Effective Java* (Bloch) — Item 11
- JEP 180: Handle Frequent HashMap Collisions with Balanced Trees
