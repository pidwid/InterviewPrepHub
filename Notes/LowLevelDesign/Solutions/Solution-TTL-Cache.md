# 🛠️ Design a TTL (Time-To-Live) Cache (LLD)

> **Sources**: [Caffeine Cache (Ben Manes)](https://github.com/ben-manes/caffeine) — W-TinyLFU + per-key expiration; [Redis EXPIRE — passive vs active expiration](https://redis.io/docs/manual/keyspace-notifications/) (probabilistic active sampling); Apache Kafka's [hierarchical timing wheel](https://github.com/apache/kafka/blob/trunk/server-common/src/main/java/org/apache/kafka/server/util/timer/TimingWheel.java); Brian Goetz et al. — *Java Concurrency in Practice*.

## 1. Requirements

### Functional
- `put(K key, V value, long ttlSeconds)`
- `V get(K key)` — returns value if not expired, else `null`
- `remove(K key)`
- **Per-key TTL** (different keys may have different expirations)

### Non-Functional
- **O(1) average** for `put`/`get`
- Bounded memory even when many entries expire at once
- **Thread-safe** under concurrent `put`/`get`/cleanup
- Per-keystroke latency unaffected by background cleanup

## 2. Core Entities

| Entity | Fields |
|---|---|
| `CacheEntry<V>` | `value: V`, `expirationTimeMs: long` (absolute, computed at `put` time) |
| `TTLCache<K,V>` | `storage: ConcurrentHashMap<K, CacheEntry<V>>`, `expirationStrategy`, optional `cleanupExecutor`, optional `evictionListener` |
| `ExpirationStrategy` | interface with `LAZY`, `ACTIVE`, `TTL_WHEEL` implementations |

> **Store an absolute `expirationTimeMs`, not a relative TTL.** Comparisons become `entry.expirationTimeMs > now`, no per-check arithmetic.

## 3. Reference Implementation (LAZY + ACTIVE hybrid)

```java
public class TTLCache<K, V> {
  static final class Entry<V> {
    final V value; final long expireAt;
    Entry(V v, long e) { value = v; expireAt = e; }
  }

  private final ConcurrentHashMap<K, Entry<V>> map = new ConcurrentHashMap<>();
  private final ScheduledExecutorService sweeper;

  public TTLCache(long sweepEveryMs) {
    sweeper = Executors.newScheduledThreadPool(1, r -> {
      Thread t = new Thread(r, "ttl-cache-sweeper"); t.setDaemon(true); return t;
    });
    sweeper.scheduleAtFixedRate(this::sweep, sweepEveryMs, sweepEveryMs, MILLISECONDS);
  }

  public void put(K key, V value, long ttlMs) {
    map.put(key, new Entry<>(value, System.currentTimeMillis() + ttlMs));
  }

  // LAZY check on get, with atomic check-then-evict
  public V get(K key) {
    Entry<V>[] removed = new Entry[1];
    Entry<V> kept = map.compute(key, (k, e) -> {
      if (e == null) return null;
      if (e.expireAt <= System.currentTimeMillis()) { removed[0] = e; return null; }
      return e;
    });
    return kept != null ? kept.value : null;
  }

  public V remove(K key) {
    Entry<V> e = map.remove(key);
    return e != null ? e.value : null;
  }

  // ACTIVE sweep: incremental, bounded — runs on the scheduler thread
  private void sweep() {
    long now = System.currentTimeMillis();
    map.entrySet().removeIf(e -> e.getValue().expireAt <= now);
  }
}
```

The `compute()` block makes the **check-then-evict** atomic (no race where two readers both see "expired" and both attempt removal).

## 4. Eviction Strategies — Trade-offs

| Strategy | Memory | CPU | Notes |
|---|---|---|---|
| **LAZY only** (check on `get`) | **Unbounded** if cold keys are never read | Lowest | Simplest; bad for write-heavy with infrequent reads |
| **ACTIVE** (background sweep) | Bounded ✓ | Periodic spikes during sweep | Tune sweep interval; can cause GC bursts |
| **TTL Wheel** (hierarchical) | Bounded ✓ | O(1) insert + O(bucket) sweep | Used by Kafka and Netty for **100M+** scheduled tasks |
| **Min-heap by `expireAt`** | Bounded ✓ | O(log n) insert; sweeper polls earliest | Precise next-expiration time, but more allocations |

### Hierarchical timing wheel (high-scale)
A circular array of `bucketCount` buckets, each holding entries that expire within a small time window (e.g., 1 second). The "hand" advances one bucket per tick, expiring everything in that bucket. **Hierarchical**: a second wheel ticks once per full revolution of the first (seconds → minutes → hours), so a 1-day TTL stores 1 entry, not 86,400. O(1) insert and cancel. Kafka uses exactly this for delayed produce/fetch operations.

## 5. Design Patterns

| Pattern | Where | Why |
|---|---|---|
| **Strategy** | `ExpirationStrategy` (`Lazy`, `Active`, `TTLWheel`) | Switch policies without changing call sites. |
| **Decorator** | `TtlCacheDecorator` wraps any underlying `Cache` (`HashMap`, `LRUCache`, `Caffeine`) | Add TTL semantics without modifying the wrapped class. |
| **Observer** | `EvictionListener.onEvict(key, value, cause)` | Metrics, write-back, downstream cache invalidation. |
| **Singleton** | `CacheManager` registry of named caches | One coordinator, like Caffeine's `CacheManager`. |
| **Composite** | Tiered cache: `TieredCache(L1: in-memory TTL, L2: Redis)` — same `Cache` interface | Read L1 → miss → read L2 → populate L1. |

## 6. Concurrency & Edge Cases

### 6.1 Cache stampede (thundering herd)
A popular key expires; thousands of `get`s miss simultaneously and all rush to recompute. Solutions:
- **Single-flight** (Go's `singleflight`): the first miss takes a per-key lock, computes, writes; concurrent misses for the same key wait for the result.
- **Stale-while-revalidate**: serve the (just-)expired value while a background task refreshes.
Both turn an O(N) origin spike back into O(1).

### 6.2 Hot key contention
A single `ConcurrentHashMap` segment may bottleneck on a 100k req/s key. Mitigations: replicate to per-thread L1, use Caffeine's striped buffers, or shard by `hash(key) % N` across N inner caches.

### 6.3 GC pressure during big sweeps
Removing 1M entries in one tick produces a long young-GC pause. Mitigations: **incremental sweep** (process at most K entries per tick), or use Redis-style **probabilistic active expiration** — sample 20 random keys; if more than 25% were expired, sample again; otherwise stop.

### 6.4 Wall-clock skew
NTP corrections can move the clock backward, "un-expiring" entries. Use `System.nanoTime()` for relative deltas if you need to be skew-proof; for cross-process caches, accept a small drift.

### 6.5 When **not** to write your own
For most production needs, use **Caffeine** (Java) — it combines W-TinyLFU admission, async refresh, per-entry TTL, weight-based eviction, and very careful concurrency. The interview value of writing your own is showing you understand the underlying mechanics.

## 7. Sources / Cross-Refs
- 12-Caching.md (cache stampede, eviction policies in depth)
- LLD-09 Concurrency.md (`ConcurrentHashMap`, atomic compute)
- Solution-LRU-Cache.md (the building block)
- Solution-Task-Scheduler.md (timing-wheel design — same data structure)
- Solution-Concurrent-HashMap.md (thread-safe map internals)
- Caffeine source; Redis EXPIRE docs; Kafka TimingWheel
