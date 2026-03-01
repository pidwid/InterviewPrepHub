# Distributed Locking

## Table of Contents

1. [Overview](#1-overview)
2. [Why Distributed Locks?](#2-why-distributed-locks)
3. [Database-Based Locks](#3-database-based-locks)
4. [Redis-Based Locks](#4-redis-based-locks)
5. [Redlock Algorithm](#5-redlock-algorithm)
6. [ZooKeeper-Based Locks](#6-zookeeper-based-locks)
7. [etcd-Based Locks](#7-etcd-based-locks)
8. [Fencing Tokens](#8-fencing-tokens)
9. [Comparison & Trade-offs](#9-comparison--trade-offs)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

In a single-process application, you use mutexes or synchronized blocks.
In a distributed system with multiple processes/servers accessing shared
resources, you need **distributed locks**.

```
Without distributed lock:           With distributed lock:
                                     
Server A ──► Deduct $100 ──► DB      Server A ──► Acquire lock ──► Deduct ──► Release
Server B ──► Deduct $100 ──► DB      Server B ──► Wait for lock... ──► Deduct ──► Release
                                     
Balance: $200                        Balance: $200
Both succeed → Balance: $0 ✓?       A: $200→$100, then B: $100→$0 ✓
But only expected one to succeed!    Correctly serialized!

Race condition: double-spend          No race condition
```

---

## 2. Why Distributed Locks?

| Use Case                  | Description                                              |
|--------------------------|----------------------------------------------------------|
| Preventing double-spend  | Only one server processes a payment at a time            |
| Leader election          | Only one instance acts as leader                         |
| Resource access control  | Exclusive access to a shared file/resource               |
| Cron job dedup           | Only one server runs the scheduled job                   |
| Rate limiting setup      | Coordinate rate limit counters across nodes              |
| Cache stampede prevention| Only one server rebuilds the cache                       |

### Properties of a Good Distributed Lock

```
1. Mutual Exclusion (Safety)
   At most one client holds the lock at any time.
   
2. Deadlock Freedom (Liveness)
   Eventually, the lock is always acquirable (TTL / expiry).
   
3. Fault Tolerance
   Lock works even if some lock service nodes fail.
   
4. No SPOF
   Lock service itself shouldn't be a single point of failure.
```

---

## 3. Database-Based Locks

### Approach 1: Row-Level Lock Table

```sql
CREATE TABLE distributed_locks (
    lock_name VARCHAR(255) PRIMARY KEY,
    locked_by VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Acquire lock (atomic INSERT — fails if already exists)
INSERT INTO distributed_locks (lock_name, locked_by, expires_at)
VALUES ('order-123', 'server-a', NOW() + INTERVAL '30 seconds');

-- Release lock
DELETE FROM distributed_locks 
WHERE lock_name = 'order-123' AND locked_by = 'server-a';

-- Cleanup expired locks (background job)
DELETE FROM distributed_locks WHERE expires_at < NOW();
```

### Approach 2: SELECT FOR UPDATE

```sql
BEGIN;
  SELECT * FROM orders WHERE id = 123 FOR UPDATE;
  -- Row is now locked for this transaction
  -- Other transactions on this row will block
  
  UPDATE orders SET status = 'processing' WHERE id = 123;
COMMIT;
-- Lock released on commit
```

**Pros**: Simple, uses existing infrastructure, ACID guarantees.
**Cons**: Database becomes bottleneck, not designed for this, limited throughput,
connection pool exhaustion with many waiting locks.

---

## 4. Redis-Based Locks

### Basic Redis Lock (Single Instance)

```
ACQUIRE:
  SET lock:order-123 "server-a" NX EX 30
  
  NX = only set if key does NOT exist (atomic)
  EX 30 = expire after 30 seconds (deadlock prevention)
  
  Returns OK → lock acquired
  Returns nil → lock held by someone else

RELEASE (must be atomic — use Lua script):
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
  
  Why check value? To avoid releasing someone else's lock:
  
  Server A acquires lock (EX 30)  →  lock = "server-a"
  Server A stalls for 35 seconds  →  lock expires
  Server B acquires lock          →  lock = "server-b"
  Server A tries to release       →  Would delete B's lock!
  With value check: A sees "server-b" ≠ "server-a" → skip
```

### Redis Lock Implementation

```python
import redis
import uuid
import time

class RedisLock:
    def __init__(self, client, key, ttl=30):
        self.client = client
        self.key = f"lock:{key}"
        self.ttl = ttl
        self.token = str(uuid.uuid4())  # Unique owner token
    
    def acquire(self, timeout=10):
        end = time.time() + timeout
        while time.time() < end:
            if self.client.set(self.key, self.token, nx=True, ex=self.ttl):
                return True
            time.sleep(0.1)  # Retry with backoff
        return False
    
    def release(self):
        # Lua script for atomic check-and-delete
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        self.client.eval(script, 1, self.key, self.token)
    
    def extend(self, additional_time):
        # Extend TTL if still holding the lock
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        self.client.eval(script, 1, self.key, self.token, additional_time * 1000)
```

### Problem: Single Redis Instance = SPOF

```
If Redis crashes while a lock is held:
  - Lock disappears → multiple clients acquire "simultaneously"
  
If Redis uses async replication:
  Client A acquires lock on master
  Master crashes before replicating to replica
  Replica promoted to master
  Client B acquires the SAME lock!
  → Both clients think they hold the lock
```

---

## 5. Redlock Algorithm

Martin Kleppmann vs Salvatore Sanfilippo (Redis author) debate.
Designed to address single-instance Redis lock failures.

```
Setup: N independent Redis instances (e.g., N=5, no replication)

ACQUIRE:
  1. Get current time T1
  2. Try to acquire lock on ALL N instances (sequentially, short timeout)
  3. Get current time T2
  4. Lock acquired if:
     - Majority (≥ N/2 + 1, i.e., ≥ 3) instances granted the lock
     - Total time (T2 - T1) < lock TTL
  5. Effective TTL = original TTL - (T2 - T1)
  6. If failed: release lock on ALL instances

  Instance 1: SET lock "tok" NX EX 30 → OK  ✓
  Instance 2: SET lock "tok" NX EX 30 → OK  ✓
  Instance 3: SET lock "tok" NX EX 30 → timeout ✗
  Instance 4: SET lock "tok" NX EX 30 → OK  ✓
  Instance 5: SET lock "tok" NX EX 30 → OK  ✓
  
  4/5 succeeded (≥ 3) → Lock acquired!
  Effective TTL = 30 - elapsed_time

RELEASE:
  DEL lock on ALL instances (even ones that failed)
```

### Criticism (Martin Kleppmann)

```
The Redlock safety argument depends on timing assumptions:
  1. Processes don't pause for arbitrary periods (GC, page faults)
  2. Clocks don't jump (NTP corrections)
  3. Network delays are bounded

If any assumption fails:
  Client A gets lock, pauses for GC (60 sec)
  Lock expires (TTL 30 sec)
  Client B gets lock
  Client A resumes — thinks it still has the lock
  BOTH are operating on the shared resource!

Solution: Use fencing tokens (see Section 8)
```

---

## 6. ZooKeeper-Based Locks

ZooKeeper provides sequential ephemeral nodes — ideal for distributed locking.

```
Zookeeper Lock Recipe:

1. Create an ephemeral sequential node:
   /locks/order-123/lock-  →  /locks/order-123/lock-0000000001

2. Get all children of /locks/order-123:
   [lock-0000000001, lock-0000000002, lock-0000000003]

3. If my node has the LOWEST sequence number → I have the lock

4. If not, watch the node with the NEXT LOWER sequence number
   (NOT all nodes — avoids "herd effect")

5. When the watched node is deleted → re-check if I'm lowest

6. Release: delete my node (or let ephemeral node expire on disconnect)

  ┌─────────────────────┐
  │ /locks/order-123    │
  │  ├── lock-001 (A)   │ ← Holds the lock (lowest)
  │  ├── lock-002 (B)   │ ← Watches lock-001
  │  └── lock-003 (C)   │ ← Watches lock-002
  └─────────────────────┘
  
  When A releases: lock-001 deleted
  B's watch fires → B is now lowest → B has the lock
  C doesn't wake up (no herd effect)
```

### Advantages of ZooKeeper Locks

```
Ephemeral nodes:
  If client crashes → session expires → node auto-deleted → lock released
  No manual TTL management needed!

Sequential ordering:
  Fair locks — first come, first served (FIFO)

Watch mechanism:
  Clients are notified instead of polling (efficient)
```

**Pros**: Battle-tested, auto-cleanup on client failure, fair ordering, no TTL guessing.
**Cons**: ZooKeeper cluster overhead, higher latency than Redis, more complex setup, 
write throughput limited by consensus.

---

## 7. etcd-Based Locks

etcd uses Raft consensus and provides lease-based locking.

```
etcd Lock Mechanism:

1. Create a lease with TTL:
   lease = client.lease(ttl=30)  # 30 second lease

2. Put a key with the lease attached:
   client.put("/locks/order-123", "server-a", lease=lease)
   
   If key exists → wait (or return failure)

3. Keep the lease alive (heartbeat):
   lease.keepalive()  # Background goroutine/thread

4. Release: revoke the lease
   lease.revoke()  → key is deleted

If client crashes → heartbeat stops → lease expires → key deleted
```

### etcd vs ZooKeeper

| Feature         | ZooKeeper                    | etcd                         |
|----------------|------------------------------|------------------------------|
| Consensus      | ZAB                          | Raft                         |
| API            | Custom protocol               | gRPC + HTTP                  |
| Watch          | Single node watch            | Key range watch              |
| Language       | Java                         | Go                           |
| Used by        | Kafka, HBase, Hadoop         | Kubernetes                   |
| Lock primitive | Sequential ephemeral nodes   | Lease + key                  |
| Ease of use    | Moderate                     | Simpler API                  |

---

## 8. Fencing Tokens

The solution to the GC-pause problem with locks.

```
The Problem:
  Client A acquires lock (token 33)
  Client A: long GC pause
  Lock expires (TTL)
  Client B acquires lock (token 34)
  Client A wakes up, thinks it has the lock
  
  A and B both write to storage → DATA CORRUPTION

The Solution — Fencing Tokens:
  Lock service issues a monotonically increasing token with each lock grant.
  Storage service (DB, file system) rejects writes with old tokens.

  ┌──────────┐    acquire    ┌────────────┐
  │ Client A │──────────────►│   Lock     │ → token: 33
  │          │◄──────────────│  Service   │
  └──────────┘               └────────────┘
       │                          │
       │  GC pause 60s            │
       │  ...                     │ Client B acquires → token: 34
       │                          │
       ▼                          ▼
  ┌──────────────────────────────────────┐
  │           Storage Service            │
  │                                      │
  │  Client B writes with token 34 → OK │
  │  Client A writes with token 33 → REJECTED (33 < 34) │
  │                                      │
  │  Rule: reject any write with a token │
  │  lower than the highest seen token   │
  └──────────────────────────────────────┘
```

### Implementation

```python
# Storage service tracks highest seen token per resource
class FencedStorage:
    def __init__(self):
        self.data = {}
        self.highest_token = {}  # resource → highest token seen
    
    def write(self, resource, value, fencing_token):
        current = self.highest_token.get(resource, 0)
        if fencing_token < current:
            raise StaleTokenError(
                f"Token {fencing_token} < current {current}"
            )
        self.highest_token[resource] = fencing_token
        self.data[resource] = value
```

---

## 9. Comparison & Trade-offs

| Approach        | Consistency | Latency | Throughput | Auto-Cleanup | Complexity |
|----------------|------------|---------|-----------|-------------|------------|
| Database       | Strong     | High    | Low       | Manual TTL  | Simple     |
| Redis (single) | Weak       | Very Low| Very High | TTL         | Simple     |
| Redlock        | Moderate   | Low     | High      | TTL         | Moderate   |
| ZooKeeper      | Strong     | Medium  | Medium    | Ephemeral   | High       |
| etcd           | Strong     | Medium  | Medium    | Lease       | Moderate   |

### Decision Guide

```
Need strong correctness guarantees?
  └── ZooKeeper or etcd (consensus-based)

Need very high throughput, can tolerate rare edge cases?
  └── Redis single-instance lock (with fencing tokens)

Already running Kubernetes?
  └── etcd (it's already there)

Already running Kafka/Hadoop?
  └── ZooKeeper (it's already there)

Simple use case, have a database?
  └── Database lock (simplest)

Need it to work across datacenters?
  └── Consider advisory locks with fencing tokens
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Distributed locks are hard | Clock skew, GC pauses, network partitions all break naive approaches |
| Redis is fast but not perfectly safe | Single-instance can lose locks on crash; Redlock is debated |
| ZooKeeper/etcd provide strong safety | Consensus-based, but higher latency and operational overhead |
| Always use fencing tokens | The only way to guarantee safety despite process pauses |
| Set appropriate TTLs | Too short → premature expiry. Too long → long wait on failure |
| Prefer idempotent operations | If mutual exclusion fails, idempotency limits the damage |
| Locks don't scale well | Consider lock-free designs (CAS, optimistic concurrency) when possible |
| Auto-cleanup is critical | Ephemeral nodes (ZK) or leases (etcd) > manual TTL management |
