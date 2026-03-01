# Design a Garbage Collection System

Garbage collection (GC) is the automatic process of reclaiming memory that is no longer in use by a program. It is a fundamental component of language runtimes like Java (JVM), Go, Python, C#, and JavaScript (V8). Designing a GC system tests knowledge of memory management, graph algorithms, concurrency, and systems-level trade-offs.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we designing a GC for a specific language runtime, or a general-purpose GC algorithm?
**Interviewer:** Design a general-purpose GC system suitable for a managed language runtime like Java or Go.

**Candidate:** What are the primary constraints — throughput or latency?
**Interviewer:** We need both high throughput (minimal total GC time) and low pause times (< 10ms).

**Candidate:** Is the heap size fixed or variable?
**Interviewer:** Assume a configurable heap, typically 1–64 GB.

### Functional Requirements

- Automatically identify and reclaim unreachable objects
- Handle cyclic references (A → B → A)
- Support object allocation with minimal overhead
- Provide deterministic finalization (or best-effort)

### Non-Functional Requirements

- **Low pause times** — Stop-the-world pauses < 10ms
- **High throughput** — Application should spend < 5% of time on GC
- **Scalable** — Handle heaps up to 64 GB efficiently
- **Concurrent** — GC should run alongside application threads when possible

---

## Step 2 — High-Level Design

### Memory Layout

```
┌──────────────────────────────────────────────┐
│                  Heap Memory                 │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          Young Generation              │  │
│  │  ┌───────┐  ┌───────┐  ┌───────────┐  │  │
│  │  │ Eden  │  │ S0    │  │ S1        │  │  │
│  │  │ Space │  │(from) │  │(to)       │  │  │
│  │  └───────┘  └───────┘  └───────────┘  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          Old Generation                │  │
│  │                                        │  │
│  │  Long-lived objects that survived      │  │
│  │  multiple young GC cycles              │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

Stack & Globals (GC Roots):
  ┌──────────────────┐
  │ Thread stacks    │ → local variables pointing to heap objects
  │ Static fields    │ → class-level references
  │ JNI references   │ → native code references
  └──────────────────┘
```

### Generational Hypothesis

```
Observation (empirically proven across all languages):
  "Most objects die young."

Allocation pattern:
  ████████████░░░░░░░░░░░░░░░░░░
  ▲ many short-lived objects    ▲ few long-lived objects

Implication:
  Collect young objects frequently (cheap, fast).
  Collect old objects infrequently (expensive, rare).

  This is why we split the heap into Young and Old generations.
```

---

## Step 3 — Design Deep Dive

### 1. Identifying Garbage: Two Approaches

#### Reference Counting

```
Each object has a counter tracking how many references point to it.

  obj.ref_count++ when a new reference points to it.
  obj.ref_count-- when a reference is removed.
  If ref_count == 0 → object is garbage → free immediately.

Example:
  A = new Object()    → A.ref_count = 1
  B = A               → A.ref_count = 2
  B = null             → A.ref_count = 1
  A = null             → A.ref_count = 0 → FREE

The Cycle Problem:
  A.next = B           → B.ref_count = 1
  B.next = A           → A.ref_count = 1
  A = null, B = null   → A.ref_count = 1 (from B.next)
                          B.ref_count = 1 (from A.next)
                          
  Both are unreachable but ref_count > 0 → MEMORY LEAK!

Fix: Cycle detection (Python uses "generational cycle detector"
     that periodically traces reference cycles).

Used by: Python (with cycle detector), Objective-C (ARC), Swift, PHP.
```

#### Tracing (Mark-and-Sweep)

```
Start from GC roots (stack variables, globals).
Trace all reachable objects by following references.
Anything NOT reachable is garbage.

Phase 1 — MARK:
  Start from roots. DFS/BFS through the object graph.
  Mark every reachable object.

  Roots: [A, D]
  
  A → B → C        D → E
  
  Marked: {A, B, C, D, E}
  
  Object F (no incoming references) → NOT marked → garbage

Phase 2 — SWEEP:
  Walk through the entire heap.
  Free every unmarked object.
  Reset marks on surviving objects.

Handles cycles: A → B → A. If neither A nor B is reachable from
roots, neither gets marked → both are freed. Problem solved.

Used by: Java (JVM), Go, C# (.NET), JavaScript (V8).
```

