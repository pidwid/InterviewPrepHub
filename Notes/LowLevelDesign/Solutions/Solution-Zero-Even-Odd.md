# 🛠️ Print Zero Even Odd (Concurrency)

This is a Leetcode concurrency problem (#1116) that is a step up from FooBar.
You have three functions: `zero()`, `even()`, and `odd()`.
Three separate threads will call these functions. You must print `0102030405...` up to $N$.

---

## 1. Requirements
- If $N=5$, output is `0102030405`.
- Thread A calls `zero()` and prints only `0`s.
- Thread B calls `even()` and prints only even numbers.
- Thread C calls `odd()` and prints only odd numbers.
- The sequence must strictly be: `Zero -> Odd -> Zero -> Even -> Zero -> Odd...`

---

## 2. Approach: Semaphores

Because the state transitions are exactly predictable and cyclical, `Semaphores` are the easiest way to control the flow.

We need three semaphores:
- `zeroSem` (Starts with 1 permit, because '0' always prints first)
- `oddSem` (Starts with 0 permits)
- `evenSem` (Starts with 0 permits)

**The tricky part:** 
`zero()` prints `0`, but who does it wake up next? It depends on what the next number is. If the next number is $1$, it wakes up `odd()`. If the next number is $2$, it wakes up `even()`.

---

## 3. Implementation (Java)

```java
import java.util.concurrent.Semaphore;
import java.util.function.IntConsumer;

class ZeroEvenOdd {
    private int n;
    
    private Semaphore zeroSem = new Semaphore(1);
    private Semaphore oddSem = new Semaphore(0);
    private Semaphore evenSem = new Semaphore(0);

    public ZeroEvenOdd(int n) {
        this.n = n;
    }

    // Thread A
    public void zero(IntConsumer printNumber) throws InterruptedException {
        for (int i = 1; i <= n; i++) {
            zeroSem.acquire();
            printNumber.accept(0);
            
            // Should the NEXT number be even or odd?
            if (i % 2 != 0) {
                oddSem.release();  // i is odd (e.g. 1), wake up Odd thread
            } else {
                evenSem.release(); // i is even (e.g. 2), wake up Even thread
            }
        }
    }

    // Thread B
    public void even(IntConsumer printNumber) throws InterruptedException {
        for (int i = 2; i <= n; i += 2) {
            evenSem.acquire();
            printNumber.accept(i);
            
            // Even is done, always hand control back to Zero
            zeroSem.release();
        }
    }

    // Thread C
    public void odd(IntConsumer printNumber) throws InterruptedException {
        for (int i = 1; i <= n; i += 2) {
            oddSem.acquire();
            printNumber.accept(i);
            
            // Odd is done, always hand control back to Zero
            zeroSem.release();
        }
    }
}
```

---

## 4. Why use IntConsumer?

Leetcode provides the `IntConsumer printNumber` parameter. It is a functional interface. Calling `printNumber.accept(x)` actually prints the number to the console in the test environment. 

### Why is Semaphore better than `wait/notify` here?
To do this with `wait/notify`, you only have one monitor lock (the `this` object). When `zero()` finishes, it must call `notifyAll()` to wake up *both* the Even and Odd threads, because it cannot selectively `notify()` just one specific thread. The wrong thread will wake up, evaluate a `while` condition, and go back to sleep. This causes unnecessary CPU usage (Thundering Herd). Semaphores avoid this entirely by targeting the specific blocked thread.