# Design a Chat System (WhatsApp/Messenger)

A chat system enables real-time messaging between users. It supports 1-on-1 chats and group chats, handles message delivery across online and offline users, and shows presence indicators. Systems like WhatsApp serve 2+ billion users with 100 billion messages per day.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Is this a 1-on-1 chat, group chat, or both?
**Interviewer:** Both, but start with 1-on-1.

**Candidate:** Is this a mobile app, web app, or both?
**Interviewer:** Both.

**Candidate:** What is the scale? How many DAUs?
**Interviewer:** 50 million daily active users.

**Candidate:** What is the max group size?
**Interviewer:** 100 members.

**Candidate:** Do we need to support media (images, videos)?
**Interviewer:** Text only for now, but design for extensibility.

**Candidate:** Is there a message size limit?
**Interviewer:** Text messages up to 10,000 characters.

**Candidate:** Do we need end-to-end encryption?
**Interviewer:** Not required for this design, but mention it.

**Candidate:** How long should we store chat history?
**Interviewer:** Forever.

### Functional Requirements

- 1-on-1 messaging with low delivery latency
- Group chat (up to 100 members)
- Online/offline presence indicators
- Message persistence (chat history)
- Sent/delivered/read receipts
- Push notifications for offline users
- Multi-device support

### Non-Functional Requirements

- Real-time message delivery (<100ms for online users)
- High availability
- Consistency: messages must not be lost or duplicated
- Minimal battery and data usage (mobile)

### Back-of-the-Envelope Estimation

- 50M DAU, each sends 40 messages/day → 2 billion messages/day
- QPS: 2B / 86400 ≈ 23,000 messages/sec
- Average message size: 100 bytes
- Daily storage: 2B × 100 bytes = ~200 GB/day
- 5-year storage: ~365 TB
- Peak QPS: ~46,000 messages/sec (2× average)

---

## Step 2 — High-Level Design

### Communication Protocol

HTTP is request-response and **not ideal** for real-time messaging. Options:

| Protocol | How It Works | Best For |
|----------|-------------|----------|
| **HTTP Polling** | Client asks server repeatedly | Simple but wasteful |
| **Long Polling** | Server holds connection until new data | Better but still has timeouts |
| **WebSocket** | Full-duplex persistent connection | Best for real-time chat ✅ |
| **Server-Sent Events** | Server pushes to client | One-way only |

**WebSocket** is the best choice: bidirectional, persistent, low overhead, works on port 80/443.

```
Client A ◀──WebSocket──▶ Chat Server ◀──WebSocket──▶ Client B
```

However, most app features (signup, login, profile, group management) use regular **HTTP REST**. WebSocket is only for messaging.

### High-Level Architecture

```
┌─────────┐       ┌──────────────────┐       ┌─────────┐
│ Client A │◀─WS─▶│  Chat Service    │◀─WS─▶│ Client B │
└─────────┘       │  (stateful)      │       └─────────┘
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Message DB   Presence Svc  Push Notification
         (Cassandra)  (Redis)       (APNs / FCM)
```

### Stateful vs Stateless Services

- **Stateless services** (HTTP): Auth, user profile, group management → behind a load balancer
- **Stateful service** (WebSocket): Chat servers maintain persistent connections → need session-aware routing

### API Design

```
-- REST APIs --
POST   /api/v1/auth/login
GET    /api/v1/users/{userId}/contacts
POST   /api/v1/groups
POST   /api/v1/groups/{groupId}/members

-- WebSocket Messages --
SEND:    { "type": "message", "to": "user123", "content": "Hello!", "msgId": "uuid" }
RECEIVE: { "type": "message", "from": "user456", "content": "Hi!", "msgId": "uuid", "timestamp": 1700000 }
ACK:     { "type": "ack", "msgId": "uuid", "status": "delivered" }
```

---

## Step 3 — Design Deep Dive

### 1-on-1 Chat Flow

```
Client A                    Chat Server               Client B
   │                             │                        │
   ├── SEND message ──────────▶  │                        │
   │                             ├── Store in DB          │
   │                             ├── Look up B's server   │
   │                             │                        │
   │                             │  B online?             │
   │                             ├── YES: forward via WS ─▶│
   │                             ├── NO: push notification │
   │                             │                        │
   │   ◀── ACK (stored) ────────┤                        │
   │                             │   ◀── ACK (delivered) ─┤
   │   ◀── ACK (delivered) ─────┤                        │
```

### Message ID Generation

Messages need a unique ID for ordering. Requirements:
- Unique globally
- Sortable by time (for chat ordering)

**Approach:** Use a **local sequence number** per chat session. Within a 1-on-1 or group channel, a simple auto-increment counter works. This is sufficient because ordering only matters within a single conversation.

Alternative: Twitter Snowflake-style IDs (64-bit: timestamp + machine ID + sequence)

### Message Storage

**Why not MySQL/PostgreSQL?**
- Chat data is write-heavy and grows enormously
- Need horizontal scaling (sharding)
- Regular SQL databases struggle with this workload