### 2. GC Algorithms

#### Mark-Sweep

```
Mark phase: Trace from roots, mark all live objects.
Sweep phase: Walk heap, free unmarked objects.

Heap before:   [A][B][C][ ][D][ ][E][F]
Marked:         ✓  ✓        ✓     ✓
After sweep:   [A][B][C][ ][D][ ][E][ ]
                          ↑        ↑  ↑ free holes

Problem: Memory fragmentation — free space is scattered.
         Large allocations may fail even with enough total free space.

Time complexity: O(live objects) for mark + O(heap size) for sweep.
```

#### Mark-Compact

```
After marking, COMPACT all live objects to one end of the heap.

Heap before:   [A][ ][B][ ][ ][C][D][ ]
After compact: [A][B][C][D][ ][ ][ ][ ]
                            ↑ free pointer

Allocation: Just bump the free pointer. O(1) allocation!

Pros: No fragmentation, fast allocation (bump pointer).
Cons: Expensive compaction (must update ALL references to moved objects).
```

#### Copying Collector (Semi-Space)

```
Divide heap into two equal halves: FROM-space and TO-space.
Allocate objects in FROM-space.
When FROM-space is full:
  1. Copy all LIVE objects from FROM-space to TO-space.
  2. Swap roles: FROM becomes TO, TO becomes FROM.
  3. Old FROM-space is now entirely free.

FROM-space:  [A][ ][B][ ][C][ ][D][ ]
                    ↓ copy live objects
TO-space:    [A][B][C][D][ ][ ][ ][ ]

Pros: Fast allocation (bump pointer), no fragmentation,
      only touches live objects (efficient if most objects are dead).
Cons: Wastes 50% of heap (only half is usable at any time).
      Expensive if survival rate is high.

This is the basis for Young Generation collection in the JVM.
```

### 3. Generational Collection (Modern JVM)

```
Young Generation Collection (Minor GC):

  New objects allocated in Eden space.
  When Eden is full → Minor GC:
  
  1. Copy live objects from Eden + S0 (from) → S1 (to).
  2. Increment "age" of each surviving object.
  3. Swap S0 and S1 roles.
  4. If age > threshold (e.g., 15) → promote to Old Generation.
  
  Speed: Very fast. Most Eden objects are dead (generational hypothesis).
         Only copies ~5-10% of objects. Typical pause: < 5ms.

  Eden (full):   [A][B][C][D][E][F][G][H]
  Live objects:   A, D, F (only 3 out of 8)
  
  Copy A, D, F → Survivor space.
  Eden is now 100% free. Instant.

Old Generation Collection (Major GC / Full GC):

  When Old Gen fills up → Major GC.
  Uses Mark-Compact or Mark-Sweep-Compact.
  Much more expensive: scans the entire Old Gen.
  Typical pause: 100ms–1s+ (problematic for latency-sensitive apps).
```

### 4. Concurrent & Low-Pause Collectors

#### CMS (Concurrent Mark-Sweep) — Deprecated in JVM

```
Goal: Minimize stop-the-world pauses by doing most work concurrently.

Phase 1: Initial Mark (STW, very short)
  Mark objects directly reachable from roots.

Phase 2: Concurrent Mark (runs alongside application)
  Trace the full object graph. Application threads keep running.

Phase 3: Remark (STW, short)
  Re-scan objects modified during concurrent mark (using write barriers).

Phase 4: Concurrent Sweep (runs alongside application)
  Free unmarked objects.

Problem: No compaction → fragmentation over time.
         "Concurrent mode failure" if Old Gen fills during concurrent GC.
```

