# 🛠️ Design a Connection Pool (LLD)

A Connection Pool is a cache of database connections maintained so that the connections can be reused when future requests to the database are required. Opening a new physical TCP connection to PostgreSQL or MySQL takes tens of milliseconds (handshake, auth). A pool keeps $N$ connections perpetually "open" and hands them out to threads instantly.

---

## 1. Requirements

### Functional Requirements
- Initialize with a minimum number of connections (e.g., 5).
- Allow setting a maximum limit (e.g., 20).
- `getConnection()`: Checkout an existing open connection.
- `releaseConnection()`: Return a connection to the pool.
- Expand the pool dynamically if it hits a spike, up to the max exactly.

### Non-Functional Requirements
- **Thread Safety:** Multiple web server threads will call `getConnection()` concurrently.
- **Blocking / Timeout:** If 20 threads hold all 20 connections, the 21st thread should block and wait, perhaps timing out after a while.
- **Validation:** (Bonus) Periodically verify that connections haven't silently died (TCP drop).

---

## 2. Core Concepts

This is exactly the **Producer-Consumer** pattern mixed with the **Object Pool** Design Pattern.
We will use a `BlockingQueue` to hold the "Idle" connections.
- When you want a connection: `queue.take()`
- When you are done: `queue.offer(conn)`

---

## 3. Implementation (Java)

Instead of actual generic `java.sql.Connection`, we'll use a dummy `DBConnection` wrapper for clarity.

### The Pool Manager

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class BasicConnectionPool {
    private final String url;
    private final String user;
    private final String password;

    private final int minPoolSize;
    private final int maxPoolSize;

    // The queue holding the currently available, idle connections
    private BlockingQueue<Connection> availableConnections;
    
    // Tracks the absolute total number of connections created
    private AtomicInteger totalCreated = new AtomicInteger(0);

    public BasicConnectionPool(String url, String user, String pass, int min, int max) throws Exception {
        this.url = url;
        this.user = user;
        this.password = pass;
        this.minPoolSize = min;
        this.maxPoolSize = max;

        this.availableConnections = new LinkedBlockingQueue<>(max);

        // Pre-fill the minimum connections
        for (int i = 0; i < minPoolSize; i++) {
            availableConnections.add(createNewConnection());
        }
    }

    private Connection createNewConnection() throws Exception {
        Connection conn = DriverManager.getConnection(url, user, password);
        totalCreated.incrementAndGet();
        return conn;
    }

    public Connection getConnection() throws Exception {
        // Try to grab one instantly
        Connection conn = availableConnections.poll();
        if (conn != null) {
            return conn;
        }

        // If None available, can we create a new one?
        // We use a CAS loop setup (or simple sync) to avoid breaching the max size
        synchronized (this) {
            if (totalCreated.get() < maxPoolSize) {
                // We are under the max limit, so spin up a new connection on the fly
                return createNewConnection();
            }
        }

        // We hit the max limit. The only option is to wait until one is returned.
        // Wait up to 5 seconds before throwing an error.
        conn = availableConnections.poll(5, TimeUnit.SECONDS);
        
        if (conn == null) {
            throw new RuntimeException("Timeout waiting for a free database connection.");
        }
        
        return conn;
    }

    // Client MUST call this in a finally block!
    public void releaseConnection(Connection connection) {
        if (connection != null) {
            try {
                if (!connection.isClosed()) {
                    // Put it back in the pool
                    availableConnections.offer(connection);
                } else {
                    // Connection was fatally closed, decrement our count
                    totalCreated.decrementAndGet();
                }
            } catch (Exception e) {
                totalCreated.decrementAndGet();
            }
        }
    }
}
```

### 4. Advanced Considerations (Real-World HikariCP / c3p0)

In an interview, they might ask how to improve this naive implementation. Real-world pools (like HikariCP) are much more complex.

**1. Connection Validation (Eviction):**
What if the database server was restarted? All 10 connections sitting in your `LinkedBlockingQueue` are now completely broken (broken pipes). 
If a user calls `getConnection()` and receives a dead connection, their SQL query will throw an Exception.
- *Fix:* Before returning the connection from `getConnection()`, run a fast validation query `SELECT 1`. If it throws an error, destroy the connection, decrement `totalCreated`, and recursively call `getConnection()` to try the next one.
- *Better Fix (HikariCP):* Have a background eviction thread ping the idle connections every minute to ensure they are alive.

**2. Guarding against Memory Leaks:**
What if a junior developer writes `Connection c = pool.getConnection();` but forgets to call `pool.releaseConnection(c)` inside a `finally` block? That connection is gone forever. If it happens 20 times, the app freezes.
- *Fix:* Give connections a `lastRentedTimestamp`. A background daemon thread scans active connections. If a connection has been checked out for > 5 minutes, it assumes a leak, forcefully kills the physical socket, and generates a new internal connection, logging a massive warning.
- *Proxy Pattern:* Don't return the raw `java.sql.Connection`. Return a Proxy `WrappedConnection` that overrides the `close()` method. When the user calls `c.close()`, it intercepts the call and runs `pool.releaseConnection(this)`.