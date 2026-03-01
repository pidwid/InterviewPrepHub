# 🛠️ Fizz Buzz Multithreaded (Concurrency)

This is Leetcode problem #1195. It takes the classic FizzBuzz interview question and turns it into a synchronization problem across 4 threads.

---

## 1. Requirements

You have a class with 4 methods:
- `fizz()`: prints "fizz" if `i` is divisible by 3 and not 5.
- `buzz()`: prints "buzz" if `i` is divisible by 5 and not 3.
- `fizzbuzz()`: prints "fizzbuzz" if `i` is divisible by 3 and 5.
- `number()`: prints `i` if `i` is not divisible by 3 or 5.

Four separate threads will call these four methods simultaneously.
They must print exactly: `1, 2, fizz, 4, buzz, fizz, 7, 8, fizz, buzz...` up to $N$.

---

## 2. Approach: wait() and notifyAll() with a Shared Counter

Unlike "FooBar" or "ZeroEvenOdd", the flow of control is *not* a fixed rotating sequence. Sometimes `number()` runs twice in a row (e.g., printing 1 then 2). 

Because the next state is purely determined by the value of a shared counter `i`, this problem is perfectly suited for the intrinsic monitor lock (`synchronized`, `wait`, `notifyAll`). We maintain a shared variable `i` that iterates from 1 to $N$. Each thread loops but only acts if it is currently its specific turn based on the math.

---

## 3. Implementation (Java)

```java
import java.util.function.IntConsumer;

class FizzBuzz {
    private int n;
    private int current = 1; // Our shared state

    public FizzBuzz(int n) {
        this.n = n;
    }

    // Thread A
    public synchronized void fizz(Runnable printFizz) throws InterruptedException {
        while (current <= n) {
            if (current % 3 == 0 && current % 5 != 0) {
                printFizz.run();
                current++;
                notifyAll();
            } else {
                wait();
            }
        }
    }

    // Thread B
    public synchronized void buzz(Runnable printBuzz) throws InterruptedException {
        while (current <= n) {
            if (current % 5 == 0 && current % 3 != 0) {
                printBuzz.run();
                current++;
                notifyAll();
            } else {
                wait();
            }
        }
    }

    // Thread C
    public synchronized void fizzbuzz(Runnable printFizzBuzz) throws InterruptedException {
        while (current <= n) {
            if (current % 15 == 0) {
                printFizzBuzz.run();
                current++;
                notifyAll();
            } else {
                wait();
            }
        }
    }

    // Thread D
    public synchronized void number(IntConsumer printNumber) throws InterruptedException {
        while (current <= n) {
            if (current % 3 != 0 && current % 5 != 0) {
                printNumber.accept(current);
                current++;
                notifyAll();
            } else {
                wait();
            }
        }
    }
}
```

---

## 4. Alternative Approach: CyclicBarrier

Because all 4 threads check the same single number in unison (only one succeeds, while the others fail their `if` check), this problem can also be modeled using a `CyclicBarrier`.
However, `CyclicBarrier` logic here is often considered "clever" but overly complex and harder to read than the standard `wait/notify` loop. The standard `synchronized` approach is highly recommended for interviews as it proves you understand primitive monitor locks.