#### G1 (Garbage-First) — Default in Modern JVM

```
Divides heap into fixed-size regions (1–32 MB each):

  ┌───┬───┬───┬───┬───┬───┬───┬───┐
  │ E │ E │ S │ O │ O │ O │ H │ E │
  └───┴───┴───┴───┴───┴───┴───┴───┘
  E = Eden, S = Survivor, O = Old, H = Humongous

Key idea: "Garbage-First"
  Track the amount of garbage in each region.
  Collect regions with the MOST garbage first (highest ROI).
  
  Region analysis:
    Region 5: 90% garbage → collect first (most space reclaimed)
    Region 3: 20% garbage → collect last (not worth it yet)

Pause target: User configures max pause time (e.g., 200ms).
  G1 selects enough regions to collect within that budget.

Mixed collections: Can collect Young + selected Old regions together.
```

#### ZGC / Shenandoah (Ultra-Low Pause)

```
Target: < 1ms pause times regardless of heap size (even 16 TB).

How: Almost everything is concurrent.
  - Concurrent marking
  - Concurrent relocation (moving objects while app runs!)
  - Uses colored pointers / load barriers to track object moves

  Application reads object → load barrier checks if object moved →
  if moved, transparently redirects to new location.

Trade-off: Slightly lower throughput (barrier overhead) for
           dramatically lower pause times.
```

### 5. Write Barriers & Remembered Sets

```
Problem: During Young GC, we don't scan Old Gen.
         But what if an Old Gen object points to a Young Gen object?

  Old Gen:  [X] ──reference──→ [Y]  (Young Gen)
  
  If we only scan Young Gen roots, we miss X→Y.
  Y appears unreachable → Y is freed → X now has a dangling pointer!

Solution: Write Barrier + Remembered Set

  Write barrier: Intercepts every reference write.
    When old_obj.field = young_obj:
      Record this cross-generational reference in a "Remembered Set."

  During Young GC:
    Roots = stack roots + Remembered Set entries.
    This way, Y is found via the Remembered Set → not freed.

  Overhead: Write barriers add ~1-5% overhead to all reference writes.
            But this avoids scanning the entire Old Gen during Minor GC.
```

---

## Step 4 — Wrap Up

### Comparison of GC Strategies

| Algorithm          | Pause Time    | Throughput | Fragmentation | Heap Overhead |
|--------------------|---------------|-----------|----------------|--------------|
| Mark-Sweep         | High (STW)    | Good      | Yes            | None         |
| Mark-Compact       | High (STW)    | Moderate  | No             | None         |
| Copying (semi-space)| Medium (STW) | Good      | No             | 50% waste    |
| Generational       | Low (minor)   | Very good | Minimal        | Low          |
| CMS                | Low           | Good      | Yes            | Low          |
| G1                 | Configurable  | Good      | Minimal        | ~10%         |
| ZGC/Shenandoah     | Ultra-low     | Moderate  | No             | ~15%         |

### Key Design Decisions

- **Throughput vs latency:** Mark-Compact maximizes throughput but has long pauses. ZGC minimizes pauses but uses more CPU. Choose based on workload (batch vs interactive).

- **Generational is almost always worth it:** The generational hypothesis holds empirically across all languages and workloads. Young GC is cheap and effective.

- **Concurrent GC requires write barriers:** The cost of write barriers is justified by dramatically lower pause times. Every modern production GC uses them.

### Architecture Summary

1. **Generational heap layout** (Young + Old) exploits the empirical observation that most objects die young, making frequent Young GC very cheap.
2. **Copying collection** for the Young Generation provides zero-fragmentation and O(live) cost — ideal since most young objects are dead.
3. **Mark-Compact or region-based (G1)** for the Old Generation balances throughput with manageable pause times.
4. **Concurrent phases** (mark, sweep, relocate) run alongside application threads to minimize stop-the-world pauses.
5. **Write barriers and remembered sets** enable efficient cross-generational reference tracking without scanning the entire heap.
