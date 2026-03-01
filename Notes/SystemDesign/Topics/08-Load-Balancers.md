# Load Balancers

> Load balancers distribute traffic across multiple servers. They're one of the most important components in any scalable system.

---

## Table of Contents

1. [What is a Load Balancer?](#1-what-is-a-load-balancer)
2. [Why Load Balancers Matter](#2-why-load-balancers-matter)
3. [Layer 4 (Transport) Load Balancing](#3-layer-4-transport-load-balancing)
4. [Layer 7 (Application) Load Balancing](#4-layer-7-application-load-balancing)
5. [Layer 4 vs Layer 7 Comparison](#5-layer-4-vs-layer-7-comparison)
6. [Load Balancing Algorithms](#6-load-balancing-algorithms)
7. [Health Checks](#7-health-checks)
8. [SSL Termination](#8-ssl-termination)
9. [Session Persistence (Sticky Sessions)](#9-session-persistence-sticky-sessions)
10. [Horizontal Scaling with Load Balancers](#10-horizontal-scaling-with-load-balancers)
11. [High Availability for Load Balancers](#11-high-availability-for-load-balancers)
12. [Hardware vs Software Load Balancers](#12-hardware-vs-software-load-balancers)
13. [Cloud Load Balancers](#13-cloud-load-balancers)
14. [Disadvantages](#14-disadvantages)
15. [Key Takeaways](#15-key-takeaways)

---

## 1. What is a Load Balancer?

A load balancer sits between clients and servers, distributing incoming requests across multiple backend servers.

```
Without Load Balancer:                With Load Balancer:

Client ──→ Single Server             Client ──→ Load Balancer ──→ Server 1
                                                      ├──→ Server 2
If server dies,                                       └──→ Server 3
everything is down.
                                      If Server 2 dies,
                                      LB routes to Servers 1 & 3.
```

---

## 2. Why Load Balancers Matter

### The Five Key Benefits

```
1. DISTRIBUTION
   Spread traffic evenly across servers.
   No single server is overwhelmed.

2. AVAILABILITY
   If a server fails, traffic goes to healthy servers.
   Users don't experience downtime.

3. SCALABILITY
   Need more capacity? Add more servers behind the LB.
   No DNS changes needed.

4. SSL TERMINATION
   LB handles encryption/decryption.
   Backend servers work with plain HTTP (faster, simpler).

5. SECURITY
   Hides backend server IPs from the public internet.
   Can block malicious traffic, rate limit, etc.
```

---

## 3. Layer 4 (Transport) Load Balancing

Layer 4 LBs operate at the **transport layer** (TCP/UDP). They route traffic based on **IP addresses and port numbers** without inspecting the content of the request.

```
How L4 works:

Client sends TCP packet:
  Source: 203.0.113.1:54321
  Destination: 198.51.100.1:443 (load balancer)

L4 Load Balancer:
  1. Looks at: source IP, dest IP, source port, dest port
  2. Does NOT read: HTTP headers, cookies, URL path, body
  3. Performs NAT (Network Address Translation):
     Rewrites destination to: 10.0.1.5:8080 (backend server)
  4. Forwards the raw TCP packets

┌────────┐    TCP     ┌────────┐    TCP     ┌────────┐
│ Client │ ─────────→ │  L4 LB │ ─────────→ │ Server │
│        │ ←───────── │  (NAT) │ ←───────── │        │
└────────┘            └────────┘            └────────┘
```

### Characteristics

| Property | Value |
|----------|-------|
| OSI Layer | Layer 4 (Transport) |
| Decision based on | IP, port, protocol (TCP/UDP) |
| Content inspection | None |
| Speed | Very fast (no payload inspection) |
| SSL handling | Pass-through (doesn't decrypt) |
| Sticky sessions | By source IP only |
| Examples | AWS NLB, HAProxy (TCP mode), Linux IPVS |

---

## 4. Layer 7 (Application) Load Balancing

Layer 7 LBs operate at the **application layer** (HTTP/HTTPS). They can inspect the content of requests and make routing decisions based on URLs, headers, cookies, and body content.

```
How L7 works:

Client sends HTTP request:
  GET /api/users HTTP/1.1
  Host: example.com
  Cookie: session=abc123

L7 Load Balancer:
  1. Terminates the TCP connection (and TLS if HTTPS)
  2. Reads the full HTTP request
  3. Makes routing decisions based on:
     - URL path: /api/* → API servers
     - Header: User-Agent: mobile → mobile-optimized servers
     - Cookie: session=abc123 → sticky session to Server 2
  4. Opens a NEW connection to the chosen backend server

┌────────┐   HTTPS   ┌────────┐    HTTP    ┌────────┐
│ Client │ ────────→ │  L7 LB │ ─────────→ │ Server │
│        │ ←──────── │(decrypt│ ←───────── │        │
└────────┘  encrypt  │ inspect│            └────────┘
                     │ route) │
                     └────────┘
```

### Content-Based Routing Examples

```
Route by URL path:
  /api/*          → API server pool
  /static/*       → CDN or static file servers
  /admin/*        → Admin server pool
  /ws/*           → WebSocket server pool

Route by header:
  Accept: application/json  → API servers
  Accept: text/html         → Web servers

Route by cookie:
  has "beta" cookie?        → Beta server pool
  no "beta" cookie?         → Production server pool

Route by host:
  api.example.com           → API servers
  www.example.com           → Web servers
  admin.example.com         → Admin servers
```

### Characteristics

| Property | Value |
|----------|-------|
| OSI Layer | Layer 7 (Application) |
| Decision based on | URL, headers, cookies, body content |
| Content inspection | Full (can read and modify requests) |
| Speed | Slower than L4 (must parse HTTP) |
| SSL handling | Terminates SSL (decrypts, inspects, re-encrypts) |
| Sticky sessions | By cookie, URL parameter, or header |
| Examples | AWS ALB, Nginx, HAProxy (HTTP mode), Envoy |

---

## 5. Layer 4 vs Layer 7 Comparison

| Feature | Layer 4 | Layer 7 |
|---------|---------|---------|
| **Speed** | Faster (no content parsing) | Slower (parses HTTP) |
| **Intelligence** | Dumb routing (IP + port only) | Smart routing (URL, headers, cookies) |
| **SSL** | Pass-through or terminate | Must terminate SSL |
| **Flexibility** | Low (can't route by content) | High (content-based routing) |
| **Use cases** | TCP/UDP traffic, very high throughput | HTTP/HTTPS traffic, microservices |
| **Connection handling** | Same connection forwarded | New connection to backend |
| **WebSocket support** | Pass-through (transparent) | Explicit support needed |
| **Cost** | Lower (less processing) | Higher (more processing) |

### When to Use Which

```
Use Layer 4 when:
  - You need raw speed and minimal latency
  - Traffic is not HTTP (database connections, gaming, DNS)
  - You don't need content-based routing
  - You want SSL pass-through

Use Layer 7 when:
  - You need URL-based routing (/api, /web, /admin)
  - You want SSL termination at the LB
  - You need cookie-based sticky sessions
  - You're running microservices with different paths
  - You want to inspect/modify HTTP headers
```

---

## 6. Load Balancing Algorithms

### Round Robin

Requests are distributed to servers **sequentially**, one after another.

```
Request 1 → Server A
Request 2 → Server B
Request 3 → Server C
Request 4 → Server A  (cycle repeats)
Request 5 → Server B
...

Pros: Simple, fair distribution
Cons: Doesn't account for server capacity or current load
```

### Weighted Round Robin

Like round robin, but servers with higher weights receive **more requests.**

```
Server A (weight 5): Gets 5 out of every 8 requests
Server B (weight 2): Gets 2 out of every 8 requests
Server C (weight 1): Gets 1 out of every 8 requests

Use case: Servers with different capacities.
  New powerful server → weight 5
  Old weaker server → weight 1
```

### Least Connections

Route to the server with the **fewest active connections.**

```
Server A: 12 active connections
Server B: 5 active connections   ← next request goes here
Server C: 15 active connections

Pros: Naturally adapts to server load
      Great when requests have varying processing times
Cons: Doesn't account for server capacity
```

### Weighted Least Connections

Combines least connections with server weights.

```
Server A (weight 3): 12 connections ÷ 3 = 4.0
Server B (weight 1): 5 connections ÷ 1 = 5.0
Server C (weight 2): 15 connections ÷ 2 = 7.5

Effective load: A=4.0, B=5.0, C=7.5
Next request → Server A (lowest effective load)
```

### IP Hash

Hash the client's IP address to determine which server handles the request. **Same client always goes to the same server.**

```
hash("203.0.113.1") % 3 = 1 → always goes to Server B
hash("198.51.100.5") % 3 = 0 → always goes to Server A

Pros: Natural session affinity without cookies
Cons: Uneven distribution if IP distribution is skewed
      Adding/removing servers redistributes everything
```

### Least Response Time

Route to the server with the **lowest current response time.**

```
Server A: avg response 45ms
Server B: avg response 12ms  ← next request goes here
Server C: avg response 89ms

Pros: Adapts to real performance
Cons: Requires continuous monitoring of response times
```

### Random

Pick a server at random.

```
Statistically fair over many requests.
No state needed (simplest to implement).
```

---

## 7. Health Checks

Load balancers continuously check if backend servers are healthy.

```
Types of Health Checks:

1. TCP Health Check:
   LB attempts to open TCP connection to server:port
   Success → server is healthy
   Failure → server is unhealthy

2. HTTP Health Check:
   LB sends: GET /health → expects HTTP 200 OK
   Returns 200 → healthy
   Returns 5xx or timeout → unhealthy

3. Deep Health Check:
   GET /health/deep → server checks DB, cache, dependencies
   All ok → 200
   DB down → 503

Configuration:
  Interval: Check every 10 seconds
  Timeout: Wait 5 seconds for response
  Unhealthy threshold: 3 consecutive failures → mark unhealthy
  Healthy threshold: 2 consecutive successes → mark healthy again

┌────────────┐     healthcheck      ┌────────────┐
│    Load     │ ──── GET /health ──→ │  Server 1  │ ← healthy ✅
│  Balancer   │ ──── GET /health ──→ │  Server 2  │ ← unhealthy ❌
│             │ ──── GET /health ──→ │  Server 3  │ ← healthy ✅
└────────────┘                      └────────────┘

Server 2 is removed from the pool. Traffic goes to 1 and 3 only.
When Server 2 passes health checks again, it's added back.
```

---

## 8. SSL Termination

SSL/TLS termination at the load balancer **offloads encryption/decryption** from backend servers.

```
With SSL Termination at LB:

Client ──── HTTPS (encrypted) ───→ Load Balancer ──── HTTP (plain) ───→ Server
                                       │
                                  Decrypts here
                                  Handles certificates
                                  CPU for TLS

Benefits:
  ✅ Backend servers are simpler (no TLS config)
  ✅ Centralized certificate management (one place to update certs)
  ✅ LB can inspect HTTP content for routing
  ✅ Backend servers spend CPU on application logic, not crypto

Considerations:
  ⚠️ Traffic between LB and backend is unencrypted
  ⚠️ If internal network is untrusted, use TLS everywhere (end-to-end)
  ⚠️ Some compliance requirements mandate end-to-end encryption
```

### SSL Pass-through (Alternative)

```
Client ──── HTTPS (encrypted) ───→ Load Balancer ──── HTTPS (still encrypted) ───→ Server

LB forwards encrypted traffic without decrypting.
LB cannot inspect HTTP content → only L4 routing.
Used when end-to-end encryption is required.
```

---

## 9. Session Persistence (Sticky Sessions)

Ensure a user's requests always go to the **same backend server.**

```
Why needed?
  Some applications store session data in the server's memory.
  If user's next request goes to a different server, session is lost.

How:
  1. Cookie-based: LB sets a cookie indicating which server to use
     SERVERID=srv2  → always route to Server 2

  2. IP-based: Hash client IP → always same server (less reliable with NAT)

  3. URL parameter: Append ?server=2 to URLs

Problem with sticky sessions:
  They undermine the benefits of load balancing!
  - Uneven distribution (popular user stuck on one server)
  - Can't remove servers without disrupting sessions
  - Server failure loses sessions

Better solution:
  Store sessions EXTERNALLY (Redis, Memcached, database)
  → Any request can go to any server
  → True stateless architecture
```

---

## 10. Horizontal Scaling with Load Balancers

```
Growth pattern:

Phase 1: Single server
  Client → Server

Phase 2: Add LB + servers
  Client → LB → [Server 1, Server 2, Server 3]

Phase 3: Separate tiers
  Client → LB → [Web 1, Web 2]
                     ↓
               Internal LB → [App 1, App 2]
                                  ↓
                            Internal LB → [DB primary, DB replicas]

Phase 4: Multi-region
  DNS → Region A: LB → [Servers]
      → Region B: LB → [Servers]
```

### Requirements for Horizontal Scaling

```
1. Stateless servers:
   No in-memory sessions. Sessions in Redis/DB.
   Any server can handle any request.

2. Shared data layer:
   All servers connect to the same database cluster.
   All servers use the same cache cluster.

3. Consistent deployments:
   All servers run the same code version.
   Rolling deployments to update without downtime.
```

---

## 11. High Availability for Load Balancers

A single load balancer is a **single point of failure.** Solutions:

### Active-Passive LB

```
┌──────────────┐  heartbeat  ┌──────────────┐
│   Active LB  │ ←─────────→ │  Passive LB  │
│   (handles   │             │  (standby)   │
│    traffic)  │             │              │
└──────┬───────┘             └──────────────┘
       │
  ┌────┴────┐
  │ Servers │
  └─────────┘

If Active LB dies → Passive takes over its IP (via VRRP/keepalived)
```

### Active-Active LBs

```
┌──────────────┐  ┌──────────────┐
│     LB 1     │  │     LB 2     │
│   (active)   │  │   (active)   │
└──────┬───────┘  └──────┬───────┘
       └────────┬────────┘
           ┌────┴────┐
           │ Servers │
           └─────────┘

DNS returns both LB IPs. Traffic split between both.
If one dies, other handles all traffic.
```

---

## 12. Hardware vs Software Load Balancers

| Factor | Hardware (F5, Citrix) | Software (Nginx, HAProxy, Envoy) |
|--------|----------------------|----------------------------------|
| **Cost** | $10K-$100K+ per unit | Free (open source) or low cost |
| **Performance** | Very high (custom ASICs) | High (but uses commodity hardware) |
| **Flexibility** | Limited to vendor features | Highly customizable |
| **Scalability** | Buy bigger boxes | Add more VMs/containers |
| **Cloud native** | Poor cloud fit | Runs anywhere (VM, container, pod) |
| **Updates** | Vendor firmware updates | Update anytime yourself |

### Modern Recommendation

Software load balancers (Nginx, HAProxy, Envoy) are the **standard choice** for most organizations. Hardware LBs are mostly used in on-premise enterprise environments.

---

## 13. Cloud Load Balancers

| Service | Type | Layer | Key Feature |
|---------|------|-------|-------------|
| **AWS ALB** | Application | L7 | Path-based routing, WebSocket, gRPC |
| **AWS NLB** | Network | L4 | Ultra-low latency, static IPs, TLS pass-through |
| **AWS CLB** | Classic | L4/L7 | Legacy, basic features |
| **GCP Load Balancer** | Global | L4/L7 | Global anycast IP, auto-scaling |
| **Azure Load Balancer** | Network | L4 | Zone-redundant |
| **Azure Application GW** | Application | L7 | WAF, URL routing |

---

## 14. Disadvantages

| Disadvantage | Explanation |
|-------------|-------------|
| **Single point of failure** | Without redundancy, LB failure = total outage |
| **Bottleneck** | All traffic flows through the LB — it can become the bottleneck |
| **Complexity** | Adds another component to manage, monitor, and troubleshoot |
| **Cost** | Hardware LBs are expensive; cloud LBs charge per-request |
| **Latency** | Adds a small amount of latency (typically <1ms) |

---

## 15. Key Takeaways

1. **Load balancers distribute traffic** across servers, improving availability, scalability, and performance.

2. **Layer 4** routes by IP/port (fast, simple). **Layer 7** routes by HTTP content (smart, flexible). Use L7 for HTTP services, L4 for everything else.

3. **Least connections** is usually the best default algorithm. Use **weighted** variants when servers have different capacities.

4. **Health checks** automatically remove unhealthy servers and add them back when they recover.

5. **SSL termination** at the LB simplifies backend servers and centralizes certificate management.

6. **Avoid sticky sessions** if possible. Store sessions externally (Redis) for true statelessness.

7. **Make the LB highly available** with active-passive or active-active pairs. A single LB is a single point of failure.

8. **In system design interviews,** the load balancer is almost always the second thing you draw (after DNS). It's the entry point to your backend infrastructure.

---

## 🔥 Senior Interview Questions

1. You have a microservices architecture with 200+ services. Would you use a single centralized load balancer, per-service load balancers, or client-side load balancing (like gRPC)? Discuss the trade-offs of each. [Answer](QnA-Answer-Key.md#8-load-balancers)

2. Explain the difference between L4 and L7 load balancing with concrete examples. When would L4 be faster but L7 be necessary? What about L3 (DSR — Direct Server Return)? [Answer](QnA-Answer-Key.md#8-load-balancers)

3. Your load balancer uses round-robin, but one server is consistently slower than others, causing request queuing. How would you detect this, and which algorithm would fix it? Compare least connections, weighted RR, and adaptive algorithms. [Answer](QnA-Answer-Key.md#8-load-balancers)

4. You're serving WebSocket connections for a real-time chat app. How does this affect your load balancing strategy? Why can't you use standard L7 load balancing with connection draining? [Answer](QnA-Answer-Key.md#8-load-balancers)

5. An interviewer says: "The load balancer itself is a single point of failure." Walk through exactly how you make load balancing highly available — discuss DNS round-robin, BGP anycast, VRRP/keepalived, and cloud-native solutions (ALB, NLB). [Answer](QnA-Answer-Key.md#8-load-balancers)

6. You need to do a rolling deployment of a new version. How does the load balancer participate? Discuss health checks, connection draining, blue-green deployments, and canary routing at the LB level. [Answer](QnA-Answer-Key.md#8-load-balancers)

7. Compare hardware load balancers (F5), software load balancers (HAProxy, NGINX), and cloud-native load balancers (AWS ALB/NLB). When would a company still buy a hardware LB in 2025? [Answer](QnA-Answer-Key.md#8-load-balancers)

8. Your application uses sticky sessions (session affinity). A server goes down and 10,000 users lose their sessions. How do you redesign to eliminate this problem while maintaining session state? [Answer](QnA-Answer-Key.md#8-load-balancers)

9. Explain how a global load balancer differs from a local one. If you need to route US users to us-east and EU users to eu-west, what combination of DNS, GSLB, and regional LBs would you use? [Answer](QnA-Answer-Key.md#8-load-balancers)

10. Your load balancer is performing SSL termination for 100,000 concurrent TLS connections. This is consuming significant CPU. What are your options to scale SSL termination without adding more LB instances? [Answer](QnA-Answer-Key.md#8-load-balancers)

---

## 📚 Further Reading

- [Introduction to Modern Load Balancing — NGINX Blog](https://www.nginx.com/blog/inside-nginx-how-we-designed-for-performance-scale/) — How NGINX handles millions of connections.
- [AWS Load Balancing: ALB vs NLB vs CLB](https://aws.amazon.com/elasticloadbalancing/features/) — Comparison of AWS load balancer types.
- [Load Balancing at Uber (YouTube)](https://www.youtube.com/watch?v=MKgJeqF1DHw) — How Uber implements load balancing across thousands of microservices.
