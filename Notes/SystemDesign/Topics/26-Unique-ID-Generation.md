# Unique ID Generation

## Table of Contents

1. [Overview](#1-overview)
2. [UUID (Universally Unique Identifier)](#2-uuid-universally-unique-identifier)
3. [Auto-Incrementing IDs](#3-auto-incrementing-ids)
4. [Twitter Snowflake](#4-twitter-snowflake)
5. [ULID (Universally Unique Lexicographically Sortable Identifier)](#5-ulid-universally-unique-lexicographically-sortable-identifier)
6. [Database Ticket Servers](#6-database-ticket-servers)
7. [MongoDB ObjectID](#7-mongodb-objectid)
8. [Comparison & Trade-offs](#8-comparison--trade-offs)
9. [Choosing the Right Strategy](#9-choosing-the-right-strategy)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Almost every distributed system needs unique identifiers — for users, orders,
messages, events, URLs, and more. In a single-server world, an auto-incrementing
database integer works fine. In a distributed world, it doesn't.

```
Single Server:                    Distributed (problem):
┌──────────┐                      ┌──────────┐
│  Server  │ ID: 1, 2, 3, ...    │ Server A │ ID: 1, 2, 3...
│          │                      ├──────────┤
│ One DB   │                      │ Server B │ ID: 1, 2, 3...  ← COLLISION!
└──────────┘                      └──────────┘
```

### Requirements for a good distributed ID:

| Requirement     | Description                                       |
|-----------------|---------------------------------------------------|
| Globally unique | No collisions across all nodes, ever              |
| Sortable        | IDs that are roughly time-ordered (nice to have)  |
| High throughput | Generate thousands/millions per second per node   |
| Low latency     | No remote coordination needed (ideally)           |
| Compact         | Smaller = less storage, faster indexing            |
| No SPOF         | No single point of failure in generation           |

---

## 2. <abbr title="UUID (Universally Unique Identifier): a 128-bit identifier with extremely low collision probability.">UUID (Universally Unique Identifier)</abbr>

128-bit identifier, typically represented as 36 hex characters.

```
Format: 550e8400-e29b-41d4-a716-446655440000
        ┌────────┬────┬────┬────┬────────────┐
        │time-low│mid │hi+ │var │   node     │
        │        │    │ver │    │            │
        └────────┴────┴────┴────┴────────────┘
        
UUID v4 (random):
  550e8400-e29b-41d4-a716-446655440000
  ^^^^^^^^                               random bits
  
UUID v7 (time-ordered, newer standard):
  018e4c6a-1c3a-7b2d-8f1a-3c5e7d9f1b3e
  ^^^^^^^^                               Unix timestamp (ms)
```

### UUID Versions

| Version | Based On         | Sortable | Collision Risk | Use Case              |
|---------|------------------|----------|----------------|-----------------------|
| v1      | Timestamp + MAC  | Partial  | Very low       | Legacy systems        |
| v4      | Random           | No       | ~negligible    | General purpose       |
| v6      | Timestamp (v1 reordered) | Yes | Very low    | Newer alternative     |
| v7      | Unix timestamp + random  | Yes | Very low    | Recommended for new systems |

### Pros and Cons

**Pros**: No coordination needed, generate anywhere, no SPOF, standard format.
**Cons**: 128 bits (large), poor index locality for random v4, not human-readable.

---

## 3. Auto-Incrementing IDs

The simplest approach: use the database's auto-increment feature.

```
Server A ──┐                   ┌──────────────┐
           ├──── INSERT ──────►│  Database     │ → ID: 1001
Server B ──┘                   │  (single)     │ → ID: 1002
                               └──────────────┘
                                    ▲ SPOF!
```

### Multi-Master Auto-Increment

To avoid SPOF, split the ID space across multiple DB instances:

```
DB 1: 1, 3, 5, 7, 9, ...   (increment by 2, start at 1)
DB 2: 2, 4, 6, 8, 10, ...  (increment by 2, start at 2)

With N servers:
  Server k generates: k, k+N, k+2N, k+3N, ...
```

**Pros**: Simple, IDs are compact integers, naturally sortable.
**Cons**: Single point of failure (single DB), coordination needed (multi-master),
hard to add/remove servers, sequential IDs leak business info (order volume, etc.).

---

## 4. <abbr title="Twitter Snowflake: 64-bit, time-ordered ID format with timestamp + machine ID + sequence.">Twitter Snowflake</abbr>

64-bit ID scheme designed by Twitter for generating unique IDs at scale.

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
├─┼─────────────────────────────────────────┼─────────┼───────────┤
│0│         41-bit timestamp (ms)            │ 10-bit  │  12-bit   │
│ │    (milliseconds since custom epoch)     │ machine │ sequence  │
│ │                                          │   ID    │  number   │
└─┴──────────────────────────────────────────┴─────────┴───────────┘
 1                    41                        10          12

Total: 1 + 41 + 10 + 12 = 64 bits
```

### Capacity

| Component    | Bits | Max Value | Meaning                           |
|-------------|------|-----------|-----------------------------------|
| Sign bit    | 1    | 0         | Always 0 (positive)               |
| Timestamp   | 41   | ~69 years | Milliseconds since custom epoch   |
| Machine ID  | 10   | 1,024     | Datacenter (5) + Worker (5)       |
| Sequence    | 12   | 4,096     | IDs per millisecond per machine   |

**Max throughput per machine**: 4,096 IDs/millisecond = ~4M IDs/sec
**Max total throughput**: 1,024 × 4,096 = ~4B IDs/sec

### How It Works

```python
class Snowflake:
    EPOCH = 1288834974657  # Custom epoch (Twitter: Nov 4, 2010)
    
    def __init__(self, machine_id):
        self.machine_id = machine_id
        self.sequence = 0
        self.last_timestamp = -1
    
    def generate(self):
        timestamp = current_time_ms() - self.EPOCH
        
        if timestamp == self.last_timestamp:
            self.sequence = (self.sequence + 1) & 0xFFF  # 12 bits
            if self.sequence == 0:
                timestamp = wait_next_ms(self.last_timestamp)
        else:
            self.sequence = 0
        
        self.last_timestamp = timestamp
        
        return (timestamp << 22) | (self.machine_id << 12) | self.sequence
```

### Extracting Time from a Snowflake ID

```
ID = 1541815603606036480

timestamp = (ID >> 22) + EPOCH
          = 1541815603606036480 >> 22 + 1288834974657
          → Nov 15, 2022, 12:00:00 UTC
```

**Pros**: 64-bit (fits in a long), time-sortable, no coordination, extremely high throughput.
**Cons**: Clock skew can cause duplicates, machine ID assignment needs coordination,
time component leaks approximate creation time.

### <abbr title="Clock skew: different machines have slightly different system times, which can break time-ordered ID generation.">Clock Skew Mitigation</abbr>

```
NTP adjusts clock backward:
  Last ID timestamp: 1000
  Current time:       999   ← Clock went backward!
  
Solutions:
  1. Wait until time catches up
  2. Use logical clock component
  3. Refuse to generate (throw error)
```

---

## 5. <abbr title="ULID: Universally Unique Lexicographically Sortable Identifier. 128-bit, time-sortable, base32 string.">ULID (Universally Unique Lexicographically Sortable Identifier)</abbr>

128-bit identifier that is sortable and more readable than UUID.

```
  01ARZ3NDEKTSV4RRFFQ69G5FAV
  ┌──────────┬─────────────────┐
  │ 48-bit   │    80-bit       │
  │ timestamp│    randomness   │
  │ (ms)     │                 │
  └──────────┴─────────────────┘
  
  Encoded in Crockford's Base32 (26 characters)
  Lexicographically sortable!
```

### ULID vs UUID v4 vs Snowflake

| Feature          | UUID v4      | ULID         | Snowflake    |
|-----------------|-------------|-------------|-------------|
| Size            | 128 bits    | 128 bits    | 64 bits     |
| Sortable        | No          | Yes         | Yes         |
| String length   | 36 chars    | 26 chars    | 19 digits   |
| Coordination    | None        | None        | Machine ID  |
| Throughput/node | Unlimited   | Unlimited   | 4M/sec      |
| Standard        | RFC 4122    | Spec exists | Custom      |

**Pros**: Sortable, compact string, no coordination, drop-in UUID replacement.
**Cons**: 128-bit (larger than Snowflake), monotonicity only within same ms.

---

## 6. Database Ticket Servers

Centralized ID generation service using a database (Flickr's approach).

```
┌──────────┐     ┌─────────────────┐
│ Server A │────►│ Ticket Server 1 │── REPLACE INTO → ID: 1, 3, 5, 7...
│ Server B │────►│  (odd IDs)      │
└──────────┘     └─────────────────┘
                 ┌─────────────────┐
┌──────────┐────►│ Ticket Server 2 │── REPLACE INTO → ID: 2, 4, 6, 8...
│ Server C │────►│  (even IDs)     │
└──────────┘     └─────────────────┘
```

### Flickr's Implementation

```sql
-- Ticket server uses REPLACE INTO to get next ID
CREATE TABLE Tickets64 (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stub CHAR(1) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY stub (stub)
) ENGINE=InnoDB;

REPLACE INTO Tickets64 (stub) VALUES ('a');
SELECT LAST_INSERT_ID();
```

**Pros**: Simple, numeric IDs, sortable, easy to understand.
**Cons**: SPOF (need multiple ticket servers), network round-trip for every ID,
limited throughput.

---

## 7. MongoDB ObjectID

96-bit (12-byte) identifier used by MongoDB.

```
 ┌────────────┬──────────┬───────────┬──────────┐
 │ 4 bytes    │ 5 bytes  │ 3 bytes   │          │
 │ timestamp  │ random   │ counter   │          │
 │ (seconds)  │ value    │ (inc)     │          │
 └────────────┴──────────┴───────────┴──────────┘
 
 Example: 507f1f77bcf86cd799439011
```

**Pros**: Built into MongoDB, time-sortable, no coordination.
**Cons**: 96-bit (non-standard size), tied to MongoDB ecosystem.

---

## 8. Comparison & Trade-offs

| Strategy       | Size    | Sortable | Coordination | Throughput  | SPOF  |
|---------------|---------|----------|-------------|-------------|-------|
| UUID v4       | 128-bit | No       | None         | Unlimited   | None  |
| UUID v7       | 128-bit | Yes      | None         | Unlimited   | None  |
| Snowflake     | 64-bit  | Yes      | Machine ID   | 4M/node/sec | None  |
| ULID          | 128-bit | Yes      | None         | Unlimited   | None  |
| Auto-Inc (DB) | 32/64   | Yes      | Full         | Limited     | Yes   |
| Ticket Server | 64-bit  | Yes      | Per-request  | Medium      | Partial|
| MongoDB OID   | 96-bit  | Yes      | None         | High        | None  |

---

## 9. Choosing the Right Strategy

```
Need a simple, universal ID?
  └── UUID v4 (no sorting needed) or UUID v7 (sorting needed)

Need compact 64-bit IDs at massive scale?
  └── Snowflake

Need sortable IDs without any coordination?
  └── ULID or UUID v7

Using MongoDB already?
  └── ObjectID

Need sequential, gap-free IDs?
  └── Database auto-increment (accept the trade-offs)

Need IDs for a URL shortener?
  └── Base62-encoded Snowflake or counter
```

### Real-World Usage

| Company   | Strategy         | Use Case                    |
|-----------|------------------|-----------------------------|
| Twitter   | Snowflake        | Tweet IDs                   |
| Discord   | Snowflake variant| Message IDs                 |
| Instagram | Modified Snowflake| Photo IDs                  |
| MongoDB   | ObjectID         | Document IDs                |
| Stripe    | Prefixed random  | `ch_1234abc` (charge IDs)   |
| Shopify   | UUID v4          | Various entity IDs          |
| Segment   | KSUID            | Event IDs (similar to ULID) |

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| No one-size-fits-all | Choose based on your requirements (size, sortability, coordination) |
| Snowflake is the go-to for high-scale | 64-bit, sortable, high throughput. Used by Twitter, Discord, Instagram |
| UUID v7 is the modern default | If you need a drop-in UUID, prefer v7 over v4 for sortability |
| Coordination = bottleneck | Prefer schemes that generate locally (Snowflake, UUID, ULID) |
| Clock skew matters | Any time-based scheme must handle NTP adjustments |
| ID design affects DB perf | Random UUIDs fragment B-tree indexes; sortable IDs improve write throughput |
| Smaller is better for hot paths | 64-bit Snowflake vs 128-bit UUID matters at billions of rows |
