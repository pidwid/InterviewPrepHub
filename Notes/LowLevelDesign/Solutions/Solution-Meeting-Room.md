# 🛠️ Design Meeting Room / Calendar Scheduler (LLD)

A Meeting Room scheduler is a top-5 FAANG LLD problem. It tests interval handling, conflict detection, resource allocation, and (the inevitable follow-up) thread-safety under concurrent booking attempts.

---

## 1. Requirements

### Functional Requirements
- **Book** a meeting room for a given `[startTime, endTime)` interval.
- **Cancel** an existing booking.
- **Find** an available room for a requested time window.
- Support N rooms with different attributes (capacity, AV equipment, building/floor).
- Handle **recurring meetings** (daily, weekly, custom RRULE).
- Send notifications to attendees (out-of-scope for class design but injectable).

### Non-Functional Requirements
- **Concurrency-safe:** two clients must not double-book the same room.
- **Performance:** O(log N) booking & search using interval trees / sorted sets.
- **Extensibility:** new room types, new conflict policies (e.g., "back-to-back is OK with 5-min buffer").

---

## 2. Clarifying Questions to Ask

| Question | Why it matters |
|----------|----------------|
| Single building or multi-tenant? | Affects partitioning of rooms |
| Time zone handling? | Always store UTC; render in local TZ |
| Overlapping booking allowed? | Defines conflict policy |
| Hard vs soft cancellation? | Affects history/audit storage |
| Auto-find best room or user-picks? | Changes search algorithm |

---

## 3. Class Design

```
┌────────────────────────┐         ┌────────────────────────┐
│  MeetingScheduler      │◇──────▶│  Room                   │
│ (Facade / Singleton)   │   1..* │  - id, name, capacity   │
└──────────┬─────────────┘         │  - features: Set<F>     │
           │                       │  - calendar: Calendar   │
           │                       └────────────────────────┘
           │                                   │ 1
           ▼                                   ▼
┌────────────────────────┐         ┌────────────────────────┐
│  ConflictDetector      │         │  Calendar (per Room)   │
│  (Strategy)            │         │  - bookings: TreeSet    │
└────────────────────────┘         │    <Booking>            │
                                   └──────────┬─────────────┘
                                              │ *
                                              ▼
                                   ┌────────────────────────┐
                                   │  Booking                │
                                   │  - id, organizer        │
                                   │  - interval [s, e)      │
                                   │  - attendees, status    │
                                   │  - recurrenceRule       │
                                   └────────────────────────┘
```

### Key Classes (Java-style pseudocode)

```java
class Interval implements Comparable<Interval> {
    Instant start;
    Instant end;            // exclusive
    boolean overlaps(Interval o) {
        return start.isBefore(o.end) && o.start.isBefore(end);
    }
}

enum BookingStatus { CONFIRMED, CANCELLED, TENTATIVE }

class Booking {
    String id;
    String organizerId;
    Interval interval;
    Set<String> attendees;
    BookingStatus status;
    RecurrenceRule rRule;     // null for one-off
}

class Room {
    String id;
    int capacity;
    Set<RoomFeature> features;     // PROJECTOR, WHITEBOARD, VC
    Calendar calendar;
}

class Calendar {
    // TreeSet ordered by start; supports floor/ceiling for O(log n) overlap check
    private final NavigableSet<Booking> bookings =
        new TreeSet<>(Comparator.comparing(b -> b.interval.start));
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    boolean tryBook(Booking b) { ... }
    void cancel(String bookingId) { ... }
    List<Interval> freeSlots(Interval window) { ... }
}
```

---

## 4. Core Algorithm — Conflict-Free Booking

```java
boolean tryBook(Booking b) {
    lock.writeLock().lock();
    try {
        Booking floor = bookings.floor(b);          // last booking starting <= b.start
        if (floor != null && floor.interval.overlaps(b.interval)) return false;

        Booking ceil = bookings.ceiling(b);         // first booking starting >= b.start
        if (ceil != null && b.interval.overlaps(ceil.interval)) return false;

        bookings.add(b);
        return true;
    } finally {
        lock.writeLock().unlock();
    }
}
```

