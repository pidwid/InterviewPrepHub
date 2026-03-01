# Design Dropbox / Google Drive

Dropbox is a cloud-based file storage and synchronization service. It gives users a designated folder on their computer/mobile device, which is then synchronized across all their devices and the cloud.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What are the absolute core features we need to support in this interview?
**Interviewer:** Focus on file upload/download, automatic synchronization across multiple devices for a single user, and basic file versioning.

**Candidate:** Which clients should we support?
**Interviewer:** Desktop clients (Windows/Mac) and a web app.

**Candidate:** Do we need to encrypt the files?
**Interviewer:** Yes, files must be encrypted at rest and ideally in transit.

**Candidate:** What is the scale of the system?
**Interviewer:** 50 million registered users, 10 million daily active users (DAU). 

### Functional Requirements
- **Upload / Download:** Users can store files in the cloud and retrieve them.
- **Cross-device Sync:** If a user edits a file on their laptop, the change should automatically seamlessly sync to their desktop.
- **Versioning:** Users can view the history of a file and restore previous versions.
- **Large Files Support:** The system should handle files up to 50GB gracefully without breaking the network.

### Non-Functional Requirements
- **High Reliability:** Files should *never* be lost. Data durability is paramount.
- **High Availability:** Users should be able to access files anytime.
- **Bandwidth/Storage Efficiency:** Syncing large files repeatedly is expensive. Network usage must be heavily optimized so users' internet connections don't bottleneck.
- **ACIDity for Metadata:** File metadata operations (renaming, moving a folder) must have strong consistency.

### Back-of-the-Envelope Estimation
- **Users:** 50M total users, 10M DAU.
- **File Volume:** Assume each user has an average of 200 files. Total files = 10 Billion files.
- **Storage:** If the average file size is 1MB, total storage = 10B * 1MB = 10 Petabytes. (Note: Since some files will be huge, actual storage will likely be well into the Exabyte range in reality).
- **QPS:** Let's assume a user makes 5 updates per day. 10M DAU * 5 = 50M updates per day ~ 600 peak write QPS. Read QPS will be slightly higher for fetches.

---

## Step 2 — High-Level Design

### Core Concept: Delta Syncing (Block-Level Sync)
A naive approach would be to upload the entire 1GB video file every time a user changes a tiny piece of metadata or a few bytes. This would crush the massive bandwidth and create terrible user experiences.

Instead, we use **Block-Level Sync**. 
We split files into smaller, fixed-size chunks (e.g., 4MB blocks). 
- If a file is modified, we recalculate the hashes of its chunks. We only upload the **modified chunks** to the server.
- If a user downloads a file, they download all the required chunks and the client reassembles them.
- This saves massive amounts of network bandwidth and cloud storage space.

### System Architecture

```mermaid
graph TD
    Client[Desktop / Mobile Client]
    
    Client -- 1. Metadata Sync --> API_Meta[Metadata Service]
    Client -- 2. Chunk Upload/Download --> API_Block[Block Service]
    API_Meta -- 3. Notify Changes --> Notification[Notification Service (WebSockets)]
    Notification -- 4. Push Event --> Client2[Other Device / Client]
    
    API_Block --> S3[(Cloud Storage / S3)]
    API_Meta --> RDBMS[(Metadata SQL DB)]
```

---

## Step 3 — Design Deep Dive

### 1. The Client Application

The client app is the most complex piece of software in this system design. It lives on the user's OS and must handle offline states, network retries, and local file system monitoring.

Internal components of the Desktop Client:
- **File Watcher:** Monitors the designated OS workspace folder (via APIs like `fsevents` on Mac or `ReadDirectoryChangesW` on Windows) for creations, updates, or deletions.
- **Chunker:** When a file changes, it splits the file into 4MB chunks. It computes a cryptographic hash (like SHA-256) for each chunk.
- **Indexer:** Compares the local file/chunk hashes with the remote Metadata Service. It determines exactly *which* chunks actually need to be uploaded.
- **Internal Database:** A local SQLite db to store the state of the local files and their chunk hashes, so we don't have to recompute hashes on every boot.

