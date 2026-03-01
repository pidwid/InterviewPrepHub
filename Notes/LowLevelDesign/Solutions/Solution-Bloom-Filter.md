# 🛠️ Design a Concurrent Bloom Filter (LLD/Concurrency)

A **Bloom Filter** is a space-efficient probabilistic data structure used to test whether an element is a member of a set. It guarantees *no false negatives* (if it says "Not Present", it is definitely not present) but allows for *false positives* (it might say "Present" when it isn't).

The challenge here is to implement one and adapt it so multiple threads can add and check elements concurrently without lock contention.

---

## 1. Requirements

### Functional Requirements
- `add(String item)`: Hashes the item and marks specific bits as `1`.
- `mightContain(String item)`: Hashes the item and checks if all corresponding bits are `1`.

### Non-Functional Requirements
- **Thread Safety:** Multiple threads can add strings simultaneously.
- **High Concurrency:** Standard locking of the entire bit array would bottleneck CPU threads.
- **Memory Efficiency:** Use actual bits to save RAM.

---

## 2. Core Concepts: The BitSet & Lock-Free Updates

Under the hood, a Bloom Filter is an array of $M$ bits, initialized to 0. 
When adding "apple", we run it through $K$ different hash functions:
- $H1("apple") \rightarrow 4$ (Set bit 4 to 1)
- $H2("apple") \rightarrow 17$ (Set bit 17 to 1)
- $H3("apple") \rightarrow 32$ (Set bit 32 to 1)

When calling `mightContain("apple")`, we re-calculate the hashes. If bits 4, 17, and 32 are all `1`, it *might* be in the set.

**Concurrency Problem:**
Java's standard `java.util.BitSet` is NOT thread-safe. If two threads try to set bits in the same `long` word simultaneously, you get a race condition (lost updates).

**Solutions:**
1. **Synchronized Block:** Put `synchronized` on `add()` and `mightContain()`. (Slow).
2. **Lock-Free Atomic Actions:** Use an array of `AtomicLong` (or `java.util.concurrent.atomic.AtomicIntegerArray`). We use Compare-And-Swap (CAS) via Bitwise OR to flip bits without locking.

---

## 3. Implementation (Java)

```java
import java.util.concurrent.atomic.AtomicLongArray;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class ConcurrentBloomFilter {
    private final AtomicLongArray bitset;
    private final int bitSize;
    private final int numHashes;

    public ConcurrentBloomFilter(int bitSize, int numHashes) {
        this.bitSize = bitSize;
        this.numHashes = numHashes;
        
        // Size in Longs (64 bits per long).
        int arraySize = (int) Math.ceil((double) bitSize / 64);
        this.bitset = new AtomicLongArray(arraySize);
    }

    public void add(String item) {
        int[] hashes = getHashes(item);
        
        for (int hash : hashes) {
            int bitIndex = Math.abs(hash % bitSize);
            setBit(bitIndex);
        }
    }

    public boolean mightContain(String item) {
        int[] hashes = getHashes(item);
        
        for (int hash : hashes) {
            int bitIndex = Math.abs(hash % bitSize);
            if (!getBit(bitIndex)) {
                return false; // Definitely not present
            }
        }
        return true; // Probably present
    }

    // --- Concurrent Bit Manipulation ---

    private void setBit(int bitIndex) {
        int longIndex = bitIndex / 64;
        int bitOffset = bitIndex % 64;
        long mask = 1L << bitOffset;

        // Lock-Free CAS Loop
        while (true) {
            long currentVal = bitset.get(longIndex);
            long newVal = currentVal | mask; // Bitwise OR to set the bit
            
            if (currentVal == newVal) {
                break; // Bit was already set by another thread
            }
            // Attempt to update. If another thread changed currentVal in the background, CAS fails and we retry.
            if (bitset.compareAndSet(longIndex, currentVal, newVal)) {
                break; 
            }
        }
    }

    private boolean getBit(int bitIndex) {
        int longIndex = bitIndex / 64;
        int bitOffset = bitIndex % 64;
        long mask = 1L << bitOffset;
        
        long currentVal = bitset.get(longIndex);
        return (currentVal & mask) != 0; // Bitwise AND to read
    }

    // --- Hashing Strategy ---

    // A simple mock of generating K independent hashes using SHA-256.
    // In production, use MurmurHash3 or Guava's BloomFilter hashes for speed.
    private int[] getHashes(String item) {
        int[] result = new int[numHashes];
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < numHashes; i++) {
                // Prepend the loop index to create slightly different hashes
                md.update((i + item).getBytes());
                byte[] digest = md.digest();
                // Convert first 4 bytes to an int
                result[i] = ((digest[0] & 0xFF) << 24) |
                            ((digest[1] & 0xFF) << 16) |
                            ((digest[2] & 0xFF) << 8)  |
                            (digest[3] & 0xFF);
            }
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
        return result;
    }
}
```

### Why use `AtomicLongArray`?
By using an array of Atomic Longs, we rely purely on CPU-level Compare-And-Swap (CAS) instructions. This operates entirely Lock-Free. 
1. 100 threads can call `add()` on 100 different strings simultaneously.
2. Even if Thread A and Thread B both hash to index `44` and both need to update `AtomicLong[0]`, the `compareAndSet` loop ensures that one thread updates it, and the other thread immediately retries the OR operation against the new value, enforcing atomic updates without a single `synchronized` block anywhere in the class.