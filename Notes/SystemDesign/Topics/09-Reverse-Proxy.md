# Reverse Proxy

> A reverse proxy sits in front of your servers and handles requests on their behalf. It's the Swiss Army knife of web infrastructure.

---

## Table of Contents

1. [What is a Reverse Proxy?](#1-what-is-a-reverse-proxy)
2. [Forward Proxy vs Reverse Proxy](#2-forward-proxy-vs-reverse-proxy)
3. [Benefits of a Reverse Proxy](#3-benefits-of-a-reverse-proxy)
4. [Common Use Cases](#4-common-use-cases)
5. [Load Balancer vs Reverse Proxy](#5-load-balancer-vs-reverse-proxy)
6. [Popular Reverse Proxy Software](#6-popular-reverse-proxy-software)
7. [Disadvantages](#7-disadvantages)
8. [Key Takeaways](#8-key-takeaways)

---

## 1. What is a Reverse Proxy?

A reverse proxy is a web server that sits **in front of backend servers** and forwards client requests to them. The client talks to the reverse proxy as if it's the actual server — it never knows about the backend servers behind it.

```
Without reverse proxy:
  Client ──→ Web Server (directly exposed to internet)

With reverse proxy:
  Client ──→ Reverse Proxy ──→ Web Server(s)
                │
                │ Client sees only the reverse proxy's IP
                │ Backend servers are hidden
```

### Simple Example

```
Browser requests: https://example.com/api/users

  1. Request hits Nginx (reverse proxy) at 203.0.113.1
  2. Nginx routes /api/* to internal server at 10.0.1.5:8080
  3. Internal server processes the request
  4. Response flows back through Nginx to the browser

The browser only ever saw 203.0.113.1 (Nginx).
It has no idea 10.0.1.5 exists.
```

---

## 2. Forward Proxy vs Reverse Proxy

These are often confused. They sit on different sides:

```
Forward Proxy (client-side):
  Client → Forward Proxy → Internet → Server
            │
            Sits in front of CLIENTS
            Hides client identity from server
            Examples: VPN, corporate proxy, Tor

Reverse Proxy (server-side):
  Client → Internet → Reverse Proxy → Server
                        │
                        Sits in front of SERVERS
                        Hides server identity from client
                        Examples: Nginx, HAProxy, Cloudflare
```

| Property | Forward Proxy | Reverse Proxy |
|----------|--------------|---------------|
| **Protects** | Clients | Servers |
| **Configured by** | Client organization | Server organization |
| **Hides** | Client IP from servers | Server IP from clients |
| **Use case** | Internet access control, privacy | Security, load balancing, caching |

---

## 3. Benefits of a Reverse Proxy

### Security

```
✅ Hide backend server IPs — attackers can't directly target them
✅ Centralized firewall rules — block IPs, rate limit at one point
✅ DDoS protection — reverse proxy absorbs attack traffic
✅ Web Application Firewall (WAF) — filter SQL injection, XSS
```

### SSL Termination

```
Client ──── HTTPS ────→ Reverse Proxy ──── HTTP ────→ Backend
                              │
                    Decrypts TLS here
                    One place to manage certificates
                    Backend servers don't need TLS config
```

### Caching

```
Client requests /product/123
  → Reverse Proxy: Cache HIT? Return cached response (1ms)
  → Reverse Proxy: Cache MISS? Forward to backend (50ms)
    → Cache the response for future requests

Popular cached content:
  - Static files (images, CSS, JS)
  - API responses with appropriate Cache-Control headers
  - Rendered HTML pages (for CMS/blogs)
```

### Compression

```
Backend returns 500KB JSON response
Reverse proxy compresses it with gzip → 50KB
Sends compressed response to client

Result: 10x bandwidth reduction
```

### Serving Static Content

```
Reverse proxy serves static files directly from disk,
without forwarding to the application server:

  /static/*  → Serve from /var/www/static/ (Nginx)
  /api/*     → Forward to app server at localhost:8080

This is much faster because Nginx serves files
more efficiently than application servers.
```

### SSL/TLS Certificate Management

```
Instead of managing certificates on 50 backend servers,
manage them in ONE place — the reverse proxy.

Renew once → all servers benefit.
This is especially useful with Let's Encrypt auto-renewal.
```

---

## 4. Common Use Cases

### URL-Based Routing (API Gateway Pattern)

```
Nginx routing configuration:

  /                → React frontend (localhost:3000)
  /api/users/*     → User service (localhost:8001)
  /api/products/*  → Product service (localhost:8002)
  /api/orders/*    → Order service (localhost:8003)
  /admin/*         → Admin panel (localhost:9000)

All services appear to be under one domain (example.com)
but are actually different services on different ports.
```

### <abbr title="Canary deployments: gradually roll out a new version to a small subset of users (like a canary in a coal mine). If the canary is fine, expand the rollout; if it fails, only a small percentage of users were affected.">Canary Deployments</abbr>

```
Route 5% of traffic to the new version, 95% to the old:

  upstream stable {
    server 10.0.1.1:8080;
    server 10.0.1.2:8080;
  }
  
  upstream canary {
    server 10.0.2.1:8080;
  }

  split_clients $request_id $variant {
    95% stable;
    5%  canary;
  }
```

### WebSocket Proxying

```
Reverse proxy can handle WebSocket upgrade and proxy WS connections:

  Client ←── WebSocket ──→ Nginx ←── WebSocket ──→ WS Server

Nginx handles the HTTP → WebSocket upgrade transparently.
```

---

## 5. Load Balancer vs Reverse Proxy

These are related but not identical concepts:

| Feature | Reverse Proxy | Load Balancer |
|---------|--------------|---------------|
| **Primary purpose** | Shield backend servers | Distribute traffic |
| **When useful** | Even with ONE backend server | Only with MULTIPLE servers |
| **Caching** | ✅ Often included | ❌ Usually not |
| **SSL termination** | ✅ Always | ✅ Often |
| **Static file serving** | ✅ Common | ❌ Not typical |
| **Content-based routing** | ✅ Core feature | ✅ (L7 only) |
| **Compression** | ✅ Common | ❌ Rarely |

### Key Insight

> A **load balancer** is useful when you have **multiple servers.** A **reverse proxy** is useful even with **just one server.**

Most modern tools (Nginx, HAProxy, Envoy) do **both** — they are reverse proxies with built-in load balancing.

```
Nginx as both reverse proxy + load balancer:

  upstream backend {
    server 10.0.1.1:8080 weight=3;
    server 10.0.1.2:8080 weight=1;
    server 10.0.1.3:8080 weight=1;
  }

  server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    
    location /api/ {
      proxy_pass http://backend;  # Load balance + reverse proxy
    }
    
    location /static/ {
      root /var/www;  # Serve static files directly
    }
  }
```

---

## 6. Popular Reverse Proxy Software

| Software | Key Strengths | Best For |
|----------|-------------|----------|
| **Nginx** | High performance, event-driven, low memory footprint | Static serving, reverse proxy, LB |
| **HAProxy** | Best-in-class load balancing, very reliable | High-throughput load balancing |
| **Envoy** | Modern L7 proxy, built for microservices, <abbr title="Observability: the ability to understand the internal state of a system by examining its outputs (metrics, logs, traces). Envoy emits detailed telemetry for every request.">observability</abbr> | Service mesh (Istio), gRPC |
| **Traefik** | Auto-configuration with Docker/Kubernetes, built-in <abbr title="Let's Encrypt: a free, automated certificate authority that issues SSL/TLS certificates. Used to enable HTTPS without manual certificate management.">Let's Encrypt</abbr> | Container orchestration environments |
| **Caddy** | Auto-HTTPS (automatic Let's Encrypt), simple config | Small projects, developer-friendly |
| **Apache httpd** | Mature, highly configurable, mod_proxy | Legacy systems |

---

## 7. Disadvantages

| Disadvantage | Details |
|-------------|---------|
| **Single point of failure** | If the reverse proxy goes down, nothing works. Mitigate with HA pairs. |
| **Added complexity** | Another component to configure, monitor, and troubleshoot |
| **Added latency** | Adds a small hop (typically <1ms, usually negligible) |
| **Configuration errors** | Misconfigured proxy can cause outages or security issues |

---

## 8. Key Takeaways

1. **A reverse proxy sits in front of servers** and handles requests on their behalf. Clients don't know about backend servers.

2. **Even with one server,** a reverse proxy adds value: SSL termination, caching, compression, security, static file serving.

3. **Nginx and HAProxy** are the most popular choices. Envoy is growing for microservice architectures.

4. **In system design,** the reverse proxy is implicit — when you draw a load balancer, it's usually also acting as a reverse proxy. The distinction matters when discussing caching, compression, and static content serving.

5. **Don't confuse with forward proxy:** Forward proxy protects clients (VPN). Reverse proxy protects servers.

---

## 🔥 Senior Interview Questions

1. An interviewer asks: "When do you need a reverse proxy if you already have a load balancer?" Explain scenarios where a reverse proxy adds value beyond just load distribution. [Answer](QnA-Answer-Key.md#9-reverse-proxy)

2. You're designing an API that serves both mobile clients (bandwidth-sensitive) and internal services (latency-sensitive). How would you configure a reverse proxy to handle both optimally (compression, caching, protocol differences)? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

3. Compare NGINX, HAProxy, Envoy, and Traefik as reverse proxies. In a Kubernetes-native environment, which would you choose and why? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

4. Your reverse proxy is doing SSL termination, response compression, and caching. A security auditor says traffic between the reverse proxy and backend servers is unencrypted. Is this a problem? When do you need end-to-end encryption (<abbr title="mTLS (mutual TLS): both the client and server authenticate each other with certificates, not just the server authenticating to the client. Used in microservices to ensure only trusted services can communicate.">mTLS</abbr>)? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

5. Explain the difference between a reverse proxy, an <abbr title="API gateway: a specialized reverse proxy that also handles authentication, rate limiting, request transformation, and API versioning — typically the single entry point for all external API traffic">API gateway</abbr>, and a <abbr title="Service mesh sidecar: a proxy container automatically injected alongside each microservice that handles all network communication (retries, load balancing, mTLS, tracing) without any changes to the service itself">service mesh sidecar</abbr>. Where do their responsibilities overlap, and when would you use all three together? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

6. You're using NGINX as a reverse proxy to cache API responses. A user updates their profile, but the cached response still shows old data. How do you handle cache invalidation at the reverse proxy layer? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

7. Your reverse proxy is the single point of entry and a SPOF. Walk through how you'd make it highly available. Compare keepalived/VRRP, DNS failover, and cloud-managed solutions. [Answer](QnA-Answer-Key.md#9-reverse-proxy)

8. An engineer proposes using the reverse proxy to rate-limit requests instead of implementing rate limiting in the application. What are the pros and cons? When would this fail? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

9. How does a reverse proxy handle WebSocket connections differently from standard HTTP? What configuration challenges arise with long-lived connections? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

10. You need to route `/api/v1/*` to Service A and `/api/v2/*` to Service B, while serving static files directly. Configure this at the reverse proxy level — what are the performance implications of complex routing rules? [Answer](QnA-Answer-Key.md#9-reverse-proxy)

---

## 📚 Further Reading

- [Reverse Proxy vs Load Balancer — NGINX](https://www.nginx.com/resources/glossary/reverse-proxy-vs-load-balancer/) — Clear comparison with diagrams.
- [Envoy Proxy Architecture (YouTube)](https://www.youtube.com/watch?v=40gKzHQWgP0) — How Envoy is designed for modern microservice architectures.
- [HAProxy Architecture Guide](http://www.haproxy.org/download/1.2/doc/architecture.txt) — Deep technical dive into one of the most battle-tested proxies.
