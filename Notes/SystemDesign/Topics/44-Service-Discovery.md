# Service Discovery & Coordination

## Table of Contents

1. [Overview](#1-overview)
2. [Why Service Discovery?](#2-why-service-discovery)
3. [Client-Side Discovery](#3-client-side-discovery)
4. [Server-Side Discovery](#4-server-side-discovery)
5. [Service Registry](#5-service-registry)
6. [ZooKeeper](#6-zookeeper)
7. [etcd](#7-etcd)
8. [Consul](#8-consul)
9. [DNS-Based Discovery](#9-dns-based-discovery)
10. [Comparison & Trade-offs](#10-comparison--trade-offs)
11. [Key Takeaways](#11-key-takeaways)

---

## 1. Overview

In a microservices architecture, services need to find and communicate with each
other. Service instances are dynamic — they scale up, scale down, crash, and
restart on different IPs/ports. You can't hardcode addresses.

```
Monolith (simple):                Microservices (problem):

┌─────────────────┐               ┌──────────┐   ┌──────────┐
│   One Process   │               │ Order    │──►│ Payment  │
│                 │               │ Service  │   │ Service  │
│ Order → Payment │               └──────────┘   └──────────┘
│ (function call) │                    │              ???
└─────────────────┘                    ▼          Where is it?
                                  ┌──────────┐   IP? Port?
                                  │ Inventory│   How many instances?
                                  │ Service  │
                                  └──────────┘
```

**Service discovery** solves: "How does Service A find the current network
location of Service B?"

---

## 2. Why Service Discovery?

### The Core Problem

In modern deployments (Kubernetes, cloud VMs, containers), service instances
are ephemeral:

```
Time T1:                          Time T2 (after scaling):

Payment Service                   Payment Service
  Instance 1: 10.0.1.5:8080        Instance 1: 10.0.1.5:8080
  Instance 2: 10.0.1.6:8080        Instance 2: 10.0.1.6:8080
                                    Instance 3: 10.0.2.3:8080  ← NEW
                                    Instance 4: 10.0.2.7:8080  ← NEW

Time T3 (after crash):

Payment Service
  Instance 1: 10.0.1.5:8080  ← DEAD
  Instance 2: 10.0.1.6:8080
  Instance 3: 10.0.2.3:8080
  Instance 4: 10.0.2.7:8080
```

| Requirement             | Description                                         |
|------------------------|------------------------------------------------------|
| Dynamic registration   | New instances register automatically on startup      |
| Health monitoring      | Detect and remove unhealthy instances                |
| Load distribution      | Spread requests across healthy instances             |
| Real-time updates      | Clients get notified when instances change           |
| Fault tolerance        | Registry itself must be highly available             |

---

## 3. Client-Side Discovery

The client is responsible for determining the network locations of available
service instances and load-balancing across them.

```
┌──────────────────────────────────────────────────┐
│                   Client Service                 │
│                                                  │
│  1. Query Registry: "Where is Payment Service?"  │
│  2. Registry returns: [10.0.1.5, 10.0.1.6]      │
│  3. Client picks one (round-robin, random, etc.) │
│  4. Client sends request directly                │
│                                                  │
└──────────────┬───────────────────────────────────┘
               │
               ▼
      ┌─────────────────┐
      │ Service Registry │
      │  (ZooKeeper,     │
      │   etcd, Eureka)  │
      └─────────────────┘
               ▲
               │ Register on startup
      ┌────────┴────────┐
      │                 │
┌──────────┐     ┌──────────┐
│ Payment  │     │ Payment  │
│ Inst. 1  │     │ Inst. 2  │
└──────────┘     └──────────┘
```

**Pros**: No extra hop, client can make smart routing decisions (e.g., prefer
same-zone instance), fewer moving parts.
**Cons**: Couples discovery logic into every client (each language needs a
library), clients must handle registry failures.

**Example**: Netflix Eureka + Ribbon.

---

## 4. Server-Side Discovery

The client sends requests to a load balancer / router, which queries the
registry and forwards to an appropriate instance.

```
┌──────────────┐
│ Client       │
│ Service      │──── request ────►┌─────────────────┐
└──────────────┘                  │  Load Balancer / │
                                  │  API Gateway     │
                                  │                  │
                                  │  1. Query registry│
                                  │  2. Pick instance │
                                  │  3. Forward       │
                                  └──────┬──────────┘
                                         │
                              ┌──────────┼──────────┐
                              │          │          │
                         ┌─────────┐ ┌─────────┐ ┌─────────┐
                         │ Inst. 1 │ │ Inst. 2 │ │ Inst. 3 │
                         └─────────┘ └─────────┘ └─────────┘
```

**Pros**: Client is simple (just knows the load balancer address), discovery
logic is centralized.
**Cons**: Extra network hop, load balancer is a potential bottleneck/SPOF
(must be HA itself).

**Example**: AWS ALB + ECS, Kubernetes Service + kube-proxy.

---

## 5. Service Registry

The registry is the database of available service instances. Services must
register/deregister, and the registry must detect failures.

### Registration Patterns

```
Self-Registration:
  Service instance registers itself on startup.
  Sends periodic heartbeats to stay registered.
  De-registers on shutdown.
  
  + Simple, no extra component
  - Couples registration logic into service code

Third-Party Registration:
  A separate "Registrar" component watches for new instances
  (e.g., monitors Docker events, Kubernetes API) and registers them.
  
  + Services are unaware of the registry
  - Extra infrastructure component to manage
```

### Health Checking

```
Heartbeat (TTL-based):
  Service sends heartbeat every 10s.
  If registry doesn't receive heartbeat for 30s → mark unhealthy.
  
  Used by: Eureka, Consul

Active Health Check:
  Registry (or agent) periodically pings service health endpoint.
  GET /health → 200 OK = healthy, 5xx or timeout = unhealthy.
  
  Used by: Consul, Kubernetes liveness probes

Passive Health Check:
  Observe real traffic. If error rate exceeds threshold → mark unhealthy.
  
  Used by: Envoy, NGINX (upstream health)
```

---

## 6. ZooKeeper

Apache ZooKeeper is a distributed coordination service. Not specifically designed
for service discovery but widely used for it.

```
ZooKeeper Data Model (tree of znodes):

  /services
    /payment-service
      /instance-001  → {"host":"10.0.1.5","port":8080}  (ephemeral)
      /instance-002  → {"host":"10.0.1.6","port":8080}  (ephemeral)
    /order-service
      /instance-001  → {"host":"10.0.2.1","port":9090}  (ephemeral)

Registration:
  On startup, service creates an ephemeral znode under /services/<name>/.
  
  Ephemeral = auto-deleted when the client session disconnects (crash/shutdown).
  No need for manual de-registration!

Discovery:
  Client calls getChildren("/services/payment-service") 
  and sets a WATCH on the path.
  
  When a child is added/removed → ZooKeeper notifies the client.
  Client refreshes its list of available instances.
```

### ZooKeeper for Leader Election

```
Each participant creates a sequential ephemeral node:
  /election/candidate-0000000001
  /election/candidate-0000000002
  /election/candidate-0000000003

The node with the LOWEST sequence number is the leader.
If the leader crashes → its ephemeral node disappears →
the next-lowest becomes the new leader.

Used by: Kafka (controller election), HBase (master election)
```

**Pros**: Battle-tested, strong consistency (ZAB consensus), ephemeral nodes
handle crash cleanup, watches for real-time notifications.
**Cons**: Java-based (heavy), complex to operate, not purpose-built for
service discovery, limited scalability for very large clusters.

---

## 7. etcd

etcd is a distributed key-value store using Raft consensus. It's the backbone
of Kubernetes.

```
etcd Data Model (flat key-value with prefixes):

  /services/payment-service/instance-001 → {"host":"10.0.1.5","port":8080}
  /services/payment-service/instance-002 → {"host":"10.0.1.6","port":8080}
  /services/order-service/instance-001   → {"host":"10.0.2.1","port":9090}

Registration (with lease):
  1. Create a lease with TTL (e.g., 15s)
  2. PUT the key with the lease attached
  3. KeepAlive — send periodic heartbeats to renew the lease
  4. If service crashes → heartbeat stops → lease expires → key deleted

Discovery:
  GET with prefix: /services/payment-service/
  Returns all keys matching the prefix.
  
  WATCH with prefix: /services/payment-service/
  Streams real-time events (PUT, DELETE) for any key under the prefix.
```

```python
# etcd service registration example (Python)
import etcd3

client = etcd3.client()

# Create a lease (auto-expires in 15 seconds)
lease = client.lease(ttl=15)

# Register the service with the lease
client.put(
    '/services/payment/instance-001',
    '{"host":"10.0.1.5","port":8080}',
    lease=lease
)

# Keep the lease alive (background thread)
# If this process crashes, the lease expires and the key is deleted.
lease.keepalive()
```

**Pros**: Simple HTTP/gRPC API, strong consistency (Raft), lightweight (Go
binary), built into Kubernetes.
**Cons**: Not purpose-built for service discovery (no health checking built-in),
write throughput limited by Raft consensus.

---

## 8. Consul

HashiCorp Consul is purpose-built for service discovery, configuration, and
service mesh.

```
Consul Architecture:

  ┌──────────────────────────────────────────────┐
  │                Consul Cluster                │
  │  ┌────────┐  ┌────────┐  ┌────────┐         │
  │  │Server 1│  │Server 2│  │Server 3│ (Raft)  │
  │  └────────┘  └────────┘  └────────┘         │
  └──────────────────────────────────────────────┘
        ▲              ▲              ▲
        │ Gossip        │              │
  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ Agent   │    │ Agent   │    │ Agent   │
  │ (on     │    │ (on     │    │ (on     │
  │  host)  │    │  host)  │    │  host)  │
  └─────────┘    └─────────┘    └─────────┘
    ↕     ↕        ↕     ↕        ↕
  Svc A  Svc B   Svc C  Svc D   Svc E

Features:
  - Service registration via local agent
  - Built-in health checking (HTTP, TCP, gRPC, script)
  - DNS interface for discovery (dig payment.service.consul)
  - HTTP API for programmatic discovery
  - Key-value store for configuration
  - Service mesh with mTLS (Consul Connect)
  - Multi-datacenter support
```

### Consul DNS Discovery

```
# Instead of calling an API, just use DNS:
dig @127.0.0.1 -p 8600 payment.service.consul SRV

# Returns:
payment.service.consul.  0 IN SRV 1 1 8080 instance-001.node.dc1.consul.
payment.service.consul.  0 IN SRV 1 1 8080 instance-002.node.dc1.consul.

# Applications can resolve service names like normal hostnames.
# No code changes needed — just point DNS to Consul.
```

**Pros**: Purpose-built for service discovery, built-in health checking,
DNS interface (transparent), multi-datacenter, service mesh capabilities.
**Cons**: Another infrastructure component to manage, Consul agents on
every host, more complex than etcd for simple use cases.

---

## 9. DNS-Based Discovery

The simplest form of service discovery — use DNS.

```
Traditional DNS:
  payment.internal.company.com → 10.0.1.5

  Pros: Universal, every language/framework supports DNS
  Cons: DNS caching (TTL) causes stale entries,
        slow propagation on changes,
        no health checking built-in

Modern DNS-SD (Service Discovery):
  SRV records provide port information:
  _payment._tcp.company.com  SRV  10 0 8080 payment-1.company.com
  _payment._tcp.company.com  SRV  10 0 8080 payment-2.company.com
```

### Kubernetes DNS

Kubernetes provides built-in DNS-based service discovery:

```
Every Kubernetes Service gets a DNS name:

  payment-service.default.svc.cluster.local

  kube-dns / CoreDNS resolves this to the ClusterIP.
  kube-proxy routes the ClusterIP to a healthy pod (iptables/IPVS).

  Pod → DNS lookup → ClusterIP → kube-proxy → actual Pod IP

  This is effectively server-side discovery via DNS.
```

---

## 10. Comparison & Trade-offs

| Feature           | ZooKeeper       | etcd            | Consul          | Kubernetes DNS  |
|-------------------|-----------------|-----------------|-----------------|-----------------|
| Consensus         | ZAB             | Raft            | Raft            | Raft (etcd)     |
| Health checks     | Session/ephemeral| Lease TTL      | Built-in (rich) | Liveness probes |
| DNS interface     | No              | No              | Yes             | Yes             |
| Service mesh      | No              | No              | Yes (Connect)   | Yes (Istio)     |
| Multi-DC          | Manual          | Manual          | Built-in        | Federation      |
| API               | Custom protocol | gRPC + HTTP     | HTTP + DNS      | kubectl / API   |
| Language          | Java            | Go              | Go              | N/A             |
| Used by           | Kafka, Hadoop   | Kubernetes      | HashiCorp stack | K8s native      |
| Complexity        | High            | Medium          | Medium          | Low (if on K8s) |

### Decision Guide

```
Already on Kubernetes?
  └── Use Kubernetes Service + DNS (built-in, zero extra infra)

Need multi-datacenter discovery?
  └── Consul (first-class multi-DC support)

Running Kafka or Hadoop?
  └── ZooKeeper (already in your stack)

Need a lightweight, general-purpose coordination store?
  └── etcd (simple API, strong consistency)

Want service mesh + discovery + config in one tool?
  └── Consul (all-in-one)

Simple setup, few services?
  └── DNS with health-checked load balancer (ALB, NGINX)
```

---

## 11. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Service discovery is essential for microservices | Hardcoded IPs don't work when instances are ephemeral |
| Two patterns: client-side vs server-side | Client-side is more efficient; server-side is simpler for clients |
| Registry must be highly available | If the registry goes down, no service can find any other service |
| Health checking prevents routing to dead instances | Heartbeats, active probes, or passive observation |
| Ephemeral nodes / leases handle crash cleanup | ZooKeeper ephemeral znodes and etcd leases auto-expire |
| DNS is the simplest form of discovery | Works everywhere, but suffers from caching and stale entries |
| Kubernetes solves this natively | kube-dns + Services + probes = built-in service discovery |
| Consul is the most feature-rich standalone option | Discovery + health checks + DNS + config + service mesh |
