# Availability Patterns

> How do you keep your system running when things fail? These patterns ensure your system stays up.

---

## Table of Contents

1. [Measuring Availability](#1-measuring-availability)
2. [Availability in Numbers (The Nines)](#2-availability-in-numbers-the-nines)
3. [Availability in Sequence vs Parallel](#3-availability-in-sequence-vs-parallel)
4. [Fail-over Patterns](#4-fail-over-patterns)
5. [Replication Patterns](#5-replication-patterns)
6. [Multi-Region / Multi-Datacenter](#6-multi-region--multi-datacenter)
7. [Health Checks and Self-Healing](#7-health-checks-and-self-healing)
8. [Graceful Degradation](#8-graceful-degradation)
9. [Designing for Failure: Real-World Strategies](#9-designing-for-failure-real-world-strategies)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Measuring Availability

Availability is the **percentage of time** the system is operational and serving requests correctly.

```
                    Uptime
Availability = ─────────────────
                Uptime + Downtime
```

### What Counts as "Down"?

- System returns errors (5xx)
- System doesn't respond at all (timeout)
- System responds but with incorrect data
- System is too slow to be useful (latency SLA breach)

---

## 2. Availability in Numbers (The Nines)

| Availability | Common Name | Downtime/Year | Downtime/Month | Downtime/Week | Downtime/Day |
|-------------|-------------|---------------|----------------|---------------|--------------|
| 99% | Two nines | 3.65 days | 7.31 hours | 1.68 hours | 14.4 min |
| 99.9% | Three nines | 8.76 hours | 43.8 min | 10.1 min | 1.44 min |
| 99.95% | Three and a half nines | 4.38 hours | 21.9 min | 5.04 min | 43.2 sec |
| 99.99% | Four nines | 52.6 min | 4.38 min | 1.01 min | 8.64 sec |
| 99.999% | Five nines | 5.26 min | 26.3 sec | 6.05 sec | 0.86 sec |

### Context for the Numbers

```
99%     → Fine for internal tools, batch processing
99.9%   → Standard for most B2B SaaS products
99.95%  → Standard for cloud services (e.g., AWS EC2 SLA)
99.99%  → Required for critical infrastructure (payment systems)
99.999% → Telecom-grade (phone networks, emergency services)
```

### Real SLAs from Major Services

| Service | SLA |
|---------|-----|
| AWS EC2 | 99.99% |
| AWS S3 | 99.99% |
| Google Cloud Compute | 99.99% |
| Azure VMs | 99.95% - 99.99% |
| Stripe API | 99.99% |
| Twilio | 99.95% |

---

## 3. Availability in Sequence vs Parallel

### Components in Sequence (Both Must Work)

If your request goes through Component A **then** Component B, overall availability **decreases:**

```
Availability(Total) = Availability(A) × Availability(B)

Example:
  Web Server (99.9%) → Database (99.9%)
  Total = 0.999 × 0.999 = 0.998 = 99.8%

  Add more components in sequence:
  LB (99.9%) → Web (99.9%) → App (99.9%) → DB (99.9%)
  Total = 0.999⁴ = 0.996 = 99.6%

Each component in the chain reduces overall availability.
```

```
┌────────┐    ┌────────┐    ┌────────┐
│  LB    │ →  │  App   │ →  │   DB   │
│ 99.99% │    │ 99.9%  │    │ 99.9%  │
└────────┘    └────────┘    └────────┘

Total = 0.9999 × 0.999 × 0.999 = 99.79%
```

### Components in Parallel (Only One Needs to Work)

If you have **redundant** components, overall availability **increases:**

```
Availability(Total) = 1 - (1 - Availability(A)) × (1 - Availability(B))

Example:
  Server A (99.9%) in parallel with Server B (99.9%)
  Total = 1 - (0.001 × 0.001) = 1 - 0.000001 = 99.9999%

  Two 99.9% servers in parallel give you 99.9999% (six nines)!
```

```
         ┌────────┐
    ┌──→ │ App 1  │ ──┐
    │    │ 99.9%  │   │
────┤    └────────┘   ├────
    │    ┌────────┐   │
    └──→ │ App 2  │ ──┘
         │ 99.9%  │
         └────────┘

Total = 1 - (0.001)² = 99.9999%
```

### Key Insight

The way to improve availability is to **add redundancy (parallel components)** and **reduce the number of serial dependencies.**

---

## 4. Fail-over Patterns

### Active-Passive (Hot Standby)

A **primary** server handles all requests. A **standby** server is ready to take over if the primary fails.

```
Normal operation:
  ┌────────────┐  heartbeat  ┌────────────┐
  │  PRIMARY   │ ←─────────→ │  STANDBY   │
  │  (Active)  │             │  (Passive) │
  │  Handles   │             │  Idle or   │
  │  all traffic│            │  replicating│
  └────────────┘             └────────────┘
       ▲
       │ All traffic
       │

Failover:
  ┌────────────┐             ┌────────────┐
  │  PRIMARY   │  ╳ dead ╳   │  STANDBY   │
  │  (DOWN)    │             │  → Active  │
  └────────────┘             └────────────┘
                                   ▲
                                   │ All traffic (IP takeover)
                                   │
```

**How it works:**
1. The standby sends **heartbeat** signals to the primary
2. If the heartbeat stops, the standby takes over the primary's IP address
3. The standby serves all requests

**Hot vs Cold standby:**
- **Hot standby:** Passive server is running and receiving replicated data. Failover is fast (seconds).
- **Cold standby:** Passive server needs to start up and load data. Failover is slow (minutes).

**Drawback:** The standby sits idle most of the time — wasted resources.

### Active-Active

**Both servers actively handle traffic** at the same time. If one fails, the other absorbs its load.

```
Normal operation:
  ┌────────────┐             ┌────────────┐
  │  Server A  │             │  Server B  │
  │  (Active)  │ ←─sync────→ │  (Active)  │
  │  50% load  │             │  50% load  │
  └────────────┘             └────────────┘
       ▲                          ▲
       │        Load Balancer     │
       └────────────┬─────────────┘
                    │
              All traffic

Failover:
  ┌────────────┐             ┌────────────┐
  │  Server A  │  ╳ dead ╳   │  Server B  │
  │  (DOWN)    │             │  (Active)  │
  └────────────┘             │  100% load │
                             └────────────┘
```

**Advantages:**
- Better resource utilization — both servers do useful work
- No wasted standby capacity
- Can handle more total traffic than active-passive

**Disadvantages:**
- More complex — need to handle data synchronization
- DNS or load balancer must know about both servers
- Potential for *split-brain* if servers can't communicate

### Disadvantages of All Fail-over Approaches

- **Potential data loss:** If the active server fails before replicating recent writes to the standby
- **Complexity:** Need health monitoring, automatic IP takeover, data sync
- **Additional hardware:** At least double the servers for full redundancy
- **Split-brain risk:** Both servers think they're the primary → data corruption

---

## 5. Replication Patterns

### Synchronous Replication

Writes are confirmed to the client **only after** the data is written to all replicas.

```
Client → Write → Primary → Replica 1 (sync) ✅
                         → Replica 2 (sync) ✅
                         ← ACK to client

Pro: Zero data loss on failover (all replicas are current)
Con: Higher write latency (must wait for all replicas)
     Any slow replica slows down ALL writes
```

### Asynchronous Replication

Writes are confirmed to the client **immediately** after the primary stores them. Replicas catch up in the background.

```
Client → Write → Primary ← ACK to client (immediate)
                    │
                    └── Background replication to replicas

Pro: Low write latency
Con: Potential data loss if primary fails before replication
     Replicas might serve stale reads
```

### Semi-Synchronous Replication

A compromise: wait for at least **one** replica to confirm, then ACK.

```
Client → Write → Primary → Replica 1 (sync) ✅ ← ACK
                         → Replica 2 (async, background)

Pro: At least one copy survives primary failure
Con: Some added latency, but less than full synchronous
```

### Which to Choose

| Strategy | Data Loss Risk | Write Latency | Use Case |
|----------|---------------|---------------|----------|
| Synchronous | Zero | High | Financial transactions |
| Asynchronous | Possible | Low | Social media, logs |
| Semi-synchronous | Minimal | Medium | General-purpose databases |

---

## 6. Multi-Region / Multi-Datacenter

For the highest availability, run your system in **multiple geographic regions.**

```
┌─────────────────┐         ┌─────────────────┐
│   US-East       │         │   EU-West       │
│   Region        │ ←─────→ │   Region        │
│                 │  sync   │                 │
│  ┌───┐ ┌───┐   │         │  ┌───┐ ┌───┐   │
│  │App│ │App│   │         │  │App│ │App│   │
│  └───┘ └───┘   │         │  └───┘ └───┘   │
│  ┌────────────┐ │         │  ┌────────────┐ │
│  │  Database  │ │         │  │  Database  │ │
│  │  (Primary) │ │         │  │  (Replica) │ │
│  └────────────┘ │         │  └────────────┘ │
└─────────────────┘         └─────────────────┘
         ▲                           ▲
         │     Global DNS /          │
         │     Traffic Manager       │
         └───────────┬───────────────┘
                     │
               User Traffic
```

### Benefits

- Survives an entire data center failure
- Lower latency for geographically distributed users
- Data sovereignty compliance (EU data stays in EU)

### Challenges

- Cross-region replication latency (50-200ms)
- Conflict resolution for multi-master writes
- Significantly higher cost and operational complexity
- Testing failover is hard and risky

---

## 7. Health Checks and Self-Healing

### Health Check Types

| Type | How It Works | Detects |
|------|-------------|---------|
| **TCP check** | Can we open a TCP connection? | Server is running |
| **HTTP check** | Does `/health` return 200? | Server is serving requests |
| **Deep health check** | Does `/health/deep` successfully query the DB, cache, and dependencies? | Server and all its dependencies are working |
| **Synthetic monitoring** | Run a real user scenario (sign up, search, checkout) | End-to-end system is working |

### Example: AWS Load Balancer Health Check

```
ALB Configuration:
  Path:     /health
  Interval: 30 seconds
  Timeout:  5 seconds
  Healthy threshold:   2 consecutive successes
  Unhealthy threshold: 3 consecutive failures

Timeline:
  T0:  /health → 200 OK ✅
  T30: /health → 200 OK ✅
  T60: /health → Timeout ❌ (1 of 3)
  T90: /health → 500 Error ❌ (2 of 3)
  T120:/health → Timeout ❌ (3 of 3) → MARK UNHEALTHY
                                       → Stop routing traffic
```

### Self-Healing

Auto-recovery mechanisms that fix problems without human intervention:

```
1. Auto-restart: Container crashes → Kubernetes restarts it
2. Auto-scaling: CPU > 80% → Launch new instances
3. Circuit breaker: Downstream service failing → Stop calling it, use fallback
4. Auto-failover: Primary DB down → Promote replica automatically
```

---

## 8. Graceful Degradation

When parts of your system fail, **degrade functionality** rather than going fully offline.

### Examples

```
Netflix:
  Normal: Personalized recommendations based on your viewing history
  Degraded: Generic "Top 10" recommendations (recommendation engine is down)
  → Users still get SOMETHING, even if it's not personalized

Amazon:
  Normal: Real-time inventory count, personalized pricing
  Degraded: Cached inventory ("Usually ships in 2-3 days"), static prices
  → Users can still browse and add to cart

Twitter:
  Normal: Real-time timeline with full features
  Degraded: Cached timeline, "likes" disabled (under heavy load)
  → Users can still read tweets
```

### Feature Flags for Degradation

```
if (feature_flags.is_enabled("recommendations_engine")) {
    return personalized_recommendations(user)
} else {
    return cached_top_10_recommendations()  // graceful fallback
}

When the recommendations service is struggling,
ops team flips the flag to use the fallback.
```

---

## 9. Designing for Failure: Real-World Strategies

### Netflix's Chaos Engineering

```
"Chaos Monkey" — randomly kills production instances
"Chaos Kong" — simulates entire region failures
"Latency Monkey" — adds artificial delays

Philosophy: If you don't test failure scenarios regularly,
you'll be surprised when they happen for real.
```

### The Bulkhead Pattern

Isolate failures so they don't cascade. Named after ship bulkheads that prevent one leak from sinking the whole ship.

```
Without bulkhead:
  ┌─────────────────────────────┐
  │       Shared Thread Pool     │
  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
  │  │ S1│ │ S2│ │ S3│ │ S4│  │
  │  └───┘ └───┘ └───┘ └───┘  │
  └─────────────────────────────┘
  If Service 2 hangs, it consumes all threads.
  Services 1, 3, 4 can't get threads → everything fails!

With bulkhead:
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Pool for  │ │ Pool for  │ │ Pool for  │
  │ Service 1 │ │ Service 2 │ │ Service 3 │
  │ ┌──┐┌──┐ │ │ ┌──┐┌──┐ │ │ ┌──┐┌──┐ │
  │ └──┘└──┘ │ │ └──┘└──┘ │ │ └──┘└──┘ │
  └──────────┘ └──────────┘ └──────────┘
  Service 2 hangs? Only its pool is exhausted.
  Services 1 and 3 keep working normally.
```

### The Circuit Breaker Pattern

Prevent cascading failures by "breaking the circuit" when a downstream service is unhealthy.

```
States:
  CLOSED   → Normal operation, requests pass through
  OPEN     → Service is unhealthy, fail immediately without calling it
  HALF-OPEN → Test with a few requests to see if service recovered

Transitions:
  CLOSED → OPEN: When failure rate exceeds threshold (e.g., > 50% errors)
  OPEN → HALF-OPEN: After a timeout period (e.g., 30 seconds)
  HALF-OPEN → CLOSED: If test requests succeed
  HALF-OPEN → OPEN: If test requests still fail

Example:
  Payment service is down.
  After 5 failures in 10 seconds → Circuit OPENS
  Next 30 seconds: All payment requests immediately return
                   "Payment temporarily unavailable"
                   (instead of timing out for 30s each)
  After 30 seconds: Try one request → if it works → CLOSE circuit
```

---

## 10. Key Takeaways

1. **Availability = Uptime / (Uptime + Downtime).** Measure in "nines." Each additional nine is exponentially harder.

2. **Serial components multiply availability (decrease it).** Parallel components improve it. Redundancy is the key to high availability.

3. **Active-passive failover** is simpler but wastes resources. **Active-active** is more efficient but more complex.

4. **Replication guarantees vary:** Synchronous = no data loss but slower writes. Asynchronous = fast writes but possible data loss.

5. **Multi-region deployments** provide the highest availability but are the most complex and expensive.

6. **Design for graceful degradation.** Partial functionality is always better than complete failure.

7. **Test your failure modes.** If you haven't tested it, it doesn't work. Use chaos engineering approaches.

8. **Use circuit breakers and bulkheads** to prevent cascading failures. One failing service shouldn't take down your entire system.

---

## 🔥 Senior Interview Questions

1. Your SLA promises 99.99% availability (four 9s). You have three services in series, each at 99.95%. What's your actual availability? How do you reach four 9s without improving individual service reliability? [Answer](QnA-Answer-Key.md#5-availability-patterns)

2. Active-active vs active-passive failover: when would you choose each? What are the hidden complexities of active-active that most people underestimate? [Answer](QnA-Answer-Key.md#5-availability-patterns)

3. A database failover takes 30 seconds. During that time, all writes are lost. How would you redesign the system to achieve zero data loss during failover? Discuss synchronous replication, WAL shipping, and their trade-offs. [Answer](QnA-Answer-Key.md#5-availability-patterns)

4. Your system uses health checks to detect failure. A service is responding to health checks but returning incorrect data (a "gray failure"). How do you detect and handle this? [Answer](QnA-Answer-Key.md#5-availability-patterns)

5. Explain the circuit breaker pattern in detail. What are the three states? How do you set the thresholds? What happens to in-flight requests when the circuit opens? [Answer](QnA-Answer-Key.md#5-availability-patterns)

6. You're designing a system that must survive an entire AWS region going down. Walk through the architecture: DNS failover, data replication strategy, state management, and the cost implications. [Answer](QnA-Answer-Key.md#5-availability-patterns)

7. An interviewer says: "Just add more replicas for higher availability." What are the diminishing returns? At what point do more replicas actually hurt availability (hint: coordination overhead, split-brain risk)? [Answer](QnA-Answer-Key.md#5-availability-patterns)

8. Compare these approaches to handling a downstream service being slow: timeout + retry, circuit breaker, bulkhead isolation, and graceful degradation. When do you use each, and can they be combined? [Answer](QnA-Answer-Key.md#5-availability-patterns)

9. Your CDN provider goes down and 40% of your traffic fails. How should your system respond automatically? Design the fallback architecture. [Answer](QnA-Answer-Key.md#5-availability-patterns)

10. Explain the difference between high availability and disaster recovery. A company says "we have DR, so we're highly available." Why is this wrong? [Answer](QnA-Answer-Key.md#5-availability-patterns)

---

## 📚 Further Reading

- [Patterns for Resilient Architecture (Adrian Hornsby, AWS)](https://medium.com/@adhorn/patterns-for-resilient-architecture-part-1-d3b60cd8d2b6) — Excellent 4-part series on failover, redundancy, and bulkheads.
- [Release It! by Michael Nygard](https://pragprog.com/titles/mnee2/release-it-second-edition/) — The definitive book on stability patterns (circuit breakers, bulkheads, timeouts).
- [Chaos Engineering at Netflix (YouTube)](https://www.youtube.com/watch?v=CZ3wIuvmHeM) — How Netflix tests availability through intentional failure injection.
