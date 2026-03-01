# 🛠️ Building H2O Molecule (Concurrency)

This is Leetcode problem #1117. 
There are two kinds of threads, oxygen and hydrogen. Your goal is to group these threads to form water molecules. There is a barrier where each thread has to wait until a complete molecule (two Hydrogen, one Oxygen) can be formed.

---

## 1. Requirements

- `hydrogen(Runnable releaseHydrogen)`
- `oxygen(Runnable releaseOxygen)`
- Two `hydrogen` threads and one `oxygen` thread must cross the barrier together to form a molecule.
- If an oxygen thread arrives, it must wait until two hydrogens arrive.
- If three hydrogens arrive, the third one must wait until an oxygen arrives and the first two complete their molecule.

---

## 2. Approach: Semaphores

We need to restrict the number of threads entering the critical section.
We only ever want 2 Hydrogens active at a time.
We only ever want 1 Oxygen active at a time.

We can use standard `Semaphores` combined with a variable or a cyclic barrier to group them.
However, because exactly 2 H and 1 O make a molecule, we can set up interlocking Semaphores.

---

## 3. Implementation (Java)

We will use two Semaphores:
- `hSem`: initialized to 2. (Allows 2 hydrogens to enter the room).
- `oSem`: initialized to 0. (Oxygens must wait outside until called).

Another Semaphore `oTurn` or `oLock` initialized to 1 can ensure only one oxygen process enters at a time, but standard permits work fine.

```java
import java.util.concurrent.Semaphore;

class H2O {

    // Allow exactly 2 H
    private Semaphore hSem = new Semaphore(2);
    // Allow exactly 0 O initially
    private Semaphore oSem = new Semaphore(0);

    public H2O() {
    }

    public void hydrogen(Runnable releaseHydrogen) throws InterruptedException {
        // Wait for a hydrogen permit
        hSem.acquire();
        
        // releaseHydrogen.run() outputs "H". Do not change or remove this line.
        releaseHydrogen.run();
        
        // After an H prints, it gives exactly half a permit to O.
        // It takes TWO hydrogens to give O a full permit (if we release(1), O needs acquire(2))
        // So we will just use a cyclic logic.
        oSem.release();
    }

    public void oxygen(Runnable releaseOxygen) throws InterruptedException {
        // Wait for TWO hydrogens to have arrived and processed
        oSem.acquire(2);
        
        // releaseOxygen.run() outputs "O". Do not change or remove this line.
        releaseOxygen.run();
        
        // Now that the molecule H2O is complete, open the gate for the next 2 H's
        hSem.release(2);
    }
}
```

### How the flow works:

**Scenario: 3 Hydrogen threads arrive.**
1. H1 calls `hSem.acquire()` (Permits drops 2 -> 1). Prints "H". Calls `oSem.release(1)` (O permits 0 -> 1).
2. H2 calls `hSem.acquire()` (Permits drops 1 -> 0). Prints "H". Calls `oSem.release(1)` (O permits 1 -> 2).
3. H3 calls `hSem.acquire()` (Permits 0). **H3 Blocks**.

**Scenario: 1 Oxygen thread arrives.**
4. O1 calls `oSem.acquire(2)`. (It succeeds because Permits is 2 -> 0).
5. O1 Prints "O". 
6. O1 calls `hSem.release(2)`. (H permits 0 -> 2).

7. H3 (which was blocked) immediately acquires a permit and proceeds.

This perfectly coordinates the $2:1$ ratio indefinitely without race conditions.