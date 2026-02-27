# CS75 Lecture 9 - Scalability and Deployment of Web Applications

> **Source:** Harvard CS75 (Building Dynamic Websites) - [Lecture 9 by David Malan](https://www.youtube.com/watch?v=-W9F__D3oY4)

---

## Table of Contents

1. [Web Hosting Foundations](#1-web-hosting-foundations)
2. [Approaches to Scaling](#2-approaches-to-scaling)
3. [Distributing Traffic (Load Balancing)](#3-distributing-traffic-load-balancing)
4. [Session Management](#4-session-management)
5. [Data Storage & Redundancy](#5-data-storage--redundancy)
6. [Database Scalability & Replication](#6-database-scalability--replication)
7. [Performance Optimization (Caching)](#7-performance-optimization-caching)
8. [PHP Performance & Accelerators](#8-php-performance--accelerators)
9. [Global Architecture, High Availability & Security](#9-global-architecture-high-availability--security)
10. [Key Insights & Takeaways](#10-key-insights--takeaways)

---

## 1. Web Hosting Foundations

When you move a web application from your local machine to the internet, you need to choose where it lives. There are three primary tiers of hosting.

### Shared Hosting

Multiple customers share a **single physical server** (CPU, RAM, disk).

- **How it works:** Your website's files sit alongside dozens (or hundreds) of other customers' files on the same machine. The OS schedules resources between all of you.
- **Pros:** Very cheap (a few dollars/month).
- **Cons:** **Resource contention** -- if another customer's site gets a traffic spike, your site slows down. The provider advertises "unlimited" resources, but it's a shared pool.

```
┌─────────────────────────────────────────┐
│           Physical Server               │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Site A  │ │ Site B  │ │ Site C  │   │
│  │ (You)   │ │ (Other) │ │ (Other) │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│       ↕ Shared CPU, RAM, Disk ↕         │
└─────────────────────────────────────────┘
```

**Example:** DreamHost offers "unlimited bandwidth" shared hosting. If your neighbor site gets slashdotted, your site response times go from 200ms to 5+ seconds.

### Virtual Private Server (VPS)

A **virtual machine** on a shared physical box that gives you an isolated operating system.

- **How it works:** A hypervisor (e.g., VMware, KVM) divides the physical machine into multiple VMs. Each VM gets a dedicated slice of CPU, RAM, and disk.
- **Pros:** You get root access to your own OS (e.g., Ubuntu). Your resources are isolated from other tenants.
- **Cons:** The hosting provider still has access to the underlying hardware. You're limited to the resources of one physical machine.

```
┌──────────────────────────────────────────┐
│         Physical Server + Hypervisor     │
│                                          │
│  ┌──────────┐  ┌──────────┐             │
│  │  VM 1    │  │  VM 2    │             │
│  │ (You)    │  │ (Other)  │             │
│  │ Ubuntu   │  │ CentOS   │             │
│  │ 2GB RAM  │  │ 4GB RAM  │             │
│  └──────────┘  └──────────┘             │
└──────────────────────────────────────────┘
```

**Example:** A Linode VPS with 4GB RAM and 2 CPU cores costs ~$20/month. You install Apache, PHP, MySQL yourself and have full control.

### Cloud / Self-Service (e.g., AWS EC2)

Spawn virtual machines **on demand** and pay by the minute/hour.

- **How it works:** Through a web console or API, you launch instances of varying sizes. You can auto-scale: spin up 10 servers during peak traffic, and terminate 8 of them at night.
- **Pros:** Elastic scaling, pay only for what you use, global data center presence.
- **Cons:** Complexity increases; you manage more infrastructure. Costs can balloon if not monitored.

**Example:** You run an e-commerce site. On Black Friday, traffic jumps 10x. An auto-scaling group on AWS EC2 detects high CPU usage and launches additional instances within minutes. After the rush, instances are terminated automatically.

---

## 2. Approaches to Scaling

Once your single server can't handle the load, you have two fundamental strategies.

### Vertical Scaling (Scaling Up)

Upgrade a single machine's hardware to make it more powerful.

| Component | Upgrade Path |
|-----------|-------------|
| **CPU** | Single-core -> Multi-core -> More cores |
| **RAM** | 1GB -> 4GB -> 16GB -> 64GB -> 512GB |
| **Disk** | SATA (7,200 RPM) -> SAS (15,000 RPM) -> SSD (Flash) |

#### Disk Speed Comparison

| Type | Speed | Cost | Typical Use |
|------|-------|------|-------------|
| **SATA** | 7,200 RPM, ~100 MB/s sequential | Low | Bulk storage, backups |
| **SAS** | 15,000 RPM, ~200 MB/s sequential | Medium | Database servers |
| **SSD** | No moving parts, ~500+ MB/s sequential | High | High-performance databases, caching |

**The Ceiling Problem:** There is a hard technological and financial limit. The most powerful single server money can buy (e.g., a $50,000 machine with 1TB RAM) will eventually be outgrown. You can't vertically scale forever.

**Example:** Your MySQL database server is hitting 95% CPU. You upgrade from 4 cores to 16 cores and add 32GB of RAM. This buys you time, but eventually even 16 cores won't be enough.

### Horizontal Scaling (Scaling Out)

Add **multiple, cheaper servers** and distribute the load across them.

```
                    ┌──────────┐
                    │  Load    │
           ┌──────>│ Balancer │<──────┐
           │       └──────────┘       │
           │            │             │
     ┌─────┴───┐  ┌────┴────┐  ┌─────┴───┐
     │ Server 1│  │ Server 2│  │ Server 3│
     │ (Cheap) │  │ (Cheap) │  │ (Cheap) │
     └─────────┘  └─────────┘  └─────────┘
```

- **Pros:** Near-infinite scalability. Add more commodity servers as needed. If one server dies, others continue serving.
- **Cons:** Introduces **complexity** -- you now need load balancing, session management, data consistency, and more.

**Example:** Instead of one $50,000 server, you buy ten $5,000 servers. Each handles 1/10th of the traffic. When traffic doubles, you add 10 more.

---

## 3. Distributing Traffic (Load Balancing)

Once you have multiple servers, you need a way to decide which server handles each incoming request.

### Approach 1: DNS Round-Robin

The DNS server (e.g., BIND) is configured with multiple A records for the same domain. It returns a different IP for each sequential DNS query.

```
$ nslookup www.example.com
;; First query:
Answer: 1.2.3.4

$ nslookup www.example.com
;; Second query:
Answer: 5.6.7.8

$ nslookup www.example.com
;; Third query:
Answer: 9.10.11.12
```

**DNS Zone File Example:**
```
www.example.com.  IN  A  1.2.3.4
www.example.com.  IN  A  5.6.7.8
www.example.com.  IN  A  9.10.11.12
```

**Drawbacks:**
- **Caching:** Browsers and operating systems cache DNS responses based on the TTL (Time To Live). Even if you set TTL to 0, many resolvers ignore it. A user may be stuck hitting the same server for hours.
- **No health awareness:** If Server 2 crashes, DNS keeps handing out its IP. Users hitting that IP get errors.
- **Uneven distribution:** Since users stay on cached IPs, one server might get 60% of traffic while another gets 10%.

### Approach 2: Dedicated Load Balancer

A single entry point (hardware or software) that sits between the internet and your backend servers.

```
   Internet
      │
      ▼
┌──────────────┐    Public IP: 74.125.224.72
│ Load Balancer│
└──────┬───────┘
       │
  ┌────┼──────────┐
  ▼    ▼          ▼
┌───┐ ┌───┐    ┌───┐
│S1 │ │S2 │    │S3 │     Private IPs: 192.168.1.x
└───┘ └───┘    └───┘
```

- **Hardware:** F5 BIG-IP, Cisco ACE (expensive, high performance).
- **Software:** HAProxy, Nginx, AWS ELB (cheaper, flexible).
- The load balancer holds the **public IP**. Backend servers use **private IPs** (e.g., `10.0.0.x`, `192.168.x.x`), invisible to the outside world.

**Routing Strategies:**

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| **Round-Robin** | Rotate through servers sequentially | Equal-capacity servers, stateless requests |
| **Least Connections** | Send to server with fewest active connections | Varying request durations |
| **Least Load / CPU** | Send to server with most available CPU cycles | CPU-intensive workloads |
| **IP Hash** | Hash the client IP to consistently pick a server | Primitive session affinity |
| **Weighted** | Assign weights to servers (more powerful = higher weight) | Mixed hardware capacity |

**HAProxy Configuration Example:**
```
frontend http_front
    bind *:80
    default_backend web_servers

backend web_servers
    balance roundrobin
    server web1 192.168.1.10:80 check
    server web2 192.168.1.11:80 check
    server web3 192.168.1.12:80 check
```

The `check` keyword tells HAProxy to periodically probe each server. If a server fails the health check, HAProxy stops routing traffic to it.

### Active-Active Load Balancers (Eliminating the SPOF)

A single load balancer is itself a **Single Point of Failure (SPOF)**. Solution: deploy two (or more) load balancers.

```
         Internet
            │
     ┌──────┴──────┐
     ▼              ▼
┌─────────┐   ┌─────────┐
│  LB 1   │◄─►│  LB 2   │   Heartbeat
│ (Active) │   │ (Active) │   between them
└────┬─────┘   └────┬─────┘
     │              │
     └──────┬───────┘
            ▼
     Backend Servers
```

- **Heartbeats:** Each load balancer periodically sends a "I'm alive" signal to the other.
- **Active-Active:** Both serve traffic simultaneously. If one dies, the other absorbs 100% of the traffic.
- **Active-Passive:** One serves traffic, the other is on standby. If the active one fails, the passive one takes over (slightly simpler but wastes capacity).

**Example:** You have two HAProxy instances sharing a Virtual IP (VIP) via `keepalived`. If HAProxy-1's heartbeat stops, `keepalived` migrates the VIP to HAProxy-2 within seconds.

---

## 4. Session Management

### The Problem

HTTP is stateless. When a user logs in, the server creates a session (e.g., a PHP `$_SESSION`). By default, PHP stores this session as a file on the **local disk** of the server that handled the login request.

```
1. User logs in → Request hits Server A → Session file created on Server A
2. User clicks a link → Load balancer sends request to Server B
3. Server B checks for session → NOT FOUND → User appears logged out!
```

### Solution 1: Sticky Sessions

The load balancer inserts a **cookie** into the user's browser that identifies which backend server they belong to. All subsequent requests from that user are routed to the same server.

```
HTTP/1.1 200 OK
Set-Cookie: SERVERID=server-a; Path=/; HttpOnly; Secure
```

- **Pros:** Simple. No changes needed on the application side.
- **Cons:** If Server A crashes, all users "stuck" to it lose their sessions. Load can become uneven if many heavy users happen to land on the same server.

### Solution 2: Shared Session Storage

Factor sessions **out** of individual web servers and store them in a shared location.

```
┌───────┐  ┌───────┐  ┌───────┐
│ Web 1 │  │ Web 2 │  │ Web 3 │
└───┬───┘  └───┬───┘  └───┬───┘
    │          │          │
    └──────────┼──────────┘
               ▼
      ┌────────────────┐
      │ Session Store  │
      │ (DB / Redis /  │
      │  File Server)  │
      └────────────────┘
```

**Options:**
- **Shared file server (NFS):** All web servers mount the same network directory for session files.
- **Database (MySQL):** Store sessions in a `sessions` table.
- **In-memory store (Redis / Memcached):** Fastest option. Sessions live in RAM.

**Tradeoff:** The shared session store becomes a new SPOF. You must make it redundant (e.g., Redis with a replica, a RAID-backed file server, or a replicated database).

**PHP Configuration Example (Redis sessions):**
```ini
; php.ini
session.save_handler = redis
session.save_path = "tcp://192.168.1.50:6379"
```

Now any web server can read/write sessions from the same Redis instance.

---

## 5. Data Storage & Redundancy

### RAID (Redundant Array of Independent Disks)

RAID combines multiple physical disks into a single logical unit for performance, redundancy, or both.

#### RAID 0 -- Striping

```
┌──────────┐  ┌──────────┐
│  Disk 1  │  │  Disk 2  │
│ Block A  │  │ Block B  │
│ Block C  │  │ Block D  │
└──────────┘  └──────────┘
```

- Data is split across drives. Writing "ABCD" puts A,C on Disk 1 and B,D on Disk 2.
- **Speed:** 2x read/write (both disks work in parallel).
- **Redundancy:** ZERO. If either disk fails, **all data is lost**.
- **Use case:** Temporary data, scratch disks where speed matters and loss is acceptable.

#### RAID 1 -- Mirroring

```
┌──────────┐  ┌──────────┐
│  Disk 1  │  │  Disk 2  │
│ Block A  │  │ Block A  │  ← Identical copy
│ Block B  │  │ Block B  │
└──────────┘  └──────────┘
```

- Every write goes to both disks simultaneously.
- **Speed:** Read speed can be 2x (read from either disk). Write speed is the same as a single disk.
- **Redundancy:** Full. One disk can fail completely and you lose nothing.
- **Cost:** 50% storage overhead (2 drives store 1 drive's worth of data).
- **Use case:** OS drives, critical databases where data loss is unacceptable.

#### RAID 5 -- Striping with Distributed Parity

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Disk 1  │  │  Disk 2  │  │  Disk 3  │
│ Block A  │  │ Block B  │  │ Parity(AB)│
│ Parity(CD)│ │ Block C  │  │ Block D  │
└──────────┘  └──────────┘  └──────────┘
```

- Requires **3+ drives**. Parity data is distributed across all drives.
- **Speed:** Good read speed; write speed is slower due to parity calculations.
- **Redundancy:** Can survive **one** drive failure. The missing data is reconstructed from parity.
- **Capacity:** You lose one drive's worth of space to parity (3 x 1TB = 2TB usable).
- **Use case:** General-purpose server storage, file servers.

#### RAID 6 -- Double Parity

- Like RAID 5 but with **two** sets of parity data.
- Can survive **two simultaneous** drive failures.
- Requires **4+ drives**. You lose 2 drives' worth of capacity.
- **Use case:** Large arrays where the probability of a second failure during rebuild is significant.

#### RAID 10 (1+0) -- Mirroring + Striping

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Disk 1  │  │  Disk 2  │  │  Disk 3  │  │  Disk 4  │
│ Block A  │  │ Block A  │  │ Block B  │  │ Block B  │
│  (mirror pair 1)       │  │  (mirror pair 2)       │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
              Striped across mirror pairs
```

- Combines the speed of RAID 0 with the safety of RAID 1.
- Requires **4+ drives** (minimum). 50% storage overhead.
- **Speed:** Excellent read and write performance.
- **Redundancy:** Can survive one failure per mirror pair.
- **Use case:** High-performance databases (MySQL on RAID 10 is a common pattern).

#### RAID Comparison Table

| RAID Level | Min Drives | Speed | Redundancy | Usable Capacity | Best For |
|------------|-----------|-------|------------|-----------------|----------|
| **0** | 2 | Fastest | None | 100% | Temp/scratch data |
| **1** | 2 | Good read | Full mirror | 50% | OS, small critical DBs |
| **5** | 3 | Good read, slower write | 1 drive failure | (N-1)/N | File servers, general use |
| **6** | 4 | Good read, slower write | 2 drive failures | (N-2)/N | Large arrays |
| **10** | 4 | Excellent | 1 per mirror pair | 50% | High-perf databases |

### MySQL Storage Engines

MySQL supports pluggable storage engines, each optimized for different use cases.

| Engine | Key Feature | Locking | Transactions | Best For |
|--------|------------|---------|-------------|----------|
| **InnoDB** | Default engine, ACID compliant | Row-level | Yes | General purpose, transactional apps |
| **MyISAM** | Older engine | Full table lock | No | Read-heavy legacy workloads |
| **Memory/Heap** | Stores data entirely in RAM | Table-level | No | Temp tables, blazing-fast lookups |
| **Archive** | Heavy compression | Row-level (insert) | No | Logs, audit trails, write-once data |

**Example - Choosing the right engine:**
```sql
-- Transactional e-commerce orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Append-only access log (compressed, rarely queried)
CREATE TABLE access_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45),
    path VARCHAR(255),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=Archive;

-- Temporary lookup cache (fast, but lost on restart)
CREATE TABLE temp_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value TEXT
) ENGINE=Memory;
```

**Key Insight:** Memory/Heap tables are incredibly fast but all data is **lost if the server restarts or loses power**. Only use them for data you can regenerate.

---

## 6. Database Scalability & Replication

### Master-Slave Replication

```
    ┌──────────┐
    │  Master  │ ← All WRITES go here
    │ (Read +  │
    │  Write)  │
    └────┬─────┘
         │  Replication (async)
    ┌────┴─────────────┐
    ▼                  ▼
┌──────────┐    ┌──────────┐
│  Slave 1 │    │  Slave 2 │ ← READS distributed here
│ (Read)   │    │ (Read)   │
└──────────┘    └──────────┘
```

- **Writes** go to the master. The master **replicates** changes to one or more slaves asynchronously.
- **Reads** are distributed across slaves.
- Great for **read-heavy workloads** (which most web apps are -- think Facebook: lots of reads of news feeds, few writes of new posts).

**MySQL Replication Config Example (Master):**
```ini
# my.cnf on master
[mysqld]
server-id = 1
log-bin = mysql-bin
binlog-do-db = myapp_production
```

**Tradeoffs:**
- **Replication lag:** Slaves may be slightly behind the master. A user writes data, then immediately reads it back -- the slave might not have the update yet.
- **Master is a SPOF:** If the master dies, writes stop. You must manually or automatically **promote** a slave to master (failover).

### Master-Master Replication

```
┌──────────┐         ┌──────────┐
│ Master 1 │◄───────►│ Master 2 │
│ (Read +  │  Sync   │ (Read +  │
│  Write)  │         │  Write)  │
└──────────┘         └──────────┘
```

- **Both** databases accept writes and replicate to each other.
- Eliminates the master as a single point of failure.
- **Complexity:** Conflict resolution is harder. What if both masters update the same row simultaneously? Requires careful application design (e.g., auto-increment offsets, conflict resolution logic).

**Example:** Master 1 uses odd auto-increment IDs (1, 3, 5...) and Master 2 uses even IDs (2, 4, 6...) to avoid primary key collisions.

```ini
# Master 1
auto_increment_offset = 1
auto_increment_increment = 2

# Master 2
auto_increment_offset = 2
auto_increment_increment = 2
```

### Database Partitioning (Sharding)

Divide a massive database across multiple servers based on specific criteria.

```
┌─────────────┐
│   Router    │ ← Looks at last name
└──────┬──────┘
       │
  ┌────┴────┐
  ▼         ▼
┌──────┐  ┌──────┐
│ DB 1 │  │ DB 2 │
│ A-M  │  │ N-Z  │
└──────┘  └──────┘
```

**Partitioning Strategies:**

| Strategy | How | Example |
|----------|-----|---------|
| **Range-based** | Divide by ranges of a key | Users A-M on Shard 1, N-Z on Shard 2 |
| **Hash-based** | Hash a key, mod by shard count | `hash(user_id) % 4` determines shard |
| **Geographic** | Route by user location | US users on US shard, EU users on EU shard |

**Tradeoffs:**
- Queries that span multiple shards (e.g., "find all users") become expensive.
- Rebalancing shards when data grows unevenly is complex.

---

## 7. Performance Optimization (Caching)

Caching is the single most impactful optimization for read-heavy web applications.

### Level 1: MySQL Query Cache

MySQL can cache the result of a `SELECT` query. If the same query is issued again and the underlying tables haven't changed, it returns the cached result instantly.

```sql
-- First execution: ~50ms (hits disk)
SELECT * FROM products WHERE category = 'electronics';

-- Second execution: ~0.1ms (served from query cache)
SELECT * FROM products WHERE category = 'electronics';
```

**Limitation:** The query cache is invalidated on **any** write to the table. For write-heavy workloads, the cache thrashes constantly and provides little benefit.

### Level 2: File-Based Caching (Page Caching)

Generate the HTML output once (from PHP + MySQL), save it as a static `.html` file, and serve that file directly for subsequent requests.

```
First request:
  User → Apache → PHP → MySQL → Generate HTML → Save to /cache/home.html → Return

Subsequent requests:
  User → Apache → Serve /cache/home.html directly (no PHP, no MySQL)
```

- **Pros:** Incredibly fast. Apache/Nginx serve static files with minimal overhead.
- **Cons:**
  - Consumes disk space (every unique page = a cached file).
  - Cache invalidation is hard. If you change the site's header, you must regenerate **every** cached page.
  - Not suitable for personalized content (each user sees different data).

### Level 3: In-Memory Caching (Memcached / Redis)

Store the results of expensive database queries (or computed objects) in **RAM** as key-value pairs.

```
┌─────────┐     ┌────────────┐     ┌──────────┐
│ Web App │────►│ Memcached  │     │ Database │
│ (PHP)   │     │ (RAM Cache)│     │ (MySQL)  │
└─────────┘     └────────────┘     └──────────┘
      │                │                 │
      │  1. Check cache │                │
      │───────────────►│                 │
      │  2. Cache HIT? │                 │
      │◄───────────────│                 │
      │                │                 │
      │  3. Cache MISS?│  4. Query DB    │
      │                │                 │
      │────────────────────────────────►│
      │  5. Get result                   │
      │◄────────────────────────────────│
      │  6. Store in cache              │
      │───────────────►│                │
```

**PHP + Memcached Example:**
```php
$memcached = new Memcached();
$memcached->addServer('192.168.1.50', 11211);

$key = 'user_profile_12345';
$profile = $memcached->get($key);

if ($profile === false) {
    // Cache MISS: query the database
    $profile = $db->query("SELECT * FROM users WHERE id = 12345");

    // Store in cache for 5 minutes (300 seconds)
    $memcached->set($key, $profile, 300);
}

// Use $profile (from cache or DB)
```

**Garbage Collection / Eviction:**
- Memcached has finite RAM (e.g., 64MB, 1GB).
- When the cache is full, it uses **LRU (Least Recently Used)** eviction: the oldest, least-accessed entries are removed to make room for new ones.
- You can also set explicit TTLs (Time To Live) on each cache entry.

**Real-World Usage:** Facebook used Memcached extensively, running thousands of Memcached servers with terabytes of RAM to avoid hitting their MySQL databases on every page load.

---

## 8. PHP Performance & Accelerators

### The Problem

PHP is an interpreted language. On every HTTP request:
1. Apache receives the request.
2. PHP reads the `.php` file from disk.
3. PHP **parses and compiles** it into opcodes (bytecode).
4. PHP **executes** the opcodes.
5. The result is returned to Apache and sent to the user.

Steps 2 and 3 happen on **every single request**, even though the code hasn't changed.

### The Solution: Opcode Caching

A **PHP accelerator** (e.g., OPcache, APC, XCache) caches the compiled opcodes in shared memory.

```
Without accelerator:
  Request → Read .php → Parse → Compile → Execute → Response
  Request → Read .php → Parse → Compile → Execute → Response  (repeated!)

With accelerator:
  Request → Read .php → Parse → Compile → Cache opcodes → Execute → Response
  Request → Load cached opcodes → Execute → Response  (skip parse/compile!)
```

- **Performance gain:** Typically **2-5x faster** response times with zero code changes.
- **Configuration (OPcache in php.ini):**

```ini
[opcache]
opcache.enable=1
opcache.memory_consumption=128
opcache.max_accelerated_files=10000
opcache.revalidate_freq=60   ; Check for file changes every 60 seconds
```

**Caveat:** After deploying new code, the cache must be invalidated. Either restart PHP-FPM, or wait for `revalidate_freq` to expire.

---

## 9. Global Architecture, High Availability & Security

### High Availability (HA)

The goal: **no single component failure should take down the entire system.**

```
                        Internet
                           │
                    ┌──────┴──────┐
                    ▼              ▼
              ┌─────────┐   ┌─────────┐
              │  LB 1   │◄─►│  LB 2   │  ← Heartbeat
              └────┬────┘   └────┬────┘
                   │             │
          ┌────────┼─────────────┼────────┐
          ▼        ▼             ▼        ▼
       ┌─────┐ ┌─────┐      ┌─────┐ ┌─────┐
       │Web 1│ │Web 2│      │Web 3│ │Web 4│
       └──┬──┘ └──┬──┘      └──┬──┘ └──┬──┘
          │       │             │       │
          └───────┼─────────────┼───────┘
                  ▼             ▼
            ┌──────────┐ ┌──────────┐
            │ Master 1 │►│ Master 2 │  ← DB Replication
            │   (DB)   │◄│   (DB)   │
            └──────────┘ └──────────┘
```

Every layer has redundancy:
- **Load Balancers:** Active-Active pair with heartbeat.
- **Web Servers:** Multiple stateless servers behind the LB.
- **Databases:** Master-Master replication (or Master-Slave with automatic failover).

### Physical Network Redundancy

It's not enough to have multiple servers -- you must eliminate SPOFs at the **cable and switch level**.

```
┌──────────┐          ┌──────────┐
│ Switch A │◄────────►│ Switch B │
└───┬──┬───┘          └───┬──┬───┘
    │  │                  │  │
    │  └──────┐     ┌─────┘  │
    │         │     │        │
┌───┴───┐ ┌──┴─────┴──┐ ┌───┴───┐
│  LB 1 │ │  Server 1  │ │  LB 2 │
│(2 NICs)│ │ (2 NICs)   │ │(2 NICs)│
└────────┘ └────────────┘ └────────┘
```

- Every server and load balancer has **at least two ethernet cables** plugged into **different physical switches**.
- Switches are connected to each other (stacked/bonded).
- If Switch A fails, all devices remain reachable through Switch B.

### Availability Zones (Geographic Redundancy)

Scale across multiple data centers in different geographic regions.

```
        Global DNS Load Balancer
               │
     ┌─────────┼─────────┐
     ▼                    ▼
┌──────────┐       ┌──────────┐
│ US-East  │       │ EU-West  │
│ Data     │       │ Data     │
│ Center   │       │ Center   │
└──────────┘       └──────────┘
```

- **DNS-based global load balancing** routes users to the nearest (or healthiest) data center.
- If an earthquake knocks out US-East, DNS reroutes all traffic to EU-West.
- Data must be replicated across regions (adds latency to writes).

### Firewalls & Security

Apply the **principle of least privilege**: only open the ports that are absolutely necessary.

| Port | Protocol | Purpose | Exposure |
|------|---------|---------|----------|
| **80** | TCP (HTTP) | Web traffic | Public (internet-facing) |
| **443** | TCP (HTTPS) | Encrypted web traffic | Public (internet-facing) |
| **22** | TCP (SSH) | Admin access | Restricted (VPN or specific IPs only) |
| **3306** | TCP (MySQL) | Database traffic | Internal only (never exposed to internet) |

**Firewall Rules Example (iptables):**
```bash
# Allow HTTP and HTTPS from anywhere
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow SSH only from office IP
iptables -A INPUT -p tcp --dport 22 -s 203.0.113.50 -j ACCEPT

# Allow MySQL only from web servers (internal network)
iptables -A INPUT -p tcp --dport 3306 -s 192.168.1.0/24 -j ACCEPT

# Drop everything else
iptables -A INPUT -j DROP
```

### SSL Termination

HTTPS encryption/decryption is CPU-intensive. Instead of making every web server handle SSL, **terminate SSL at the load balancer**.

```
   Client ──── HTTPS (encrypted) ────► Load Balancer
                                            │
                                     SSL Terminated here
                                            │
                                  HTTP (unencrypted) ────► Web Servers
                                  (over secure internal network)
```

- **The load balancer** handles the expensive cryptographic operations (TLS handshake, decryption).
- **Backend web servers** receive plain HTTP, reducing their CPU load.
- This is safe because traffic between the LB and web servers travels over a **private, trusted internal network**.

**Nginx SSL Termination Example:**
```nginx
server {
    listen 443 ssl;
    server_name www.example.com;

    ssl_certificate     /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    location / {
        proxy_pass http://backend_servers;  # Plain HTTP to backends
    }
}
```

---

## 10. Key Insights & Takeaways

1. **There is no silver bullet.** Every solution introduces new complexity or potential failure points. Architecture is about **trade-offs**.

2. **Vertical scaling is simple but limited.** It's a good starting point, but you will eventually hit a ceiling that only horizontal scaling can solve.

3. **Horizontal scaling introduces distributed systems problems.** You must deal with load balancing, session management, data consistency, and partial failures.

4. **Load balancing is the gateway to horizontal scaling.** DNS round-robin is a cheap hack; dedicated load balancers (HAProxy, Nginx, AWS ELB) are the production solution.

5. **Sessions are the first thing that breaks** in a multi-server setup. Use sticky sessions as a quick fix or shared session storage (Redis/Memcached) for a proper solution.

6. **Redundancy must exist at every layer:** servers, load balancers, databases, network switches, data centers. A chain is only as strong as its weakest link.

7. **Caching is the biggest performance lever.** Memcached/Redis can reduce database load by 90%+ for read-heavy workloads. Cache at every layer: opcode caching (PHP), query caching (MySQL), object caching (Memcached), page caching (static HTML).

8. **Database replication** (Master-Slave for reads, Master-Master for availability) is essential for both performance and fault tolerance.

9. **Security is not optional.** Firewall aggressively, use SSL/TLS, follow least privilege, and keep database ports off the public internet.

10. **Cloud platforms (AWS, GCP, Azure)** provide building blocks for all of the above (ELB, RDS, ElastiCache, auto-scaling groups), but you still need to understand the underlying principles to use them correctly.

---

## Quick Reference: Architecture Evolution

```
Stage 1: Single Server
  [User] → [One Server: Web + DB + Files]

Stage 2: Separate Database
  [User] → [Web Server] → [Database Server]

Stage 3: Load Balancer + Multiple Web Servers
  [User] → [Load Balancer] → [Web 1, Web 2, Web 3] → [Database]

Stage 4: Caching Layer
  [User] → [LB] → [Web Servers] → [Memcached] → [Database]

Stage 5: Database Replication
  [User] → [LB] → [Web Servers] → [Cache] → [Master DB + Slave DBs]

Stage 6: Full Redundancy
  [User] → [DNS GLB] → [LB Pair] → [Web Servers] → [Cache Cluster]
                                                    → [DB Master-Master]
                                                    → [Multiple Data Centers]
```