### 2. Metadata Database
Since we need strong consistency for file metadata (folder structures, file names, sharing permissions), a **Relational Database (SQL)** like MySQL or PostgreSQL is highly recommended. 
If we use NoSQL, we must implement ACID transactions at the application layer (e.g., ensuring a file rename and a folder move don't conflict), which is difficult.

**Schema:**
- `Workspace` (or `Device`): `device_id`, `user_id`, `last_sync_timestamp`
- `File`: `file_id`, `user_id`, `filename`, `parent_folder_id`, `latest_version`
- `File_Version`: `version_id`, `file_id`, `updated_at`
- `Chunk`: `chunk_id`, `s3_path`, `hash`
- `File_Version_Chunks`: Mapping table linking a `version_id` to its ordered `chunk_id`s.

### 3. Block Servers (Sync Service)
The Block Server (or Object Server) handles the raw bytes of the files.
- It receives chunks from the client, stores them in Object Storage (e.g., Amazon S3), and returns success.
- **Data Deduplication:** A massive cost-saving measure. Before an upload, the client sends the SHA-256 hash of the chunk to the Block Server. The Block Server checks the database: *"Do we already have a chunk with this hash in S3?"* (Perhaps from a completely different user who uploaded the same meme). If yes, the Block Server immediately returns "Success" and just maps the new user's file version to the existing chunk in the database. The client skips the upload entirely.

### 4. Notification Service
If User A has a laptop and a phone, and they upload a file on the laptop, the phone needs to know immediately to download the new file, without the user pressing a "Sync" button.
- We cannot have millions of clients aggressively HTTP polling the servers every second. It would crash the servers.
- We use a Notification Service utilizing **Long Polling** or **WebSockets**.
- When the Metadata database is updated via the laptop, an event is sent to the Notification Service.
- The Notification Service identifies other active WebSocket connections for User A (e.g., their iPhone) and pushes a message: `"File X metadata updated"`.
- The iPhone client receives the notification, contacts the Metadata Server to get the new chunk IDs, and then contacts S3/Block Servers to download the new chunks to assemble the file.

### 5. Conflict Resolution
What happens if User A edits `report.docx` offline on their laptop, and *also* edits it offline on their desktop? When both connect to the internet, which version wins?
- The system must not quietly overwrite data. 
- Whichever device syncs first successfully saves V1. 
- When the second device attempts to sync, the Metadata Server recognizes a "revision conflict" (the client claims it is editing base V0, but the server is already at V1).
- The server saves the second upload as a branching file (e.g., `"report (Desktop's conflicted copy).docx"`) and downloads it alongside the original, forcing the user to manually merge the text.

---

## Step 4 — Wrap Up

### Trade-offs & Bottlenecks

- **Database Sharding:** As the Metadata DB grows to billions of rows, a single SQL node maxes out on CPU/Disk IO. We must shard the database. Sharding by `user_id` is the most logical choice since user workspaces are highly isolated (User A rarely queries User B's folder structures unless shared).
- **Handling Shared Folders:** Sharding by `user_id` becomes tricky when Folder A (owned by User 1) is shared with User 2, who is on a different database shard. In this case, cross-shard queries or an asynchronous replication strategy must be used to ensure User 2's shard is aware of updates to the shared folder.
- **Cold Storage for Versioning:** Saving the chunks for *every single historical save* of a file is terribly expensive. To manage costs, the system should move chunks belonging to old versions (e.g., > 30 days old) to cold storage tiers like Amazon S3 Glacier. Retrieving an old version will take longer, but this is an acceptable trade-off for infrequent operations.
- **Message Queue Decoupling:** The upload process involves two databases: S3 and the Metadata SQL DB. If S3 succeeds but the SQL insert fails, we have an orphaned chunk. Using a Message Queue (like Kafka) ensures that once a chunk is safely in S3, a persistent event is published allowing the Metadata service to retry building the file mapping until it succeeds. 

### Architecture Summary

1. The local Client monitors local files, chunks them, and hashes them.
2. The Client talks to the Metadata Service to check which chunks are actually new (global deduplication).
3. The Client pushes only the *new, un-duplicated* chunks to the Block Server, which stores them securely in S3.
4. The Client commits the "Save file" event to the Metadata SQL DB, noting the list of chunk hashes that make up this version.
5. The Metadata Service triggers the WebSocket Notification Service.
6. The Notification Service alerts the user's other online devices.
7. Those devices immediately fetch the new metadata and subsequently download the missing chunks from S3 to silently reconstruct the file in the background.