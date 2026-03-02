# Domain Name System (DNS)

> DNS is the "phone book" of the internet. Every system design starts with a DNS lookup, so understanding how it works is foundational.

---

## Table of Contents

1. [What is DNS?](#1-what-is-dns)
2. [How DNS Resolution Works](#2-how-dns-resolution-works)
3. [DNS Hierarchy](#3-dns-hierarchy)
4. [DNS Record Types](#4-dns-record-types)
5. [DNS Caching and TTL](#5-dns-caching-and-ttl)
6. [DNS-Based Traffic Management](#6-dns-based-traffic-management)
7. [DNS in System Design](#7-dns-in-system-design)
8. [Disadvantages of DNS](#8-disadvantages-of-dns)
9. [Managed DNS Services](#9-managed-dns-services)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. What is DNS?

DNS (Domain Name System) translates **human-readable domain names** (like `www.google.com`) into **IP addresses** (like `142.250.80.4`) that computers use to communicate.

```
You type: www.google.com
DNS returns: 142.250.80.4
Your browser: connects to 142.250.80.4
```

Without DNS, you'd have to memorize IP addresses for every website. DNS is one of the most critical pieces of internet infrastructure.

---

## 2. How DNS Resolution Works

When you type a URL into your browser, here's what happens:

```
Step-by-step DNS resolution for "www.example.com"

  ┌──────────────┐
  │   Browser    │ 1. Check browser cache
  │              │    → Found? Use it. Done.
  └──────┬───────┘    → Not found? Ask the OS.
         │
  ┌──────▼───────┐
  │   OS Cache   │ 2. Check OS cache (/etc/hosts, local cache)
  │              │    → Found? Use it. Done.
  └──────┬───────┘    → Not found? Ask the resolver.
         │
  ┌──────▼───────┐
  │  Recursive   │ 3. ISP's DNS resolver (or 8.8.8.8, 1.1.1.1)
  │  Resolver    │    Checks its cache.
  │  (ISP/Public)│    → Found? Use it. Done.
  └──────┬───────┘    → Not found? Start the lookup chain.
         │
  ┌──────▼───────┐
  │  Root DNS    │ 4. "I don't know www.example.com, but 
  │  Server      │     .com is handled by these servers..."
  │  (13 global) │     → Returns TLD server addresses
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │  TLD DNS     │ 5. ".com TLD server: example.com is handled
  │  Server      │     by these nameservers..."
  │  (.com)      │     → Returns authoritative NS addresses
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ Authoritative│ 6. "www.example.com = 93.184.216.34"
  │  DNS Server  │     → Returns the actual IP address
  │ (example.com)│
  └──────────────┘

Total round trips: Up to 4 (but usually 1-2 thanks to caching)
Typical time: 20-120ms (uncached), <1ms (cached)
```

---

## 3. DNS Hierarchy

DNS is organized as a **hierarchical tree:**

```
                    . (Root)
                   /    |    \
               .com   .org   .io    ← Top-Level Domains (TLD)
              / |  \
         google example amazon      ← Second-Level Domains
          / \      |
       www  mail   www              ← Subdomains (Hostnames)
```

### The Root Zone

- **13 root server clusters** worldwide (named A through M)
- Each "server" is actually a cluster of many machines using <abbr title="Anycast: a network routing technique where the same IP address is assigned to multiple servers in different locations. Traffic is automatically routed to the nearest one, improving speed and resilience.">anycast</abbr>
- Maintained by organizations like <abbr title="ICANN: Internet Corporation for Assigned Names and Numbers — the non-profit that coordinates the global DNS, IP addresses, and internet naming standards">ICANN</abbr>, IANA, VeriSign, NASA, etc.
- They don't know every domain — they only know who handles each TLD

### TLD Servers

- Managed by registries (e.g., VeriSign for `.com`, Public Interest Registry for `.org`)
- They know which authoritative nameservers handle each second-level domain

### Authoritative Nameservers

- The final authority for a domain
- Configured by the domain owner (or their DNS provider)
- These servers know the actual IP addresses for hostnames

---

## 4. DNS Record Types

| Record Type | Purpose | Example |
|------------|---------|---------|
| **A** | Maps a hostname to an **IPv4** address | `www.example.com → 93.184.216.34` |
| **AAAA** | Maps a hostname to an **IPv6** address | `www.example.com → 2606:2800:220:1:248:...` |
| **CNAME** | Creates an **alias** (one hostname points to another) | `blog.example.com → example.wordpress.com` |
| **NS** | Specifies the **authoritative nameservers** for a domain | `example.com NS ns1.dnsimple.com` |
| **MX** | Specifies the **mail servers** for a domain | `example.com MX mail.example.com (priority 10)` |
| **TXT** | Stores **arbitrary text** (often used for verification, <abbr title="SPF (Sender Policy Framework): a DNS record that lists which mail servers are allowed to send email on behalf of your domain, helping prevent email spoofing">SPF</abbr>, <abbr title="DKIM (DomainKeys Identified Mail): adds a digital signature to outgoing emails so receivers can verify the email wasn't tampered with in transit">DKIM</abbr>) | `example.com TXT "v=spf1 include:_spf.google.com"` |
| **SRV** | Specifies a **host and port** for a service | `_sip._tcp.example.com SRV 10 60 5060 server.example.com` |
| **SOA** | **Start of Authority** — metadata about the zone (serial number, refresh rate) | Admin info, refresh intervals |
| **PTR** | **Reverse DNS** — maps an IP address back to a hostname | `34.216.184.93 → www.example.com` |

### CNAME vs A Record

```
A Record:     www.example.com → 93.184.216.34
              Directly maps to an IP address.
              Fastest lookup.

CNAME Record: blog.example.com → myblog.wordpress.com
              Points to another domain name.
              Requires an additional lookup to resolve the final IP.
              Cannot be used at the zone apex (example.com itself).

ALIAS Record: example.com → myapp.herokuapp.com
              (vendor-specific, not standard DNS)
              Like CNAME but works at the zone apex.
              Used by Route 53, CloudFlare, etc.
```

---

## 5. DNS Caching and TTL

### What is TTL?

**TTL (Time to Live)** tells the resolver how long to cache a DNS record before asking again.

```
example.com  A  93.184.216.34  TTL: 300 seconds (5 minutes)

Minute 0: Resolver queries authoritative server → gets IP, caches it
Minute 1: Resolver gets another query → serves from cache
Minute 4: Still cached
Minute 5: Cache expires → must query authoritative server again
```

### TTL Trade-offs

| TTL Length | Pros | Cons |
|-----------|------|------|
| **Short (60-300s)** | Changes propagate quickly; can failover faster | More DNS queries; slightly higher latency |
| **Long (3600-86400s)** | Fewer DNS queries; lower latency | Changes take hours to propagate; slow failover |

### Where DNS is Cached

```
Layer 1: Browser cache (~1-30 minutes, browser-dependent)
Layer 2: OS cache (respects TTL, flushed on restart)
Layer 3: Router/ISP resolver cache (respects TTL)
Layer 4: Recursive resolver cache (respects TTL)

To view your OS DNS cache (macOS):
  sudo dscacheutil -flushcache

To see browser DNS cache (Chrome):
  chrome://net-internals/#dns
```

---

## 6. DNS-Based Traffic Management

Modern DNS services do much more than simple name-to-IP mapping:

### Weighted Round Robin

Distribute traffic across servers with configurable weights.

```
example.com  A  1.2.3.4  (weight: 70)
example.com  A  5.6.7.8  (weight: 30)

70% of DNS queries return 1.2.3.4
30% of DNS queries return 5.6.7.8

Use cases:
- Gradual migration between old and new servers
- A/B testing
- Canary deployments
- Balancing between different-capacity clusters
```

### Latency-Based Routing

Route users to the **closest (lowest latency)** server.

```
User in New York → DNS returns: us-east server IP
User in London   → DNS returns: eu-west server IP
User in Tokyo    → DNS returns: ap-northeast server IP

How: DNS provider measures latency from resolver networks
     to each endpoint and returns the fastest.
```

### Geolocation-Based Routing

Route users based on their **geographic location.**

```
User in EU → DNS returns: EU server IP (data stays in EU → GDPR)
User in US → DNS returns: US server IP
User in CN → DNS returns: CN server IP

Determined by the IP address of the DNS resolver.
```

### Health-Check-Based Failover

DNS provider monitors server health and removes unhealthy servers from responses.

```
Normal: example.com → [1.2.3.4, 5.6.7.8] (both healthy)
Server 1 fails: example.com → [5.6.7.8] (only healthy server)
Server 1 recovers: example.com → [1.2.3.4, 5.6.7.8] (back to both)
```

---

## 7. DNS in System Design

### Typical Architecture Role

```
User types URL
    │
    ▼
DNS (Route 53 / CloudFlare)
    │ Returns: CDN IP or Load Balancer IP
    │
    ├──→ CDN (for static content: images, CSS, JS)
    │
    └──→ Load Balancer IP (for dynamic content)
            │
            ├──→ App Server 1
            ├──→ App Server 2
            └──→ App Server 3
```

### DNS Failover Architecture

```
Primary Region (US-East)     Secondary Region (US-West)
┌─────────────────┐          ┌─────────────────┐
│ Load Balancer   │          │ Load Balancer   │
│ IP: 1.2.3.4    │          │ IP: 5.6.7.8    │
│ ┌───┐ ┌───┐    │          │ ┌───┐ ┌───┐    │
│ │App│ │App│    │          │ │App│ │App│    │
│ └───┘ └───┘    │          │ └───┘ └───┘    │
└─────────────────┘          └─────────────────┘

DNS Health Check:
  ✅ Primary healthy → DNS returns 1.2.3.4
  ❌ Primary down    → DNS returns 5.6.7.8 (failover)
```

---

## 8. Disadvantages of DNS

| Disadvantage | Details |
|-------------|---------|
| **Slight delay** | DNS lookup adds latency to the first request (mitigated by caching) |
| **Caching causes staleness** | After a DNS change, cached records serve the old IP until TTL expires |
| **Single point of failure** | If your authoritative DNS is down, your domain is unreachable |
| **DDoS attacks** | DNS infrastructure is a common DDoS target (e.g., 2016 Dyn attack took down Twitter, Netflix, Reddit) |
| **Complex management** | Large organizations have thousands of DNS records to manage |
| **DNS propagation delay** | Changes can take minutes to hours to propagate fully due to caching at multiple levels |
| **DNS hijacking** | Attackers can intercept DNS queries and return malicious IP addresses |

### Mitigations

- **Redundancy:** Use multiple DNS providers (e.g., Route 53 + CloudFlare)
- **<abbr title="DNSSEC (DNS Security Extensions): adds cryptographic signatures to DNS records. Resolvers can verify that records came from the legitimate authoritative server and haven't been tampered with">DNSSEC</abbr>:** Cryptographic signing of DNS records to prevent tampering
- **<abbr title="DNS over HTTPS (DoH): sends DNS queries over an encrypted HTTPS connection instead of plain text UDP, preventing ISPs or attackers from seeing what domains you're looking up">DNS over HTTPS (DoH)</abbr>:** Encrypt DNS queries to prevent snooping
- **Low TTLs before migrations:** Reduce TTL to 60s before making DNS changes
- **Anycast:** Distribute DNS servers globally to resist DDoS

---

## 9. Managed DNS Services

| Service | Provider | Key Features |
|---------|----------|-------------|
| **Route 53** | AWS | Latency-based, geolocation, weighted routing, health checks, tight AWS integration |
| **CloudFlare DNS** | CloudFlare | Fast (anycast), DDoS protection, free tier, DNS-level security |
| **Google Cloud DNS** | Google | 100% SLA, global anycast, integration with GCP |
| **Azure DNS** | Microsoft | Integration with Azure, alias records, private DNS zones |
| **DNSimple** | DNSimple | Simple API, good for developers, ALIAS record support |

---

## 10. Key Takeaways

1. **DNS translates domain names to IP addresses.** It's a globally distributed, hierarchical system.

2. **DNS resolution involves multiple steps:** Browser cache → OS cache → Resolver → Root → TLD → Authoritative. Caching makes most lookups fast.

3. **Know your record types:** A (IPv4), AAAA (IPv6), CNAME (alias), NS (nameserver), MX (mail).

4. **TTL controls caching.** Short TTL = faster failover but more queries. Long TTL = better performance but slower changes.

5. **Modern DNS does traffic routing:** Weighted, latency-based, and geolocation routing are critical tools in system design.

6. **DNS is a potential single point of failure.** Use multiple DNS providers and DNSSEC for resilience.

7. **In system design interviews,** DNS is often the first thing you draw — traffic enters your system through DNS routing to CDNs, load balancers, or regional endpoints.

---

## 🔥 Senior Interview Questions

1. You need to migrate traffic from one data center to another with zero downtime. Walk through how you'd use DNS (TTL management, weighted routing, health checks) to achieve this safely. [Answer](QnA-Answer-Key.md#6-domain-name-system)

2. An interviewer asks: "What happens when you type google.com in a browser?" Walk through the full DNS resolution chain, including browser cache, OS cache, recursive resolver, root, TLD, and authoritative servers. [Answer](QnA-Answer-Key.md#6-domain-name-system)

3. Your DNS provider (e.g., Route 53) experiences an outage. How does this affect your system? What architectural decisions would have prevented a total outage? [Answer](QnA-Answer-Key.md#6-domain-name-system)

4. Explain the difference between A, AAAA, CNAME, MX, NS, TXT, and SRV records. When would you use an ALIAS/ANAME record instead of a CNAME at the zone apex? [Answer](QnA-Answer-Key.md#6-domain-name-system)

5. You set a TTL of 5 minutes for a DNS record, but after changing the IP, some users are still hitting the old IP 2 hours later. Why? Discuss recursive resolver caching, client-side caching, and Java's notorious DNS caching. [Answer](QnA-Answer-Key.md#6-domain-name-system)

6. How would you implement <abbr title="GSLB (Global Server Load Balancing): distributes traffic across servers in different geographic regions using DNS, directing users to the best available region based on latency, health, or location">DNS-based global server load balancing (GSLB)</abbr> for a multi-region deployment? Compare latency-based routing, geolocation routing, and weighted routing. [Answer](QnA-Answer-Key.md#6-domain-name-system)

7. An attacker is performing a DNS cache poisoning attack against your service. What is happening, and how do DNSSEC and DNS-over-HTTPS (DoH) mitigate this? [Answer](QnA-Answer-Key.md#6-domain-name-system)

8. Your startup is choosing between using Route 53, Cloudflare DNS, and running your own BIND servers. Compare them on reliability, latency, cost, and features. [Answer](QnA-Answer-Key.md#6-domain-name-system)

9. In a microservices environment, you need service discovery. Compare DNS-based service discovery (e.g., <abbr title="Consul: a service networking tool that provides service discovery, health checking, and a DNS interface so services can find each other by name rather than hard-coded IP addresses">Consul DNS</abbr>) vs a service registry (e.g., <abbr title="Eureka: Netflix's open-source service registry where microservices register themselves on startup and discover other services by name, without needing DNS changes">Eureka</abbr>) vs a service mesh (e.g., <abbr title="Istio: a service mesh that handles service-to-service communication, security, and observability by injecting a sidecar proxy alongside each service, bypassing DNS for internal routing">Istio</abbr>). When does DNS fall short? [Answer](QnA-Answer-Key.md#6-domain-name-system)

10. The Dyn DDoS attack in 2016 took down Twitter, GitHub, and Netflix. How did a DNS attack cascade into application-level outages, and what architectural lesson should every system designer learn from it? [Answer](QnA-Answer-Key.md#6-domain-name-system)

---

## 📚 Further Reading

- [How DNS Works — A Comic Explanation (DNSimple)](https://howdns.works/) — Fun, visual walkthrough of the DNS resolution process.
- [The Dyn DDoS Attack of 2016 — Post-Mortem](https://dyn.com/blog/dyn-analysis-summary-of-friday-october-21-attack/) — Real-world case study of DNS as a critical SPOF.
- [DNS Infrastructure at Cloudflare (YouTube)](https://www.youtube.com/watch?v=OwxDYPeyJhk) — How one of the world's largest DNS providers architects for scale and resilience.