**Recommended: Cassandra or HBase**

| Feature | Why It Fits |
|---------|------------|
| Wide-column store | Efficient for sequential writes |
| Partition key = chat_id | All messages in a conversation on same node |
| Clustering key = message_id | Messages sorted within partition |
| Linear scalability | Add nodes to handle growth |
| High write throughput | Handles 23K writes/sec easily |

**Schema:**

```
Table: messages
  partition_key: channel_id (1-on-1 or group)
  clustering_key: message_id (time-sortable)
  columns: sender_id, content, type, created_at
```

**Fetching history:**
```sql
SELECT * FROM messages
WHERE channel_id = 'abc123'
AND message_id > last_seen_id
ORDER BY message_id ASC
LIMIT 50;
```

### Group Chat

Group messages are different from 1-on-1:

```
Client A sends to Group G (members: A, B, C, D)
   │
   ▼
Chat Server
   ├── Store message in messages table (channel = group_id)
   ├── For each member ≠ sender:
   │     ├── Online? → push via WebSocket
   │     └── Offline? → push notification + write to inbox
```

For small groups (≤100 members), iterating over the member list is acceptable. For very large groups (thousands of members), a fan-out approach with message queues is needed.

**Message sync for groups:** Each user has a per-group `last_read_message_id`. On reconnect, fetch messages after that ID.

### Online/Offline Presence

**Naive approach:** Update status on every action → too expensive

**Optimized approach: Heartbeat**

```
Client sends heartbeat every 5 seconds → Presence Server (Redis)
Redis key: presence:{userId} → { status: "online", lastSeen: timestamp }
TTL: 30 seconds (auto-expire if no heartbeat)
```

```
When user goes offline:
  - Heartbeats stop → Redis key expires → status = offline
  - Presence server notifies friends via their WebSocket connections
```

**Fan-out of presence updates:**
- For 1-on-1: only notify contacts who are also online
- For groups: only notify members with the conversation open
- Use a pub/sub mechanism (Redis Pub/Sub or a message broker)

### Multi-Device Support

A user might be logged in on phone and laptop simultaneously:

```
User A logs in from:
  Phone → Chat Server 1 (WS connection)
  Laptop → Chat Server 3 (WS connection)

Incoming message for A:
  Session registry (Redis): user_A → [server1, server3]
  Forward message to both connections
```

### Push Notifications

For offline users, deliver via push notification:

```
Chat Server ──▶ Notification Service ──▶ APNs (iOS) / FCM (Android)
```

- Queue notifications in Kafka for reliability
- Deduplicate (don't send if user comes online before notification fires)
- Batch notifications for group chats (e.g., "5 new messages in Group X")

### Message Delivery States

```
Sent:      Message stored on server → show single check ✓
Delivered: Message received by recipient's device → double check ✓✓
Read:      Recipient opened the conversation → blue checks ✓✓
```

Implementation:
- Server sends `ack:stored` to sender → ✓
- Recipient device sends `ack:delivered` → ✓✓ (relayed to sender)
- Recipient opens conversation → `ack:read` → blue ✓✓

### Handling Reconnection

When a device reconnects after being offline:

```
1. Re-establish WebSocket connection
2. Send last_received_message_id to server
3. Server fetches all newer messages from DB
4. Deliver batch to client
5. Mark messages as delivered
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
┌──────────┐   HTTP    ┌──────────────┐
│ Clients  │◀────────▶│ API Servers   │ (auth, profiles, groups)
│(mobile/  │          │ (stateless)   │
│ web)     │          └──────────────┘
│          │
│          │   WS     ┌──────────────┐    ┌─────────────┐
│          │◀────────▶│ Chat Servers  │──▶│ Cassandra    │ (messages)
│          │          │ (stateful)    │   └─────────────┘
└──────────┘          └──────┬───────┘
                             │          ┌─────────────┐
                             ├─────────▶│ Redis        │ (presence, sessions)
                             │          └─────────────┘
                             │          ┌─────────────┐
                             └─────────▶│ Notification │──▶ APNs/FCM
                                        │ Service      │
                                        └─────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Protocol | WebSocket | Bidirectional, real-time, low overhead |
| Message DB | Cassandra | Write-heavy, horizontally scalable |
| Presence | Redis + heartbeat | Fast, auto-expiring keys |
| Ordering | Per-channel sequence | Only need ordering within a conversation |
| Offline delivery | Push notifications + message sync on reconnect | Reliable delivery |

### Additional Talking Points

- **End-to-end encryption** — Signal Protocol (used by WhatsApp); keys exchanged via key server, server cannot read messages
- **Media messages** — Upload to S3/CDN, store URL in message; thumbnail generation pipeline
- **Message search** — Full-text search with Elasticsearch, indexed per user
- **Abuse prevention** — Rate limiting, content filtering, spam detection
- **Data locality** — Store messages close to users (regional Cassandra clusters)
- **GDPR compliance** — Message deletion on account close, right to export
