# Design Google Docs (Collaborative Editor)

A real-time collaborative document editor allows multiple users to simultaneously view and edit the same document. The core challenge is handling concurrent edits from different users without conflicts, while maintaining a responsive local editing experience. This is the system behind Google Docs, Notion, and Figma.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we designing just the real-time collaboration part, or the entire document management platform (folders, permissions, sharing)?
**Interviewer:** Focus on the real-time collaborative editing, but briefly touch on storage.

**Candidate:** How many concurrent editors per document?
**Interviewer:** Up to 50 simultaneous editors per document.

**Candidate:** Do we need to support rich text (bold, tables, images) or just plain text?
**Interviewer:** Support rich text editing.

**Candidate:** What about offline editing?
**Interviewer:** Nice to have, but not the primary focus.

### Functional Requirements

- Multiple users can edit the same document simultaneously
- Changes appear in real-time for all connected users (< 200ms perceived latency)
- Cursor and selection positions of other users are visible
- Document history and version control (undo/redo per user)
- Conflict resolution — no edits are lost

### Non-Functional Requirements

- **Low latency** — Local edits must feel instant (optimistic UI)
- **Consistency** — All users must eventually converge to the same document state
- **Availability** — System should be available even during partial failures
- **Durability** — No data loss; all edits are persisted
- **Scalability** — Support millions of documents, thousands with active editors

### Back-of-the-Envelope Estimation

- 10 million total documents, 100K with active sessions at peak
- Average 3 concurrent editors per document
- Each keystroke generates an operation (~5 bytes)
- Typing speed ~5 chars/sec per user
- 100K docs × 3 users × 5 ops/sec = ~1.5M operations/sec system-wide

---

## Step 2 — High-Level Design

```
┌─────────┐   ┌─────────┐   ┌─────────┐
│ User A  │   │ User B  │   │ User C  │
│ Browser │   │ Browser │   │ Browser │
└────┬────┘   └────┬────┘   └────┬────┘
     │              │              │
     │         WebSocket           │
     ▼              ▼              ▼
┌──────────────────────────────────────┐
│         Collaboration Service        │
│   (per-document session manager)     │
│                                      │
│   - Receives operations              │
│   - Transforms / merges              │
│   - Broadcasts to all clients        │
└───────────────┬──────────────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌─────────────┐   ┌───────────┐
│  Document   │   │  Operation │
│  Store      │   │  Log       │
│  (current)  │   │  (history) │
└─────────────┘   └───────────┘
```

### Key Components

| Component              | Responsibility                                          |
|------------------------|---------------------------------------------------------|
| Client Editor          | Local editing, optimistic UI, operation generation      |
| WebSocket Gateway      | Persistent connections, message routing                 |
| Collaboration Service  | Conflict resolution (OT or CRDT), operation ordering    |
| Document Store         | Persists the latest document snapshot                   |
| Operation Log          | Append-only log of all operations (for history/undo)    |
| Presence Service       | Tracks cursor positions, who's online                   |

---

## Step 3 — Design Deep Dive

### 1. The Core Problem: Concurrent Edits

```
Document state: "ABCD"

User A (at position 1): Insert "X" → "AXBCD"
User B (at position 3): Delete "C"  → "ABD"

Both edits happen at the same time.
If we naively apply both:

  Apply A's edit first:  "ABCD" → "AXBCD"
  Apply B's edit (pos 3): "AXBCD" → "AXBD"  ← Deleted 'C'? No, deleted 'B'!

  B wanted to delete 'C' (position 3 in original),
  but A's insert shifted positions.
  B's operation is now WRONG.
```

There are two main approaches to solving this: **OT** and **CRDTs**.

### 2. Operational Transformation (OT)

OT is the algorithm used by Google Docs. The core idea: when concurrent
operations arrive, **transform** them against each other so they produce the
correct result regardless of application order.

```
Operation: { type: "insert" | "delete", position: N, char: "X" }

Transform function T(op_a, op_b) → (op_a', op_b')
  such that: apply(apply(doc, op_a), op_b') == apply(apply(doc, op_b), op_a')

Example:
  Doc: "ABCD"
  op_a: insert("X", pos=1)   [User A]
  op_b: delete(pos=3)         [User B]

  Transform(op_a, op_b):
    op_a inserted at pos 1, which is BEFORE op_b's pos 3.
    So op_b' must shift right: delete(pos=4)
    op_a' stays the same: insert("X", pos=1)

  Server applies op_a first:  "ABCD" → "AXBCD"
  Then applies op_b':         "AXBCD" → "AXBD"  ✗ Wait...
  
  Actually: op_b wanted to delete char at index 3 = 'D' originally?
  No — pos 3 in "ABCD" is 'D' (0-indexed: A=0, B=1, C=2, D=3).
  
  After A's insert at 1: "AXBCD" → 'D' is now at index 4.
  op_b' = delete(pos=4) → "AXBC" ← Correct! 'D' was deleted.
  
  (If 'C' was the target at index 2, transform would give pos=3 after shift.)
```

### OT Architecture (Google Docs Model)

```
                    ┌─────────────────┐
                    │   OT Server     │
                    │                 │
Client A ──op_a──► │  Receive op_a   │
                    │  Transform vs   │
Client B ──op_b──► │  pending ops    │ ──► Broadcast transformed ops
                    │  Apply to       │
                    │  server doc     │
                    │                 │
                    │  Revision: 42   │
                    └─────────────────┘

Each client tracks:
  - Local revision number
  - Pending (unacknowledged) operations
  - A buffer of incoming remote operations

When sending an operation:
  Client sends: { op, baseRevision }
  Server transforms op against all ops since baseRevision
  Server increments revision, broadcasts transformed op
  Client receives ACK, advances its revision
```