This is **O(log N)** per booking and atomic — the lock makes the read-then-write a single critical section.

---

## 5. Finding the Best Room (Multi-Room Search)

```java
Optional<Room> findRoom(Interval window, int minCapacity, Set<RoomFeature> required) {
    return rooms.stream()
        .filter(r -> r.capacity >= minCapacity)
        .filter(r -> r.features.containsAll(required))
        .filter(r -> r.calendar.isFree(window))
        .min(Comparator.comparingInt(r -> r.capacity)); // smallest room that fits
}
```

For high scale (10k rooms), index rooms by `(capacity bucket, features bitmap)` and use an **interval tree** per room cluster instead of linear scan.

---

## 6. Recurring Meetings

Two strategies:

| Strategy | Pros | Cons |
|----------|------|------|
| **Materialize** all instances at booking time | Simple read path | Storage explosion (yearly daily = 365 rows) |
| **Lazy expand** RRULE on read (Google Calendar style) | Compact storage | More complex conflict checks |

Lazy expansion is usually preferred. On a query for `[s,e)`, expand any RRULE intersecting the window using a library like `rrule.js` or `lib-recur`.

**Edge case:** "exception instances" (skip a single occurrence, override one occurrence) need an `EXDATE`/`overrideMap` per recurring booking.

---

## 7. Concurrency — The "Make It Thread-Safe" Follow-Up

Three levels of correctness:

1. **Coarse lock** on the whole scheduler — correct but kills throughput.
2. **Per-room ReentrantReadWriteLock** — recommended; reads (free-slot lookup) parallel, writes serialized per room.
3. **Optimistic concurrency** at the storage layer — version stamp on booking row; retry on conflict. Best for distributed deployments.

```java
@Transactional
public boolean book(String roomId, Booking b) {
    Room r = roomRepo.findByIdForUpdate(roomId);   // SELECT ... FOR UPDATE
    if (r.calendar.hasOverlap(b.interval)) return false;
    bookingRepo.save(b);
    return true;
}
```

The DB row lock guarantees that two pods can't both insert overlapping rows.

---

## 8. Design Patterns Demonstrated

| Pattern | Where |
|---------|-------|
| **Strategy** | `ConflictDetector` (strict / with-buffer / soft-overlap) |
| **Singleton / Facade** | `MeetingScheduler` |
| **Observer** | Notify attendees on book/cancel |
| **Command** | `BookCommand`, `CancelCommand` enable undo + audit log |
| **Composite** | Group rooms by Floor / Building |

---

## 9. Common Pitfalls

- Forgetting `[start, end)` is **half-open** → back-to-back meetings get falsely rejected.
- Using `start <= now` checks across time zones — always convert to UTC.
- Allowing the LRU/recurring expansion to materialize unbounded ranges (memory blowup).
- Single global lock — kills concurrency in large orgs.

---

## 10. Senior Interview Talking Points

- Trade-off: in-memory `TreeSet` vs DB row locks — pick based on durability requirements.
- How would you scale this to 1M rooms? → shard by `roomId`, partition by building, async indexer.
- How would you support "Find the next 30-minute slot when these 5 people are all free"? → intersect their interval trees (sweep-line algorithm).
- How would you handle clock skew between client and server? → server is source of truth; reject booking if `client.now() - server.now() > 30s`.

---

## Sources / Cross-Refs
- LeetCode #253 — *Meeting Rooms II* (interval-scheduling foundation): https://leetcode.com/problems/meeting-rooms-ii/
- *Introduction to Algorithms* (Cormen et al., 4e) — Ch. 14 (Augmented data structures: interval trees).
- Java API docs — `TreeMap.floorEntry / ceilingEntry`: https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/TreeMap.html
- LLD-08 Behavioral Patterns (Strategy for room-suggestion algorithm).
- Solution-Calendar.md, Solution-Hotel-Management.md (sister date-range allocation problems).
