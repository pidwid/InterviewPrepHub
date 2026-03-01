# SLO, SLA, SLI & Error Budgets

## Table of Contents

1. [Overview](#1-overview)
2. [SLI — Service Level Indicators](#2-sli--service-level-indicators)
3. [SLO — Service Level Objectives](#3-slo--service-level-objectives)
4. [SLA — Service Level Agreements](#4-sla--service-level-agreements)
5. [Error Budgets](#5-error-budgets)
6. [SLO-Based Alerting](#6-slo-based-alerting)
7. [Choosing SLOs](#7-choosing-slos)
8. [SLO Implementation](#8-slo-implementation)
9. [Organizational Impact](#9-organizational-impact)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

SLI, SLO, and SLA form a framework (popularized by Google SRE) for defining,
measuring, and managing service reliability. They answer: "How reliable should
our service be, and how do we know if we're meeting that target?"

```
Relationship:

  SLI → What you measure
  SLO → What you target
  SLA → What you promise (with consequences)

  ┌─────────────────────────────────────────────────────┐
  │                                                      │
  │  SLA: "99.9% availability or we refund 10% of bill" │
  │  ┌──────────────────────────────────────────────┐    │
  │  │ SLO: "99.95% of requests succeed within 200ms"│   │
  │  │ ┌────────────────────────────────────────┐    │   │
  │  │ │ SLI: "ratio of successful requests     │    │   │
  │  │ │       with latency < 200ms"             │    │   │
  │  │ └────────────────────────────────────────┘    │   │
  │  └──────────────────────────────────────────────┘    │
  │                                                      │
  │  SLI is the measurement.                             │
  │  SLO is the internal target (stricter than SLA).     │
  │  SLA is the external promise (with penalties).       │
  └─────────────────────────────────────────────────────┘
```

---

## 2. SLI — Service Level Indicators

A quantitative measure of some aspect of the level of service provided.

### Common SLI Categories

| Category     | SLI                                              | Formula                              |
|-------------|--------------------------------------------------|--------------------------------------|
| Availability | Proportion of successful requests               | good requests / total requests       |
| Latency     | Proportion of requests faster than threshold      | requests < 200ms / total requests    |
| Throughput  | Requests successfully processed per second        | successful requests / time           |
| Error rate  | Proportion of requests that fail                  | error requests / total requests      |
| Freshness   | Proportion of data updated within threshold       | fresh records / total records        |
| Durability  | Proportion of data retained without loss          | retained objects / total objects     |

### SLI Specification

```
Good SLI definition follows this pattern:

  "The proportion of [valid events] that [meet a quality threshold]"

Examples:
  Availability: "The proportion of HTTP requests that return 2xx or 4xx within 10s"
  Latency:      "The proportion of RPCs that complete within 100ms"
  Freshness:    "The proportion of data queries that return data < 1 minute old"
  Correctness:  "The proportion of records processed that produce correct output"

Note: 4xx errors are often included as "successful" (it's a valid response).
      5xx errors are failures.
      Timeouts are failures.

Where to measure:
  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
  │ Client │───►│  LB    │───►│ Server │───►│  DB    │
  └────────┘    └────────┘    └────────┘    └────────┘
       ▲              ▲              ▲
       │              │              │
  Best (user         Good           Cheapest but
  experience)     (infrastructure)  misses network
  but harder                        issues
```

---

## 3. SLO — Service Level Objectives

The target value for an SLI. "We aim for X% of requests to be good."

### Setting SLOs

```
SLO = SLI target over a time window

  SLO: 99.9% availability over a 30-day rolling window
  
  Meaning:
    In any 30-day period, at least 99.9% of requests must succeed.
    
  Allowed failures:
    30 days × 24 hours × 60 minutes = 43,200 minutes
    0.1% failure budget = 43.2 minutes of downtime allowed

  ┌──────────────────────────────────────────┐
  │ SLO: 99.9% = 43 minutes downtime/month  │
  │ SLO: 99.95% = 22 minutes/month          │
  │ SLO: 99.99% = 4.3 minutes/month         │
  │ SLO: 99.999% = 26 seconds/month         │
  └──────────────────────────────────────────┘
```

### Multiple SLOs per Service

```
API Service SLOs:
  1. Availability: 99.95% of requests return non-5xx
  2. Latency (p50): 99% of requests complete within 100ms
  3. Latency (p99): 99.9% of requests complete within 500ms
  
  Why multiple?
    A service can be "available" but unusably slow.
    A service can be fast but returning errors.
    You need both dimensions.
```

---

## 4. SLA — Service Level Agreements

An SLA is a **contract** with customers that includes consequences for not
meeting service levels.

```
SLA vs SLO:
  SLO: Internal target (engineering commitment)
       "We aim for 99.95% availability"
       
  SLA: External contract (business/legal commitment)
       "We guarantee 99.9% availability or provide service credits"
       
  Best practice: SLO should be STRICTER than SLA
       SLO: 99.95% (internal target)
       SLA: 99.9%  (external promise)
       
  This gives you a buffer to fix issues before breaching the SLA.
```

### Real-World SLAs

| Service          | SLA Commitment    | Penalty                         |
|-----------------|-------------------|---------------------------------|
| AWS EC2         | 99.99% monthly    | 10-30% service credits          |
| AWS S3          | 99.9% monthly     | 10-25% service credits          |
| Google Cloud    | 99.95% monthly    | 10-50% financial credits        |
| Azure VMs       | 99.95% monthly    | 10-100% service credits         |
| Stripe API      | 99.99% uptime     | Custom SLA for enterprise       |

---

## 5. Error Budgets

The amount of unreliability you're **allowed** based on your SLO.

```
Error Budget = 1 - SLO

  SLO: 99.9% availability
  Error Budget: 0.1% = 43.2 minutes/month

  Think of it as a "reliability bank account":
  ┌─────────────────────────────────────────────┐
  │ Month starts: 43.2 minutes available         │
  │                                               │
  │ Week 1: 5-minute outage       → 38.2 min left│
  │ Week 2: Deploy causes 2-min   → 36.2 min left│
  │ Week 3: No incidents          → 36.2 min left│
  │ Week 4: 10-minute degradation → 26.2 min left│
  │                                               │
  │ Month total: 17 minutes used, 26.2 remaining │
  │ Status: HEALTHY ✓                             │
  └─────────────────────────────────────────────┘
```

### Error Budget Policies

```
When error budget is healthy (> 50% remaining):
  ├── Ship features at normal velocity
  ├── Encourage experimentation
  └── Deploy frequently

When error budget is depleted (< 25% remaining):
  ├── Slow down feature deployments
  ├── Focus engineering on reliability
  ├── Require extra review for changes
  └── Increase testing requirements

When error budget is EXHAUSTED (0% remaining):
  ├── Feature freeze
  ├── All engineering focuses on reliability
  ├── Post-mortem on what consumed the budget
  └── Only reliability fixes and critical patches ship

  ┌────────────────────────────────────────────┐
  │  Error Budget Policy = team contract       │
  │                                            │
  │  Budget remaining │ Development velocity   │
  │  > 50%            │ Full speed             │
  │  25-50%           │ Careful, extra reviews │
  │  < 25%            │ Slow down              │
  │  0%               │ Feature freeze         │
  └────────────────────────────────────────────┘
```

### Error Budgets Align Incentives

```
Without error budgets:
  Dev team: "Ship faster!"
  SRE team: "Don't break things!"
  → Constant tension, no framework for decisions

With error budgets:
  Both teams: "We have 30 minutes of budget left this month.
               Is this risky deploy worth potentially using 5 minutes?"
  → Shared language, data-driven decisions
```

---

## 6. SLO-Based Alerting

Traditional alerting (threshold-based) creates noise. SLO-based alerting
focuses on what matters: **are we burning through our error budget too fast?**

### Burn Rate

```
Burn rate = how fast you're consuming your error budget.

  Burn rate 1.0 = consuming budget at exactly the expected rate
                  (will hit 0% at end of window)
  Burn rate 2.0 = consuming at 2x rate
                  (will exhaust budget in half the time)
  Burn rate 10.0 = consuming at 10x rate
                   (will exhaust budget in 3 days instead of 30)

  30-day SLO with 43-minute error budget:
    Burn rate 1.0  → runs out in 30 days (normal)
    Burn rate 10.0 → runs out in 3 days (alert!)
    Burn rate 36.0 → runs out in 20 hours (page!)
```

### Multi-Window, Multi-Burn-Rate Alerting

```
Google SRE recommended approach:

  ┌────────────────────────────────────────────────────┐
  │ Alert Severity │ Burn Rate │ Short Window │ Action │
  ├────────────────┼───────────┼──────────────┼────────┤
  │ Page (urgent)  │ 14.4x     │ 1 hour       │ Page   │
  │                │ 6x        │ 6 hours      │ Page   │
  │ Ticket         │ 3x        │ 1 day        │ Ticket │
  │ Log only       │ 1x        │ 3 days       │ Log    │
  └────────────────┴───────────┴──────────────┴────────┘

  Why two windows (short + long)?
    Short window: Detect fast incidents (spike of errors)
    Long window: Detect slow burns (gradual degradation)
    
  Both must trigger to fire the alert:
    "Error rate is high over the last hour (short)
     AND it's been elevated for the last 6 hours (long)"
    → Reduces false positives
```

### SLO Alerting vs Threshold Alerting

```
Threshold: "Alert if error rate > 1%"
  Problem: 1% error rate for 5 seconds → alert (unnecessary noise)
           1% error rate for 5 hours → also alert (same severity!)

SLO-based: "Alert if we'll exhaust our monthly error budget in 3 days"
  Better: A 5-second blip doesn't trigger (budget barely affected)
          A 5-hour issue does trigger (significant budget consumption)
```

---

## 7. Choosing SLOs

### SLO Selection Process

```
1. List all user-facing operations
2. For each, define SLIs (what to measure)
3. Measure current performance (baseline)
4. Set achievable but meaningful SLO targets
5. Review and refine quarterly

Common mistakes:
  ✗ Making SLOs too aggressive (99.999% when you can barely do 99.9%)
  ✗ Making SLOs too lenient (99% when users expect 99.9%)
  ✗ Too many SLOs (can't focus on what matters)
  ✗ Not differentiating critical vs non-critical paths
```

### SLO Tiers

```
Critical path (checkout, login):
  Availability: 99.99%
  Latency (p99): 500ms

Important path (search, browse):
  Availability: 99.95%
  Latency (p99): 1s

Background (analytics, reports):
  Availability: 99.9%
  Latency: not user-facing, no latency SLO
```

---

## 8. SLO Implementation

### Monitoring Stack

```
┌──────────────────────────────────────────────────┐
│                SLO Monitoring                     │
│                                                   │
│  Data Collection:                                 │
│    Prometheus / Datadog / CloudWatch              │
│    → Scrape SLI metrics every 30s                 │
│                                                   │
│  SLO Computation:                                 │
│    Sloth / Pyrra / Google SLO Generator           │
│    → Compute error budget consumption             │
│                                                   │
│  Alerting:                                        │
│    Alertmanager / PagerDuty / OpsGenie            │
│    → Multi-burn-rate alerts                       │
│                                                   │
│  Dashboards:                                      │
│    Grafana / Datadog                              │
│    → SLO status, burn rate, budget remaining      │
│                                                   │
│  Reporting:                                       │
│    Weekly SLO review email                        │
│    Monthly SLO report to leadership               │
└──────────────────────────────────────────────────┘
```

### Prometheus SLO Example

```yaml
# Prometheus recording rules for SLO

# SLI: Request success rate
- record: sli:http_requests:success_rate
  expr: |
    sum(rate(http_requests_total{code!~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))

# Error ratio (inverted SLI)
- record: sli:http_requests:error_rate
  expr: 1 - sli:http_requests:success_rate

# Burn rate alert (14.4x burn rate over 1 hour)
- alert: SLO_HighBurnRate_Page
  expr: |
    sli:http_requests:error_rate > (14.4 * 0.001)  # 14.4x of 0.1% budget
  for: 2m
  labels:
    severity: page
  annotations:
    summary: "High error budget burn rate - will exhaust budget in < 2 days"
```

---

## 9. Organizational Impact

```
SLOs affect how organizations make decisions:

  Product: "Can we ship this without testing?"
    → "How much error budget do we have? If < 25%, we need testing first."

  Engineering: "Should we do this migration?"
    → "Our SLO is healthy, we have budget for risk."

  Leadership: "How reliable are we?"
    → "Dashboard shows all critical SLOs green, 60% budget remaining."

  Incident response: "Is this worth waking someone up?"
    → "Burn rate is 10x → yes, page the on-call."

  Postmortem: "How bad was this incident?"
    → "Consumed 30% of our monthly error budget."
```

### SLO Review Meeting (Monthly)

```
Agenda:
  1. SLO status for each service (green/yellow/red)
  2. Error budget consumption this month
  3. Incidents that consumed budget
  4. Action items from last month
  5. SLO adjustments (too tight? too loose?)
  6. Upcoming risky changes and their budget impact
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| SLI = what you measure | Ratio of good events to total events |
| SLO = what you target | Internal reliability goal (stricter than SLA) |
| SLA = what you promise | External contract with consequences |
| Error budgets align teams | Shared language between dev and SRE |
| Error budget policies drive decisions | Healthy budget → ship fast. Exhausted → feature freeze |
| SLO-based alerting reduces noise | Alert on burn rate, not raw thresholds |
| Start with 2-3 SLOs per service | Availability + latency covers most cases |
| Measure from the user's perspective | Instrument at the load balancer or client, not just the server |
| Review SLOs quarterly | Too tight → constant firefighting. Too loose → no incentive |
| 100% is the wrong target | Diminishing returns. 99.99% → 99.999% is 10x harder |
