# Design a Stock Exchange / Trading System

A stock trading platform (like Robinhood, E-Trade, or the core Nasdaq matching engine) involves accepting buy and sell orders from users and matching them up to execute trades.

*Note: This design focuses on a modernized, retail-brokerage/exchange hybrid, not necessarily the exact single C++ monolith utilized by the NYSE, but the distributed systems approach typical of technical interviews.*

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions
**Candidate:** Are we designing the retail broker (where users have accounts and send orders) or the core Matching Engine (which actually pairs buyers and sellers)? 
**Interviewer:** Focus heavily on the core Matching Engine and the order flow, but acknowledge the gateway where clients connect.

**Candidate:** What types of orders are supported?
**Interviewer:** Keep it simple: Limit Orders and Market Orders.

**Candidate:** What is the scale?
**Interviewer:** 100,000 orders per second during market open/close. 

### Functional Requirements
- Users can place a Buy or Sell order (Market or Limit).
- The system must match a Buy order with a corresponding Sell order based on price and time.
- Users can view the current "Order Book" (Level 2 data).
- Users can view their filled/executed trades.

### Non-Functional Requirements
- **Extreme High Availability & Fault Tolerance:** If the system drops an order or goes down, millions of dollars are lost, resulting in SEC fines.
- **Ultra-Low Latency:** Orders must be acknowledged and matched in microseconds.
- **Strict Determinism and Fairness (FIFO):** If User A places an order one microsecond before User B, User A must absolutely get matched first.

---

## Step 2 — High-Level Design

### Core Concept: The Order Book & Matching Engine
Every stock (AAPL, TSLA) has its own independent **Order Book**. An Order Book consists of two lists:
- **Bids (Buyers):** Sorted Highest price first, then by earliest time.
- **Asks (Sellers):** Sorted Lowest price first, then by earliest time.

When a new order arrives, the **Matching Engine** checks if the top of the Bid list $\ge$ the top of the Ask list. If they cross, a trade is executed.

### System Architecture

```mermaid
graph TD
    Client[Trader Client] -->|Submit Order| API_GW[Order Gateway]
    
    API_GW --> Validator[Risk & Validation Service]
    Validator --> Sequencer[[Order Sequencer / Message Bus (Kafka/Aeron)]]
    
    Sequencer --> ME_AAPL[Matching Engine Node - AAPL]
    Sequencer --> ME_TSLA[Matching Engine Node - TSLA]
    
    ME_AAPL -->|Trade Event| ResultsB[[Trade Results Bus]]
    
    ResultsB --> Execution[Execution / Clearing Service]
    Execution --> DB[(Trade Ledger DB)]
    
    ResultsB --> MktData[Market Data Broadcaster]
    MktData -->|WebSockets| Client
```

---

## Step 3 — Design Deep Dive

### 1. Order Sequencing (The Fix for Fairness)

If User A from New York and User B from London send an order at the identical moment, who gets to the Matching Engine first? 
In distributed systems, clocks are inherently out of sync by milliseconds (NTP drift). We cannot rely on the timestamp attached by the client's phone.

**The Sequencer:** All incoming validated orders must pass through a single, highly available sequencer (often a very fast message queue like Redpanda / Aeron, or a heavily optimized Kafka setup).
- The Sequencer's only job is to receive network packets and stamp them with a monotonically increasing sequence ID (1, 2, 3, 4).
- Once stamped, the order of the universe is locked. The Matching Engine processes them strictly according to this Sequence ID. This guarantees absolute fairness and determinism.

### 2. The Matching Engine (The Core Algorithm)

Database row-locking is **not** an option here. Executing a SQL `UPDATE` or `BEGIN TRANSACTION` takes ~2 milliseconds (2,000 microseconds). For a trading engine, that is criminally slow.
The Matching Engine must be an **In-Memory State Machine**.

**Architecture of the Engine Node:**
- It is a single-threaded process (often written in C++ or Rust) pinned to a dedicated CPU core. (Using one thread eliminates all Mutex/Locking overhead).
- **Data Structure:** The Order Book is usually maintained as a Red-Black Tree or a highly optimized array/hashmap combination (often called a Price-Tier structure). 
  - Hash Map: `Price -> Pointer to a Linked List of Orders`.
  - This allows O(1) appending of a new order to the end of a price tier, and O(1) removal from the front of the tier when a match occurs.
- **Partitioning:** AAPL's order book is entirely independent of TSLA's order book. Therefore, we horizontally partition. `Node 1` strictly handles A-E tickers. `Node 2` handles F-M tickers.

**The Match:**
If an incoming Buy order matches an existing Sell order:
1. The engine deducts the quantity from both.
2. It generates a "Trade Fill" event.
3. It pushes the Trade Fill event to an outbound Message Bus.
4. (The engine *never* touches a disk. It just fires events out into the void and goes to the next order in nanoseconds).

### 3. Fault Tolerance (What if the Engine crashes?)

If the Matching Engine is entirely in RAM and never writes to an SSD, what happens if the server loses power? All open orders are gone.

We use **Event Sourcing** and **State Machine Replication**.
- Because the input from the Sequencer is totally ordered and deterministic, any Matching Engine given the exact same sequence of order events will build the exact same Order Book in RAM.
- We run a Primary Engine and a Backup Engine for the AAPL partition on two different servers.
- Both consume the exact same sequence of orders from the Sequencer.
- Only the Primary sends trades to the outbound bus. The Backup just silently updates its RAM.
- If the Primary dies, the Backup instantly takes over sending outbound messages. No data is lost, no disk reads are required to recover state.

### 4. Clearing, Settlement, and Market Data

The actual deduction of money from User A and the transfer of shares to User B does not happen in the Matching Engine.

- The `Trade Fill` event lands on the outbound message bus.
- The `Execution Service` consumes it. This service utilizes traditional ACID SQL databases. It updates User A's cash balance (Debit $150) and User B's portfolio (Credit 1 AAPL share). Since the match is already guaranteed, this can happen asynchronously over the next few milliseconds/seconds without holding up the market.
- Meanwhile, the `Market Data Broadcaster` consumes the exact same `Trade Fill` event and pushes an update over WebSockets so all web-clients see the AAPL ticker flash green with the new price.

---

## Step 4 — Wrap Up

### Edge Cases
- **Handling Surges (Market Open):** At 9:30 AM, traffic spikes 100x. The Sequencer queue acts as a massive shock absorber. The Matching Engine might lag behind the queue by 50 milliseconds, processing at max CPU, but it won't crash.
- **Network UDP vs TCP:** Standard financial exchanges often prefer UDP Multicast instead of TCP for transmitting market data (tickers) to hedge funds and brokers. TCP requires handshakes and packet acknowledgments, which slows down the stream. UDP fires the packets out—if a client drops a packet, it's their problem to catch the next heartbeat.

### Architecture Summary
1. The system abandons traditional ACID databases for the actual trading logic due to latency constraints.
2. Inbound orders are serialized by a high-speed **Sequencer** to establish an immutable, universally agreed-upon chronological order.
3. The core **Matching Engine** relies on single-threaded, highly optimized in-memory data structures (Price/Time priority queues) partitioned horizontally by stock symbol.
4. State persistence is achieved through **Event Sourcing**; rather than saving the Order Book to disk, the incoming sequence of events is saved logically, allowing secondary replica engines to maintain identical hot-standby state in their RAM.
5. All downstream ledgers (money movement) act asynchronously, consuming the output events of the Matching engine.