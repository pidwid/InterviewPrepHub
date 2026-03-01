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
Interviews at top companies (especially FAANG) increasingly ask:
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

### What is a Feature Store?

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

## 7. ML Pipelines (MLOps)

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

### Model Monitoring

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

### Recommendation System

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
| Two-stage retrieval + ranking | Standard pattern for recommendations and search |
| A/B testing validates everything | Never ship a model without measuring real impact |
| Monitor for data and concept drift | Models degrade over time — detect and retrain |
| Batch for most, online for time-sensitive | Not everything needs real-time inference |
| The data flywheel is the moat | More data → better model → more users → more data |
| Latency matters for serving | Quantization, caching, pre-computation keep it fast |
| Start simple, iterate | Logistic regression → gradient boosting → deep learning |
