# 🛠️ Print FooBar Alternately (Concurrency)

This is a classic Leetcode concurrency problem (#1115).
You have a class with two methods: `foo()` and `bar()`. 
Thread A calls `foo()`, and Thread B calls `bar()`. You must guarantee that the output is exactly "foobarfoobar...", meaning the two threads must strictly alternate, starting with "foo".

---

## 1. Requirements

- Thread A calls `foo()` $N$ times.
- Thread B calls `bar()` $N$ times.
- Result should be `foobar` repeated $N$ times.
- Threads execute asynchronously, meaning Thread B might get CPU time before Thread A. The code must block B until A has printed "foo".

---

## 2. Approach: Semaphores

A `Semaphore` maintains a set of permits. 
- `acquire()`: Blocks until a permit is available, then takes it.
- `release()`: Adds a permit, unblocking a waiting thread.

By initializing the "Foo" semaphore with 1 permit, and the "Bar" semaphore with 0 permits, we enforce the starting order. 
When Foo finishes, it releases a permit to Bar. When Bar finishes, it releases a permit to Foo.

---

## 3. Implementation (Java)

```java
import java.util.concurrent.Semaphore;

class FooBar {
    private int n;
    
    // Foo starts with 1 permit (it is allowed to go first)
    private Semaphore fooSem = new Semaphore(1);
    
    // Bar starts with 0 permits (it must wait)
    private Semaphore barSem = new Semaphore(0);

    public FooBar(int n) {
        this.n = n;
    }

    public void foo(Runnable printFoo) throws InterruptedException {
        for (int i = 0; i < n; i++) {
            fooSem.acquire();       // 1->0 (First time, succeeds instantly. Next times, waits for Bar)
            
            printFoo.run();         // Print "foo"
            
            barSem.release();       // Unblock Bar (0->1)
        }
    }

    public void bar(Runnable printBar) throws InterruptedException {
        for (int i = 0; i < n; i++) {
            barSem.acquire();       // Wait for Foo to release a permit
            
            printBar.run();         // Print "bar"
            
            fooSem.release();       // Unblock Foo
        }
    }
}
```

---

## 4. Alternative Approach: synchronized (wait/notify)

You can also solve this using the intrinsic object monitor lock. We use a boolean flag `fooTurn` to represent whose turn it is.

```java
class FooBar {
    private int n;
    private boolean fooTurn = true; // True if it's Foo's turn

    public FooBar(int n) {
        this.n = n;
    }

    public synchronized void foo(Runnable printFoo) throws InterruptedException {
        for (int i = 0; i < n; i++) {
            while (!fooTurn) {
                wait(); // Wait until it's foo's turn
            }
            printFoo.run();
            fooTurn = false; // Hand over turn to Bar
            notifyAll();     // Wake up Bar
        }
    }

    public synchronized void bar(Runnable printBar) throws InterruptedException {
        for (int i = 0; i < n; i++) {
            while (fooTurn) {
                wait(); // Wait until it's bar's turn
            }
            printBar.run();
            fooTurn = true;  // Hand over turn to Foo
            notifyAll();     // Wake up Foo
        }
    }
}
```

*Note: While `wait/notify` is perfectly valid, using `Semaphore` is usually considered the cleanest and most readable solution for strict alternation problems.*