# Design an Order Matching Engine (LLD)

> A central limit order book (CLOB) with a price-time priority matching algorithm. The core software at every modern exchange (NYSE, NASDAQ, CME, Coinbase, Binance) and HFT firm.
> Tests data-structure choice under hard latency budgets, state-machine reasoning, and consequences of low-level design decisions on market microstructure.

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Domain Concepts](#2-domain-concepts)
3. [Order Types](#3-order-types)
4. [Matching Algorithm: Price-Time Priority](#4-matching-algorithm-price-time-priority)
5. [Data Structures](#5-data-structures)
6. [Core Operations](#6-core-operations)
7. [Worked Example](#7-worked-example)
8. [Concurrency Model](#8-concurrency-model)
9. [Persistence and Recovery](#9-persistence-and-recovery)
10. [Operational Concerns](#10-operational-concerns)
11. [Common Follow-ups](#11-common-follow-up-questions)
12. [Sources](#12-sources)

---

## 1. Requirements

### Functional
- Accept **limit orders**, **market orders**, and **cancellations**
- Match orders by **price-time priority** (the most popular CLOB algorithm)
- Support partial fills
- Emit a **trade execution stream** and **order book updates**
- Support order modification (typically implemented as cancel + new)

### Non-Functional
- **Sub-microsecond** matching latency at the engine core (HFT-grade implementations claim ~14M orders/sec)
- **Deterministic** — same input sequence → same trades, every time (essential for replay / audit)
- **Single-threaded core** — most production engines avoid locks by design
- **No data loss** — every accepted order survives a crash

### Out of scope (follow-ups)
- Risk checks, margin, settlement, clearing — handled by separate services
- Auction phases (open / close), circuit breakers — covered briefly in §11

---

## 2. Domain Concepts

| Term | Meaning |
|---|---|
| **CLOB** (Central Limit Order Book) | The single in-memory list of all unmatched limit orders for a symbol |
| **Bid** | A buy order — paying *price* for *quantity* |
| **Ask** (or Offer) | A sell order |
| **Top of Book** | Highest bid + lowest ask |
| **Spread** | `best_ask - best_bid` |
| **Mid** | `(best_ask + best_bid) / 2` |
| **Aggressive order** | An incoming order that crosses the spread and trades immediately |
| **Passive order** | An order that rests in the book providing liquidity |
| **Maker** | The trader whose passive order rested in the book; usually receives a rebate |
| **Taker** | The trader whose aggressive order consumed liquidity; usually pays a fee |

> "All other exchange systems can be regarded as peripheral to the matching engine because, without it, there is effectively no market to speak of."

---

## 3. Order Types

| Type | Behavior |
|---|---|
| **Limit** | "Buy up to *qty* at no more than *price*" / "Sell at no less than *price*". If unmatched, rests in the book. |
| **Market** | Execute immediately at any available price. Modeled internally as a limit with `price = +∞` (buy) or `price = 0` (sell). |
| **IOC** (Immediate-or-Cancel) | Match what's possible immediately; cancel the unfilled remainder. |
| **FOK** (Fill-or-Kill) | All-or-nothing: only fills if the entire quantity can be matched at acceptable prices. |
| **Stop** | Triggers a market/limit order when the market crosses a stop price. **Lives outside the CLOB** in a stop-order table; gets injected when triggered. |
| **Cancel** | Removes a resting order; not actually an order, an instruction. |

> "A market order is in fact just a special case of limit orders. The limit prices are set high/low enough so that they will most likely never be reached while filling the order."

---

## 4. Matching Algorithm: Price-Time Priority

Two principles, applied in order:
1. **Price priority** — best price wins. Highest bid for buyers; lowest ask for sellers.
2. **Time priority** — among equal-price orders, the one accepted first by the exchange wins (FIFO at each price level).

### Worked example
```
BID SIDE                ASK SIDE
qty   price       price   qty
24 @ 102.55  | 103.23 @ 48
14 @ 102.55  | 103.98 @ 84
131 @ 102.54 | 104.17 @ 38
32 @ 101.87  | 104.75 @ 127
```

The two bids at `102.55` were placed in that order. If a sell at `102.55` for 30 arrives, **24 is taken from the first bid first** (time priority), then **6 from the second**, leaving 8 resting at `102.55`.

### Why FIFO matters
> "Motivates [traders] to narrow the spread, since by narrowing the spread the limit order is the first in the order queue. Discourages other orders to join the queue since a limit order that joins the queue is the last."

The alternative — **pro-rata** allocation — splits incoming volume proportionally across all orders at a price level. Used by some commodity / rates markets. Rewards size, not patience.

---

## 5. Data Structures

The classic high-performance CLOB design uses **three layers**:

```
                      OrderBook
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
  Bid: TreeMap     Ask: TreeMap         Order index
  (max-ordered)    (min-ordered)        HashMap<order_id, Order>
        │                 │
        ▼                 ▼
  PriceLevel        PriceLevel       (one per occupied price)
        │
        ▼
  doubly-linked list of Orders     (FIFO at this price)
```

### Why these choices?

| Operation | Required complexity | Data structure |
|---|---|---|
| Best bid / best ask | **O(1)** | Cache top-of-book pointers; refresh on each mutation |
| Insert at price level | **O(log P)** where P = distinct prices | Sorted map (red-black tree, skip list, or B+ tree) |
| Append to FIFO queue | **O(1)** | Doubly-linked list (orders are nodes) |
| Cancel by order id | **O(1)** | HashMap<order_id, Order*> + node has prev/next pointers → unlink in O(1) |
| Match consumption | **O(M)** where M = orders consumed | Pop from head of linked list |

### Why a tree, not a hash?
We need **the next-best price** when the top level empties. A hash gives O(1) for known keys but cannot answer "what's the next-highest price below 102.54?" without a full scan.

### Why doubly-linked list, not array/heap?
- We need cancellation in O(1) given a node pointer (heap requires O(log n) sift-down)
- We need FIFO ordering preserved exactly (heap of timestamps is technically O(log n) but adds constant overhead)
- Iteration during a match always proceeds from the head — never needing random access

### Memory layout (HFT-style)
- `Order` is a fixed-size struct (`order_id`, `price` as int64 ticks, `qty`, `side`, `timestamp`, `prev*`, `next*`)
- All orders allocated from a **slab pool** to avoid heap fragmentation and improve cache locality
- Prices stored as **integer ticks** (e.g., `$102.55` → `1025500` if tick = 0.0001) — never floats; floats break determinism

---

## 6. Core Operations

```pseudocode
class OrderBook:
    bids: SortedMap<price, PriceLevel>  // descending
    asks: SortedMap<price, PriceLevel>  // ascending
    orders: HashMap<order_id, Order>

class PriceLevel:
    price: int
    total_qty: int             // cached sum for fast volume queries
    head, tail: Order*         // FIFO queue endpoints

class Order:
    id, account, price, qty, side, timestamp
    prev, next: Order*         // linked-list pointers
    level: PriceLevel*
```

### Add order
```
function add_order(order):
    book = order.side == BUY ? bids : asks
    other = order.side == BUY ? asks : bids
    
    // 1. Match against opposite side
    while order.qty > 0 and !other.empty():
        best = other.first()    // best price level
        if !crosses(order.price, best.price, order.side):
            break
        
        resting = best.head
        trade_qty = min(order.qty, resting.qty)
        emit_trade(taker=order, maker=resting, qty=trade_qty, price=resting.price)
        
        order.qty   -= trade_qty
        resting.qty -= trade_qty
        best.total_qty -= trade_qty
        
        if resting.qty == 0:
            unlink(resting)        // O(1) via linked list
            orders.remove(resting.id)
            if best.empty():
                other.remove(best.price)
    
    // 2. Rest the remainder (limit orders only)
    if order.qty > 0 and order.type == LIMIT:
        level = book.get_or_create(order.price)
        level.append(order)        // O(1) at tail
        level.total_qty += order.qty
        orders.put(order.id, order)
```

### Cancel order
```
function cancel(order_id):
    order = orders.get(order_id)
    if !order: return NotFound
    level = order.level
    unlink(order)                  // O(1)
    level.total_qty -= order.qty
    if level.empty():
        (order.side == BUY ? bids : asks).remove(level.price)
    orders.remove(order_id)
    emit_cancel_ack(order_id)
```

### Helper
```
function crosses(price, best, side):
    return side == BUY  ? price >= best
                        : price <= best
```

---

## 7. Worked Example

Starting book:
```
BID                    ASK
24 @ 102.55  |  103.23 @ 48
14 @ 102.55  |  103.98 @ 84
131 @ 102.54 |  104.17 @ 38
```

**Incoming**: limit sell 40 @ 102.55

1. `crosses(102.55, best_bid=102.55, SELL)` → `102.55 <= 102.55` → true
2. Trade: 24 @ 102.55 (consumes first bid entirely; FIFO)
3. Remaining sell qty = 16
4. Trade: 14 @ 102.55 (consumes second bid entirely)
5. Remaining sell qty = 2
6. Best bid now `102.54`. `crosses(102.55, 102.54, SELL)` → `102.55 <= 102.54` → **false**
7. Rest the remaining 2 @ 102.55 on the ASK side

**Resulting book**:
```
BID                    ASK
131 @ 102.54 |  102.55 @ 2
32 @ 101.87  |  103.23 @ 48
              |  103.98 @ 84
```

Two trades emitted; spread tightened to `0.01`.

---

## 8. Concurrency Model

The classic answer: **single-threaded matcher, multi-threaded I/O**.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Gateway 1   │    │  Gateway 2   │    │  Gateway N   │
│ (parse FIX/  │    │              │    │              │
│  WebSocket)  │    │              │    │              │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────┬───┴───────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   Sequencer (single thread)  │  → assigns global seq number
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │   Matcher (single thread)    │  → mutates the book
        └──────┬───────────────────────┘
               │ trade & book-update events
               ▼
        ┌──────────────────────────────┐
        │   Market Data Publisher      │  → multicast UDP
        └──────────────────────────────┘
```

### Why single-threaded?
1. **Determinism** — same input order → same trades. Locks introduce non-determinism via thread scheduling.
2. **No lock overhead** — a spinlock at every order touch would dominate latency.
3. **Modern CPUs** match millions of orders/sec on a single core when the data fits in L1/L2 cache.

> "Due to the low latency demands placed on these systems, they must run exclusively in RAM, which means that all record keeping of matching engine interactions must take place in peripheral systems outside of the matching engine itself."

### Sharding
Across symbols, the engine shards naturally — each symbol gets its own matcher thread (or process / machine). Within a single symbol, do not split.

---

## 9. Persistence and Recovery

The matcher is in RAM. How do we survive a crash?

### Journaling pattern
```
incoming order → sequencer → append to journal → fsync → matcher → trades → publisher
```

Every accepted order is appended to a write-ahead log **before** the matcher sees it. On crash:
1. Bring up a fresh matcher
2. Replay the journal from the last snapshot
3. Resume accepting new orders at `last_seq + 1`

### Snapshots
Every N seconds (or every K orders), snapshot the entire book to disk. On recovery, load the snapshot then replay only the journal entries after that snapshot.

### Hot-standby
Two matchers consume the same sequenced stream. Active publishes trades; standby silently maintains an identical book. On failover, the standby is byte-for-byte identical because the input was deterministic.

This **state-machine replication** pattern is the standard for exchange engines (CME's Globex, NYSE's Pillar, IEX's MOM all follow variants of it).

---

## 10. Operational Concerns

### Throughput tuning
- **Avoid GC** — implement in C++/Rust, or in Java with off-heap memory and pre-allocated object pools
- **Pin threads** to specific CPU cores (`taskset`); disable hyperthreading on the matcher core
- **Kernel-bypass networking** for the gateway (DPDK, Solarflare)
- **Coalesce updates** to the market-data feed — one update per match cycle, not per book mutation

### Throttling and risk
- **Per-account order rate limits** — enforced at the gateway, before sequencing
- **Max position checks** — typically a separate risk gateway in front of the matcher
- **Self-trade prevention** — reject orders that would match an order from the same account

### Audit and replay
- The journal **is** the audit log. Regulators (FINRA, MiFID II) require trade reconstruction — having a deterministic replay solves this for free.

### Observability
- **Latency histograms**: gateway → sequencer, sequencer → matcher, matcher → publisher
- **Book depth** — number of orders, distinct price levels, top-N volumes
- **Trade rate**, **cancel-to-trade ratio** (regulators flag high ratios as potential spoofing)
- **Reject rate by reason** (rate-limited, risk-blocked, malformed)

---

## 11. Common Follow-up Questions

**Q: How would you handle a market open / close auction?**
- Switch to **batch state**: collect orders for a window without matching. At the cutoff, run a single-price auction — find the price that maximizes traded volume, allocate fills by time priority within that price.

**Q: How do circuit breakers work?**
- A separate **monitor service** consumes the trade stream, computes price moves, and if a threshold is crossed (e.g., ±7% in 5 minutes), it sends a HALT control message to the matcher. The matcher stops accepting orders for the symbol but still allows cancels.

**Q: How would you support iceberg orders?**
- Order has `display_qty` and `total_qty`. Only `display_qty` is visible at the price level. When that slice fully fills, the matcher silently re-injects another `display_qty` slice **with a fresh timestamp** (loses time priority — this is the protocol design choice).

**Q: How do you prevent a slow consumer of market data from blocking the matcher?**
- The publisher is a separate thread/process. The matcher writes trades to a **lock-free SPSC ring buffer**; the publisher drains it. If the publisher falls behind, the ring overflows and that consumer is dropped — the matcher is never throttled.

**Q: Pro-rata vs price-time?**
- Price-time rewards being early; pro-rata rewards being big. Equity exchanges almost universally use price-time. Some commodities (e.g., short-term interest rate futures at CME) use pro-rata to encourage large quotes from market-makers in thin books.

**Q: How to scale beyond a single matcher's capacity?**
- **Shard by symbol** — each matcher owns a subset. Cross-symbol orders (rare) go to a coordinator. NYSE and NASDAQ both use this approach with thousands of symbols spread across many matcher servers.

**Q: How would you compare with a continuous-double-auction crypto exchange?**
- Same data structures. Differences: 24/7 trading (no open/close auction), much wider tick sizes, smaller order sizes per trade, generally higher maker-taker fee asymmetry, often a single global book per pair (no fragmentation across venues like equities).

**Q: Why integer ticks instead of floats?**
- Floats are non-associative (`(a + b) + c ≠ a + (b + c)` in general) and depend on the FPU. Integer ticks give bit-exact arithmetic, perfect determinism for replay, and correct rounding by definition.

---

## 12. Sources

- **Wikipedia — Order matching system** — overview, FIFO vs pro-rata trade-offs, "penny jumping" attack on pro-rata
- **Devexperts — "Order Matching Engine: Everything You Need to Know"** — CLOB definition, the in-RAM constraint, peripheral-systems statement
- **Jelle Pelgrims — "Matching engines"** — worked CLOB example used in §4
- **GitHub: jxm35/LimitOrderBook-MatchingEngine** — the ~14M orders/sec benchmark cited in §1
- **Amitava Biswas, Medium** — exchange architecture (Trading / Market Info / Clearing breakdown)
- **CME Globex / NYSE Pillar / IEX MOM** — public architecture talks corroborate the single-threaded + journaling + hot-standby pattern in §8–§9
