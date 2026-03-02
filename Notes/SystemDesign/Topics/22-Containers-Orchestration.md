# Containers & Orchestration

## Table of Contents

1. [Overview](#1-overview)
2. [Containers](#2-containers)
3. [Docker](#3-docker)
4. [Container Orchestration](#4-container-orchestration)
5. [Kubernetes Architecture](#5-kubernetes-architecture)
6. [Kubernetes Core Concepts](#6-kubernetes-core-concepts)
7. [Kubernetes Networking](#7-kubernetes-networking)
8. [Deployment Strategies](#8-deployment-strategies)
9. [Production Concerns](#9-production-concerns)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Containers enable you to package an application with all its dependencies
into a standardized unit that runs consistently on any infrastructure.
Orchestration manages those containers across a cluster of machines.

```
Evolution of deployment:

Physical Servers (2000s):
  ┌──────────────────────────────────┐
  │ Physical Server                  │
  │ ┌──────┐ ┌──────┐ ┌──────┐     │
  │ │App A │ │App B │ │App C │     │  ← Resource conflicts
  │ └──────┘ └──────┘ └──────┘     │  ← "Works on my machine"
  │   OS                            │  ← Slow provisioning (weeks)
  │   Hardware                      │
  └──────────────────────────────────┘

Virtual Machines (2010s):
  ┌──────────────────────────────────┐
  │ Physical Server                  │
  │ ┌────────────┐ ┌────────────┐   │
  │ │ VM 1       │ │ VM 2       │   │  ← Better isolation
  │ │ ┌──────┐   │ │ ┌──────┐   │   │  ← But each VM runs a 
  │ │ │App A │   │ │ │App B │   │   │     full OS (heavy)
  │ │ └──────┘   │ │ └──────┘   │   │  ← Minutes to start
  │ │ Guest OS   │ │ Guest OS   │   │
  │ └────────────┘ └────────────┘   │
  │      Hypervisor                  │
  │      Host OS / Hardware          │
  └──────────────────────────────────┘

Containers (2015+):
  ┌──────────────────────────────────┐
  │ Physical Server (or VM)          │
  │ ┌────────┐ ┌────────┐ ┌────────┐│
  │ │  App A │ │  App B │ │  App C ││  ← Lightweight
  │ │  Libs  │ │  Libs  │ │  Libs  ││  ← Share the kernel
  │ └────────┘ └────────┘ └────────┘│  ← Seconds to start
  │      Container Runtime (Docker)  │  ← Consistent everywhere
  │      Host OS / Hardware          │
  └──────────────────────────────────┘
```

### VMs vs Containers

| Aspect          | Virtual Machines        | Containers               |
|-----------------|-------------------------|--------------------------|
| Isolation       | Strong (separate kernel)| Process-level (shared kernel)|
| Size            | Gigabytes               | Megabytes                |
| Startup time    | Minutes                 | Seconds                  |
| Resource usage  | Heavy (full OS)         | Lightweight              |
| Density         | 10s per host            | 100s per host            |
| Portability     | VM images (large)       | Container images (small) |
| Security        | Stronger isolation      | Weaker isolation         |

---

## 2. Containers

### How Containers Work (Linux)

Containers are not magic. They use two Linux kernel features:

```
<abbr title="Namespaces: Linux kernel feature that isolates what a container can see (processes, network, filesystem, users).">Namespaces</abbr> (isolation):
  What a container can SEE.
  
  ┌─────────────────────────────────────────────────┐
  │ Namespace Type    │ Isolates                     │
  ├───────────────────┼──────────────────────────────┤
  │ PID               │ Process IDs                  │
  │ NET               │ Network interfaces, ports    │
  │ MNT               │ File system mount points     │
  │ UTS               │ Hostname                     │
  │ IPC               │ Inter-process communication  │
  │ USER              │ User and group IDs           │
  └─────────────────────────────────────────────────┘
  
  Container thinks it has PID 1, its own hostname, its own network stack.
  It can't see other containers' processes or files.

<abbr title="Cgroups (control groups): Linux kernel feature that limits CPU, memory, and I/O resources per container.">Cgroups</abbr> (resource limits):
  What a container can USE.
  
  - CPU: Max 2 cores
  - Memory: Max 512 MB (OOM-killed if exceeded)
  - Disk I/O: Max 100 MB/s
  - Network: Bandwidth limits
  
  Prevents one container from starving others.
```

### Container Images

```
An image is a read-only template with everything needed to run the application.

Image layers (like a stack of transparent sheets):
  ┌────────────────────────────────────┐
  │ Layer 5: COPY app.py              │  ← Your code (changes frequently)
  ├────────────────────────────────────┤
  │ Layer 4: RUN pip install flask    │  ← Dependencies
  ├────────────────────────────────────┤
  │ Layer 3: RUN apt-get install python│ ← System packages
  ├────────────────────────────────────┤
  │ Layer 2: Ubuntu base image        │  ← Base OS
  ├────────────────────────────────────┤
  │ Layer 1: scratch                   │  ← Root filesystem
  └────────────────────────────────────┘

Key insight: Layers are cached and shared.
  - 10 containers using the same base image share those layers.
  - Rebuilding only changes the layer that was modified (and above).
  - Order matters: Put things that change LEAST at the bottom.
```

---

## 3. Docker

### Dockerfile Best Practices

```dockerfile
# BAD Dockerfile
FROM ubuntu:latest
COPY . /app
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install -r /app/requirements.txt
CMD ["python3", "/app/main.py"]

# GOOD Dockerfile
# 1. Use specific version (reproducible builds)
FROM python:3.11-slim

# 2. Set working directory
WORKDIR /app

# 3. Copy dependency file FIRST (layer caching!)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy application code LAST (changes most often)
COPY . .

# 5. Don't run as root
RUN adduser --disabled-password appuser
USER appuser

# 6. Use exec form (proper signal handling)
CMD ["python", "main.py"]
```

### <abbr title="Multi-stage builds: use one stage to compile/build and a separate minimal stage to run, keeping final images small.">Multi-Stage Builds</abbr>

```dockerfile
# Build stage (has compilers, build tools — large)
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o myapp

# Runtime stage (minimal — small)
FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/myapp /myapp
USER nobody
CMD ["/myapp"]

# Result: ~15 MB image instead of ~1 GB
# Build tools are NOT in the final image.
```

### Docker Compose

For running multi-container applications locally:

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://db:5432/myapp
      - REDIS_URL=redis://cache:6379
    depends_on:
      - db
      - cache

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=secret

  cache:
    image: redis:7-alpine

volumes:
  pgdata:
```

---

## 4. Container Orchestration

Running a few containers with Docker is easy. Running hundreds across
multiple machines, keeping them healthy, scaling them, networking them —
that's orchestration.

### What Orchestration Solves

```
Without orchestration (manual management):
  ├── Which machine has enough CPU/memory to run this container?
  ├── Container crashed — who restarts it?
  ├── Need to scale from 3 to 10 instances — how?
  ├── How do containers on different machines find each other?
  ├── How to do zero-downtime deployments?
  ├── How to manage secrets (DB passwords, API keys)?
  └── How to handle persistent storage?

With orchestration (Kubernetes handles all of this):
  You: "I want 5 instances of my API running."
  K8s: "Done. I'll keep exactly 5 running, restart any that crash,
        spread them across machines, route traffic to them, and
        scale them if CPU goes above 70%."
```

---

## 5. Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Control Plane                                │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐           │
│  │ API Server   │ │ Scheduler    │ │ Controller     │           │
│  │ (kube-apiserver)│              │ │ Manager        │           │
│  │              │ │ Assigns Pods │ │ Ensures desired │           │
│  │ All requests │ │ to Nodes     │ │ state matches   │           │
│  │ go through   │ │ based on     │ │ actual state    │           │
│  │ this gateway │ │ resources &  │ │                 │           │
│  └──────────────┘ │ constraints  │ │ ReplicaSet:     │           │
│                    └──────────────┘ │ "3 replicas → 3 │           │
│  ┌──────────────┐                   │  Pods running"  │           │
│  │ etcd         │                   └────────────────┘           │
│  │ (key-value   │                                                │
│  │  store for   │                                                │
│  │  ALL cluster │                                                │
│  │  state)      │                                                │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Worker Node 1                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ kubelet      │  │ kube-proxy   │  │ Container Runtime     │  │
│  │ (manages Pods│  │ (networking  │  │ (containerd, CRI-O)   │  │
│  │  on this node│  │  rules)      │  │                       │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ Pod             │  │ Pod             │                       │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │                       │
│  │ │ Container 1 │ │  │ │ Container 1 │ │                       │
│  │ └─────────────┘ │  │ └─────────────┘ │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Control Plane Components

| Component          | Purpose                                              |
|--------------------|------------------------------------------------------|
| API Server         | REST API for all operations; the front door           |
| etcd               | Stores ALL cluster state (configuration, secrets, Pods)|
| Scheduler          | Assigns unscheduled Pods to Nodes based on resources  |
| Controller Manager | Runs control loops (ReplicaSet, Deployment, etc.)     |

---

## 6. Kubernetes Core Concepts

### <abbr title="Pod: the smallest deployable unit in Kubernetes. It groups one or more containers that share network and storage.">Pod</abbr>

The smallest deployable unit. Contains one or more containers that share
networking and storage.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-api
  labels:
    app: my-api
spec:
  containers:
    - name: api
      image: myapp:1.2.0
      ports:
        - containerPort: 8080
      resources:
        requests:           # Minimum guaranteed
          cpu: "250m"        # 0.25 CPU cores
          memory: "128Mi"    # 128 MB
        limits:              # Maximum allowed
          cpu: "500m"        # 0.5 CPU cores
          memory: "256Mi"    # 256 MB (OOM-killed if exceeded)
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /readyz
          port: 8080
        periodSeconds: 5
```

### <abbr title="Deployment: manages a set of identical Pods and handles rolling updates and rollbacks.">Deployment</abbr>

Manages a set of identical Pods. Handles rollouts and rollbacks.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
spec:
  replicas: 3                    # Run 3 instances
  selector:
    matchLabels:
      app: my-api
  strategy:
    type: RollingUpdate           # Zero-downtime deployment
    rollingUpdate:
      maxSurge: 1                 # Create 1 extra Pod during rollout
      maxUnavailable: 0           # Never have fewer than 3 ready Pods
  template:
    metadata:
      labels:
        app: my-api
    spec:
      containers:
        - name: api
          image: myapp:1.2.0
          ports:
            - containerPort: 8080
```

### <abbr title="Service: stable virtual IP and DNS name that load-balances traffic to a set of Pods.">Service</abbr>

Provides a stable network endpoint for a set of Pods. Pods come and go;
the Service IP stays the same.

```
Without Service:
  Pod IPs change on restart: 10.0.1.5 → 10.0.2.8 → 10.0.3.2
  Clients don't know which IP to use.

With Service:
  Service IP: 10.96.0.1 (stable)
  ┌──────────────┐
  │ Service      │──► Pod 1 (10.0.1.5)
  │ my-api-svc   │──► Pod 2 (10.0.1.6)    ← Load balanced
  │ 10.96.0.1    │──► Pod 3 (10.0.2.3)
  └──────────────┘
  
  DNS: my-api-svc.default.svc.cluster.local → 10.96.0.1
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api-svc
spec:
  selector:
    app: my-api          # Routes to Pods with this label
  ports:
    - port: 80           # Service port
      targetPort: 8080   # Container port
  type: ClusterIP        # Internal only (default)
```

### Service Types

| Type          | Description                                            |
|---------------|--------------------------------------------------------|
| ClusterIP     | Internal only. Reachable within the cluster.           |
| NodePort      | Exposes on each Node's IP at a static port (30000-32767)|
| LoadBalancer  | Creates a cloud load balancer (AWS ALB, GCP LB)        |
| ExternalName  | Maps to an external DNS name                           |

### <abbr title="ConfigMap: stores non-sensitive configuration. Secret: stores sensitive data (base64-encoded, not encrypted by default).">ConfigMap & Secrets</abbr>

```yaml
# ConfigMap (non-sensitive configuration)
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"

# Secret (sensitive data — base64-encoded, not encrypted by default!)
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=    # echo -n 'password123' | base64
```

### <abbr title="Horizontal Pod Autoscaler (HPA): automatically scales the number of Pods up/down based on metrics like CPU or memory.">Horizontal Pod Autoscaler (HPA)</abbr>

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # Scale up when avg CPU > 70%
```

---

## 7. Kubernetes Networking

```
Pod-to-Pod networking:
  Every Pod gets its own IP address.
  Any Pod can reach any other Pod without NAT.
  
  ┌─── Node 1 ────────────┐   ┌─── Node 2 ────────────┐
  │ Pod A: 10.0.1.5        │   │ Pod C: 10.0.2.8        │
  │ Pod B: 10.0.1.6        │   │ Pod D: 10.0.2.9        │
  └────────────────────────┘   └────────────────────────┘
  
  Pod A can reach Pod C at 10.0.2.8 directly.
  Network plugins (Calico, Cilium, Flannel) make this work.

Ingress (external traffic → Services):
  ┌─────────┐      ┌──────────────┐     ┌───────────────┐
  │ Internet│─────►│ Ingress      │────►│ Service       │
  │         │      │ Controller   │     │ (ClusterIP)   │
  └─────────┘      │ (Nginx, Traefik)  └───────────────┘
                   │              │
                   │ Routes by:   │
                   │  /api → api-svc
                   │  /web → web-svc
                   └──────────────┘
```

---

## 8. Deployment Strategies

```
Rolling Update (default in Kubernetes):
  v1: [Pod] [Pod] [Pod]
  
  Step 1: Start v2 Pod
  v1: [Pod] [Pod] [Pod]
  v2: [Pod]
  
  Step 2: Remove v1 Pod, start another v2 Pod
  v1: [Pod] [Pod]
  v2: [Pod] [Pod]
  
  Step 3: Continue...
  v1: [Pod]
  v2: [Pod] [Pod] [Pod]
  
  Step 4: Done
  v2: [Pod] [Pod] [Pod]
  
  Pros: Zero downtime, gradual rollout.
  Cons: In transition, both versions serve traffic.

Blue-Green:
  Blue (v1): [Pod] [Pod] [Pod]  ← All traffic here
  Green (v2): [Pod] [Pod] [Pod] ← Deployed, not receiving traffic
  
  Switch traffic all at once: Blue → Green
  
  Pros: Instant switch, easy rollback (switch back to Blue).
  Cons: Double the resources during deployment.

Canary:
  v1: [Pod] [Pod] [Pod] [Pod] [Pod]  ← 90% traffic
  v2: [Pod]                           ← 10% traffic (canary)
  
  Monitor v2 → if healthy, gradually increase to 100%.
  
  Pros: Test in production with real traffic, limited blast radius.
  Cons: More complex traffic management, need good observability.
```

---

## 9. Production Concerns

### Resource Management

```
Always set requests and limits:
  requests: Minimum resources the Pod needs (scheduling guarantee).
  limits: Maximum resources allowed (enforced by cgroup).

  resources:
    requests:
      cpu: "250m"       # 0.25 cores guaranteed
      memory: "128Mi"   # 128 MB guaranteed
    limits:
      cpu: "500m"       # Can burst to 0.5 cores
      memory: "256Mi"   # Hard limit — OOM killed if exceeded

Best practice:
  - CPU: Set requests, often skip limits (CPU is compressible — throttled, not killed)
  - Memory: Set both requests and limits (memory is incompressible — OOM kill)
```

### Pod Disruption Budgets

```yaml
# Ensure at least 2 Pods are always running, even during maintenance
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-api-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: my-api
```

### Namespace Organization

```
Namespaces: Virtual clusters within a physical cluster.

production/              # Each team/environment gets a namespace
├── namespace: frontend
├── namespace: backend
├── namespace: data
├── namespace: monitoring
└── namespace: istio-system

Benefits:
  - Resource quotas per namespace (team can't eat all resources)
  - Network policies per namespace (isolation)
  - RBAC per namespace (access control)
```

---

## 10. Key Takeaways

### Decision Guide

```
Do I need containers?
  ├── Single application, single server → Maybe not (just deploy directly)
  └── Multiple services, multiple environments → Yes
  
Do I need Kubernetes?
  ├── < 5 services, small team → Probably not (use Docker Compose, ECS, Cloud Run)
  ├── 5-20 services, growing team → Consider managed K8s (EKS, GKE, AKS)
  └── 20+ services, large team, multi-cloud → Yes, definitely Kubernetes
  
Managed vs self-hosted K8s?
  ├── Almost always use managed (EKS, GKE, AKS)
  └── Self-hosted only if you have specific compliance needs AND a platform team
```

### Golden Rules

1. **Use specific image tags.** Never use `:latest` in production.
2. **Don't run as root.** Add a non-root USER in your Dockerfile.
3. **Set resource requests and limits.** Prevent noisy neighbor problems.
4. **Use liveness and readiness probes.** Kubernetes can't manage what it can't monitor.
5. **Use multi-stage builds.** Keep images small (MB, not GB).
6. **One process per container.** If you need two, use a multi-container Pod.
7. **Store state outside containers.** Containers are ephemeral.
8. **Use namespaces** for isolation between teams and environments.
9. **Start with managed Kubernetes.** Running your own is a full-time job.

---

## 🔥 Senior Interview Questions

1. You're deploying a stateful application (e.g., PostgreSQL) on Kubernetes. Walk through the challenges: persistent volumes, StatefulSets, pod identity, leader election. When should you NOT run databases on Kubernetes? [Answer](QnA-Answer-Key.md#22-containers--orchestration)

2. An interviewer asks: "Docker vs Kubernetes — what's the difference?" Many candidates conflate them. Explain the distinction and how they complement each other. Where do containerd, CRI-O, and OCI fit in? [Answer](QnA-Answer-Key.md#22-containers--orchestration)

3. Your Kubernetes cluster has 500 pods. During peak traffic, auto-scaling takes 3 minutes to launch new pods (image pull + startup). Users experience errors during the scaling window. How do you reduce scaling time? Discuss pre-warming, pod priority, Knative, and over-provisioning. [Answer](QnA-Answer-Key.md#22-containers--orchestration)

4. Compare Kubernetes Deployments, StatefulSets, DaemonSets, and Jobs. For each, give a concrete use case and explain why the other options wouldn't work. [Answer](QnA-Answer-Key.md#22-containers--orchestration)

5. Your team uses Helm charts for deployment. A Helm upgrade fails halfway, leaving the cluster in an inconsistent state. How do you design for safe rollbacks? Compare Helm rollback, ArgoCD GitOps, and Flux. [Answer](QnA-Answer-Key.md#22-containers--orchestration)

6. Explain Kubernetes networking: how does a request from the internet reach a specific container? Walk through Ingress Controller → Service → kube-proxy → Pod. What's the difference between ClusterIP, NodePort, and LoadBalancer services? [Answer](QnA-Answer-Key.md#22-containers--orchestration)

7. You have 100 microservices on Kubernetes. Each team deploys independently. A bad deployment in Service A causes cascading failures across the cluster. How do you prevent this? Discuss resource quotas, network policies, Pod Disruption Budgets, and canary deployments. [Answer](QnA-Answer-Key.md#22-containers--orchestration)

8. Compare running your own Kubernetes cluster vs managed Kubernetes (EKS, GKE, AKS). What are specific operational tasks you avoid with managed K8s? When would a company still run self-managed? [Answer](QnA-Answer-Key.md#22-containers--orchestration)

9. A Docker image for your Java application is 1.2GB. Walk through the optimization: multi-stage builds, distroless base images, JLink custom runtimes, layer caching. What's the impact on build time, image pull time, and security surface? [Answer](QnA-Answer-Key.md#22-containers--orchestration)

10. Your CI/CD pipeline builds and deploys 50 services to Kubernetes. The full pipeline takes 45 minutes. How do you optimize it? Discuss parallel builds, registry caching, Buildkit, incremental builds, and progressive delivery (canary, blue-green). [Answer](QnA-Answer-Key.md#22-containers--orchestration)

---

## 📚 Further Reading

- [Kubernetes the Hard Way (Kelsey Hightower)](https://github.com/kelseyhightower/kubernetes-the-hard-way) — Build a K8s cluster from scratch to deeply understand every component.
- [Docker Best Practices (Docker Official Docs)](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/) — Official guide to writing efficient, secure Dockerfiles.
- [Why Kubernetes Is So Hard (YouTube — Viktor Farcic)](https://www.youtube.com/watch?v=X48VuDVv0do) — Full Kubernetes tutorial covering all major concepts in one video.
