# 🛠️ Design a Task Scheduler / Job Scheduler (LLD)

A Task Scheduler runs jobs at specific times or intervals (cron-like). It's a FAANG favorite because it tests priority queues, concurrency, retries, and fault tolerance — all in 45 minutes.

---

## 1. Requirements

### Functional Requirements
- Schedule a task to run **once at a specific time** (`runAt`).
- Schedule a task to run **periodically** (`every N seconds`, cron expression).
- **Cancel** a scheduled task.
- Support **task priority** — higher priority runs first if two tasks fire at the same instant.
- Support **retries with exponential backoff** on failure.
- Optional: **task dependencies** (B runs only after A succeeds — DAG of tasks).

### Non-Functional Requirements
- O(log N) schedule and dispatch (priority queue).
- Thread-safe — many producers can submit, many workers consume.
- Graceful shutdown — no task lost.
- Pluggable execution backend (in-process, thread pool, distributed worker).

---

## 2. Class Design

```
┌────────────────────┐        ┌────────────────────┐
│   Scheduler        │◇──────▶│  Task              │
│   (Singleton)      │  *     │ id, runAt, prio    │
│   - PQ<Task>       │        │ payload, retries   │
│   - WorkerPool     │        └────────────────────┘
└────────┬───────────┘                  ▲
         │                              │ implements
         ▼                              │
┌────────────────────┐        ┌────────────────────┐
│  DispatcherThread  │        │  Runnable          │
│  (single)          │        └────────────────────┘
└────────┬───────────┘
         │ submits to
         ▼
┌────────────────────┐
│  ExecutorService   │
│  (worker pool)     │
└────────────────────┘
```

### Core Data Structure: Min-Heap (PriorityQueue) on `(runAt, priority)`

```java
class Task implements Comparable<Task> {
    String id;
    long runAtMillis;          // wall clock
    int priority;              // higher = runs first
    Runnable action;
    int attempts = 0;
    int maxAttempts;
    long backoffBaseMs;
    boolean cancelled;

    public int compareTo(Task other) {
        int t = Long.compare(this.runAtMillis, other.runAtMillis);
        return (t != 0) ? t : Integer.compare(other.priority, this.priority); // higher prio first
    }
}
```

---

## 3. The Scheduler — Producer-Consumer with Condition Variable

```java
public class TaskScheduler {
    private final PriorityQueue<Task> heap = new PriorityQueue<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    private final ExecutorService workers = Executors.newFixedThreadPool(8);
    private volatile boolean running = true;

    public String schedule(Task t) {
        lock.lock();
        try {
            heap.offer(t);
            notEmpty.signal();          // wake dispatcher
        } finally {
            lock.unlock();
        }
        return t.id;
    }

    public void cancel(String id) {
        lock.lock();
        try {
            heap.removeIf(t -> { if (t.id.equals(id)) { t.cancelled = true; return true; } return false; });
        } finally { lock.unlock(); }
    }

    private void dispatchLoop() {
        while (running) {
            lock.lock();
            try {
                while (heap.isEmpty()) notEmpty.await();
                Task next = heap.peek();
                long delay = next.runAtMillis - System.currentTimeMillis();
                if (delay > 0) {
                    notEmpty.await(delay, TimeUnit.MILLISECONDS); // sleep until ready OR new task added
                    continue;                                     // re-check head (may have changed)
                }
                heap.poll();
                if (!next.cancelled) workers.submit(() -> run(next));
            } catch (InterruptedException ignored) {
            } finally { lock.unlock(); }
        }
    }
}
```

**Why `await(delay)` instead of `Thread.sleep(delay)`?**
A new task might be inserted with an *earlier* `runAt`. `Condition.await(timeout)` lets the producer `signal()` to wake the dispatcher early.

---

## 4. Retries With Exponential Backoff

