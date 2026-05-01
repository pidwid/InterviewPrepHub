# Feature Flags & Experimentation Platforms

> An infrastructure note: how feature flag platforms (LaunchDarkly, Statsig, Unleash, Flagsmith) are architected, and how experimentation pipelines are built on top of them.
>
> One of the most-asked emerging-topics questions in 2025-2026 senior interviews — every modern team uses some form of this.

---

## Table of Contents

1. [Why Feature Flags Are Now Infrastructure](#why-feature-flags-are-now-infrastructure)
2. [The Five Categories of Flags](#the-five-categories-of-flags)
3. [Architecture of a Feature Flag Platform](#architecture-of-a-feature-flag-platform)
4. [Targeting & Evaluation](#targeting--evaluation)
5. [Progressive Delivery](#progressive-delivery)
6. [Experimentation Pipeline (A/B Testing)](#experimentation-pipeline-ab-testing)
7. [Build vs Buy](#build-vs-buy)
8. [What Could Bite You In an Interview](#what-could-bite-you-in-an-interview)

---

## Why Feature Flags Are Now Infrastructure

The core idea is simple: **decouple deployment from release.**

Without flags:
```
Deploy code → Feature is live → Hope nothing breaks
```

With flags:
```
Deploy code (feature wrapped in flag, OFF) → Toggle ON via dashboard → Roll back instantly if needed
```

This unlocks:
- **Dark launches** — code in production but inert; can be exercised by internal users only
- **Canary / progressive rollouts** — 1% → 10% → 50% → 100%
- **Kill switches** — disable a problematic feature in seconds without redeploying
- **A/B tests** — different users see different variations; measure impact on metrics
- **Targeted rollouts** — beta features for specific tenants, geographies, or plan tiers
- **Trunk-based development** — merge incomplete features behind off flags; no long-lived branches

The headline benefit: **release becomes a runtime decision, not a deployment event.**

---

## The Five Categories of Flags

Per LaunchDarkly's official taxonomy:

| Type | Lifetime | Purpose |
|---|---|---|
| **Release flags** | Temporary | Roll out a new feature gradually; remove once 100% |
| **Kill switch flags** | Permanent | Emergency disable of a feature ("circuit breaker") |
| **Experiment flags** | Temporary | A/B testing; remove after winning variation ships |
| **Migration flags** | Temporary | Two-to-six stage migration between systems (old → dual-write → new) |
| **Operational / entitlement flags** | Permanent | Long-term config: per-tenant features, debug toggles, plan-tier gating |

**The categorization matters** because it dictates lifecycle management. Temporary flags should have a removal plan from day one — stale flags accumulate technical debt fast (a "flag graveyard" can have thousands of dead branches).

---

## Architecture of a Feature Flag Platform

### The Critical Constraint: Evaluation Latency

A flag check happens on **every request**. If evaluation requires a network call, your application latency just got worse by milliseconds × call count. The architectural challenge is making `is_enabled("flag-key", user)` essentially **free** in the request hot path.

The standard solution (used by LaunchDarkly, Statsig, Unleash, Flagsmith, etc.):

```
┌──────────────────────┐
│  Flag Configuration  │     UI / API for managing flag rules,
│  Plane (control)     │     targeting, percentage rollouts
└──────────┬───────────┘
           │ writes
           ▼
┌──────────────────────┐
│  Rule Store          │     Postgres, DynamoDB, etc. — source of truth
└──────────┬───────────┘
           │ change events
           ▼
┌──────────────────────┐
│  Edge / CDN          │     Globally replicated, e.g. Fastly
│  (Flag delivery      │     Holds the latest ruleset for ANY app
│   network)           │     using an environment SDK key
└──────────┬───────────┘
           │ streaming connection
           ▼
┌──────────────────────┐
│  SDK (in-process)    │     Loads all rules into RAM at startup;
│  - In-memory cache   │     subscribes to push updates
│  - Local evaluation  │     Evaluations happen LOCALLY → microseconds
└──────────────────────┘
```

**Key design points:**

1. **Rules are pushed to SDKs, not pulled per-request.** The SDK opens a long-lived streaming connection (SSE / WebSocket) to the edge and receives ruleset diffs.
2. **Evaluation is local and in-memory.** No network call on the request path. Latency is measured in microseconds.
3. **Rule propagation target: ~200 ms globally.** LaunchDarkly publicly cites *flag updates processing on all connected clients within 200 ms*. This is achieved via the CDN-backed delivery network and persistent connections.
4. **Resilience layers**: SDKs fall back to last-known ruleset if the edge is unreachable. Optionally, **persistent feature stores** (Redis, DynamoDB) cache rules across application restarts so cold-start doesn't depend on the network.

### Server-Side vs Client-Side SDKs

| | Server-side SDK | Client-side SDK |
|---|---|---|
| Where it runs | Backend service | Browser, mobile app |
| Has full ruleset | Yes | No (would leak business logic) |
| Evaluation | Local | Backend evaluates per-user, returns variations |
| Trust model | Trusted env | Untrusted (don't ship targeting rules to client) |

For client-side, the platform pre-evaluates flags on the backend (or at the edge for the requesting user) and ships only the **resulting variations**, not the rules. This protects the targeting logic from inspection.

---

## Targeting & Evaluation

A flag is more than on/off. The targeting model is what makes flags useful:

```
Flag: new-checkout-flow
Variations: control / treatment / dark

Rules (evaluated top-to-bottom):
  1. IF user.email ENDS WITH "@yourcompany.com"  → treatment
  2. IF user.tenant_id IN ["beta-customers"]      → treatment
  3. IF user.country == "US"                       → percentage_rollout(treatment: 25%, control: 75%)
  4. ELSE                                          → control
```

### Deterministic Bucketing

For percentage rollouts, the platform must **always assign the same user to the same variation** (otherwise users see flipping behavior on every request). The standard approach:

```
bucket = hash(flag_key + user_key) % 100
if bucket < 25: treatment
else:           control
```

The **flag_key in the hash** matters — it ensures different flags produce independent assignments (a user shouldn't always be in the "early access" bucket for every percentage rollout).

### Sticky Bucketing

For experiments specifically, the platform may persist the assignment in a database so that even if you change the rollout percentage, **already-bucketed users stay in their original variation**. Otherwise an experiment's results become contaminated when you ramp from 5% to 50%.

---

## Progressive Delivery

A typical release ramp:

| Stage | Audience | Watch for |
|---|---|---|
| 1. Dark launch | Code deployed, flag OFF | Build failures, deployment errors |
| 2. Internal | Employees only | Functional correctness, edge cases |
| 3. Canary | 1% of users | Error rate, latency p99, custom metric regressions |
| 4. Ramp | 10% → 25% → 50% | Same metrics at higher confidence |
| 5. GA | 100% | Done. Schedule flag removal. |

**Guarded rollouts** (LaunchDarkly term, others use "auto-rollback"): the platform watches a metric (e.g., error rate, p99 latency) and **automatically rolls back** if it crosses a threshold during ramp. This is the difference between "we noticed at 3am and rolled back manually" and "the platform rolled back at 2:47am and paged whoever owns the flag."

---

## Experimentation Pipeline (A/B Testing)

A feature flag platform that supports experimentation adds:

### 1. Variation assignment

The same deterministic bucketing as percentage rollouts, but the assignment is **logged** to a metrics pipeline.

### 2. Event collection

Application emits events (`button_clicked`, `purchase_completed`, `page_view`) tagged with the user's variation assignment.

```
Application → Event collector → Kafka → Data warehouse (BigQuery, Snowflake)
```

### 3. Metric computation

Per-experiment, per-variation aggregates:
- Conversion rate, average revenue per user, retention, latency
- Computed daily (or in near-real-time for "guardrail metrics")

### 4. Statistical analysis

For each (experiment × metric × variation):
- **Mean and variance** per group
- **Confidence intervals** (typically 95%)
- **p-value** via t-test, Mann-Whitney, or sequential testing
- **Sample-size calculation** (how long must the experiment run for statistical power?)

Modern platforms use **sequential testing** (e.g., mSPRT) so you can peek at results without inflating false-positive rate — a major improvement over fixed-horizon t-tests where peeking corrupts statistical validity.

### 5. Decision

- **Winner detection**: when statistical significance is reached, surface a recommendation
- **Guardrail metrics**: e.g., latency. Even if conversion is up, if p99 latency went up >5%, don't ship
- **Heterogeneous treatment effects**: did the treatment work for *all* segments or only some?

### Common Experimentation Pitfalls

- **SRM (Sample Ratio Mismatch)** — if you set a 50/50 split but observe 53/47 with statistical significance, your assignment is broken (often a logging bug, sometimes filtering bias). Check this before trusting any result.
- **Peeking without sequential tests** — repeated significance checks inflate false positives massively
- **Network effects** — features that affect groups (chat, social) violate the independence assumption of standard A/B tests
- **Novelty / primacy effects** — short experiments measure "users react to change," not "users prefer the new design"

---

## Build vs Buy

**Build a minimal in-house system if:**
- You only need on/off toggles, no targeting, no experimentation
- Compliance requires you cannot send user identifiers off-prem
- You have ~5 flags and they change rarely

**Buy / use a platform if:**
- You need percentage rollouts, complex targeting, multivariate experiments
- You have multiple teams creating flags (governance becomes critical)
- You need <200 ms global propagation
- You want guarded rollouts and experimentation analysis

### The Major Players (2025-2026)

| Platform | Notes |
|---|---|
| **LaunchDarkly** | Market leader; enterprise pricing; full experimentation suite |
| **Statsig** | Strong experimentation focus; generous free tier; Statsig Console for analytics |
| **Unleash** | Open-source, self-hostable; good if you need on-prem |
| **Flagsmith** | Open-source + cloud; mid-market |
| **PostHog** | Combined product analytics + flags + experiments |
| **OpenFeature** | A **standard / SDK abstraction** (CNCF), not a product — lets you swap providers |

### A Minimal Build Sketch

```python
# Hash-based percentage rollout, deterministic per user
import hashlib

def is_enabled(flag_key: str, user_id: str, percent: int) -> bool:
    h = hashlib.md5(f"{flag_key}:{user_id}".encode()).hexdigest()
    bucket = int(h[:8], 16) % 100
    return bucket < percent
```

This is the kernel; a real system layers in: rule storage, push delivery, SDK ergonomics, audit logs, segments, prerequisites, scheduled releases, and experimentation analysis.

---

## What Could Bite You In an Interview

- **"How do you ensure consistent assignment across services?"** — Same `(flag_key, user_key)` hashing across all SDK languages. Document the hash algorithm; treat it as part of the public contract.
- **"How do you handle a flag-evaluation outage?"** — SDKs cache rules in memory and continue to evaluate against last-known state. Optionally, persist rules to Redis/DynamoDB so cold-start doesn't depend on the network. Always specify a default value at the call site.
- **"What about flag debt?"** — Tag flags with creation date and owner; alert when a "temporary" flag is older than 30/60/90 days; integrate with code search to find unreferenced flags. Some platforms (LaunchDarkly Code References) auto-detect flag usage in commits.
- **"How do you A/B test latency-sensitive code?"** — Make sure both variations are timed identically (don't let logging asymmetry skew results); guardrail on p50/p99/p999; have a pre-defined rollback threshold.
- **"How do you experiment on a feature that requires migration?"** — Use a **migration flag** with stages: `old` → `dual-write-old-canonical` → `dual-write-new-canonical` → `new-only`. At each stage, validate parity before advancing.

---

## Quick Mental Model

> Feature flags decouple **deployment** (engineers shipping code) from **release** (users seeing functionality). A platform makes this controllable, observable, and measurable across teams. Experimentation is feature flags + statistics + an event pipeline.

---

> **Sources for this note.** LaunchDarkly's official documentation pages: "How LaunchDarkly works", "Creating flags", "Feature Flags 101", and the architecture deep-dive on dev.to. OpenFeature CNCF specification. Standard A/B testing literature on mSPRT, sequential testing, and SRM. Specific quoted numbers (200 ms global propagation, 100+ CDN locations) come from LaunchDarkly's published documentation.
