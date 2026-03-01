# Observability

## Table of Contents

1. [Overview](#1-overview)
2. [Three Pillars of Observability](#2-three-pillars-of-observability)
3. [Logging](#3-logging)
4. [Metrics](#4-metrics)
5. [Distributed Tracing](#5-distributed-tracing)
6. [Alerting](#6-alerting)
7. [Observability in Practice](#7-observability-in-practice)
8. [Health Checks and SLOs](#8-health-checks-and-slos)
9. [Key Takeaways](#9-key-takeaways)

---

## 1. Overview

### Monitoring vs Observability

**Monitoring** tells you *when* something is wrong.
**Observability** tells you *why* something is wrong.

Monitoring is a subset of observability. With good observability, you can debug
issues you've never seen before — without deploying new code.

```
Monitoring: "The server's CPU is at 95%."
Observability: "CPU is at 95% because the search service is running an
               O(n²) query for user X who has 50,000 items, triggered
               by a new feature flag rolled out 10 minutes ago."
```

### Why Observability Matters at Scale

```
Monolith:
  One server, one log file, one database.
  Debugging: SSH in, tail the log, find the error.

Microservices at scale:
  200 services, 500 containers, 3 regions, 100K requests/sec.
  Debugging: Which of the 200 services is slow? Which instance?
  Which request? Which dependency? Which line of code?
  
  You CAN'T SSH into 500 containers and grep logs.
  You NEED structured, centralized observability.
```

---

## 2. Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                    Observability                                 │
│  ┌───────────┐    ┌───────────┐    ┌──────────────────┐         │
│  │  Logging  │    │  Metrics  │    │ Distributed      │         │
│  │           │    │           │    │ Tracing          │         │
│  │ What      │    │ How much  │    │ What path        │         │
│  │ happened  │    │ (numbers) │    │ (request flow)   │         │
│  │           │    │           │    │                  │         │
│  │ Text/JSON │    │ Counters  │    │ Spans across     │         │
│  │ events    │    │ Gauges    │    │ services         │         │
│  │           │    │ Histograms│    │                  │         │
│  └───────────┘    └───────────┘    └──────────────────┘         │
│                                                                  │
│  When to use:     When to use:     When to use:                 │
│  Debug specific   Dashboard &      Trace a request              │
│  errors/events    alerting on      across multiple              │
│                   trends           services                     │
└─────────────────────────────────────────────────────────────────┘
```

| Pillar            | Data Type      | Cardinality  | Retention | Cost  |
|-------------------|---------------|--------------|-----------|-------|
| Logs              | Text/JSON     | Very high    | Days-weeks| High  |
| Metrics           | Numbers       | Low-medium   | Months    | Low   |
| Traces            | Structured    | Medium-high  | Days-weeks| Medium|

---

## 3. Logging

### Log Levels

```
FATAL   → Application is about to crash. Wake someone up.
ERROR   → Something failed. Needs attention but app continues.
WARN    → Unexpected but handled. Could become a problem.
INFO    → Normal operations. What happened, milestones.
DEBUG   → Detailed diagnostic information (not in production usually).
TRACE   → Very fine-grained (method entry/exit, variable values).
```

### Structured vs Unstructured Logging

```
Unstructured (bad for machines, hard to search):
  2024-01-15 10:30:00 ERROR Failed to process order 12345 for user alice

Structured (great for search and analysis):
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "ERROR",
    "service": "order-service",
    "message": "Failed to process order",
    "order_id": "12345",
    "user_id": "alice",
    "error": "InsufficientInventory",
    "trace_id": "abc123",
    "span_id": "def456",
    "duration_ms": 250
  }
```

Always use structured logging in production. It enables:
- Searching: `order_id = 12345`
- Aggregation: `count by error type`
- Correlation: `trace_id = abc123` to see all logs for a request

### Centralized Logging Architecture (ELK/EFK)

```
Services          Collection        Storage           Visualization
                                    
┌─────────┐       ┌──────────┐     ┌──────────────┐  ┌───────────┐
│Service A │──────►│          │     │              │  │           │
└─────────┘       │ Logstash │     │ Elasticsearch│  │  Kibana   │
┌─────────┐       │    or    │────►│              │──►│           │
│Service B │──────►│ Fluentd  │     │ (index &     │  │ (search & │
└─────────┘       │    or    │     │  search)     │  │  dashboards│
┌─────────┐       │ Fluent   │     └──────────────┘  └───────────┘
│Service C │──────►│  Bit     │
└─────────┘       └──────────┘

Alternative stacks:
  - Loki + Grafana (lightweight, label-based, cheaper)
  - Datadog Logs
  - Splunk
  - AWS CloudWatch Logs
```

### Logging Best Practices

| Do                                          | Don't                                    |
|---------------------------------------------|------------------------------------------|
| Use structured logging (JSON)               | Log passwords, tokens, PII              |
| Include trace_id and span_id                | Log too much in production (cost!)      |
| Log at appropriate levels                   | Use print statements instead of loggers |
| Include context (user_id, order_id)         | Log full request/response bodies        |
| Set log retention policies                  | Ignore log rotation and disk space      |
| Centralize logs from all services           | SSH into servers to read log files      |

---

## 4. Metrics

Metrics are **numeric measurements** collected over time. They're cheap to store,
fast to query, and ideal for dashboards and alerting.

### Metric Types

```
Counter:
  Only goes up (or resets to 0). Tracks cumulative totals.
  Examples: total requests, total errors, bytes transferred.
  
  http_requests_total{method="GET", path="/api/users", status="200"} = 15432
  
  Use rate() to get per-second rate:
    rate(http_requests_total[5m]) → 25 req/sec

Gauge:
  Goes up and down. Tracks current value.
  Examples: CPU usage, memory usage, active connections, queue depth.
  
  system_cpu_usage_percent = 67.5
  active_connections = 142

Histogram:
  Tracks distribution of values in configurable buckets.
  Examples: request duration, response size.
  
  http_request_duration_seconds_bucket{le="0.01"}  = 1000  (≤10ms)
  http_request_duration_seconds_bucket{le="0.05"}  = 4500  (≤50ms)
  http_request_duration_seconds_bucket{le="0.1"}   = 9000  (≤100ms)
  http_request_duration_seconds_bucket{le="0.5"}   = 9800  (≤500ms)
  http_request_duration_seconds_bucket{le="+Inf"}  = 10000 (all)
  
  Can compute percentiles from buckets:
    histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
    → P99 latency

Summary:
  Pre-computed percentiles on the client side.
  Less flexible than histogram but more accurate for specific quantiles.
```

### RED and USE Methods

Two frameworks for what metrics to collect:

```
RED Method (for request-driven services — APIs, web servers):
  R — Rate:     How many requests per second?
  E — Errors:   How many requests are failing?
  D — Duration: How long do requests take?

USE Method (for resources — CPU, memory, disk, network):
  U — Utilization: How busy is the resource? (0-100%)
  S — Saturation:  How much queuing/backlog? (waiting work)
  E — Errors:      How many errors?
```

### Four Golden Signals (Google SRE)

```
1. Latency:      Time to serve a request (differentiate success vs error latency)
2. Traffic:      Demand on the system (requests/sec, transactions/sec)
3. Errors:       Rate of failed requests (HTTP 5xx, application errors)
4. Saturation:   How "full" the service is (CPU, memory, I/O, queue depth)
```

### Prometheus + Grafana Architecture

```
┌──────────┐    Prometheus scrapes    ┌────────────┐     ┌──────────┐
│ Service A │◄──────── /metrics ──────│ Prometheus │────►│ Grafana  │
│  :8080    │                         │            │     │          │
└──────────┘                         │ Time-series│     │Dashboards│
                                      │ database   │     │ & alerts │
┌──────────┐    Prometheus scrapes    │            │     │          │
│ Service B │◄──────── /metrics ──────│            │     └──────────┘
│  :8080    │                         └─────┬──────┘
└──────────┘                               │
                                           │ AlertManager
┌──────────┐    Prometheus scrapes         ▼
│ Service C │◄──────── /metrics ──────  Alerts → PagerDuty / Slack / Email
│  :8080    │
└──────────┘

Pull model: Prometheus pulls metrics from services every 15-30 seconds.
Services expose a /metrics endpoint with current metric values.
```

### Labels and Cardinality

```
Good (low cardinality):
  http_requests_total{method="GET", status="200", service="order"}
  
  Labels: method (GET/POST/PUT/DELETE = 4 values)
          status (200/201/400/404/500 = 5 values)
          service (order/user/payment = ~20 values)
  Total time series: 4 × 5 × 20 = 400 → Fine

Bad (high cardinality — will kill Prometheus):
  http_requests_total{user_id="user_12345", request_id="req_abc"}
  
  Labels: user_id (millions of values)
          request_id (unique per request — infinite values)
  Total time series: Millions → Prometheus explodes

Rule: Never use unbounded values (user IDs, request IDs, email addresses) as metric labels.
      Use logs or traces for high-cardinality data.
```

---

## 5. Distributed Tracing

When a single user request travels through 5-10 services, how do you figure out
where the bottleneck is? Distributed tracing.

### Concepts

```
Trace: The full journey of a single request through all services.
       Identified by a unique trace_id.

Span: A single operation within a trace (an API call, a DB query, etc.).
      Has: span_id, parent_span_id, service name, operation, duration.

Example: User searches for a product

Trace ID: abc123
┌──────────────────────────────────────────────────────────────────────┐
│ Span 1: API Gateway                                    [0ms - 250ms]│
│   │                                                                  │
│   ├── Span 2: Auth Service (validate token)            [10ms - 30ms]│
│   │                                                                  │
│   └── Span 3: Search Service (search products)         [35ms - 220ms│
│         │                                                            │
│         ├── Span 4: Elasticsearch query                [40ms - 180ms]│
│         │                                                            │
│         └── Span 5: Cache lookup (Redis)               [185ms - 190ms│
│                                                                      │
│   └── Span 6: Response serialization                   [225ms - 245ms│
└──────────────────────────────────────────────────────────────────────┘

From this trace, you can see:
  - Total request took 250ms
  - Elasticsearch query took 140ms (the bottleneck!)
  - Auth was fast (20ms)
  - Cache lookup was fast (5ms)
```

### Context Propagation

```
For tracing to work across services, the trace context must be passed along.

Service A ──[HTTP]──► Service B ──[gRPC]──► Service C

HTTP Headers:
  traceparent: 00-abc123-span456-01
  
  Format: version-traceId-parentSpanId-flags

Each service:
  1. Reads the traceparent header from the incoming request
  2. Creates a new span (with parent = the span from the header)
  3. Passes the traceparent header to outgoing requests

This works across HTTP, gRPC, message queues (as message headers),
and even across languages.
```

### OpenTelemetry

OpenTelemetry (OTel) is the industry standard for observability instrumentation.
It provides APIs and SDKs for traces, metrics, and logs.

```
Application (instrumented with OpenTelemetry SDK)
       │
       │ Export spans, metrics, logs
       ▼
  OTel Collector (receives, processes, exports)
       │
       ├──► Jaeger / Tempo (traces)
       ├──► Prometheus (metrics)
       └──► Loki / Elasticsearch (logs)

The OTel Collector is a vendor-agnostic proxy. Your application sends data
to the collector, and the collector routes it to your backend of choice.
You can switch backends without changing application code.
```

### Sampling Strategies

Tracing every single request is too expensive at high scale. Use sampling.

| Strategy           | Description                                               |
|--------------------|-----------------------------------------------------------|
| Head-based         | Decide at the start of the trace whether to sample        |
| Tail-based         | Decide after the trace completes (keep errors, slow traces)|
| Probabilistic      | Sample X% of traces (e.g., 1% at 100K req/sec)           |
| Rate limiting      | Sample at most N traces per second                        |
| Always-on for errors| Always capture traces that have errors                   |

Tail-based sampling is best but requires buffering complete traces before deciding.

---

## 6. Alerting

### Alert Design

```
Good alert:
  - Actionable (someone can do something about it)
  - Urgent (needs attention now, not next week)
  - Based on symptoms, not causes
  - Has a clear runbook

Bad alert:
  - CPU is at 80% (so what? Is anything actually affected?)
  - Disk at 70% (too early — alert at 85% or based on fill rate)
  - A single request failed (noise)
```

### Symptom vs Cause Alerts

```
Symptom (alert on these — user-facing impact):
  "5xx error rate > 1% for 5 minutes"
  "P99 latency > 2 seconds for 10 minutes"
  "Order success rate dropped below 95%"

Cause (useful for dashboards, not for alerts):
  "CPU at 90%"
  "Memory at 85%"
  "Kafka lag increasing"

Why? Because high CPU doesn't necessarily mean users are affected.
And sometimes users ARE affected even though CPU looks fine
(e.g., a dependency is slow).
```

### Alert Fatigue

```
Too many alerts → engineers ignore all alerts → real incidents get missed.

Solutions:
  1. Reduce alert count: Only alert on symptoms, not causes.
  2. Set proper thresholds: Use percentiles, not averages.
     Bad:  avg(latency) > 500ms (one slow request skews it)
     Good: p99(latency) > 2s for 10 minutes (consistent problem)
  3. Group related alerts: Multiple alerts for one incident → one page.
  4. Suppress flapping: Require condition to persist (e.g., 5 minutes).
  5. Escalation tiers: Warning → Slack, Critical → PagerDuty.
```

---

## 7. Observability in Practice

### Debugging a Production Issue

```
Scenario: Users report slow checkout.

Step 1: Metrics Dashboard
  → P99 checkout latency spiked from 200ms to 5s at 14:30 UTC
  → Error rate increased from 0.1% to 3%

Step 2: Drill into Traces
  → Find slow traces for the checkout endpoint
  → Payment Service span is 4.8 seconds (normally 100ms)

Step 3: Check Payment Service Metrics
  → Payment Service has high connection wait time to its database
  → Database connection pool is saturated

Step 4: Check Payment Service Logs
  → "Connection pool exhausted, waiting for available connection"
  → Started at 14:28 UTC, correlates with a deployment

Step 5: Check Deployments
  → Payment Service v2.3.1 deployed at 14:25 UTC
  → New code opened DB connections without closing them (connection leak)

Step 6: Rollback
  → Revert to v2.3.0 → latency returns to normal.

This is observability in action: metrics pointed to the area, traces found 
the slow service, logs revealed the cause, and deployment history confirmed it.
```

### Observability Stack Comparison

| Stack                | Traces        | Metrics         | Logs             |
|----------------------|---------------|-----------------|------------------|
| Open source          | Jaeger/Tempo  | Prometheus      | Loki/ELK         |
| AWS                  | X-Ray         | CloudWatch      | CloudWatch Logs  |
| Google Cloud         | Cloud Trace   | Cloud Monitoring| Cloud Logging    |
| Datadog              | Datadog APM   | Datadog Metrics | Datadog Logs     |
| New Relic            | New Relic APM | New Relic Metrics| New Relic Logs  |

---

## 8. Health Checks and SLOs

### Health Checks

```
Liveness: "Is the service running?"
  GET /healthz → 200 OK
  Used by Kubernetes to restart crashed containers.

Readiness: "Is the service ready to accept traffic?"
  GET /readyz → 200 OK (DB connected, caches warmed)
  Used by Kubernetes to route traffic. If not ready, no traffic sent.

Startup: "Has the service finished starting up?"
  GET /startupz → 200 OK
  Prevents liveness checks from killing slow-starting services.

Deep health check: "Are all dependencies healthy?"
  GET /health/deep → {
    "status": "degraded",
    "checks": {
      "database": "healthy",
      "redis": "healthy",
      "payment_api": "unhealthy"  ← external dependency is down
    }
  }
  Warning: Don't use for liveness (cascading failures if dependency is down).
```

### SLI, SLO, SLA

```
SLI (Service Level Indicator):
  A measurement of service behavior.
  Example: "99.2% of requests returned in under 200ms last month."

SLO (Service Level Objective):
  A target for an SLI. An internal goal.
  Example: "99.9% of requests should return in under 200ms."

SLA (Service Level Agreement):
  A contractual promise to customers. Has financial penalties.
  Example: "We guarantee 99.95% availability or we credit your account."

Relationship: SLA ≤ SLO ≤ actual performance
  You set the SLO tighter than the SLA so you have a buffer.
```

### Error Budgets

```
SLO: 99.9% availability per month

Error budget: 100% - 99.9% = 0.1%
In a 30-day month: 0.1% × 30 × 24 × 60 = 43.2 minutes of allowed downtime.

┌──────────────────────────────────────────────────┐
│ Error Budget Remaining: █████████░░░ 72%         │
│ Used: 12.1 minutes of 43.2 minutes              │
│                                                  │
│ If budget runs out:                              │
│   - No new deployments (freeze releases)         │
│   - Focus entirely on reliability                │
│   - No risky changes until budget resets         │
└──────────────────────────────────────────────────┘

Error budgets balance feature velocity with reliability.
Plenty of budget left → ship features faster.
Budget almost gone → slow down, focus on reliability.
```

---

## 9. Key Takeaways

### The Three Questions

1. **Is something wrong?** → Metrics + Alerts (symptom-based)
2. **Where is it wrong?** → Distributed Tracing (find the slow service)
3. **Why is it wrong?** → Logs (find the error message, root cause)

### Golden Rules

1. **Structured logging always.** JSON with trace_id, span_id, context fields.
2. **Alert on symptoms, not causes.** Alert on user-facing pain, not CPU usage.
3. **Use the RED method for services** (Rate, Errors, Duration).
4. **Use the USE method for resources** (Utilization, Saturation, Errors).
5. **Watch your cardinality.** Never use user IDs or request IDs as metric labels.
6. **Sample traces in production.** You can't store every trace at 100K req/sec.
7. **Adopt OpenTelemetry.** It's the standard. Vendor-neutral, widely supported.
8. **Set SLOs before you need them.** They guide your alerting and error budgets.
9. **Correlate across pillars.** Use trace_id to jump from metrics → traces → logs.

---

## 🔥 Senior Interview Questions

1. Your distributed system has 200 microservices. A user reports intermittent slow responses. Walk through your debugging process using logs, metrics, and traces. How do you correlate across pillars to find the root cause? [Answer](QnA-Answer-Key.md#20-observability)

2. You're generating 50 TB of logs per day. Storage costs are exploding. How do you reduce volume without losing critical observability? Discuss sampling, log levels, structured logging, and hot/warm/cold tiering. [Answer](QnA-Answer-Key.md#20-observability)

3. Compare Prometheus + Grafana vs Datadog vs New Relic for monitoring a Kubernetes-based microservices platform. Consider cost at scale, cardinality limits, custom metrics, and alerting capabilities. [Answer](QnA-Answer-Key.md#20-observability)

4. An interviewer says: "Our alerts fire 200 times per day and on-call engineers ignore most of them." How do you fix this? Discuss alert fatigue, SLO-based alerting, multi-window burn rate alerts, and error budgets. [Answer](QnA-Answer-Key.md#20-observability)

5. Explain the difference between monitoring and observability. A system with 100% test coverage and extensive dashboards still has production incidents that take hours to diagnose. Why, and how does observability (vs monitoring) help? [Answer](QnA-Answer-Key.md#20-observability)

6. You need to implement distributed tracing across services using 5 different programming languages and 3 different frameworks. How do you do this without modifying every service? Discuss OpenTelemetry auto-instrumentation, sidecar proxies, and service mesh telemetry. [Answer](QnA-Answer-Key.md#20-observability)

7. Your Prometheus metrics have high cardinality (user_id as a label) and the instance is running out of memory. Explain why high cardinality is dangerous for metrics (not logs), and how you'd redesign the metrics to maintain usefulness. [Answer](QnA-Answer-Key.md#20-observability)

8. What are SLIs, SLOs, and SLAs? Design them for a payment processing API. Which SLIs would you track, what SLO targets would you set, and how do error budgets influence engineering prioritization? [Answer](QnA-Answer-Key.md#20-observability)

9. You're tracing a request through 12 microservices. The end-to-end latency is 2 seconds, but each service's individual metrics show <100ms latency. What's happening? Discuss queueing time, network latency, serialization overhead, and the difference between service time and wait time. [Answer](QnA-Answer-Key.md#20-observability)

10. Your entire observability stack goes down (Prometheus, ELK, Jaeger). How do you still diagnose production issues? What manual debugging techniques and failsafe mechanisms should every system have? [Answer](QnA-Answer-Key.md#20-observability)

---

## 📚 Further Reading

- [Google SRE Book: Monitoring Distributed Systems (Free)](https://sre.google/sre-book/monitoring-distributed-systems/) — Google's canonical chapter on monitoring philosophy.
- [Distributed Systems Observability (Cindy Sridharan, Free eBook)](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/) — Comprehensive guide to the three pillars.
- [Monitoring and Observability with OpenTelemetry (YouTube)](https://www.youtube.com/watch?v=r8UvWSX3KA8) — Practical walkthrough of OTel instrumentation.
