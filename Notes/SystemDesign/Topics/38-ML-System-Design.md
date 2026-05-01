# ML System Design

## Table of Contents

- [ML System Design](#ml-system-design)
  - [Table of Contents](#table-of-contents)
  - [1. Overview](#1-overview)
  - [2. ML System Architecture](#2-ml-system-architecture)
  - [3. Feature Engineering \& Feature Stores](#3-feature-engineering--feature-stores)
    - [What is a Feature Store?](#what-is-a-feature-store)
    - [Feature Types](#feature-types)
  - [4. Training Infrastructure](#4-training-infrastructure)
    - [Training at Scale](#training-at-scale)
  - [5. Model Serving](#5-model-serving)
    - [Online vs Batch Inference](#online-vs-batch-inference)
    - [Model Serving Infrastructure](#model-serving-infrastructure)
  - [6. A/B Testing \& Experimentation](#6-ab-testing--experimentation)
    - [Experimentation Infrastructure](#experimentation-infrastructure)
  - [7. ML Pipelines (MLOps)](#7-ml-pipelines-mlops)
    - [Model Monitoring](#model-monitoring)
  - [8. Data Flywheel](#8-data-flywheel)
  - [9. Common ML System Designs](#9-common-ml-system-designs)
    - [Recommendation System](#recommendation-system)
    - [Search Ranking](#search-ranking)
    - [Fraud Detection](#fraud-detection)
  - [10. Key Takeaways](#10-key-takeaways)

---

## 1. Overview

ML System Design sits at the intersection of system design and machine learning.
Interviews at top companies (especially <abbr title="FAANG: Facebook (Meta), Amazon, Apple, Netflix, and Google — commonly used to refer to top-tier tech companies with rigorous system design interviews.">FAANG</abbr>) increasingly ask:
"Design the recommendation system for YouTube" or "Design a spam detection system."

```
Traditional System Design:        ML System Design adds:
  ├── Requirements                 ├── Data collection & labeling
  ├── API Design                   ├── Feature engineering
  ├── Data Model                   ├── Model training pipeline
  ├── High-Level Architecture      ├── Model serving (online/batch)
  └── Scale & Trade-offs           ├── A/B testing / experimentation
                                   ├── Monitoring & retraining
                                   └── Feedback loops
```

---

## 2. ML System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    ML System Architecture                         │
│                                                                   │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐        │
│  │ Raw Data │──►│ Feature      │──►│ Training Pipeline │        │
│  │ Sources  │   │ Engineering  │   │                   │        │
│  │          │   │              │   │ • Preprocess      │        │
│  │ • Logs   │   │ • Transform  │   │ • Train model     │        │
│  │ • Events │   │ • Aggregate  │   │ • Evaluate        │        │
│  │ • DB     │   │ • Feature    │   │ • Register        │        │
│  └──────────┘   │   Store      │   └─────────┬─────────┘        │
│                 └──────┬───────┘             │                   │
│                        │                      │                   │
│                        ▼                      ▼                   │
│                 ┌──────────────┐   ┌───────────────────┐        │
│                 │ Online       │   │ Model Registry    │        │
│                 │ Feature      │   │ (versioned models)│        │
│                 │ Store        │   └─────────┬─────────┘        │
│                 └──────┬───────┘             │                   │
│                        │                      │                   │
│                        ▼                      ▼                   │
│                 ┌──────────────────────────────────┐             │
│                 │      Model Serving               │             │
│                 │  (Online inference / Batch)       │             │
│                 └──────────────┬───────────────────┘             │
│                                │                                  │
│                                ▼                                  │
│                 ┌──────────────────────────────────┐             │
│                 │   Monitoring & Feedback           │             │
│                 │   • Model performance             │             │
│                 │   • Data drift detection           │             │
│                 │   • A/B test results               │             │
│                 └──────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Engineering & Feature Stores

### What is a <abbr title="Feature Store: a centralised repository that stores, versions, and serves ML features for both training (offline) and inference (online), preventing training-serving skew.">Feature Store</abbr>?

```
Feature = an input signal to a model.
  User features: age, location, account_age, num_purchases
  Item features: price, category, avg_rating, num_reviews
  Context features: time_of_day, device, session_length

Problem without a feature store:
  Training: compute features from data warehouse (batch)
  Serving: compute SAME features in real-time (online)
  → Duplicate code, training-serving skew!

Feature Store solves this:
  ┌──────────────────────────────────────────┐
  │            Feature Store                  │
  │                                           │
  │  Offline Store (Batch):     Online Store: │
  │  ┌─────────────┐           ┌───────────┐ │
  │  │ Data Lake /  │           │ Redis /   │ │
  │  │ BigQuery     │───sync──►│ DynamoDB  │ │
  │  │              │           │           │ │
  │  │ Historical   │           │ Low-lat   │ │
  │  │ features for │           │ features  │ │
  │  │ training     │           │ for       │ │
  │  └─────────────┘           │ serving   │ │
  │                             └───────────┘ │
  └──────────────────────────────────────────┘
  
  Feature Stores: Feast (open source), Tecton, SageMaker Feature Store
```

### Feature Types

| Type        | Computed When  | Example                          | Latency     |
|------------|---------------|----------------------------------|-------------|
| Batch      | Hourly/daily  | User's 30-day purchase count     | Precomputed |
| Streaming  | Near real-time| User's clicks in last 5 minutes  | Seconds     |
| Real-time  | At request    | Current item's price             | Milliseconds|

---

## 4. Training Infrastructure

```
Training Pipeline:

  ┌───────────┐    ┌────────────┐    ┌───────────┐    ┌──────────┐
  │ Data      │───►│ Feature    │───►│ Model     │───►│ Model    │
  │ Ingestion │    │ Transform  │    │ Training  │    │ Evaluation│
  │           │    │            │    │           │    │           │
  │ • S3      │    │ • Normalize│    │ • GPU     │    │ • Metrics │
  │ • Kafka   │    │ • Encode   │    │ • TPU     │    │ • Offline │
  │ • DB dump │    │ • Window   │    │ • Distrib.│    │   eval    │
  └───────────┘    └────────────┘    └───────────┘    └──────┬───┘
                                                             │
                                                     ┌──────┴───────┐
                                                     │ Model        │
                                                     │ Registry     │
                                                     │ • Version    │
                                                     │ • Metadata   │
                                                     │ • Artifacts  │
                                                     └──────────────┘
```

### Training at Scale

```
Single machine:  Fits in GPU memory → train directly
                 Doesn't fit → gradient accumulation

Data parallelism:  Same model on N GPUs, split data
  GPU 1: batch 1 → gradients → 
  GPU 2: batch 2 → gradients → AllReduce → update model
  GPU 3: batch 3 → gradients →

Model parallelism: Split MODEL across GPUs (for huge models)
  GPU 1: layers 1-10
  GPU 2: layers 11-20
  GPU 3: layers 21-30
  
  Pipeline parallelism: micro-batches flow through GPU pipeline
```

---

## 5. Model Serving

### Online vs Batch Inference

```
Online (real-time):
  User request → Model inference → Response
  Latency: < 100ms
  Use case: Search ranking, recommendations, fraud detection

  ┌────────┐    ┌──────────┐    ┌──────────┐
  │ Client │───►│ Feature  │───►│ Model    │───► Prediction
  │        │    │ Retrieval│    │ Server   │
  └────────┘    └──────────┘    └──────────┘

Batch (offline):
  Run model on large dataset periodically
  Latency: minutes to hours
  Use case: Email recommendations, precomputed scores

  ┌────────────┐    ┌──────────┐    ┌──────────┐
  │ Data Lake  │───►│ Batch    │───►│ Store    │
  │ (all users)│    │ Inference│    │ Results  │
  └────────────┘    └──────────┘    └──────────┘
```

### Model Serving Infrastructure

```
Deployment options:
  1. REST API (Flask/FastAPI + container)
  2. gRPC server (TensorFlow Serving, Triton)
  3. Serverless (SageMaker / Lambda)
  4. Edge deployment (TFLite, ONNX on device)

Scaling:
  ┌──────────┐
  │    LB    │
  └────┬─────┘
       │
  ┌────┴─────┐
  ▼          ▼
┌──────┐  ┌──────┐
│Model │  │Model │    Auto-scale based on:
│Pod 1 │  │Pod 2 │    • Request queue depth
│(GPU) │  │(GPU) │    • Latency p99
└──────┘  └──────┘    • GPU utilization

Model optimization for serving:
  • Quantization (FP32 → INT8): 4x smaller, faster
  • Pruning: Remove unimportant weights
  • Distillation: Train small model to mimic large one
  • ONNX: Convert to universal format
  • TensorRT: GPU-optimized inference
```

---

## 6. A/B Testing & Experimentation

```
"Does the new model actually improve user experience?"

Control (Model A - current):     Treatment (Model B - new):
  50% of users                     50% of users
  ┌──────────────┐                 ┌──────────────┐
  │ Existing     │                 │ New          │
  │ Ranking      │                 │ Ranking      │
  │ Model        │                 │ Model        │
  └──────────────┘                 └──────────────┘
         │                                │
    Metric: CTR = 5.2%               Metric: CTR = 5.8%
    
  Statistical test: Is 5.8% > 5.2% statistically significant?
  p-value < 0.05? → Yes → Ship Model B!
```

### Experimentation Infrastructure

```
┌──────────────────────────────────────────────┐
│           Experimentation Platform            │
│                                               │
│  1. User Assignment                           │
│     Hash(user_id + experiment_id) % 100       │
│     0-49 → Control, 50-99 → Treatment        │
│                                               │
│  2. Feature Flags                             │
│     experiment.is_treatment(user_id)          │
│                                               │
│  3. Metric Collection                         │
│     Event logging → Data warehouse            │
│                                               │
│  4. Statistical Analysis                      │
│     t-test, chi-squared, Bayesian             │
│     Correcting for multiple comparisons       │
│                                               │
│  5. Guardrail Metrics                         │
│     Primary: CTR, revenue                     │
│     Guardrails: latency, error rate, crashes  │
│     If guardrail regresses → auto-rollback    │
└──────────────────────────────────────────────┘
```

---

## 7. ML Pipelines (<abbr title="MLOps: applying DevOps practices (CI/CD, monitoring, version control) to machine learning workflows — training, evaluation, deployment, and retraining.">MLOps</abbr>)

```
MLOps = DevOps for ML

CI/CD for ML:
  Code change → Train model → Evaluate → Deploy → Monitor

  ┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Code │───►│ CI:      │───►│ CD:      │───►│ Monitor: │
  │ Push │    │ Train &  │    │ Deploy   │    │ Perf &   │
  │      │    │ Evaluate │    │ Canary   │    │ Drift    │
  └──────┘    └──────────┘    └──────────┘    └──────────┘

MLOps Tools:
  ├── Experiment tracking: MLflow, Weights & Biases, Neptune
  ├── Pipeline orchestration: Kubeflow, Airflow, Vertex AI
  ├── Model registry: MLflow, SageMaker Model Registry
  ├── Serving: TFServing, Triton, SageMaker, Seldon
  └── Monitoring: Evidently AI, WhyLabs, custom
```

### Model Monitoring (<abbr title="Data drift: when the statistical distribution of input features in production diverges from what the model was trained on, degrading prediction quality.">Data drift</abbr> &amp; <abbr title="Concept drift: when the relationship between input features and the target variable changes over time, making the trained model less accurate.">Concept drift</abbr>)

```
Types of drift:
  
  Data drift: Input feature distribution changes
    Training: avg_price was $50 ± 10
    Production: avg_price is now $80 ± 20  ← DRIFT!

  Concept drift: Relationship between features and target changes
    Training: high engagement → likely to buy
    Production: high engagement → browsing but not buying ← DRIFT!

  Prediction drift: Model outputs distribution changes
    Training: 5% positive predictions
    Production: 25% positive predictions ← DRIFT!

Detection:
  - Statistical tests (KS test, PSI) on feature distributions
  - Monitor prediction distributions over time
  - Track online metrics vs offline metrics
  
Action:
  - Alert on drift
  - Retrain with recent data
  - Fall back to simpler model
```

---

## 8. Data Flywheel

```
The core growth loop for ML products:

  More Users ──► More Data ──► Better Model ──► Better Product
       ▲                                              │
       └──────────────────────────────────────────────┘

Example (Netflix):
  Users watch movies → viewing data collected
  → Train better recommendation model
  → Better recommendations → users watch more
  → More viewing data → even better model
  → Self-reinforcing loop!

This is the competitive moat of ML systems.
Amazon, Netflix, Google, TikTok all have data flywheels.
```

---

## 9. Common ML System Designs

### <abbr title="Recommendation System: an ML system that predicts what items (videos, products, posts) a user is likely to engage with, typically using a two-stage retrieve-then-rank architecture.">Recommendation System</abbr>

```
Two-stage approach:
  
  Stage 1: Candidate Generation (retrieve 1000 from millions)
    - Collaborative filtering (user-item interactions)
    - Content-based (similar items)
    - ANN search (embedding similarity)
    
  Stage 2: Ranking (rank 1000 → top 10)
    - ML model with rich features
    - User features + item features + context
    - Optimize for engagement / revenue / relevance
    
  ┌───────────┐    ┌─────────────────┐    ┌──────────────┐
  │ All Items │───►│ Candidate Gen   │───►│ Ranking      │──► Top 10
  │ (10M)     │    │ (→ 1000)        │    │ (→ 10)       │
  └───────────┘    └─────────────────┘    └──────────────┘
```

### Search Ranking

```
Query → Recall → Ranking → Display

  1. Recall: BM25 / inverted index → top 1000 docs
  2. L1 Ranking: Lightweight model → top 100
  3. L2 Ranking: Heavy model (BERT) → top 10
  4. Business rules: Boost paid, filter blocked
```

### Fraud Detection

```
Real-time scoring (< 100ms):
  Transaction → Feature extraction → Model inference → Allow/Block

Features:
  - Transaction amount, location, time
  - User history (avg spend, typical location)
  - Device fingerprint, IP reputation
  - Velocity (# transactions in last hour)

Challenge: Extreme class imbalance (0.1% fraud)
  → Use precision/recall/F1, not accuracy
  → Oversampling or weighted loss
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| ML system ≠ just the model | Infra around the model is 90% of the work |
| Feature stores prevent training-serving skew | Same feature computation for offline and online |
| <abbr title="Two-stage retrieval + ranking: first stage quickly narrows millions of candidates to ~1000 using lightweight signals; second stage ranks those with a heavier ML model.">Two-stage retrieval + ranking</abbr> | Standard pattern for recommendations and search |
| A/B testing validates everything | Never ship a model without measuring real impact |
| Monitor for data and concept drift | Models degrade over time — detect and retrain |
| Batch for most, online for time-sensitive | Not everything needs real-time inference |
| The data flywheel is the moat | More data → better model → more users → more data |
| Latency matters for serving | Quantization, caching, pre-computation keep it fast |
| Start simple, iterate | Logistic regression → gradient boosting → deep learning |

---

## 11. Distributed Training (Senior Deep Dive)

When a model + dataset don't fit on a single GPU, you need **distributed training**.

### Data Parallelism (most common)
- Same model replicated on N GPUs/nodes; each gets a different mini-batch.
- Gradients are averaged across workers each step (`AllReduce`).
- Frameworks: PyTorch DDP, Horovod, TensorFlow `MirroredStrategy`.
- **Bottleneck**: gradient sync bandwidth → use NCCL on NVLink, gradient compression, or asynchronous SGD.

### Model Parallelism
- Model itself split across GPUs (some layers on GPU 0, others on GPU 1).
- Required for huge models (LLMs > 100B params).
- **Pipeline parallelism** (GPipe) overlaps the forward/backward pass across stages.
- **Tensor parallelism** (Megatron-LM) shards individual matrix multiplies.

### Modern LLM Training Stack
- **3D Parallelism**: data + pipeline + tensor parallelism combined (DeepSpeed, Megatron).
- **Mixed precision** (bfloat16) for ~2x speed and ~50% memory.
- **ZeRO** (Zero Redundancy Optimizer) shards optimizer state across workers.
- **Gradient checkpointing** trades compute for memory.

### Hyperparameter Tuning Infrastructure
- **Random search** beats grid search in practice.
- **Bayesian optimization** (Optuna, HyperOpt) is sample-efficient for expensive trials.
- **Population-Based Training** (PBT) evolves hyperparameters during training.
- **Ray Tune** / **Vizier** are common orchestration platforms.

---

## 12. Feature Store — Detailed Architecture

A feature store solves **training-serving skew** — the silent killer of ML systems.

```
┌────────────────┐                       ┌──────────────────┐
│ Source Systems │                       │  Online Store    │
│ (DB, Kafka,    │──┬─ Feature Pipeline ▶│  (Redis/Cassandra│◀── Real-time inference
│  S3, logs)     │  │   (Spark/Flink)    │   <10ms reads)   │
└────────────────┘  │                    └──────────────────┘
                    │                    ┌──────────────────┐
                    └───────────────────▶│  Offline Store   │◀── Training, batch scoring
                                         │ (Parquet/BigQuery│
                                         │  Snowflake)      │
                                         └──────────────────┘
```

| Concern | How feature stores handle it |
|---------|------------------------------|
| **Skew** | Single feature definition produces both online and offline values |
| **Freshness** | Streaming pipelines write to online store within seconds |
| **Reuse** | One team's feature is discoverable and consumable by others |
| **Backfill** | "What would this feature have been at time T?" via point-in-time joins |
| **Lineage** | Track which features → which models → which decisions |

**Real-world systems**: Feast (open-source), Tecton, Uber Michelangelo, Airbnb Zipline, LinkedIn Feathr.

**Point-in-time correctness**: when joining labels with features for training, you MUST use the feature value as it was at the label's timestamp — not the current value. Future leakage is a top-3 ML bug.

---

## 13. Model Serving Architectures

### Batch (offline) Serving
- Score all users overnight, store predictions in a key-value store.
- Read at request time = simple cache lookup.
- **When to use**: predictions don't depend on real-time context (recommendations refreshed hourly).
- **Latency budget**: minutes to hours for the batch; <10ms for the lookup.

### Real-Time (online) Serving
- Model loaded in a server (TensorFlow Serving, TorchServe, Triton, NVIDIA Triton, BentoML).
- Request → feature lookup → inference → response.
- **Latency budget**: typically 50-200ms p99.
- **Tricks for low latency**: model quantization (INT8), distillation, caching feature lookups, batching requests on the server (dynamic batching).

### Streaming Inference
- Model embedded in a stream processor (Flink, Kafka Streams).
- Each event → score → emit downstream.
- Used for fraud detection, anomaly detection, real-time recommendations.

### Edge / On-Device Inference
- Model runs on the user's device (CoreML, TensorFlow Lite, ONNX Runtime).
- Pros: zero network latency, privacy.
- Cons: device limits, harder to update.

### Serving Patterns
- **Shadow mode**: route traffic to new model, compare to old, don't surface results.
- **A/B testing**: split traffic; measure business metric (CTR, revenue), not just model accuracy.
- **Canary deployment**: 1% → 10% → 50% → 100% traffic shift.
- **Multi-armed bandit**: dynamically allocate traffic to better-performing variant.

---

## 14. Cold-Start Problem

The Achilles heel of recommendation systems.

| Cold-start type | Solution |
|-----------------|----------|
| **New user** | Onboarding survey, demographic-based defaults, popularity baseline, contextual bandits |
| **New item** | Content-based features (text, image embeddings), explore/exploit (bandit), staff curation |
| **New context** | Hierarchical models (geo → city → user) so unknown contexts inherit from broader scope |

**Two-tower model trick**: train user-tower and item-tower separately. New items only need the item-tower forward pass — no retraining required.

---

## 15. Feedback Loops & The Data Flywheel

The **virtuous cycle**: better model → more user engagement → more data → better model.

But also the **vicious cycle**: model recommends only popular items → other items never get impressions → can never be recommended → popularity bias compounds.

### Mitigation
- **Exploration**: serve a fraction of random/diverse recommendations (epsilon-greedy, Thompson sampling).
- **Inverse-propensity-weighted training**: down-weight examples the model would have over-shown anyway.
- **Counterfactual evaluation**: estimate how a different model *would have* performed using logged data + IPS.

### Position Bias
- Users click the top result more — not because it's better, but because it's first.
- Fix: log presented position, model the position effect explicitly, or use randomized ranking for training data collection.

---

## 16. Data Labeling Strategies

| Approach | Cost | Quality | When |
|----------|------|---------|------|
| **Implicit feedback** (clicks, dwell time) | Free | Noisy, biased | Recommendations, ranking |
| **Explicit feedback** (ratings, thumbs) | Low | Sparse | Cold-start, calibration |
| **In-house annotation** | High | High | Sensitive domains (medical, legal) |
| **Crowdsourcing** (Mechanical Turk, Scale) | Medium | Variable | General CV/NLP |
| **Active learning** | Medium | High | Limited budget — label only the uncertain ones |
| **Weak supervision** (Snorkel) | Low | Medium | Programmatic labeling at scale |
| **Self-supervised pretraining** | Compute-heavy | Excellent | Foundation models |

---

## 17. MLOps & CI/CD for ML

Unlike software, ML systems have **three** sources of change: code, data, and model.

```
Data ──▶ Data Pipeline ──▶ Training ──▶ Model Registry ──▶ Serving ──▶ Monitoring
  ▲          ▲                ▲              ▲                              │
  └──────────┴────────────────┴──────────────┴──────────────────────────────┘
                          (everything triggers everything)
```

| Practice | Tool examples |
|----------|---------------|
| **Data versioning** | DVC, LakeFS, Delta Lake |
| **Experiment tracking** | MLflow, Weights & Biases, Neptune |
| **Model registry** | MLflow Model Registry, Vertex AI, SageMaker |
| **Pipeline orchestration** | Airflow, Kubeflow, Prefect, Dagster |
| **Feature store** | Feast, Tecton |
| **Model serving** | KServe, BentoML, Triton |
| **Monitoring** | WhyLabs, Arize, Evidently |

### Reproducibility Checklist
- [ ] Pinned data version
- [ ] Pinned code commit
- [ ] Pinned dependencies (lockfile, container image)
- [ ] Logged hyperparameters and seed
- [ ] Logged training metrics

---

## 18. Model Interpretability

Increasingly required (EU AI Act, financial regulations).

| Technique | Use |
|-----------|-----|
| **Feature importance** (tree-based) | Quick global explanation |
| **SHAP values** | Per-prediction explanation, model-agnostic |
| **LIME** | Local linear approximation |
| **Attention visualization** | NN/transformer models |
| **Counterfactual explanations** | "What would change the prediction?" |

---

## 19. Senior Interview Questions (ML SD)

1. *"How would you detect that your fraud model is degrading in production before it causes financial damage?"* — drift detection on input features (KS test), output distribution, business KPI.
2. *"Walk me through deploying a new ranking model. How do you guarantee it won't tank the homepage CTR?"* — shadow mode → canary → A/B with guardrails → kill switch.
3. *"You have a 200B parameter LLM that needs to serve at 100 QPS with <500ms p99. Walk me through serving infrastructure."* — quantization, batching, KV cache, tensor parallelism, model sharding.
4. *"How do you avoid feature leakage when training a model that predicts user churn?"* — point-in-time joins, exclude any feature whose value is influenced by the label.
5. *"Your recommender is biased toward popular items. How do you fix it?"* — inverse-propensity weighting, exploration noise, calibrated diversity penalties.
6. *"Why is your offline AUC great but online CTR drops?"* — training-serving skew, feedback loop, distribution shift, off-policy evaluation issues.
