# CI/CD & Deployment Pipelines

## Table of Contents

1. [Overview](#1-overview)
2. [Continuous Integration (CI)](#2-continuous-integration-ci)
3. [Continuous Delivery vs Continuous Deployment](#3-continuous-delivery-vs-continuous-deployment)
4. [Deployment Strategies](#4-deployment-strategies)
5. [Feature Flags](#5-feature-flags)
6. [GitOps](#6-gitops)
7. [Artifact Management](#7-artifact-management)
8. [Testing in the Pipeline](#8-testing-in-the-pipeline)
9. [Pipeline Security](#9-pipeline-security)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

CI/CD automates the path from code commit to production deployment.
It's the backbone of modern software delivery — enabling teams to ship
frequently, safely, and reliably.

```
Developer                                              Production
  │                                                        │
  │  git push ──► Build ──► Test ──► Package ──► Deploy ──►│
  │              ◄────────── CI ──────────────►             │
  │                          ◄──────── CD ────────────────►│
  │                                                        │
  Without CI/CD:                   With CI/CD:
  Deploy weekly (big bang)         Deploy daily (small changes)
  Manual testing                   Automated testing
  "Works on my machine"           "Works in the pipeline"
  Hours of deploy stress          Minutes of automated deploy
```

---

## 2. Continuous Integration (CI)

Every code change is automatically built, tested, and validated.

```
CI Pipeline:

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Code    │───►│  Build   │───►│  Test    │───►│  Report  │
  │  Push    │    │  Compile │    │  Unit    │    │  Status  │
  │          │    │  Lint    │    │  Integ.  │    │  to PR   │
  │          │    │  Deps    │    │  Coverage│    │          │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### CI Best Practices

| Practice              | Why                                           |
|----------------------|-----------------------------------------------|
| Commit frequently    | Small changes are easier to debug              |
| Trunk-based development | Short-lived branches → less merge pain     |
| Fast feedback loops  | CI should complete in < 10 minutes             |
| Fix broken builds immediately | Broken main branch blocks everyone    |
| Run tests in parallel | Reduce CI time                               |
| Cache dependencies   | Don't re-download on every build               |

### CI Tools

| Tool             | Hosted/Self | Strengths                              |
|-----------------|-------------|----------------------------------------|
| GitHub Actions  | Hosted      | Native GitHub integration, marketplace  |
| GitLab CI       | Both        | Built into GitLab, full DevOps platform |
| Jenkins         | Self-hosted | Extremely flexible, huge plugin ecosystem|
| CircleCI        | Hosted      | Fast, good caching, Docker-native       |
| AWS CodeBuild   | Hosted      | AWS-native, pay-per-build               |
| Buildkite       | Hybrid      | Run agents anywhere, fast               |

---

## 3. Continuous Delivery vs Continuous Deployment

```
Continuous Delivery:
  Code → Build → Test → [Manual Approval] → Deploy to Prod
                                    ▲
                              Human decides when

Continuous Deployment:
  Code → Build → Test → Auto-Deploy to Prod
                            ▲
                      No human gate (if tests pass, it ships)
```

| Aspect          | Continuous Delivery         | Continuous Deployment        |
|----------------|----------------------------|------------------------------|
| Approval       | Manual gate before prod    | Fully automated              |
| Risk tolerance | Lower                      | Higher (need great tests)    |
| Deploy freq.   | Daily to weekly            | Per-commit (10s-100s/day)    |
| Team maturity  | Medium                     | High                         |
| Used by        | Most companies             | Netflix, Amazon, Facebook    |

---

## 4. Deployment Strategies

### 4.1 Rolling Deployment

```
Replace instances one (or few) at a time:

  Time 0:  [v1] [v1] [v1] [v1]
  Time 1:  [v2] [v1] [v1] [v1]  ← 1 updated
  Time 2:  [v2] [v2] [v1] [v1]  ← 2 updated
  Time 3:  [v2] [v2] [v2] [v1]  ← 3 updated
  Time 4:  [v2] [v2] [v2] [v2]  ← Complete

Pros: Zero downtime, minimal extra resources.
Cons: Mixed versions during rollout, slow rollback.
```

### 4.2 Blue-Green Deployment

```
Two identical environments, only one serves traffic:

  Blue (current - v1):     Green (new - v2):
  ┌──────────────┐         ┌──────────────┐
  │ [v1][v1][v1] │         │ [v2][v2][v2] │  ← Deploy & test
  └──────┬───────┘         └──────┬───────┘
         │                        │
  ┌──────┴───────┐         ┌──────┴───────┐
  │  LB ──────►  │         │  (standby)   │
  └──────────────┘         └──────────────┘

After validation, switch:

  ┌──────────────┐         ┌──────────────┐
  │  (standby)   │         │ [v2][v2][v2] │
  └──────────────┘         └──────┬───────┘
                            ┌──────┴───────┐
                            │  LB ──────►  │  ← Traffic switched
                            └──────────────┘

Rollback: Switch LB back to blue. Instant.

Pros: Instant rollback, full testing before switch.
Cons: 2x infrastructure cost during deployment.
```

### 4.3 Canary Deployment

```
Route a small percentage of traffic to the new version:

  v1 (95% traffic):          v2 (5% traffic):
  ┌──────────────┐           ┌──────────────┐
  │ [v1][v1][v1] │           │ [v2]         │
  └──────────────┘           └──────────────┘
         ▲                          ▲
         │                          │
  ┌──────┴──────────────────────────┴──────┐
  │              Load Balancer              │
  │         95% ──────► v1                  │
  │          5% ──────► v2 (canary)         │
  └─────────────────────────────────────────┘

Monitor canary:
  - Error rates increased? → Rollback (kill canary)
  - Latency increased? → Rollback
  - All good? → Increase to 25% → 50% → 100%

Pros: Low risk, real production validation.
Cons: Complex routing, monitoring required, slow rollout.
```

### 4.4 A/B Testing Deployment

```
Similar to canary, but routes specific users (not random %):

  User segment A → v1 (control)
  User segment B → v2 (experiment)

  Used for product experiments, not just deployments.
  
  Routing criteria:
    - User ID % 100 < 10 → v2
    - User country == "US" → v2
    - User in beta list → v2
```

### Strategy Comparison

| Strategy    | Downtime | Rollback Speed | Resource Cost | Risk  |
|------------|---------|---------------|--------------|-------|
| Rolling    | Zero    | Slow           | Low          | Medium|
| Blue-Green | Zero    | Instant        | 2x           | Low   |
| Canary     | Zero    | Fast           | Low          | Very Low|
| Recreate   | Yes     | Slow           | 1x           | High  |

---

## 5. Feature Flags

Decouple deployment from release. Deploy code without activating features.

```
Code is deployed but feature is off:

  if (featureFlags.isEnabled("new-checkout")) {
      showNewCheckout();      // Only for enabled users
  } else {
      showOldCheckout();      // Everyone else
  }

Deployment timeline:
  Day 1: Deploy code with flag OFF (safe)
  Day 2: Enable for internal employees (dogfooding)
  Day 3: Enable for 5% of users (beta)
  Day 5: Enable for 50% (wider rollout)
  Day 7: Enable for 100% (full release)
  Day 14: Remove flag and old code (cleanup)
```

### Feature Flag Types

| Type           | Description                                    | Example                    |
|---------------|------------------------------------------------|----------------------------|
| Release flag  | Roll out new features gradually                 | New checkout flow          |
| Ops flag      | Toggle operational behavior                     | Disable expensive query    |
| Experiment    | A/B test variations                             | Button color test          |
| Permission    | Control access per user/role                    | Premium feature access     |

### Feature Flag Platforms

| Platform     | Type        |
|-------------|-------------|
| LaunchDarkly| SaaS        |
| Unleash     | Open source |
| Split.io    | SaaS        |
| Flagsmith   | Both        |
| AWS AppConfig| AWS-native |

### Risks of Feature Flags

```
Tech debt: Old flags never removed → code full of conditionals
Testing: Must test all flag combinations (exponential)
Incidents: Wrong flag state causes outage
Staleness: Flags left on for months

Best practice:
  - Set an expiration date on every flag
  - Track flag ownership (who created it)
  - Limit # of active flags per service
  - Monitor flag evaluations
```

---

## 6. GitOps

Git as the single source of truth for both application code AND infrastructure.

```
Traditional:                       GitOps:
  Developer → CI → Deploy →        Developer → Git push → CI builds image
  kubectl apply (imperative)        → Image pushed to registry
                                    → Update manifest in Git
                                    → Operator detects change
                                    → Operator reconciles cluster state
                                    
  ┌──────┐    ┌──────────┐    ┌───────────┐    ┌──────────────┐
  │ Git  │───►│ CI Build │───►│ Container │    │ GitOps       │
  │ Push │    │ Image    │    │ Registry  │    │ Operator     │
  └──────┘    └──────────┘    └───────────┘    │ (ArgoCD/Flux)│
                                    ▲           │              │
  ┌──────────────┐                  │           │ watches Git  │
  │ Git (config) │◄─── update tag ──┘           │ reconciles   │
  │ manifests/   │─────────────────────────────►│ cluster      │
  │ values.yaml  │  desired state               └──────────────┘
  └──────────────┘                                     │
                                                       ▼
                                                 ┌──────────┐
                                                 │ K8s      │
                                                 │ Cluster  │
                                                 └──────────┘
```

### GitOps Tools

| Tool     | Description                       |
|---------|-----------------------------------|
| ArgoCD  | K8s-native CD, UI, multi-cluster  |
| Flux    | CNCF project, lightweight         |

### GitOps Principles

```
1. Declarative: Desired state is defined in Git
2. Versioned:   Git history = infrastructure history
3. Automated:   Approved changes are auto-applied
4. Reconciled:  Operators continuously ensure actual == desired
```

---

## 7. Artifact Management

```
Pipeline artifacts:

  Source Code → Build → ┌────────────────────────────────────┐
                        │ Artifacts:                          │
                        │  Docker Image → Container Registry  │
                        │  JAR/WAR     → Artifact Repository  │
                        │  npm package → npm Registry          │
                        │  Helm chart  → Chart Repository      │
                        └────────────────────────────────────┘

Artifact registries:
  Docker:  Docker Hub, ECR, GCR, ACR, Harbor
  Java:    Nexus, Artifactory
  npm:     npm Registry, GitHub Packages
  Python:  PyPI, private PyPI
  Multi:   JFrog Artifactory, GitHub Packages
```

### Versioning Artifacts

```
Semantic Versioning: MAJOR.MINOR.PATCH
  1.0.0 → 1.0.1 (patch: bug fix)
  1.0.0 → 1.1.0 (minor: new feature, backward compatible)
  1.0.0 → 2.0.0 (major: breaking change)

Docker image tags:
  myapp:latest       ← Mutable (avoid in prod!)
  myapp:1.2.3        ← Immutable, specific version
  myapp:abc123f      ← Git SHA (guarantees exact code)
  myapp:1.2.3-rc1    ← Release candidate
```

---

## 8. Testing in the Pipeline

```
Testing Pyramid:

          ╱╲
         ╱  ╲
        ╱ E2E ╲         Few, slow, expensive
       ╱────────╲        (Selenium, Cypress)
      ╱Integration╲     More, moderate speed
     ╱──────────────╲    (API tests, DB tests)
    ╱   Unit Tests   ╲  Many, fast, cheap
   ╱──────────────────╲  (Jest, pytest, JUnit)
  ╱────────────────────╲

Pipeline stages:
  1. Lint + Static Analysis  (seconds)
  2. Unit Tests              (seconds-minutes)
  3. Build                   (minutes)
  4. Integration Tests       (minutes)
  5. Security Scan           (minutes)
  6. E2E Tests               (minutes-hours)
  7. Performance Tests       (optional, nightly)
```

### Shift-Left Testing

```
Find bugs earlier → cheaper to fix:

  Cost to fix →  $1    $10     $100     $1000      $10000
                 │      │       │        │          │
  Stages →    Coding  Build   Test   Staging    Production
  
  "Shift left" = catch issues as early as possible:
    - Pre-commit hooks (lint, format)
    - IDE integrations (type checking)
    - Trunk-based development (frequent integration)
```

---

## 9. Pipeline Security

```
Supply chain security:

  Threats:
    - Compromised dependencies (SolarWinds, Log4j)
    - Stolen CI/CD credentials
    - Malicious code injected during build
    - Unsigned artifacts deployed

  Defenses:
  ┌────────────────────────────────────────────────────────┐
  │ Pipeline Security Measures                             │
  │                                                        │
  │ 1. Dependency scanning (Dependabot, Snyk, Trivy)      │
  │ 2. SAST (Static Application Security Testing)         │
  │ 3. DAST (Dynamic Application Security Testing)        │
  │ 4. Container image scanning                            │
  │ 5. Secrets management (Vault, AWS Secrets Manager)     │
  │ 6. Signed artifacts (cosign, Notary)                   │
  │ 7. SBOM (Software Bill of Materials)                   │
  │ 8. Principle of least privilege for CI/CD              │
  │ 9. Immutable artifacts (never overwrite)               │
  │ 10. Audit trail (who deployed what when)               │
  └────────────────────────────────────────────────────────┘
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| CI/CD is table stakes | Every modern team has automated pipelines |
| Blue-green for instant rollback | 2x cost but safest; canary for gradual validation |
| Feature flags decouple deploy from release | Ship code daily, release features when ready |
| GitOps = Git as source of truth | ArgoCD/Flux reconcile cluster state with Git |
| Testing pyramid: many unit, few E2E | Fast feedback loop is critical |
| Pipeline should be < 10 min | Otherwise developers don't wait for it |
| Immutable, versioned artifacts | Never deploy "latest" to production |
| Security is part of the pipeline | Shift left — scan early, scan often |
| Canary + feature flags + observability | The holy trinity of safe deployments |