```java
private void run(Task t) {
    try {
        t.action.run();
    } catch (Exception e) {
        t.attempts++;
        if (t.attempts < t.maxAttempts) {
            long backoff = (long)(t.backoffBaseMs * Math.pow(2, t.attempts - 1));
            long jitter = ThreadLocalRandom.current().nextLong(backoff / 2);
            t.runAtMillis = System.currentTimeMillis() + backoff + jitter;
            schedule(t);            // re-enqueue
        } else {
            deadLetter(t, e);       // give up & log
        }
    }
}
```

Add **jitter** to avoid thundering herd when many tasks fail at once.

---

## 5. Recurring (Cron-style) Tasks

After a recurring task runs, compute the next fire time and re-enqueue.

```java
class RecurringTask extends Task {
    CronExpression cron;
    @Override
    void onComplete() {
        runAtMillis = cron.nextFireTime(System.currentTimeMillis());
        scheduler.schedule(this);
    }
}
```

Use a library like Quartz `CronExpression` for parsing.

---

## 6. Task DAG (Dependencies)

For "B runs after A succeeds":
- Each task has `Set<TaskId> dependsOn`.
- Maintain `Map<TaskId, Set<TaskId>> reverseDeps` (children waiting on me).
- On task success → for each child, decrement its remaining-deps counter → if zero, schedule it.
- Detect cycles up-front via Kahn's topological sort; reject cyclic DAGs.

---

## 7. Concurrency Pitfalls (Senior Differentiator)

| Pitfall | Fix |
|---------|-----|
| Calling `workers.submit` while holding the scheduler lock | Submit *outside* the lock to avoid lock-order issues |
| Heap removal of cancelled tasks is O(n) | Use **lazy cancellation** — mark `cancelled=true`, skip on poll |
| Clock skew / NTP jumps backward | Use `System.nanoTime()` for relative delays, or the monotonic clock |
| Worker pool saturation | Bound the pool + drop policy + back-pressure metrics |

---

## 8. Distributed Variant (When Single-Node Isn't Enough)

- Persist tasks in a DB (Postgres / DynamoDB) keyed by `(due_time, status)`.
- Each worker node polls: `SELECT ... WHERE due_time <= now() AND status='PENDING' FOR UPDATE SKIP LOCKED LIMIT N`.
- `SKIP LOCKED` is the magic that prevents two workers from grabbing the same task.
- Use a **leader-elected scheduler** (via ZooKeeper/etcd) for cron expansion to avoid duplicate fires.
- Real-world examples: Quartz cluster, Airflow, Temporal, AWS EventBridge Scheduler.

---

## 9. Design Patterns Demonstrated

| Pattern | Where |
|---------|-------|
| **Singleton** | `TaskScheduler` |
| **Producer-Consumer** | submit/dispatch loop |
| **Strategy** | retry policy (fixed, exponential, none) |
| **Command** | each `Task` is a Command |
| **Observer** | `onComplete`, `onFailure` callbacks |
| **Template Method** | `Task.run` template, subclass overrides hooks |

---

## 10. Senior Interview Talking Points

- Trade-off: priority queue (O(log n)) vs sorted bucket array (O(1) for fixed time-grain).
- How do you handle **task starvation** (low-priority tasks never run)? → Aging: bump priority based on wait time.
- How do you guarantee **at-most-once vs at-least-once**? → Idempotency tokens; the scheduler is at-least-once by default.
- How would you scale to 100M scheduled tasks? → Hierarchical timing wheels (Kafka/Netty) — O(1) insert, no heap.
- How do you handle **graceful shutdown**? → Stop accepting new submits → drain in-flight → snapshot heap to disk → restore on restart.

---

## Sources / Cross-Refs
- Quartz Scheduler reference: https://www.quartz-scheduler.org/documentation/
- Java API docs — `ScheduledThreadPoolExecutor` / `DelayQueue`: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ScheduledThreadPoolExecutor.html
- George Varghese & Anastasios Lauck — *Hashed and Hierarchical Timing Wheels* (SOSP 1987) — the O(1) timer data structure used by Kafka & Netty.
- LLD-08 Behavioral Patterns (Command pattern for tasks).
- Solution-Thread-Pool.md, Solution-Notification-Throttler.md (related schedulers).
