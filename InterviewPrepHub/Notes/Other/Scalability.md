Scalability and Deployment of Web Applications

> **Sources:**
> - Harvard CS75 (Building Dynamic Websites) - [Lecture 9 by David Malan](https://www.youtube.com/watch?v=-W9F__D3oY4)
> - [Scalability for Dummies](https://web.archive.org/web/20220530193911/https://www.lecloud.net/post/7295452622/scalability-for-dummies-part-1-clones) (Parts 1-4) by LeCloud

---

## Table of Contents

1. [Web Hosting Foundations](#1-web-hosting-foundations)
2. [Approaches to Scaling](#2-approaches-to-scaling)
3. [Distributing Traffic (Load Balancing)](#3-distributing-traffic-load-balancing)
4. [Session Management](#4-session-management)
5. [Data Storage & Redundancy](#5-data-storage--redundancy)
6. [Database Scalability & Replication](#6-database-scalability--replication)
7. [Performance Optimization (Caching)](#7-performance-optimization-caching)
8. [Asynchronism](#8-asynchronism)
9. [JVM Performance & Optimization](#9-jvm-performance--optimization-language-specific)
10. [Global Architecture, High Availability & Security](#10-global-architecture-high-availability--security)
11. [Key Insights & Takeaways](#11-key-insights--takeaways)

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

**Example:** A Linode VPS with 4GB RAM and 2 CPU cores costs ~$20/month. You install Nginx, Java, MySQL yourself and have full control.

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

### The Golden Rule of Scalability: Clones

> Source: [Scalability for Dummies - Part 1: Clones](https://web.archive.org/web/20220530193911/https://www.lecloud.net/post/7295452622/scalability-for-dummies-part-1-clones)

When you scale horizontally, **every server must be an identical, stateless clone.** A user hitting Server 2, then Server 9, then Server 2 again must get the exact same result every time, regardless of which server handles the request.

**The Golden Rule:** Every server contains exactly the same codebase and does **not** store any user-related data (sessions, profile pictures, uploads) on local disk or memory.

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Server 1 │ │ Server 2 │ │ Server 3 │
        │ Same Code│ │ Same Code│ │ Same Code│
        │ No State │ │ No State │ │ No State │
        └──────────┘ └──────────┘ └──────────┘
              │            │            │
              └────────────┼────────────┘
                           ▼
                  ┌────────────────┐
                  │ External State │
                  │ (Redis / DB /  │
                  │  Shared FS)    │
                  └────────────────┘
```

**What must be externalized:**
- **Sessions** -- Store in a centralized data store (Redis recommended over a database for performance).
- **User uploads / profile pictures** -- Store on a shared file system (NFS) or object storage (AWS S3).
- **Any user-specific state** -- Nothing local to one server.

**Deployment Consistency:**
The tricky part: when you deploy new code, every server must receive it simultaneously. You can't have Server 1 serving new code while Server 3 still runs the old version.

- **Tool:** Capistrano (or modern alternatives like Ansible, CodeDeploy) pushes code to all servers atomically.
- **Server Images (AMIs):** Once a server is set up correctly, create an image (AWS calls it an AMI -- Amazon Machine Image). All new instances are cloned from this image. On boot, they pull the latest code via an initial deployment script.

```
1. Configure one server perfectly (OS, dependencies, web server, etc.)
2. Create an AMI/image from that server
3. Launch new instances from the AMI
4. Each new instance runs a deployment script on boot to pull latest code
5. Load balancer adds the new instance to the pool
```

**Example:** You have 3 servers running v2.1 of your app. You deploy v2.2 via Capistrano, which SSH's into all 3 servers, pulls the new code from Git, and restarts the app process -- all within seconds. No server serves stale code.

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

HTTP is stateless. When a user logs in, the server creates a session (e.g., an `HttpSession` in Java Servlet / Spring). By default, many frameworks store this session **in-memory on the local server** that handled the login request.

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

**Spring Boot Configuration Example (Redis sessions):**

```xml
<!-- pom.xml dependency -->
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  session:
    store-type: redis
  redis:
    host: 192.168.1.50
    port: 6379
```

```java
// That's it -- Spring Session automatically stores HttpSession in Redis.
// Any web server instance can now read/write the same sessions.
@RestController
public class AuthController {

    @PostMapping("/login")
    public String login(HttpSession session, @RequestBody LoginRequest req) {
        User user = authService.authenticate(req);
        session.setAttribute("user", user);  // Stored in Redis, not local memory
        return "Logged in";
    }

    @GetMapping("/profile")
    public User profile(HttpSession session) {
        return (User) session.getAttribute("user");  // Read from Redis
    }
}
```

Now any web server can read/write sessions from the same Redis instance. The session is no longer tied to a specific server.

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

> Additional source: [Scalability for Dummies - Part 2: Database](https://web.archive.org/web/20220602114024/https://www.lecloud.net/post/7994751381/scalability-for-dummies-part-2-database)

After horizontally scaling your application servers (Section 2), the **database becomes the next bottleneck**. Thousands of concurrent requests now slam into a single database, causing slowdowns and eventual breakdowns. There are two fundamental paths forward.

### Path 1: Scale the Relational Database (Keep MySQL)

Stick with your relational database and apply increasingly complex techniques to keep it running:

```
Step 1: Hire a DBA
         │
Step 2: Master-Slave Replication (reads on slaves, writes on master)
         │
Step 3: Vertically scale the master (more RAM, faster disks)
         │
Step 4: Sharding (partition data across multiple DB servers)
         │
Step 5: Denormalization (reduce JOINs, add redundancy)
         │
Step 6: SQL tuning (optimize queries, add indexes)
```

Each step is **more expensive and complex** than the last. You're buying time, but the fundamental limitations of a single relational system keep creeping up.

**Example:** Your e-commerce app has 10M users. The master handles all writes. You add 3 read slaves. Traffic grows to 50M users. Now even the slaves are slow. Your DBA shards by user_id range, but cross-shard queries (like "top-selling products across all users") become nightmares.

### Path 2: Denormalize from the Start (Embrace NoSQL)

A more radical approach: design your data layer to avoid JOINs from the beginning.

- **Denormalize everything** -- store redundant data so reads don't need JOINs.
- **Use MySQL like a NoSQL store** -- just key-value lookups, no complex queries.
- **Or switch to actual NoSQL** -- MongoDB, CouchDB, DynamoDB, Cassandra, etc.
- **Move JOINs to the application layer** -- your code assembles data from multiple simple queries.

```
Traditional (Normalized):
  SELECT u.name, o.total, p.name
  FROM users u
  JOIN orders o ON u.id = o.user_id
  JOIN products p ON o.product_id = p.id
  WHERE u.id = 123;
  -- 3 tables, 2 JOINs → slow at scale

Denormalized (NoSQL-style):
  GET user:123
  → { name: "Steve", recent_orders: [
      { total: 49.99, product_name: "Keyboard" },
      { total: 29.99, product_name: "Mouse" }
    ]}
  -- Single lookup → fast at any scale
```

**When to choose Path 2:**
- The sooner you denormalize, the less code you have to rewrite later.
- If your app is read-heavy with predictable access patterns, NoSQL/denormalization is a natural fit.
- If your app needs complex ad-hoc queries and strong consistency (banking, inventory), stick with Path 1.

**The Next Bottleneck:** Even with a well-scaled database (either path), requests can still be slow if you're hitting the DB on every page load. The answer: **caching** (Section 7).

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

> Additional source: [Scalability for Dummies - Part 3: Cache](https://web.archive.org/web/20230126233752/https://www.lecloud.net/post/9246290032/scalability-for-dummies-part-3-cache)

Caching is the single most impactful optimization for read-heavy web applications. A cache is a simple **key-value store** that sits as a buffering layer between your application and your data storage. Your app checks the cache first; only on a miss does it go to the database. Always use **in-memory caches** (Memcached, Redis) -- avoid file-based caching, as it makes cloning and auto-scaling servers difficult.

**Performance context:** A standard Redis server can handle **hundreds of thousands of read operations per second**. Compare that to a MySQL server which might handle a few thousand queries per second under load.

### Two Caching Patterns

Before diving into specific caching layers, understand the two fundamental approaches to caching data:

#### Pattern 1: Cached Database Queries (Common but Problematic)

Every time you execute a database query, hash the query string and use it as the cache key. Store the query result as the value.

```
Cache Key: md5("SELECT * FROM products WHERE category = 'electronics'")
           → "a3f2b8c1d4e5..."
Cache Value: [{ id: 1, name: "Laptop", price: 999 }, { id: 2, ... }]
```

```python
import hashlib, json, redis

r = redis.Redis()

query = "SELECT * FROM products WHERE category = 'electronics'"
cache_key = hashlib.md5(query.encode()).hexdigest()

# Check cache
cached = r.get(cache_key)
if cached:
    result = json.loads(cached)
else:
    result = db.execute(query)
    r.setex(cache_key, 300, json.dumps(result))  # TTL: 5 min
```

**The Problem: Cache Invalidation.** When any piece of underlying data changes (e.g., a product price is updated), you must figure out **which cached queries** included that data and delete them. With complex queries involving JOINs and WHERE clauses, this becomes nearly impossible to manage correctly. You end up with stale data or overly aggressive invalidation that defeats the purpose of caching.

#### Pattern 2: Cached Objects (Strongly Recommended)

Instead of caching raw query results, treat your data as **objects** -- just like in your application code. Your code assembles a data object from multiple database queries, then caches the **complete object**.

```
┌─────────────────────────────┐
│ Application assembles object│
│                             │
│  Product {                  │
│    id: 42,                  │
│    name: "Laptop",          │
│    price: 999,              │
│    reviews: [...],   ← from reviews table
│    avg_rating: 4.5,  ← computed
│    images: [...]     ← from images table
│  }                          │
└──────────┬──────────────────┘
           │
           ▼
    Cache as: product:42 → { entire object }
```

```python
# Cached Objects Pattern
def get_product(product_id):
    cache_key = f"product:{product_id}"
    cached = redis_client.get(cache_key)

    if cached:
        return deserialize(cached)

    # Assemble the object from multiple DB queries
    product = db.query("SELECT * FROM products WHERE id = %s", product_id)
    product['reviews'] = db.query("SELECT * FROM reviews WHERE product_id = %s", product_id)
    product['images'] = db.query("SELECT * FROM images WHERE product_id = %s", product_id)
    product['avg_rating'] = calculate_average(product['reviews'])

    # Cache the complete assembled object
    redis_client.setex(cache_key, 3600, serialize(product))
    return product

# Invalidation is simple: when a product changes, delete one key
def update_product(product_id, new_data):
    db.update("UPDATE products SET ... WHERE id = %s", product_id)
    redis_client.delete(f"product:{product_id}")  # Clear cache → next read rebuilds it
```

**Why cached objects are better:**
- **Easy invalidation:** When something changes, you delete one object key. No guessing which queries are affected.
- **Cleaner code:** Your caching logic mirrors your domain model.
- **Enables async assembly:** Worker processes can pre-assemble objects in the background (see Section 8). The app just reads the latest cached version.

**What to cache as objects:**
- User sessions (never use the database for sessions!)
- Fully rendered blog articles / product pages
- Activity streams / news feeds
- User<->friend relationship graphs
- Any computed or aggregated data

### Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| **Data Structures** | Strings, Lists, Sets, Sorted Sets, Hashes | Strings only |
| **Persistence** | Can persist to disk (survives restart) | Pure in-memory (data lost on restart) |
| **Replication** | Built-in master-slave replication | None (client-side sharding) |
| **Use Cases** | Caching + sessions + queues + leaderboards | Pure caching |
| **Scaling** | Single-threaded (scale via sharding) | Multi-threaded (scales well per node) |

**Rule of thumb:**
- **Redis** if you need data structures, persistence, or want to use it as more than just a cache (e.g., session store, job queue, leaderboard). With clever key design, Redis can sometimes **replace the database entirely** for certain use cases.
- **Memcached** if you only need simple key-value caching and want it to scale effortlessly across many nodes.

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

Generate the HTML output once (from your application + database), save it as a static `.html` file, and serve that file directly for subsequent requests.

```
First request:
  User → Nginx → App Server (Java) → MySQL → Generate HTML → Save to /cache/home.html → Return

Subsequent requests:
  User → Nginx → Serve /cache/home.html directly (no app server, no MySQL)
```

- **Pros:** Incredibly fast. Nginx/Apache serve static files with minimal overhead.
- **Cons:**
  - Consumes disk space (every unique page = a cached file).
  - Cache invalidation is hard. If you change the site's header, you must regenerate **every** cached page.
  - Not suitable for personalized content (each user sees different data).

### Level 3: In-Memory Caching (Memcached / Redis)

Store the results of expensive database queries (or computed objects) in **RAM** as key-value pairs.

```
┌─────────┐     ┌────────────┐     ┌──────────┐
│ Web App │────►│   Redis /  │     │ Database │
│ (Java)  │     │ Memcached  │     │ (MySQL)  │
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

**Java + Jedis (Redis) Example:**
```java
import redis.clients.jedis.Jedis;
import com.fasterxml.jackson.databind.ObjectMapper;

Jedis jedis = new Jedis("192.168.1.50", 6379);
ObjectMapper mapper = new ObjectMapper();

String key = "user_profile_12345";
String cached = jedis.get(key);

UserProfile profile;
if (cached != null) {
    // Cache HIT: deserialize from JSON
    profile = mapper.readValue(cached, UserProfile.class);
} else {
    // Cache MISS: query the database
    profile = userRepository.findById(12345L);

    // Store in cache for 5 minutes (300 seconds)
    jedis.setex(key, 300, mapper.writeValueAsString(profile));
}

// Use profile (from cache or DB)
```

**Using Spring Boot + Spring Cache (cleaner approach):**
```java
@Service
public class UserService {

    @Cacheable(value = "userProfiles", key = "#userId")
    public UserProfile getUserProfile(long userId) {
        // This method body only runs on cache MISS.
        // On HIT, Spring returns the cached result automatically.
        return userRepository.findById(userId);
    }

    @CacheEvict(value = "userProfiles", key = "#userId")
    public void updateUserProfile(long userId, UserProfile updated) {
        userRepository.save(updated);
        // @CacheEvict automatically removes the stale cache entry
    }
}
```

```yaml
# application.yml -- configure Redis as the cache backend
spring:
  cache:
    type: redis
    redis:
      time-to-live: 300000  # 5 minutes in milliseconds
```

**Garbage Collection / Eviction:**
- Memcached has finite RAM (e.g., 64MB, 1GB).
- When the cache is full, it uses **LRU (Least Recently Used)** eviction: the oldest, least-accessed entries are removed to make room for new ones.
- You can also set explicit TTLs (Time To Live) on each cache entry.

**Real-World Usage:** Facebook used Memcached extensively, running thousands of Memcached servers with terabytes of RAM to avoid hitting their MySQL databases on every page load.

---

## 8. Asynchronism

> Source: [Scalability for Dummies - Part 4: Asynchronism](https://web.archive.org/web/20220926171507/https://www.lecloud.net/post/9699762917/scalability-for-dummies-part-4-asynchronism)

Some operations are too slow to perform while a user waits. Generating a PDF report, sending emails, resizing images, running complex analytics -- these can take seconds or minutes. Asynchronism is the pattern of doing work **outside** the request-response cycle so the user isn't blocked.

**The bakery analogy:** If every loaf of bread were baked only when a customer walked in, they'd wait 2 hours. Instead, the bakery bakes bread overnight and sells it fresh in the morning. For special orders (a birthday cake), the bakery takes the order, tells the customer to come back tomorrow, and bakes it in the background.

### Async Pattern 1: Pre-computation (Bake Ahead of Time)

Do time-consuming work **in advance** on a schedule. Serve pre-computed results instantly when users request them.

```
┌─────────────┐                    ┌──────────────┐
│  Cron Job   │  Every 5 minutes   │  Static HTML │
│  (Worker)   │───────────────────►│  files on    │
│             │  Pre-renders pages  │  disk / S3 / │
└─────────────┘                    │  CDN         │
                                   └──────┬───────┘
                                          │
                                   ┌──────┴───────┐
                                   │  User Request │
                                   │  → Served     │
                                   │    instantly!  │
                                   └──────────────┘
```

**How it works:**
1. A scheduled script (cron job) runs periodically (every minute, hour, etc.).
2. It queries the database, runs computations, and generates static output (HTML, JSON, reports).
3. The output is stored as files on disk, S3, or a CDN.
4. When a user requests the page, the web server serves the pre-computed static file -- no database queries, no computation.

**Example -- Pre-rendering a leaderboard:**
```python
# cron_generate_leaderboard.py (runs every 5 minutes via cron)
import json, redis

def generate_leaderboard():
    # Expensive query: scan millions of rows, aggregate, sort
    results = db.query("""
        SELECT u.name, SUM(s.points) as total_points
        FROM users u JOIN scores s ON u.id = s.user_id
        GROUP BY u.id ORDER BY total_points DESC LIMIT 100
    """)

    # Store pre-computed result
    redis_client.set("leaderboard:top100", json.dumps(results))

    # Or write as static HTML
    html = render_template("leaderboard.html", players=results)
    with open("/var/www/static/leaderboard.html", "w") as f:
        f.write(html)

generate_leaderboard()
```

```bash
# Crontab entry: run every 5 minutes
*/5 * * * * python /app/cron_generate_leaderboard.py
```

**Scaling this further:** Upload the pre-rendered files to a **CDN** (CloudFront, Cloudflare). Now the content is served from edge servers worldwide. Your backend handles zero user traffic for these pages.

**Best for:** Content that changes infrequently but is read often -- landing pages, product catalogs, leaderboards, reports, blog articles, sitemaps.

### Async Pattern 2: Job Queues (Take the Order, Bake Later)

When a user triggers a time-consuming task, don't do it during the HTTP request. Instead, put a **job** on a queue and return immediately. Background **workers** pick up jobs and process them.

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  User    │     │ Web Server│     │  Job Queue   │
│ (Browser)│     │           │     │ (RabbitMQ /  │
└────┬─────┘     └─────┬─────┘     │  Redis /     │
     │                 │           │  SQS)        │
     │  1. "Generate   │           └──────┬───────┘
     │   my report"    │                  │
     │────────────────►│                  │
     │                 │  2. Enqueue job  │
     │                 │─────────────────►│
     │                 │                  │
     │  3. "Got it!    │                  │
     │   We'll email   │           ┌──────┴───────┐
     │   you when      │           │   Workers    │
     │   it's ready"   │           │  (1, 2, 3..) │
     │◄────────────────│           └──────┬───────┘
     │                 │                  │
     │                 │  4. Worker picks │
     │                 │     up job and   │
     │                 │     processes it │
     │                 │                  │
     │  5. Email / notification:          │
     │     "Your report is ready!"        │
     │◄───────────────────────────────────│
```

**Example -- Image Resize Service:**
```python
# web_server.py (handles the HTTP request)
from rq import Queue
from redis import Redis

queue = Queue(connection=Redis())

@app.route('/upload', methods=['POST'])
def upload_image():
    image = request.files['image']
    image_path = save_to_storage(image)

    # Enqueue the resize job -- returns IMMEDIATELY
    job = queue.enqueue('workers.resize_image', image_path, job_timeout=300)

    return jsonify({
        "status": "processing",
        "job_id": job.id,
        "message": "Your image is being resized. Check back shortly."
    }), 202  # 202 Accepted

@app.route('/job/<job_id>/status')
def job_status(job_id):
    job = queue.fetch_job(job_id)
    if job.is_finished:
        return jsonify({"status": "done", "result_url": job.result})
    elif job.is_failed:
        return jsonify({"status": "failed"})
    else:
        return jsonify({"status": "processing"})
```

```python
# workers.py (runs on separate worker servers)
def resize_image(image_path):
    """This runs in the background, not during an HTTP request."""
    img = Image.open(image_path)

    # Generate multiple sizes (takes 10-30 seconds)
    for size in [(100, 100), (300, 300), (800, 800)]:
        resized = img.resize(size)
        resized.save(f"{image_path}_{size[0]}x{size[1]}.jpg")

    return f"https://cdn.example.com/images/{image_path}"
```

**Common Job Queue Technologies:**

| Tool | Type | Best For |
|------|------|----------|
| **RabbitMQ** | Full message broker (AMQP) | Complex routing, reliability guarantees, multi-language |
| **Redis (+ RQ/Celery)** | Lightweight queue via Redis lists | Simple Python/Node setups, already using Redis |
| **AWS SQS** | Managed cloud queue | AWS-native apps, zero infrastructure management |
| **ActiveMQ / Kafka** | Enterprise message broker / event streaming | High-throughput event-driven architectures |

**The frontend polling pattern:**
The user's browser periodically checks (polls) for job completion:

```javascript
// Frontend: poll for job completion
async function pollJobStatus(jobId) {
    const interval = setInterval(async () => {
        const res = await fetch(`/job/${jobId}/status`);
        const data = await res.json();

        if (data.status === 'done') {
            clearInterval(interval);
            showResult(data.result_url);  // Display the result
        } else if (data.status === 'failed') {
            clearInterval(interval);
            showError("Processing failed. Please try again.");
        }
        // else: still processing, keep polling
    }, 2000);  // Check every 2 seconds
}
```

Alternatively, use **WebSockets** or **Server-Sent Events (SSE)** for real-time push notifications instead of polling.

### When to Use Which Pattern

| Pattern | Use When | Examples |
|---------|----------|---------|
| **Pre-computation** | Data changes infrequently, many users read the same result | Leaderboards, product catalogs, blog pages, reports |
| **Job Queues** | User triggers a unique, expensive task | Image/video processing, PDF generation, email sending, data exports |

**Key Principle:** If you're doing something time-consuming, **always do it asynchronously.** Backends become nearly infinitely scalable (just add more workers), and frontends stay snappy.

---

## 9. JVM Performance & Optimization (Language-Specific)

### How the JVM Executes Code

Java source code is compiled **once** into bytecode (`.class` files) at build time. At runtime, the JVM loads and executes this bytecode. Unlike purely interpreted languages, the JVM uses a **Just-In-Time (JIT) compiler** that progressively optimizes hot code paths into native machine code.

```
Build time (once):
  .java source → javac → .class bytecode (packaged into .jar / .war)

Runtime (per request):
  Request → JVM loads bytecode → Interpreter executes bytecode → Response

After many requests (JIT kicks in):
  Request → JVM detects hot method → JIT compiles to native code → Response
  Request → Executes native machine code directly → Response  (much faster!)
```

### JIT Compilation: The JVM's Built-In Accelerator

The JVM ships with two JIT compilers that work in tiers:

| Tier | Compiler | What It Does |
|------|----------|-------------|
| **Tier 1-3** | C1 (Client) | Fast compilation with basic optimizations. Applied to methods after ~1,500 invocations. |
| **Tier 4** | C2 (Server) | Aggressive optimization (inlining, loop unrolling, escape analysis). Applied to hot methods after ~10,000+ invocations. |

```
Method call count:
  0 ─────────► ~1,500 ──────────► ~10,000+ ──────────►
  [Interpreted]  [C1 compiled]     [C2 compiled]
  (Slowest)      (Faster)          (Fastest - near C++ speed)
```

**Key difference from interpreted languages:** Java doesn't recompile on every request. The bytecode is loaded once, and the JIT progressively makes hot paths faster over time. This is why Java apps have a **warm-up period** -- performance improves as the JIT optimizes frequently-executed code.

### JVM Tuning for Web Applications

The most impactful JVM tuning parameters for web servers:

**Heap Memory (where objects live):**
```bash
# Set initial and max heap size (avoid resizing at runtime)
java -Xms2g -Xmx2g -jar app.jar

# -Xms: Initial heap size (start with this much)
# -Xmx: Maximum heap size (never exceed this)
# Setting both equal avoids costly runtime heap resizing
```

**Garbage Collection (GC):**
GC pauses can cause latency spikes in web applications. Choose the right collector:

| GC Algorithm | Flag | Best For |
|-------------|------|----------|
| **G1GC** | `-XX:+UseG1GC` | General purpose (default since Java 9). Good balance of throughput and latency. |
| **ZGC** | `-XX:+UseZGC` | Ultra-low latency (<10ms pauses). Best for latency-sensitive services. |
| **Shenandoah** | `-XX:+UseShenandoahGC` | Low latency, concurrent compaction. Similar goals to ZGC. |
| **Parallel GC** | `-XX:+UseParallelGC` | Maximum throughput (batch processing). Longer pauses OK. |

**Example -- Production Spring Boot startup:**
```bash
java \
  -Xms4g -Xmx4g \
  -XX:+UseZGC \
  -XX:+TieredCompilation \
  -XX:MaxGCPauseMillis=10 \
  -jar myapp.jar
```

### Connection Pooling

Unlike PHP (which creates/destroys resources per-request), Java web servers (Tomcat, Jetty, Netty) are **long-running processes**. This means you should pool expensive resources:

```java
// application.yml -- HikariCP connection pool (Spring Boot default)
spring:
  datasource:
    hikari:
      maximum-pool-size: 20      # Max 20 DB connections kept open
      minimum-idle: 5            # Keep at least 5 idle connections ready
      connection-timeout: 30000  # Wait max 30s for a connection
      idle-timeout: 600000       # Close idle connections after 10 min
```

```
Without pooling:
  Request → Open DB connection (50ms) → Query (5ms) → Close connection → Response
  Request → Open DB connection (50ms) → Query (5ms) → Close connection → Response

With pooling:
  Request → Borrow connection from pool (0.1ms) → Query (5ms) → Return to pool → Response
  Request → Borrow connection from pool (0.1ms) → Query (5ms) → Return to pool → Response
```

Connection pooling alone can improve throughput by **5-10x** for database-heavy applications.

### Thread Model: Blocking vs Non-Blocking

Traditional Java servers (Tomcat) use **one thread per request**. Under high concurrency, you can run out of threads.

```
Tomcat (thread-per-request):
  1000 concurrent users = 1000 threads = ~1GB RAM just for thread stacks

Netty / WebFlux (event-loop, non-blocking):
  1000 concurrent users = ~4 event-loop threads = minimal RAM overhead
```

**Spring WebFlux (reactive) example:**
```java
@RestController
public class ProductController {

    @GetMapping("/products/{id}")
    public Mono<Product> getProduct(@PathVariable long id) {
        // Non-blocking: thread is freed while waiting for DB/cache
        return reactiveRedis.opsForValue()
            .get("product:" + id)
            .switchIfEmpty(
                productRepository.findById(id)
                    .flatMap(p -> reactiveRedis.opsForValue()
                        .set("product:" + id, p)
                        .thenReturn(p))
            );
    }
}
```

For most web apps, traditional Tomcat with proper thread pool tuning is sufficient. Switch to WebFlux/Netty only if you need to handle **10,000+ concurrent connections** with limited hardware.

---

## 10. Global Architecture, High Availability & Security

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
          │       │            │       │
          └───────┼─LB <─> LB ─┼───────┘
                  ▼            ▼
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
- This could be unsafe in case of someone able to bypass the LB and intercept the traffic.

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

## 11. Key Insights & Takeaways

1. **There is no silver bullet.** Every solution introduces new complexity or potential failure points. Architecture is about **trade-offs**.

2. **Vertical scaling is simple but limited.** It's a good starting point, but you will eventually hit a ceiling that only horizontal scaling can solve.

3. **Horizontal scaling introduces distributed systems problems.** You must deal with load balancing, session management, data consistency, and partial failures.

4. **Load balancing is the gateway to horizontal scaling.** DNS round-robin is a cheap hack; dedicated load balancers (HAProxy, Nginx, AWS ELB) are the production solution.

5. **Sessions are the first thing that breaks** in a multi-server setup. Use sticky sessions as a quick fix or shared session storage (Redis/Memcached) for a proper solution.

6. **Redundancy must exist at every layer:** servers, load balancers, databases, network switches, data centers. A chain is only as strong as its weakest link.

7. **Caching is the biggest performance lever.** Memcached/Redis can reduce database load by 90%+ for read-heavy workloads. Cache at every layer: JIT compilation (JVM), query caching (MySQL), object caching (Redis/Memcached), page caching (static HTML).

8. **Database replication** (Master-Slave for reads, Master-Master for availability) is essential for both performance and fault tolerance.

9. **Security is not optional.** Firewall aggressively, use SSL/TLS, follow least privilege, and keep database ports off the public internet.

10. **Asynchronism keeps frontends snappy.** Pre-compute what you can (cron jobs, static files, CDN). For user-triggered heavy tasks, use job queues (RabbitMQ, Redis, SQS) with background workers. Never make a user wait for something that can be done later.

11. **Cloud platforms (AWS, GCP, Azure)** provide building blocks for all of the above (ELB, RDS, ElastiCache, SQS, auto-scaling groups), but you still need to understand the underlying principles to use them correctly.

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
  [User] → [LB] → [Web Servers] → [Memcached/Redis] → [Database]

Stage 5: Async Workers
  [User] → [LB] → [Web Servers] → [Job Queue] → [Workers]
                                 → [Cache]     → [Database]

Stage 6: Database Replication
  [User] → [LB] → [Web Servers] → [Cache] → [Master DB + Slave DBs]

Stage 7: Full Redundancy
  [User] → [DNS GLB] → [LB Pair] → [Web Servers] → [Cache Cluster]
                                                    → [Job Queue + Workers]
                                                    → [DB Master-Master]
                                                    → [CDN + Static Assets]
                                                    → [Multiple Data Centers]
```