**Pros**: Well-understood, proven at Google scale, works with a central server.
**Cons**: Requires a central server per document (single point of ordering),
transform functions are complex (O(n^2) for n operation types), hard to
implement correctly for rich text.

### 3. CRDTs (Conflict-free Replicated Data Types)

CRDTs are a newer, mathematically guaranteed approach. Each character gets a
unique ID, and operations are commutative — they produce the same result
regardless of order.

```
CRDT approach (simplified):

Instead of positions, each character has a unique fractional ID:

  A       B       C       D
  (0.25)  (0.5)   (0.75)  (1.0)

User A inserts "X" between A and B:
  X gets ID = (0.25 + 0.5) / 2 = 0.375
  
  A       X       B       C       D
  (0.25)  (0.375) (0.5)   (0.75)  (1.0)

User B deletes C (ID 0.75):
  Mark ID 0.75 as tombstoned.

These two operations can be applied in ANY order
and produce the same result. No transformation needed.
```

| Property       | OT                        | CRDT                          |
|---------------|---------------------------|-------------------------------|
| Server needed | Yes (central ordering)    | No (peer-to-peer possible)    |
| Complexity    | Transform functions       | Unique ID generation          |
| Correctness   | Must implement correctly  | Mathematically guaranteed     |
| Memory        | Efficient                 | Higher (tombstones, IDs)      |
| Used by       | Google Docs               | Figma, Yjs, Automerge         |
| Offline       | Difficult                 | Natural (merge on reconnect)  |

### 4. WebSocket Communication

```
Connection lifecycle:

1. User opens document
   Client → HTTP GET /api/docs/{id} → gets latest snapshot + revision
   Client → WebSocket connect to /ws/docs/{id}

2. User types
   Client applies edit locally (optimistic)
   Client → WS: { type: "op", ops: [...], baseRev: 42 }

3. Server processes
   Server transforms op if needed
   Server → WS to ALL clients: { type: "op", ops: [...], rev: 43, userId: "A" }
   Server → WS to sender: { type: "ack", rev: 43 }

4. Remote user receives
   Client applies transformed op to local document
   Client updates cursor positions of other users

5. Presence updates
   Client → WS: { type: "cursor", position: 156, userId: "B" }
   Server → broadcast to others
```

### 5. Document Storage & Persistence

```
Two-tier storage:

Hot path (real-time):
  ┌─────────────────────────────┐
  │  In-Memory Document State   │  ← Active editing sessions
  │  (per collaboration server) │
  │                             │
  │  Periodically snapshot to   │──────► Object Store (S3)
  │  durable storage            │       (full document snapshots)
  └─────────────────────────────┘
              │
              ▼
  ┌─────────────────────────────┐
  │     Operation Log (DB)      │  ← Append-only log of every edit
  │                             │     Used for: history, undo, replay
  │  { rev: 43, op: {...},      │
  │    userId: "A", ts: ... }   │
  └─────────────────────────────┘

Snapshotting strategy:
  - Save a full snapshot every N operations (e.g., every 100 ops)
  - To reconstruct document at revision 450:
    Load snapshot at revision 400 + replay ops 401–450
  - Snapshots also taken when last user disconnects
```

### 6. Scaling the Collaboration Service

```
Problem: Each document needs a single "owner" server for OT ordering.
         Can't just round-robin requests across servers.

Solution: Sticky sessions per document.

  ┌──────────────────┐
  │  WebSocket       │
  │  Gateway / LB    │──── doc_123 ──► Collab Server A
  │                  │──── doc_456 ──► Collab Server B
  │  (routes by      │──── doc_789 ──► Collab Server A
  │   document ID)   │
  └──────────────────┘

  Use consistent hashing on document ID to assign documents to servers.
  If a server crashes, its documents are reassigned.
  New server loads latest snapshot + replays ops from the operation log.
```

---

## Step 4 — Wrap Up

### Handling Edge Cases

- **User goes offline mid-edit:** Client queues operations locally. On reconnect, client sends buffered ops with its last known revision. Server transforms and applies them. With CRDTs, this is seamless; with OT, the server catches up the client.

- **Conflicting formatting:** Two users bold different overlapping ranges. OT/CRDT handles this by treating formatting as annotations on character ranges. Overlapping bold operations converge to "both ranges are bold."

- **Large documents (100+ pages):** Don't load the entire document into memory. Split into chunks/blocks (like Notion). Each block can be independently edited and synced. Only load visible blocks.

- **Version history / "See changes":** The operation log enables replaying the document at any point in time. Group operations by user session into "revisions" for a clean history view.

### Architecture Summary

1. **WebSocket connections** provide real-time bidirectional communication between clients and the collaboration server.
2. **Operational Transformation (OT)** or **CRDTs** resolve concurrent edits — OT requires a central server for ordering, CRDTs allow decentralized merging.
3. **Sticky sessions** (via consistent hashing on document ID) ensure all editors of a document connect to the same collaboration server.
4. An **append-only operation log** provides full edit history, undo/redo, and crash recovery.
5. **Periodic snapshots** to durable storage prevent unbounded operation log replay on recovery.
