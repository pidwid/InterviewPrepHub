# Blob & Object Storage

## Table of Contents

1. [Overview](#1-overview)
2. [File vs Block vs Object Storage](#2-file-vs-block-vs-object-storage)
3. [Object Storage Architecture](#3-object-storage-architecture)
4. [Amazon S3 Deep Dive](#4-amazon-s3-deep-dive)
5. [Distributed File Systems (GFS/HDFS)](#5-distributed-file-systems-gfshdfs)
6. [Data Integrity & Durability](#6-data-integrity--durability)
7. [Content Addressing & Deduplication](#7-content-addressing--deduplication)
8. [Design Patterns](#8-design-patterns)
9. [Comparison & Trade-offs](#9-comparison--trade-offs)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Applications store two kinds of data: **structured** (rows in a database) and
**unstructured** (images, videos, logs, backups). Unstructured data typically
accounts for 80%+ of all data. Object/blob storage is purpose-built for it.

```
Structured data:                  Unstructured data:
┌──────┬───────┬──────┐           ┌──────────────┐
│ id   │ name  │ age  │           │ profile.jpg  │  (2 MB)
├──────┼───────┼──────┤           │ resume.pdf   │  (500 KB)
│ 1    │ Alice │ 30   │           │ video.mp4    │  (2 GB)
│ 2    │ Bob   │ 25   │           │ backup.tar   │  (50 GB)
└──────┴───────┴──────┘           │ log-2024.csv │  (10 GB)
  → SQL/NoSQL database             └──────────────┘
                                    → Object / Blob storage
```

---

## 2. File vs Block vs Object Storage

<abbr title="File storage: hierarchical files/folders (NFS). Block storage: raw blocks for disks/VMs (EBS). Object storage: flat key+object with metadata (S3)."></abbr>

```
┌──────────────┬──────────────────┬──────────────────┬────────────────────┐
│              │  File Storage    │  Block Storage   │  Object Storage    │
├──────────────┼──────────────────┼──────────────────┼────────────────────┤
│ Analogy      │ Filing cabinet   │ Hard drive       │ Warehouse shelves  │
│ Unit         │ Files in folders │ Fixed-size blocks│ Objects (blob+meta)│
│ Access       │ Hierarchical path│ Byte offset      │ Flat namespace+key │
│ Protocol     │ NFS, SMB, CIFS   │ iSCSI, Fibre Ch. │ HTTP (REST API)   │
│ Metadata     │ Limited (OS)     │ None             │ Rich (custom)      │
│ Scalability  │ Limited          │ Moderate         │ Massive            │
│ Best For     │ Shared files     │ Databases, VMs   │ Media, backups,    │
│              │ Home directories │ Boot volumes     │ data lakes         │
│ Examples     │ NFS, EFS, FSx    │ EBS, Azure Disk  │ S3, GCS, Blob     │
└──────────────┴──────────────────┴──────────────────┴────────────────────┘
```

### Object Storage Data Model

```
Object:
┌─────────────────────────────────────────┐
│  Key:    "images/profile/user123.jpg"   │  ← Flat namespace (no real dirs)
│  Value:  <binary blob data>             │  ← The actual file bytes
│  Metadata:                              │
│    Content-Type: image/jpeg             │
│    Content-Length: 245760               │  ← Rich, custom metadata
│    x-custom-user: user123              │
│    Created: 2024-01-15T10:30:00Z       │
│  Version: 3                             │  ← Optional versioning
│  ETag: "d41d8cd98f00b204e9800998ecf8"   │  ← Content hash
└─────────────────────────────────────────┘

No hierarchy — "images/profile/" is part of the key string, not a directory.
```

---

## 3. Object Storage Architecture

```
                    ┌──────────────────────────┐
                    │      API Gateway /       │
  PUT/GET ────────►│      Load Balancer       │
  (HTTP)           └───────────┬──────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Metadata Service   │
                    │   (object → location)│
                    │   ┌────────────────┐ │
                    │   │ Key → Node Map │ │
                    │   │ Versioning     │ │
                    │   │ ACLs           │ │
                    │   └────────────────┘ │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Storage Node │  │ Storage Node │  │ Storage Node │
    │     1        │  │     2        │  │     3        │
    │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │
    │  │ Disk 1 │  │  │  │ Disk 1 │  │  │  │ Disk 1 │  │
    │  │ Disk 2 │  │  │  │ Disk 2 │  │  │  │ Disk 2 │  │
    │  │ Disk 3 │  │  │  │ Disk 3 │  │  │  │ Disk 3 │  │
    │  └────────┘  │  │  └────────┘  │  │  └────────┘  │
    └──────────────┘  └──────────────┘  └──────────────┘
    
    Data replicated across nodes (typically 3 replicas).
    Erasure coding used for cost-effective durability at scale.
```

### Write Path

```
PUT /bucket/key:

1. Client sends object to API gateway
2. Gateway authenticates and authorizes
3. Metadata service determines placement (consistent hashing)
4. Object is written to primary storage node
5. Primary replicates to N-1 secondary nodes
6. Once quorum (e.g., 2/3) acknowledges → return success
7. Metadata service records object location, version, checksum
```

### Read Path

```
GET /bucket/key:

1. Client sends request to API gateway
2. Metadata service looks up object location
3. Route to nearest/least-loaded storage node
4. Storage node reads from disk, verifies checksum
5. Return object bytes + metadata
6. (Optional) Check CDN cache first for hot objects
```

---

## 4. Amazon S3 Deep Dive

### Storage Classes

| Class              | Durability     | Availability | Cost    | Use Case                  |
|-------------------|----------------|-------------|---------|---------------------------|
| S3 Standard       | 99.999999999%  | 99.99%      | $$$     | Frequently accessed data  |
| S3 Intelligent    | 99.999999999%  | 99.9%       | $$      | Unknown access patterns   |
| S3 Standard-IA   | 99.999999999%  | 99.9%       | $$      | Infrequent access         |
| S3 One Zone-IA   | 99.999999999%  | 99.5%       | $       | Reproducible data         |
| S3 Glacier        | 99.999999999%  | 99.99%      | ¢       | Archive (minutes-hours)   |
| S3 Glacier Deep   | 99.999999999%  | 99.99%      | ¢/10    | Archive (12-48 hours)     |

### S3 Consistency Model

```
Before Dec 2020: Eventual consistency for overwrites/deletes
After Dec 2020:  Strong read-after-write consistency

PUT object → 200 OK → immediate GET returns latest version ✓
DELETE obj → 200 OK → immediate GET returns 404 ✓
LIST after PUT → object appears immediately ✓
```

### Key S3 Features

| Feature           | Description                                            |
|------------------|--------------------------------------------------------|
| Versioning       | Keep all versions of an object, recover from deletes   |
| Lifecycle rules  | Auto-transition to cheaper storage classes over time   |
| Cross-region rep.| Replicate buckets across AWS regions                   |
| Pre-signed URLs  | Temporary access URLs (upload/download without creds)  |
| Event notifications| Trigger Lambda/SQS/SNS on PUT/DELETE events          |
| S3 Select        | Query CSV/JSON/Parquet in-place with SQL               |
| Transfer Accel.  | Use CloudFront edge locations for faster uploads       |
| Multipart upload | Upload large objects in parallel parts                 |

### <abbr title="Multipart upload: split a large object into parts uploaded in parallel, then assembled by S3. Improves speed and retryability.">Multipart Upload</abbr>

```
For objects > 5 GB (recommended for > 100 MB):

1. Initiate multipart upload → get Upload ID
2. Upload parts in parallel (each 5MB-5GB)
3. Complete multipart upload → S3 assembles the object

  ┌──────┐ Part 1 (5MB)  ┌──────────┐
  │Client│─────────────► │          │
  │      │ Part 2 (5MB)  │   S3     │
  │      │─────────────► │          │  → Assemble
  │      │ Part 3 (5MB)  │          │  → Single object
  │      │─────────────► │          │
  └──────┘ (in parallel)  └──────────┘

Benefits:
  - Resume failed uploads (retry individual parts)
  - Upload parts in parallel (faster)
  - Start uploading before knowing total size
```

---

## 5. Distributed File Systems (GFS/HDFS)

### Google File System (GFS) Architecture

```
┌───────────────────────────────────────────────────────┐
│                     GFS Client                        │
│  (talks to master for metadata, chunkservers for data)│
└────────┬─────────────────────────────────┬────────────┘
         │ metadata ops                     │ data ops
         ▼                                  ▼
┌─────────────────┐                 ┌──────────────────┐
│   GFS Master    │                 │  Chunk Servers   │
│ (single, with   │                 │  (hundreds)      │
│  shadow master) │                 │                  │
│                 │                 │  ┌────────────┐  │
│ • File → chunk  │                 │  │  Chunk 1   │  │
│   mapping       │                 │  │  (64 MB)   │  │
│ • Chunk →       │                 │  ├────────────┤  │
│   location      │                 │  │  Chunk 2   │  │
│ • Namespace     │                 │  │  (64 MB)   │  │
│ • Access control│                 │  └────────────┘  │
└─────────────────┘                 └──────────────────┘

Key design decisions:
  - 64 MB chunk size (large! reduces metadata size)
  - 3x replication per chunk
  - Master is SPOF → shadow master for failover
  - Optimized for append-heavy workloads
```

### HDFS (Hadoop Distributed File System)

```
Open-source implementation inspired by GFS:
  GFS Master   → HDFS NameNode
  Chunk Server → HDFS DataNode
  Chunk        → Block (128 MB default)
  
  Same architecture: single NameNode + many DataNodes
  Federation: Multiple NameNodes, each managing a namespace portion
  HA: Active+Standby NameNode with shared edit log (JournalNode)
```

---

## 6. Data Integrity & Durability

### Replication vs Erasure Coding

<abbr title="Erasure coding: split data into data+parity chunks so the original can be reconstructed if some chunks are lost. Lower storage overhead than full replication.">Erasure coding</abbr> trades CPU and rebuild time for cheaper storage.

```
3x Replication:
  Object (1 MB) → 3 copies → 3 MB total storage
  Can lose 2 copies and survive
  Storage overhead: 200%

Erasure Coding (e.g., Reed-Solomon 6+3):
  Object (1 MB) → split into 6 data + 3 parity chunks
  Can lose any 3 chunks and reconstruct
  Storage overhead: 50% (vs 200% for replication)
  
  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
  │ D1 │ D2 │ D3 │ D4 │ D5 │ D6 │ P1 │ P2 │ P3 │
  └────┴────┴────┴────┴────┴────┴────┴────┴────┘
    Data chunks (6)         Parity chunks (3)
    
  Any 6 of 9 chunks → reconstruct original data
```

### Checksums

```
Write:
  1. Compute checksum (CRC-32, MD5, SHA-256) of object
  2. Store checksum alongside object
  3. Replicate both

Read:
  1. Read object from disk
  2. Recompute checksum
  3. Compare with stored checksum
  4. If mismatch → bit rot detected → read from replica
  
Scrubbing:
  Background process periodically reads all objects,
  verifies checksums, and repairs corrupted copies.
```

---

## 7. Content Addressing & Deduplication

### <abbr title="Content-addressable storage (CAS): store objects by their content hash so identical content maps to the same address.">Content-Addressable Storage (CAS)</abbr>

```
Instead of naming objects by path, name them by content hash:

  file.jpg → SHA-256 → "a1b2c3d4e5f6..."
  Store as: /a1/b2/c3d4e5f6...

Benefits:
  - Same content always has same address (deduplication)
  - Integrity is trivially verifiable
  - Immutable by definition

Used by: Git, Docker image layers, IPFS.
```

### Deduplication

```
Without dedup:                    With dedup:
  User A uploads photo.jpg (5MB)   User A uploads → hash → store (5MB)
  User B uploads same photo (5MB)  User B uploads → hash → already exists!
  Total: 10 MB                     Total: 5 MB + reference
  
Levels:
  - File-level: Compare whole file hashes
  - Block-level: Split files into blocks, dedup blocks individually
  - Byte-level: Variable-length chunking (Rabin fingerprint)
```

---

## 8. Design Patterns

### Pattern 1: Media Upload Service

```
┌──────┐   1. Request   ┌───────────┐  2. Generate  ┌──────────┐
│Client│──────────────►│ API Server│─────────────►│ S3       │
│      │               │           │ pre-signed URL│          │
│      │◄──────────────│           │               │          │
│      │  3. Pre-signed │           │               │          │
│      │     URL        │           │               │          │
│      │               │           │               │          │
│      │────────────────────────────────────────────►│          │
│      │  4. Direct upload to S3 (bypasses server!)│          │
└──────┘               └───────────┘               └──────────┘
                            │
                       5. S3 event → Lambda → generate thumbnails
                            │
                       6. Update DB with object metadata
```

### Pattern 2: Large File Upload with Resume

```
1. Client requests upload session (POST /uploads)
2. Server returns upload_id + chunk size
3. Client splits file into chunks
4. For each chunk:
   - PUT /uploads/{id}/parts/{n} with chunk data
   - Server stores chunk, returns ETag
5. After all parts: POST /uploads/{id}/complete
6. Server assembles final object

Resume after failure:
  - GET /uploads/{id} → returns list of received parts
  - Client resumes from first missing part
```

### Pattern 3: CDN Integration

```
User → CDN edge → Cache HIT? → Return cached object
                → Cache MISS → Fetch from S3 origin → Cache it → Return

  URL: https://cdn.example.com/images/profile/user123.jpg
  
  CDN caches objects at edge locations worldwide.
  TTL-based invalidation or explicit cache purge.
  Origin shield: Additional cache layer to reduce origin load.
```

---

## 9. Comparison & Trade-offs

### When to Use What

```
Images, videos, static assets?
  └── Object storage (S3/GCS) + CDN

Database storage (EBS volumes)?
  └── Block storage

Shared file access across servers?
  └── File storage (NFS/EFS)

Big data processing (Hadoop/Spark)?
  └── HDFS or S3 (with connectors)

Archive / compliance (7+ year retention)?
  └── S3 Glacier Deep Archive
```

### Cost Comparison (approximate)

| Storage Type      | $/GB/month | Read Latency | Write Latency |
|------------------|-----------|-------------|--------------|
| Block (SSD)      | $0.10     | < 1 ms      | < 1 ms       |
| Block (HDD)      | $0.045    | ~10 ms      | ~10 ms       |
| Object (Standard)| $0.023    | ~50-200 ms  | ~100-500 ms  |
| Object (IA)      | $0.0125   | ~50-200 ms  | ~100-500 ms  |
| Object (Archive) | $0.004    | minutes-hrs | ~100-500 ms  |
| File (NFS/EFS)   | $0.30     | < 10 ms     | < 10 ms      |

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Object storage is the default for unstructured data | S3/GCS for media, logs, backups, data lakes |
| Flat namespace, not hierarchical | "folder/file.jpg" is just a key string |
| Pre-signed URLs bypass your servers | Let clients upload/download directly to S3 |
| Erasure coding saves cost at scale | 50% overhead vs 200% for 3x replication |
| Multipart upload for large files | Parallel, resumable, required for > 5 GB |
| Always integrate with CDN for reads | Cache popular objects at edge locations |
| Lifecycle rules reduce costs | Auto-archive old data to Glacier |
| S3 has strong consistency now | Read-after-write consistency since Dec 2020 |
| Content addressing enables dedup | Same content → same key → store once |
