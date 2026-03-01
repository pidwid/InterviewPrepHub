# 🛠️ Design an API Rate Limiter (LLD)

This question tests your ability to translate logical Rate Limiting Algorithms (like Token Bucket, Leaking Bucket, or Sliding Window) into actual working code. 
*Note: This focuses on single-node, in-memory implementation. Distributed Rate Limiting using Redis is a System Design topic discussed elsewhere.*

---

## 1. Requirements

### Functional Requirements
- `boolean allowRequest(String clientId)`
- If a client exceeds the limit (e.g., 5 requests per minute), the function returns `false` (drop the request).
- Otherwise returns `true` (allow).

### Non-Functional Requirements
- **Thread-Safety:** Multiple requests from the same user hit `allowRequest` concurrently.
- **Memory Efficiency:** Do not store redundant data.
- **Low Latency:** The calculation should not block or slow down the application.

---

## 2. Approach: Token Bucket Algorithm

The **Token Bucket** is the most common and accepted algorithm to implement in code because it naturally allows for bursts of traffic while enforcing a long-term average rate.

**Concept:**
Imagine a bucket with a maximum capacity of `5` tokens.
Every minute, a "refiller" drops `5` tokens into the bucket.
When a request comes in:
- Are there tokens? Yes -> Take 1 token, return True.
- Is the bucket empty? Yes -> Return False.

---

## 3. Implementation (The "Refill" Trick)

A naive implementation would spawn a background `TimerTask` or `Thread` that wakes up every minute to refill the buckets. **Do not do this.** If you have 100,000 users, running 100,000 background threads will crash the server.

**The Trick:** Calculate the refill lazily (mathematically) at the exact moment a request comes in.

### The TokenBucket Class

```java
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class TokenBucket {
    private final int maxBucketSize;
    private final int refillRatePerSecond;

    private AtomicInteger currentTokens;
    private AtomicLong lastRefillTimestamp;

    public TokenBucket(int maxBucketSize, int refillRatePerSecond) {
        this.maxBucketSize = maxBucketSize;
        this.refillRatePerSecond = refillRatePerSecond;
        
        // Start with a full bucket
        this.currentTokens = new AtomicInteger(maxBucketSize);
        this.lastRefillTimestamp = new AtomicLong(System.nanoTime());
    }

    public synchronized boolean allowRequest() {
        refill();

        if (currentTokens.get() > 0) {
            currentTokens.decrementAndGet();
            return true;
        }
        return false;
    }

    // Lazy mathematical refill
    private void refill() {
        long now = System.nanoTime();
        long elapsedTimeInNanos = now - lastRefillTimestamp.get();
        // 1 second = 1,000,000,000 nanoseconds
        double elapsedTimeInSeconds = elapsedTimeInNanos / 1e9;
        
        int tokensToAdd = (int) (elapsedTimeInSeconds * refillRatePerSecond);

        if (tokensToAdd > 0) {
            // Update tokens, but do not exceed max capacity
            int newTokens = Math.min(maxBucketSize, currentTokens.get() + tokensToAdd);
            currentTokens.set(newTokens);
            
            // Only update the timestamp if we actually shifted time enough to add a token
            lastRefillTimestamp.set(now);
        }
    }
}
```

### The RateLimiter Manager (Orchestrator)

We need a central manager to assign buckets to clients. We use a Thread-Safe HashMap.

```java
import java.util.concurrent.ConcurrentHashMap;

public class APIRateLimiter {
    private final ConcurrentHashMap<String, TokenBucket> clientBuckets;
    private final int capacity;
    private final int tokensPerSec;

    public APIRateLimiter(int capacity, int tokensPerSec) {
        this.clientBuckets = new ConcurrentHashMap<>();
        this.capacity = capacity;
        this.tokensPerSec = tokensPerSec;
    }

    public boolean allowRequest(String clientId) {
        // If the client doesn't exist, create a bucket for them Atomically
        clientBuckets.putIfAbsent(clientId, new TokenBucket(capacity, tokensPerSec));
        
        TokenBucket bucket = clientBuckets.get(clientId);
        return bucket.allowRequest();
    }
}
```

---

## 4. Alternative Approach: Sliding Window Log

If the interviewer says: "The Token Bucket allows bursts. I want a strictly enforced 5 requests per rolling 60 seconds with no bursting."

Use a **Sliding Window Log** utilizing a Queue.

**Concept:** 
Keep a Queue of timestamps for every request a user makes.
When a new request arrives, look at the Queue. Remove any timestamps older than (Now - 60 seconds).
If the Queue size is `< 5`, add the new timestamp and allow. Else, reject.

```java
import java.util.Queue;
import java.util.LinkedList;

public class SlidingWindowRateLimiter {
    private final Queue<Long> windowLog;
    private final int limit;
    private final long timeWindowInMillis;

    public SlidingWindowRateLimiter(int limit, long timeWindowInMillis) {
        this.windowLog = new LinkedList<>();
        this.limit = limit;
        this.timeWindowInMillis = timeWindowInMillis;
    }

    public synchronized boolean allowRequest() {
        long now = System.currentTimeMillis();
        long windowStart = now - timeWindowInMillis;

        // Strip off outdated requests
        while (!windowLog.isEmpty() && windowLog.peek() < windowStart) {
            windowLog.poll();
        }

        // Check if we hit the limit
        if (windowLog.size() < limit) {
            windowLog.offer(now); // Grant request
            return true;
        }

        // Limit reached
        return false;
    }
}
```
*Note:* The Sliding Window Log is 100% accurate but takes O(N) memory per user based on the limit. For a limit of 10,000 req/min, a Queue is too memory-heavy, and you should switch back to Token Bucket.