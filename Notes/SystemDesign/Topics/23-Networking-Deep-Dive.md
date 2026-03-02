# Networking Deep Dive

## Table of Contents

1. [OSI Model](#1-osi-model)
2. [TCP/IP in Depth](#2-tcpip-in-depth)
3. [HTTP Deep Dive](#3-http-deep-dive)
4. [TLS/SSL](#4-tlsssl)
5. [DNS Resolution In Detail](#5-dns-resolution-in-detail)
6. [Network Address Translation (NAT)](#6-network-address-translation-nat)
7. [Network Troubleshooting](#7-network-troubleshooting)
8. [Cloud Networking](#8-cloud-networking)
9. [Key Takeaways](#9-key-takeaways)

---

## 1. <abbr title="OSI (Open Systems Interconnection) Model: a 7-layer model that describes how data moves across a network.">OSI Model</abbr>

Seven layers, from physical wire to application. Each layer communicates
only with the layers directly above and below it.

```
Layer  │ Name          │ Protocol Examples   │ Data Unit  │ What It Does
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   7   │ Application   │ HTTP, gRPC, DNS,    │ Data       │ User-facing
       │               │ SMTP, WebSocket     │            │ protocols
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   6   │ Presentation  │ TLS/SSL, JSON,      │ Data       │ Encryption,
       │               │ Protobuf, gzip      │            │ serialization
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   5   │ Session       │ TLS handshake,      │ Data       │ Maintains
       │               │ RPC sessions        │            │ connections
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   4   │ Transport     │ TCP, UDP, QUIC      │ Segment    │ End-to-end
       │               │                     │ /Datagram  │ delivery
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   3   │ Network       │ IP (IPv4, IPv6),    │ Packet     │ Routing between
       │               │ ICMP                │            │ networks
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   2   │ Data Link     │ Ethernet, Wi-Fi,    │ Frame      │ Node-to-node
       │               │ ARP                 │            │ on same network
───────┼───────────────┼─────────────────────┼────────────┼──────────────────
   1   │ Physical      │ Electrical signals, │ Bits       │ Physical
       │               │ fiber optics        │            │ transmission
```

### Practical Simplification (TCP/IP Model)

In practice, most engineers think in 4 layers:

```
┌─────────────────────────────────────┐
│ Application Layer (HTTP, DNS, gRPC) │  ← OSI Layers 5-7
├─────────────────────────────────────┤
│ Transport Layer (TCP, UDP)          │  ← OSI Layer 4
├─────────────────────────────────────┤
│ Internet Layer (IP, ICMP)           │  ← OSI Layer 3
├─────────────────────────────────────┤
│ Link Layer (Ethernet, Wi-Fi)        │  ← OSI Layers 1-2
└─────────────────────────────────────┘
```

### How Data Flows Through the Layers

```
Sending an HTTP request:

Application:  [  HTTP GET /api/users  ]
               ↓ (add TCP header)
Transport:    [TCP Header | HTTP GET /api/users ]
               ↓ (add IP header)
Network:      [IP Header | TCP Header | HTTP GET /api/users ]
               ↓ (add Ethernet frame header + trailer)
Link:         [Eth Header | IP Header | TCP Header | HTTP GET /api/users | FCS]

Each layer wraps the data from above with its own header.
This is called ENCAPSULATION.

Receiving: The reverse. Each layer strips its header and passes data up.
```

---

## 2. TCP/IP in Depth

### <abbr title="TCP connection lifecycle: the 3-way handshake establishes a connection, and a 4-step FIN/ACK sequence closes it. TIME_WAIT prevents old packets from being mistaken as new ones.">TCP Connection Lifecycle</abbr>

```
Three-Way Handshake (connection establishment):

Client                              Server
  │                                    │
  │──── SYN (seq=100) ───────────────►│  "I want to connect"
  │                                    │
  │◄─── SYN-ACK (seq=300, ack=101) ──│  "OK, I acknowledge"
  │                                    │
  │──── ACK (seq=101, ack=301) ──────►│  "Connection established"
  │                                    │
  │     ← Connection established →     │

Four-Way Termination:

Client                              Server
  │                                    │
  │──── FIN ──────────────────────────►│  "I'm done sending"
  │                                    │
  │◄─── ACK ──────────────────────────│  "Got it"
  │                                    │
  │◄─── FIN ──────────────────────────│  "I'm done too"
  │                                    │
  │──── ACK ──────────────────────────►│  "Connection closed"
  │                                    │

TIME_WAIT: After closing, the client waits 2×MSL (typically 60 seconds)
before fully releasing the port. This prevents old packets from being
misinterpreted as new connection packets.

Problem: High-traffic servers can exhaust ports due to TIME_WAIT.
Solution: Enable SO_REUSEADDR / SO_REUSEPORT, tune tcp_tw_reuse.
```

### TCP Flow Control

```
Sliding Window:
  The receiver tells the sender how much data it can accept.
  
  Receiver window size = 64KB
  
  Sender: "I'll send up to 64KB without waiting for ACK"
  
  ┌──────────────────────────────────────────────────────┐
  │ Sent & ACKed │ Sent, not ACKed │ Can send │ Can't send│
  │  (done)      │  (in flight)    │ (window) │   (wait)  │
  └──────────────────────────────────────────────────────┘
  
  As receiver ACKs data, the window slides right → sender can send more.
  If receiver is slow, window shrinks → sender slows down.

Congestion Control:
  Prevents the NETWORK from being overwhelmed (not just the receiver).
  
  Slow Start: Start with a small congestion window (cwnd).
              Double cwnd every RTT until packet loss occurs.
  
  cwnd:  1 → 2 → 4 → 8 → 16 → 32 → [loss!] → 16 (halve)
  
  Algorithms: Reno, Cubic (Linux default), BBR (Google, throughput-focused)
  
  BBR is especially important for high-latency links (cross-continent).
```

### TCP vs UDP vs QUIC

```
TCP:
  ✓ Reliable, ordered delivery
  ✓ Flow control, congestion control
  ✗ <abbr title="Head-of-line blocking: one lost packet holds up everything behind it.">Head-of-line blocking</abbr> (one lost packet blocks ALL streams)
  ✗ Connection setup takes 1-2 RTT (plus TLS adds 1-2 more)
  
  Use for: Web (HTTP/1, HTTP/2), databases, file transfer

UDP:
  ✓ No connection overhead
  ✓ No head-of-line blocking
  ✗ No reliability guarantees
  ✗ No ordering
  ✗ No congestion control (application must handle)
  
  Use for: DNS, video streaming, gaming, VoIP

QUIC (HTTP/3):
  ✓ Built on UDP
  ✓ Multiple independent streams (no head-of-line blocking)
  ✓ 0-RTT connection resumption
  ✓ Built-in TLS 1.3 (encrypted by default)
  ✓ Connection migration (survives IP changes, e.g., Wi-Fi → cellular)
  
  TCP + TLS:   1 RTT (TCP) + 1 RTT (TLS) = 2 RTT before data
  QUIC:        1 RTT (first connection), 0 RTT (resumption)
  
  Use for: HTTP/3, modern web applications
```

---

## 3. HTTP Deep Dive

### HTTP Request Anatomy

```
GET /api/users?page=2 HTTP/1.1        ← Request line (method, path, version)
Host: api.example.com                  ← Required header
Authorization: Bearer eyJhbGci...      ← Auth token
Accept: application/json               ← Desired response format
Accept-Encoding: gzip, deflate, br     ← Compression support
Connection: keep-alive                 ← Reuse connection
Cache-Control: no-cache                ← Caching directive
X-Request-ID: abc-123                  ← Custom header (tracing)
                                       ← Empty line (end of headers)
                                       ← Body (empty for GET)
```

### HTTP Response Anatomy

```
HTTP/1.1 200 OK                        ← Status line
Content-Type: application/json         ← Response format
Content-Length: 1234                    ← Body size
Content-Encoding: gzip                 ← Compression used
Cache-Control: max-age=3600            ← Cache for 1 hour
ETag: "abc123"                         ← Version for conditional requests
X-RateLimit-Remaining: 99             ← Custom rate limit header
                                       ← Empty line
{"users": [...]}                       ← Body
```

### HTTP Caching Headers

```
Cache-Control directives:
  ┌────────────────────────┬──────────────────────────────────────┐
  │ Directive              │ Meaning                              │
  ├────────────────────────┼──────────────────────────────────────┤
  │ max-age=3600           │ Cache for 3600 seconds               │
  │ no-cache               │ Must revalidate with server          │
  │ no-store               │ Never cache (sensitive data)         │
  │ private                │ Only browser can cache (not CDN)     │
  │ public                 │ CDN and browser can cache            │
  │ s-maxage=600           │ CDN-specific max age                 │
  │ stale-while-revalidate │ Serve stale while fetching fresh     │
  └────────────────────────┴──────────────────────────────────────┘

Conditional Requests (avoid re-downloading unchanged content):
  
  Client                                   Server
    │                                        │
    │── GET /image.png ──────────────────────►│
    │                                        │
    │◄── 200 OK                              │
    │    ETag: "abc123"                       │
    │    (full response body)                 │
    │                                        │
    │── GET /image.png ──────────────────────►│
    │   If-None-Match: "abc123"              │
    │                                        │
    │◄── 304 Not Modified (no body!)          │  ← Saves bandwidth
    │                                        │
```

### HTTP/1.1 vs HTTP/2 vs HTTP/3

```
HTTP/1.1:
  Client ─── Connection 1 ──── Request 1 → Response 1 → Request 2 → Response 2
  Client ─── Connection 2 ──── Request 3 → Response 3
  Client ─── Connection 3 ──── Request 4 → Response 4
  
  6 connections per domain. Sequential requests per connection.
  Head-of-line blocking: Must wait for Response 1 before sending Request 2.

HTTP/2:
  Client ─── Single Connection ──── Stream 1: Request 1 → Response 1
                                 ├── Stream 2: Request 2 → Response 2
                                 ├── Stream 3: Request 3 → Response 3
                                 └── Stream 4: Request 4 → Response 4
  
  Multiplexing: Multiple streams on one connection.
  Header compression (HPACK).
  Server push (server sends resources before client asks).
  But: TCP head-of-line blocking (one lost TCP packet blocks ALL streams).

HTTP/3 (QUIC):
  Same multiplexing as HTTP/2 but built on QUIC (UDP).
  Each stream is independent — one lost packet only affects that stream.
  0-RTT connection resumption.
  Built-in encryption (TLS 1.3).
```

- <abbr title="Head-of-line blocking: one slow or lost response blocks everything behind it.">Head-of-line blocking</abbr>
- <abbr title="HPACK: HTTP/2 header compression to reduce repeated header bytes.">HPACK</abbr>

---

## 4. TLS/SSL

### TLS 1.3 Handshake

```
Client                                        Server
  │                                              │
  │── ClientHello ──────────────────────────────►│
  │   Supported cipher suites                    │
  │   Client key share (DH public key)           │
  │   Supported TLS versions                     │
  │                                              │
  │◄─── ServerHello ────────────────────────────│
  │     Chosen cipher suite                      │
  │     Server key share (DH public key)         │
  │     Server certificate                       │
  │     Certificate verify (signed hash)         │
  │     Finished                                 │
  │                                              │
  │── Finished ────────────────────────────────►│
  │                                              │
  │           ← Encrypted data →                 │

TLS 1.3 improvements over TLS 1.2:
  - 1 RTT handshake (was 2 RTT in TLS 1.2)
  - 0-RTT resumption (for repeat connections)
  - Removed insecure algorithms (RSA key exchange, CBC, RC4, SHA-1)
  - Forward secrecy is mandatory (Diffie-Hellman only)
```

### Certificate Chain

```
Root CA (trusted, stored in browser/OS):
  │ Signs
  ├── Intermediate CA Certificate
  │     │ Signs  
  │     ├── Your Server Certificate (*.example.com)
  │     │
  │     └── Another Server Certificate (*.other.com)
  │
  └── Another Intermediate CA

Your server sends: Server cert + Intermediate cert
Browser verifies: Chain from server cert → intermediate → root CA
If the chain is valid → connection is trusted.

Certificate types:
  DV (Domain Validation): Proves you own the domain. Automated. (Let's Encrypt)
  OV (Organization Validation): Proves org identity. Manual verification.
  EV (Extended Validation): Highest trust. Green bar (deprecated in most browsers).
```

### mTLS (Mutual TLS)

```
Regular TLS: Only the client verifies the server's certificate.
mTLS: BOTH sides verify each other's certificates.

Client                                        Server
  │── ClientHello ──────────────────────────►│
  │◄── ServerHello + Server Certificate ────│
  │                                          │
  │── Client Certificate ──────────────────►│  ← Extra step!
  │                                          │
  │   Both sides verified. Connection established.

Use cases:
  - Service-to-service communication (microservices)
  - Zero-trust networking
  - API authentication (instead of API keys)
  
  Tools: Istio (service mesh), SPIFFE/SPIRE (identity framework)
```

---

## 5. DNS Resolution In Detail

```
User types: www.example.com

Step 1: Browser cache → found? Use it. Not found? Continue.

Step 2: OS cache (local resolver) → found? Use it. Not found? Continue.

Step 3: Recursive Resolver (usually your ISP or 8.8.8.8)
  │
  │── "Where is www.example.com?" ──────► Root Server (.)
  │◄── "I don't know, but .com is      ── 198.41.0.4"
  │
  │── "Where is www.example.com?" ──────► TLD Server (.com)
  │◄── "I don't know, but example.com  ── 192.0.34.163"
  │
  │── "Where is www.example.com?" ──────► Authoritative NS (example.com)
  │◄── "www.example.com = 93.184.216.34" (A record)
  │
  └── Cache the result (TTL = 3600 seconds)

Step 4: Return 93.184.216.34 to the browser.
Step 5: Browser connects to 93.184.216.34.

Total lookups: Up to 4 (root → TLD → authoritative → answer)
With caching: Usually 0-1 lookups.
```

### DNS Record Types

| Type  | Purpose                    | Example                              |
|-------|----------------------------|--------------------------------------|
| A     | Domain → IPv4              | example.com → 93.184.216.34          |
| AAAA  | Domain → IPv6              | example.com → 2606:2800:220:1:...    |
| CNAME | Alias → another domain     | www.example.com → example.com        |
| MX    | Mail server                | example.com → mail.example.com (10)  |
| NS    | Name server                | example.com → ns1.example.com        |
| TXT   | Arbitrary text             | SPF, DKIM, domain verification       |
| SRV   | Service discovery          | _sip._tcp.example.com → server:5060  |
| CAA   | Certificate authority auth | Only Let's Encrypt can issue certs   |

### DNS-Based Load Balancing

```
Round Robin DNS:
  example.com → 1.2.3.4
  example.com → 5.6.7.8
  example.com → 9.10.11.12
  
  Each query gets a different IP. Simple but no health checking.

Weighted DNS (Route 53):
  example.com → 1.2.3.4 (weight: 70)
  example.com → 5.6.7.8 (weight: 30)
  
  70% of requests go to 1.2.3.4.

Geo DNS:
  US users → us-east.example.com → 1.2.3.4
  EU users → eu-west.example.com → 5.6.7.8
  
  Users are routed to the nearest datacenter.

Latency-based DNS (Route 53):
  Always returns the IP with the lowest latency from the user's location.
```

---

## 6. Network Address Translation (NAT)

```
NAT allows multiple devices on a private network to share one public IP.

Private Network:                          Internet:
┌──────────────────────┐     ┌─────┐
│ 192.168.1.10 (laptop)│────►│     │     ┌──────────────┐
│ 192.168.1.11 (phone) │────►│ NAT │────►│ Server       │
│ 192.168.1.12 (tablet)│────►│     │     │ 93.184.216.34│
└──────────────────────┘     └─────┘     └──────────────┘
                              │
                        Public IP: 203.0.113.5

NAT Table:
  Private IP:Port          │ Public IP:Port     │ Destination
  192.168.1.10:12345       │ 203.0.113.5:40001  │ 93.184.216.34:443
  192.168.1.11:54321       │ 203.0.113.5:40002  │ 93.184.216.34:443

The server sees all requests coming from 203.0.113.5.
NAT maps the response back to the correct internal device.

Why this matters in system design:
  - Cloud instances in a VPC use NAT for outbound internet access.
  - NAT gateways can be a bottleneck (limited ports: ~65K per IP).
  - WebSocket connections through NAT may be dropped by idle timers.
```

---

## 7. Network Troubleshooting

### Essential Commands

```
DNS lookup:
  dig example.com            # Query DNS records
  dig +trace example.com     # Full resolution trace
  nslookup example.com       # Simple DNS lookup

Connectivity:
  ping example.com           # ICMP echo (is host reachable?)
  telnet example.com 443     # Can I reach this port?
  nc -zv example.com 443     # Same, more modern

Routing:
  traceroute example.com     # Show every hop to the destination
  mtr example.com            # traceroute + ping combined (live)

HTTP:
  curl -v https://example.com    # Verbose HTTP request (see headers, TLS)
  curl -o /dev/null -w "%{time_total}" https://example.com  # Just timing

TCP connections:
  ss -tuln                   # Show listening ports
  ss -tunap                  # Show all connections + process names
  netstat -an                # Legacy equivalent

Packet capture:
  tcpdump -i eth0 port 443   # Capture packets on port 443
  wireshark                  # GUI packet analyzer
```

### Common Network Issues in Distributed Systems

| Issue                    | Symptoms                    | Diagnosis                     |
|--------------------------|-----------------------------|-------------------------------|
| DNS resolution failure   | Connection timeouts         | dig (check if DNS resolves)   |
| Port blocked (firewall)  | Connection refused/timeout  | telnet/nc to the port         |
| TLS certificate expired  | SSL handshake failure       | openssl s_client, curl -v     |
| MTU mismatch             | Large packets dropped       | ping with -s flag (vary size) |
| TCP connection leak      | Too many TIME_WAIT          | ss -s (count states)          |
| DNS TTL too high         | Stale IPs after migration   | dig +trace, check TTL         |
| Asymmetric routing       | Intermittent failures       | traceroute from both sides    |

---

## 8. Cloud Networking

### VPC (Virtual Private Cloud)

```
┌─── VPC (10.0.0.0/16) ──────────────────────────────────────────┐
│                                                                  │
│  ┌─── Public Subnet (10.0.1.0/24) ────────────────────┐        │
│  │  ┌──────────┐  ┌──────────┐                        │        │
│  │  │ Load     │  │ NAT      │                        │        │
│  │  │ Balancer │  │ Gateway  │                        │        │
│  │  └──────────┘  └──────────┘                        │        │
│  │                                                     │        │
│  │  Route: 0.0.0.0/0 → Internet Gateway               │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─── Private Subnet (10.0.2.0/24) ───────────────────┐        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │        │
│  │  │ App      │  │ App      │  │ App      │         │        │
│  │  │ Server 1 │  │ Server 2 │  │ Server 3 │         │        │
│  │  └──────────┘  └──────────┘  └──────────┘         │        │
│  │                                                     │        │
│  │  Route: 0.0.0.0/0 → NAT Gateway (outbound only)    │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─── Private Subnet (10.0.3.0/24) ───────────────────┐        │
│  │  ┌──────────┐  ┌──────────┐                        │        │
│  │  │ Database │  │ Database │                        │        │
│  │  │ Primary  │  │ Replica  │                        │        │
│  │  └──────────┘  └──────────┘                        │        │
│  │                                                     │        │
│  │  No internet access. Only accessible from app subnet│        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  Security Groups (instance-level firewall):                      │
│    App SG: Allow inbound from LB SG on port 8080                │
│    DB SG:  Allow inbound from App SG on port 5432               │
└──────────────────────────────────────────────────────────────────┘
```

### VPC Peering and Transit Gateway

```
VPC Peering (direct connection between two VPCs):
  ┌─── VPC A ───┐     ┌─── VPC B ───┐
  │  10.0.0.0/16│◄───►│  10.1.0.0/16│
  └─────────────┘     └─────────────┘
  
  Limitation: Not transitive. If A peers with B and B peers with C,
  A cannot reach C through B.

Transit Gateway (hub-and-spoke for many VPCs):
  ┌─── VPC A ───┐
  │             │──┐
  └─────────────┘  │    ┌─────────────────┐
                   ├───►│ Transit Gateway  │
  ┌─── VPC B ───┐ │    │ (central hub)    │
  │             │──┤    └─────────────────┘
  └─────────────┘  │
                   │
  ┌─── VPC C ───┐ │
  │             │──┘
  └─────────────┘
  
  All VPCs can reach each other through the Transit Gateway.
```

---

## 9. Key Takeaways

### What to Know for System Design Interviews

```
Must know:
  ├── TCP vs UDP differences and when to use each
  ├── How DNS works (resolution process, record types)
  ├── HTTP/1.1 vs HTTP/2 vs HTTP/3 differences
  ├── TLS handshake (at a high level)
  ├── VPC architecture (public/private subnets, security groups)
  └── Basic troubleshooting (why is this service unreachable?)

Nice to know (senior/architect):
  ├── TCP congestion control (slow start, BBR)
  ├── QUIC protocol details
  ├── mTLS for service-to-service
  ├── NAT gateway limitations
  ├── DNS-based load balancing strategies
  └── VPC peering vs Transit Gateway vs PrivateLink
```

### Golden Rules

1. **Use private subnets for everything except load balancers.** Databases,
   app servers, caches — none of these should have public IPs.
2. **Security groups are your first line of defense.** Restrict access
   to the minimum required ports and sources.
3. **HTTP/2 is the baseline.** Use it for all web traffic. HTTP/3 when mature.
4. **TCP for reliability, UDP for speed.** QUIC gives you both.
5. **DNS TTLs matter.** Too high = slow failover. Too low = more DNS traffic.
   300 seconds is a good balance for most services.
6. **Connection pooling reduces TCP overhead.** Avoid creating new connections
   for every request.
7. **Know your tools.** `curl -v`, `dig`, `traceroute`, `ss` — these will save
   you hours of debugging in production.

---

## 🔥 Senior Interview Questions

1. Walk through everything that happens at the network level when a user types "https://example.com" in their browser and hits Enter. Cover DNS, TCP handshake, TLS handshake, HTTP request, and response. How many round trips before the first byte of content arrives? [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

2. Your microservices communicate over HTTP/1.1 within a Kubernetes cluster. You're seeing high latency during traffic spikes. An engineer suggests switching to HTTP/2 or gRPC. Explain the head-of-line blocking difference between HTTP/1.1, HTTP/2 (over TCP), and HTTP/3 (over QUIC). [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

3. Explain how NAT (Network Address Translation) works. Your application runs on EC2 instances in a private subnet. How does it access the internet? Walk through the role of NAT Gateway, Internet Gateway, and route tables. [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

4. You're debugging a production issue where TCP connections between two services are being reset randomly. Walk through your diagnostic process using tools like `ss`, `tcpdump`, `netstat`. What could cause TCP RST packets? [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

5. Compare VPC peering, Transit Gateway, VPN, and PrivateLink for connecting two AWS VPCs. When would you use each? What are the bandwidth, latency, and cost implications? [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

6. Your application opens 10,000 short-lived TCP connections per second to a database. Each connection goes through the 3-way handshake. Calculate the overhead and explain why connection pooling (PgBouncer, ProxySQL) is essential at scale. [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

7. An interviewer says: "TLS adds too much latency." Quantify the latency difference between TLS 1.2 (2-RTT handshake) and TLS 1.3 (1-RTT, 0-RTT resumption). When is 0-RTT dangerous and why? [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

8. Explain BGP (Border Gateway Protocol) at a high level. How does internet routing work between autonomous systems? What happens during a BGP route leak or hijack (like the Cloudflare/Verizon incident)? [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

9. You're designing a multi-region architecture with servers in US, EU, and Asia. How does anycast routing work, and how do CDNs like Cloudflare use it? Compare anycast with DNS-based global load balancing. [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

10. Your system uses WebSocket connections for real-time updates. Each WebSocket holds an open TCP connection. You have 1 million concurrent users. Calculate the server resources needed (file descriptors, memory) and explain how you'd architect this with connection servers, pub/sub, and horizontal scaling. [Answer](QnA-Answer-Key.md#23-networking-deep-dive)

---

## 📚 Further Reading

- [High Performance Browser Networking (Ilya Grigorik, Free Online)](https://hpbn.co/) — Comprehensive deep-dive into TCP, TLS, HTTP/2, WebSocket, and more.
- [Computer Networking: A Top-Down Approach (Kurose & Ross)](https://gaia.cs.umass.edu/kurose_ross/online_lectures.htm) — The classic networking textbook with free lecture videos.
- [How HTTPS Works (Comic)](https://howhttps.works/) — Visual, fun explanation of TLS/HTTPS from certificate authorities to encryption.
