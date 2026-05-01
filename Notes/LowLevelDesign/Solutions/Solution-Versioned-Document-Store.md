# Design a Versioned Document Store (LLD)

> A storage layer that keeps every historical version of every document, like Git for arbitrary structured documents (think Notion, Figma history, Google Docs revisions, S3 versioning, or a wiki).
> Tests content-addressable storage, immutable data structures, hash trees (Merkle DAG), and the snapshot-vs-diff trade-off.

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Two Storage Strategies: Diffs vs Snapshots](#2-two-storage-strategies-diffs-vs-snapshots)
3. [The Git Object Model](#3-the-git-object-model)
4. [Schema](#4-schema)
5. [Core Operations](#5-core-operations)
6. [Concurrency: Optimistic Branching](#6-concurrency-optimistic-branching)
7. [Garbage Collection](#7-garbage-collection)
8. [Performance Patterns](#8-performance-patterns)
9. [Operational Concerns](#9-operational-concerns)
10. [Common Follow-ups](#10-common-follow-up-questions)
11. [Sources](#11-sources)

---

## 1. Requirements

### Functional
- Create, update, delete documents — every save creates a new immutable version
- Retrieve a specific historical version by ID or by branch HEAD
- List the version history of a document
- Compute a diff between any two versions
- Branch a document (alternative timeline) and merge branches
- Tag a specific version (e.g., "v1.0", "production")
- Rename / move documents without losing history

### Non-Functional
- **Storage efficient** — millions of revisions of slightly-modified documents must not bloat 1000×
- **Read performance**: open any version in O(depth) tree-walks
- **Immutable** — historical versions never change. Audit-friendly.
- **Atomic writes** — partial commits never visible to readers
- **Deduplication** — identical content stored once across the entire system

---

## 2. Two Storage Strategies: Diffs vs Snapshots

The fork in the road every version-control system faces.

| | Delta storage (CVS, Subversion, Mercurial) | Snapshot + content addressing (Git) |
|---|---|---|
| What's stored | Initial version + chain of diffs | Every version's full tree, deduplicated |
| Read latest | Apply N patches | Single tree walk |
| Read old version | Apply N – k patches | Same — single tree walk |
| Identical files in two versions | Two diffs (one rebuilds, one cancels) | One blob, referenced twice |
| Branching | Fork the diff chain | Two commits pointing to the same tree |
| Disk pressure | Lower for small edits to large files | Higher per-revision; lower with packfile delta-compression |
| Operational complexity | Patches can corrupt the whole chain | Each object verified by its hash |

> "Subversion, CVS, Perforce, Mercurial and the like all use Delta Storage systems — they store the differences between one commit and the next. Git does not do this — it stores a snapshot of what all the files in your project look like in this tree structure each time you commit."

**Choose snapshots + content addressing.** It scales better, supports branching cheaply, and makes integrity verification trivial. (Git also uses delta compression *inside* its packfiles to recover storage, but that's a physical detail — the logical model is full snapshots.)

> "Git does use delta compression inside packfiles to save storage and network bytes, which is the closest conceptual thing to a 'diff.' But that is a physical encoding detail; the logical model is still full snapshots connected by parent links."

---

## 3. The Git Object Model

Three primary object types — each immutable, content-addressed, and stored exactly once.

### 3.1 Blob
> "A blob is file content and nothing more."

- Stores the **raw bytes** of a single document version
- ID = hash of the content (e.g., `SHA-256(content)`)
- Independent of name and location — the same content used in two different documents shares one blob

```
blob 4f1f23...
└── { ...raw document bytes... }
```

### 3.2 Tree
- Represents a directory: a sorted list of `(mode, type, hash, name)` entries
- Each entry points to a blob (file) or another tree (subdirectory)
- ID = hash of the entries

> "Since trees and blobs, like all other objects, are named by the hash of their contents, two trees have the same name if and only if their contents (including, recursively, the contents of all subdirectories) are identical."

```
tree 9aa3...
├── 100644 blob 4f1f23... README.md
├── 100644 blob 7b2c1f... config.json
└── 040000 tree 11db8c... lib/
                         └── tree 11db8c...
                             └── 100644 blob c4e51b... util.js
```

### 3.3 Commit
- Single snapshot — points to **one tree** (the root) and **zero or more parents**
- Carries metadata: author, timestamp, message
- ID = hash of the commit's contents (which includes parent hashes → tamper-evident chain)

```
commit 8cc0d4...
├── tree    9aa3...
├── parent  bc8d9d... (zero parents = root commit, two = merge)
├── author  Alice <[email protected]> 1730000000 +0000
└── message "Update README"
```

### 3.4 The DAG
> "Git's data model is a directed acyclic graph (DAG). This data model keeps all the Git objects in a DAG structure, thus from each commit we can traverse back to its ancestors."

```
commit 3 ──► tree C ──► blob X
   │           │
   │           └────────► tree D ──► blob Y
   │
   ▼ parent
commit 2 ──► tree B ──► blob X       (← reused)
   │           │
   │           └────────► tree D     (← reused)
   ▼ parent
commit 1 ──► tree A ──► blob W
                │
                └────────► tree D    (← reused)
```

Notice the **structural sharing**: an unchanged subtree across commits is *literally the same tree object*. This is the source of the storage efficiency.

### 3.5 Why this works (the deduplication insight)
> "Since the blob is entirely defined by its data, if two files in a directory tree (or in multiple different versions of the repository) have the same contents, they will share the same blob object."

Editing one file in a 10,000-file project creates:
- 1 new blob (the modified file)
- 1 new tree (its parent directory)
- 1 new tree (each ancestor directory up to root) — typically O(log N) for a balanced tree
- 1 new commit

Everything else is referenced. **Storage cost ≈ size of the change**, not size of the document tree.

### 3.6 References (mutable pointers)
> "In addition to the Git objects, which are immutable — that is, they cannot ever be changed — there are references also stored in Git. Unlike the objects, references can constantly change."

```
refs/heads/main       → commit 8cc0d4...   (branch)
refs/tags/v1.0        → commit ab12cd...   (tag — immutable in practice)
HEAD                  → ref: refs/heads/main
```

Refs are the **only mutable state** in the entire system. Updating a ref is a single atomic compare-and-swap.

---

## 4. Schema

### Object store (immutable)
```sql
CREATE TABLE objects (
    hash      BYTEA PRIMARY KEY,           -- SHA-256
    type      SMALLINT NOT NULL,           -- 1=blob, 2=tree, 3=commit
    size      BIGINT  NOT NULL,
    content   BYTEA   NOT NULL             -- compressed (zstd)
);
CREATE INDEX ON objects (type);
```

For large blobs, content lives in S3 / object storage; the row holds a pointer.

### References (mutable, atomic)
```sql
CREATE TABLE refs (
    namespace  TEXT NOT NULL,             -- e.g., document_id
    name       TEXT NOT NULL,             -- "main", "v1.0", "draft"
    target     BYTEA NOT NULL,            -- commit hash
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version    BIGINT NOT NULL DEFAULT 1, -- for optimistic concurrency
    PRIMARY KEY (namespace, name)
);
```

### Index for path-history queries (optional)
```sql
CREATE TABLE path_history (
    namespace   TEXT,
    path        TEXT,
    commit_hash BYTEA,
    blob_hash   BYTEA,
    seq         BIGINT,
    PRIMARY KEY (namespace, path, seq DESC)
);
```

> Git "infers renames at query time when a command asks for that view, rather than storing them as first-class events in the object model" — so this index is an optimization for the most common UI query ("show me history of this file").

---

## 5. Core Operations

### 5.1 Write a document
```python
def commit(namespace, branch, path, content, parent_commit, author, message):
    # 1. Hash the content; deduplicate
    blob_hash = sha256(b"blob " + content)
    objects.put(blob_hash, "blob", content)        # idempotent
    
    # 2. Update tree from parent (with structural sharing)
    parent_tree = objects.get(parent_commit).tree
    new_tree    = update_tree(parent_tree, path.split("/"), blob_hash)
    
    # 3. Create commit
    new_commit = {
        tree:    new_tree.hash,
        parent:  parent_commit,
        author:  author,
        time:    now(),
        message: message,
    }
    commit_hash = sha256(serialize(new_commit))
    objects.put(commit_hash, "commit", serialize(new_commit))
    
    # 4. Update branch ref atomically (CAS)
    if not refs.update_if_equals(namespace, branch,
                                  expected=parent_commit, new=commit_hash):
        return CONFLICT
    return commit_hash

def update_tree(tree, path_parts, blob_hash):
    if len(path_parts) == 1:
        # Replace this file in the tree
        new_entries = [e for e in tree.entries if e.name != path_parts[0]]
        new_entries.append({mode: 0o644, hash: blob_hash, name: path_parts[0]})
        return store_tree(sorted(new_entries, key=lambda e: e.name))
    
    # Recurse into subtree
    head, *rest = path_parts
    sub = tree.entries.find(head) or empty_tree()
    new_sub = update_tree(sub, rest, blob_hash)
    new_entries = [e for e in tree.entries if e.name != head]
    new_entries.append({mode: 0o040000, hash: new_sub, name: head})
    return store_tree(sorted(new_entries, key=lambda e: e.name))
```

### 5.2 Read a document at a version
```python
def read(commit_hash, path):
    commit = objects.get(commit_hash)
    tree   = objects.get(commit.tree)
    for part in path.split("/")[:-1]:
        entry = tree.find(part)
        tree  = objects.get(entry.hash)
    blob_entry = tree.find(path.split("/")[-1])
    return objects.get(blob_entry.hash).content
```

Cost: O(path-depth + tree-fan-out) hash lookups. Trees are typically O(log N) for balanced repositories.

### 5.3 List history
```python
def history(commit_hash):
    seen = set()
    queue = [commit_hash]
    while queue:
        c = objects.get(queue.pop(0))
        if c.hash in seen: continue
        seen.add(c.hash)
        yield c
        queue.extend(c.parents)
```

### 5.4 Diff two versions
```python
def diff(tree_a_hash, tree_b_hash):
    if tree_a_hash == tree_b_hash:
        return []                    # ← key optimization: hash equality
    
    a = objects.get(tree_a_hash).entries
    b = objects.get(tree_b_hash).entries
    changes = []
    for name in {*a.names(), *b.names()}:
        ea, eb = a.get(name), b.get(name)
        if ea is None:                    changes += [("ADD",    name, eb)]
        elif eb is None:                  changes += [("DELETE", name, ea)]
        elif ea.hash == eb.hash:          continue          # unchanged subtree/blob
        elif ea.type == TREE == eb.type:  changes += diff(ea.hash, eb.hash)  # recurse
        else:                              changes += [("MODIFY", name, ea, eb)]
    return changes
```

> Per the Caleb Sander dev.to source: "Instead of always comparing the contents of the blobs, we can skip them if their hashes are the same, since that means they are the same object."

### 5.5 Branch a document
```python
def branch(namespace, base_branch, new_branch):
    base_commit = refs.get(namespace, base_branch)
    refs.create(namespace, new_branch, base_commit)
```

O(1) — just a new ref pointing at the same commit. Both branches share **all** history until they diverge.

### 5.6 Merge two branches (3-way)
```python
def merge(commit_a, commit_b):
    base = lowest_common_ancestor(commit_a, commit_b)
    
    # Trivial fast-forward
    if base == commit_a: return commit_b
    if base == commit_b: return commit_a
    
    # Three-way merge of trees
    merged_tree, conflicts = three_way_merge_tree(
        base.tree, commit_a.tree, commit_b.tree)
    
    if conflicts:
        return ConflictResult(merged_tree, conflicts)
    
    return create_commit(merged_tree, parents=[commit_a, commit_b], message="Merge")
```

`three_way_merge_tree` recurses, comparing entry-by-entry: if base = A but base ≠ B, B wins; if base ≠ A and A = B, no conflict; if all three differ, conflict.

---

## 6. Concurrency: Optimistic Branching

Multiple users editing the same branch simultaneously?

### CAS on the ref
The ref update is the single point of serialization. Every write is:
```
UPDATE refs
SET    target = ?, version = version + 1
WHERE  namespace = ? AND name = ? AND target = ?  -- expected
```
If `affected_rows = 0`, the branch moved under us — return `CONFLICT`.

### Client-side merge
On conflict, the client:
1. Fetches the new HEAD
2. Three-way merges its local change with the new HEAD against their common base
3. Retries the CAS with `expected = new_HEAD`

This is the **Git push --force-with-lease** semantics — and it's the only sane way to handle concurrent writes without distributed locking.

### Why not pessimistic locking?
Locks block. In a multi-user editor (Notion, Figma), users are physically present and impatient. Optimistic + auto-merge is far better UX.

For very high-conflict cases (collaborative editing of a single text doc), use **CRDTs** *inside* the document — but that's a separate layer above this storage.

---

## 7. Garbage Collection

Branches get deleted; orphaned commits / trees / blobs accumulate.

### Mark and sweep
```
def gc():
    reachable = set()
    
    # 1. Mark — walk every ref
    for ref in refs.all():
        traverse(ref.target, reachable)
    
    # 2. Sweep — delete everything not marked
    for hash in objects.all_hashes():
        if hash not in reachable:
            objects.delete(hash)

def traverse(commit_hash, reachable):
    if commit_hash in reachable: return
    reachable.add(commit_hash)
    commit = objects.get(commit_hash)
    walk_tree(commit.tree, reachable)
    for parent in commit.parents:
        traverse(parent, reachable)

def walk_tree(tree_hash, reachable):
    if tree_hash in reachable: return
    reachable.add(tree_hash)
    for entry in objects.get(tree_hash).entries:
        if entry.type == TREE:
            walk_tree(entry.hash, reachable)
        else:
            reachable.add(entry.hash)
```

### Online GC strategies
- **Reflog grace period** — keep deleted-branch HEADs for 30 days before they're truly gone (Git default is 90 days)
- **Reference counting** alongside GC — `refcount = 0` is a candidate but only deleted on next mark-sweep run, to avoid races
- **Compaction job** — runs nightly on a single shard

### Avoid stop-the-world
- Soft-delete on `delete branch` — write a tombstone, defer reachability sweep
- Concurrent mark with epoch counters — like a copying garbage collector

---

## 8. Performance Patterns

### Packing
Storing one file per object is fine for cold storage but slow for read-heavy workloads. **Packfiles** (Git's invention) bundle many objects into one append-only file with delta compression *between similar blobs*. Reduces both disk and read amplification.

### Caching layers
- **Object cache** in front of the store — LRU keyed by hash. Hit ratio is excellent because trees are referenced thousands of times.
- **Path → hash lookup cache** — for fast random reads of `branch HEAD :: path`
- **Diff cache** — common (commit_a, commit_b) pairs; cheap because keyed by hashes

### Bloom filters for "did this commit modify this path?"
For the path-history UI: each commit gets a Bloom filter of the paths it touched (size ≈ 200 bytes). Walking 10,000 commits to find ones that touched `/lib/util.js` is reduced from "open every tree" to "skip 99% via Bloom".

> "Path history queries are sometimes expensive because Git has to inspect which snapshots changed a path rather than reading off a neatly stored per-file timeline."

---

## 9. Operational Concerns

### Storage layout
- Hot objects (recent commits, current HEADs) in a fast key-value store (Redis / RocksDB)
- Cold objects in S3, prefixed by first 2 hex chars of hash for sharding (`ab/cdef0123...` — same as Git's filesystem layout)
- Packfiles batched periodically

### Replication
- Object store is **append-only and content-addressed** → trivially replicable. No conflict resolution needed; equal hashes = equal content.
- Refs need ordered replication (CAS semantics matter); use a consensus log (Raft) or a single-master-per-namespace.

### Hash choice
> "Historically, Git repositories have used SHA-1 for this, while modern Git also supports repositories created with SHA-256 object IDs."

Use **SHA-256**. SHA-1 has known collision attacks (SHAttered, 2017). SHA-256 adds CPU cost (~2× hashing time) but is now standard for new systems.

### Audit trail
The DAG itself is the audit trail — every commit hash includes its parent hashes, so any tampering invalidates downstream hashes. Free integrity verification.

### Quotas
Per-namespace storage is summed via the GC mark phase. Approximate live counters via increments on commit / decrements on GC sweep.

---

## 10. Common Follow-up Questions

**Q: How do you handle very large blobs (e.g., 1 GB videos)?**
- **LFS pattern**: blob in S3, hash + pointer in your object store. Same content-addressing, just defer the bytes.
- For incremental edits to large blobs (image with annotations), break into chunks (rolling-hash boundaries, à la rsync / Restic) so a small edit doesn't re-upload the whole file.

**Q: How would you implement file rename/move while preserving history?**
- The object model doesn't store renames. Heuristic: when computing a diff, if file X disappears and file Y appears with content hash within an edit-distance of X's last hash → infer a rename. UI surface only.

**Q: Branching for collaborative editing — how do you avoid hundreds of micro-commits?**
- **Squashing**: at "save point" (user pauses for 5 min, or hits "publish"), collapse N commits into one. The intermediate commits become unreachable and GC'd later.
- Or expose two layers: an **autosave timeline** (frequent, ephemeral commits) and a **publish timeline** (curated, permanent).

**Q: How would you support cherry-pick — apply one commit from branch A onto branch B?**
- Compute the diff `commit_A_parent → commit_A`. Apply that diff to `commit_B`'s tree. Create a new commit on B with the result. Conflicts handled like merges.

**Q: When would you NOT use this design?**
- **Append-only logs** (Kafka, event sourcing) — different problem; sequence numbers, not snapshots
- **High-frequency mutable counter** — content addressing every increment is expensive. Use a regular DB.
- **Strict ACID across documents** — Git-style CAS is per-namespace; multi-document atomic writes need a real RDBMS or two-phase commit on top.

**Q: How do you prevent abuse / repository explosion?**
- **Per-namespace quotas** enforced on every commit (live counter, periodically reconciled via GC)
- **Anti-DoS**: reject commits whose new tree size > 10× parent tree size unless explicitly approved
- **Hash-collision detection** — two writes producing the same hash with different content is fatal; alert and isolate the namespace

**Q: How does this compare to a CRDT-based store like Y.js / Automerge?**
- This stores **versions** (point-in-time snapshots). CRDTs store **operations** (apply-anywhere, anytime). Notion / Figma actually combine both — CRDTs for live collaboration within a session, snapshot history for "show me yesterday's state" backed by a Git-like object model. The two layers compose well.

---

## 11. Sources

- **git-scm.com/book/en/v2 — "Git Internals - Git Objects"** — the canonical explanation; `find .git/objects` listings; "All Git objects are stored the same way…" 
- **gitperf.com Chapter 2 — "Git's Core Data Model"** — SHA-1/SHA-256 quote in §9; logical-snapshots-vs-physical-deltas in §2; "name lives in the tree" in §3
- **shafiul.github.io — "The Git Object Model"** — Subversion/Mercurial vs Git delta-vs-snapshot distinction in §2
- **dev.to (Caleb Sander) — "Git Internals part 1"** — hash-equality as diff shortcut in §5.4
- **dev.to (\_\_whyd_rf) — "A Deep Dive into Git Internals"** — DAG / content-addressable filesystem framing
- **Pluralsight "Git Internals" PDF (chapter 5: data model)** — references vs objects, mutable pointers in §3.6
- **freeCodeCamp — "A Visual Guide to Git Internals"** — hash-cascade-up-the-tree explanation in §3.5
- **Medium (Amir Ebrahimi Fard) — "Git Under the Hood, Part 1"** — "16 immutable, signed, compressed objects" worked example
- **Pro Git Book** — referenced throughout; the standard authority on this object model
