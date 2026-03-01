# Design a Recommendation System

A recommendation system suggests relevant items (products, movies, songs, posts) to users based on their behavior and preferences. It powers the "Recommended for You" sections on Amazon, Netflix, YouTube, Spotify, and TikTok. These systems directly drive revenue — Netflix estimates its recommendations save $1B/year by reducing churn.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What kind of items are we recommending? Products, videos, or something else?
**Interviewer:** Design a general-purpose recommendation engine, but let's use an e-commerce product recommendation as our example.

**Candidate:** Are we generating recommendations in real-time or can they be pre-computed?
**Interviewer:** A mix — pre-compute most recommendations, but also support real-time signals (user just viewed item X).

**Candidate:** How many users and items?
**Interviewer:** 100 million users, 10 million items.

**Candidate:** Do we need to explain why an item was recommended ("Because you bought X...")?
**Interviewer:** Yes, that's important for user trust.

### Functional Requirements

- Generate personalized item recommendations for each user
- Support multiple recommendation types: "Similar items," "Customers also bought," "Recommended for you"
- Incorporate real-time signals (recent views, clicks, purchases)
- Provide explanation for recommendations ("Because you viewed...")

### Non-Functional Requirements

- **Low latency** — Serve recommendations in < 200ms
- **Scalability** — Handle 100M users, 10M items
- **Freshness** — Incorporate new user behavior within minutes
- **Availability** — Recommendations should always be available (fallback to popular items)

### Back-of-the-Envelope Estimation

- 100M users × 10M items = 10^15 possible (user, item) pairs — can't store all scores
- If we store top 100 recommendations per user: 100M × 100 × 8 bytes = ~80 GB → fits in a distributed cache
- 50K recommendation requests/sec at peak

---

## Step 2 — High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                    Online Serving Path                   │
│                                                         │
│  User Request → API Gateway → Recommendation Service    │
│                                    │                    │
│                     ┌──────────────┼──────────────┐     │
│                     ▼              ▼              ▼     │
│              ┌───────────┐  ┌──────────┐  ┌─────────┐  │
│              │ Pre-       │  │ Real-time│  │Fallback │  │
│              │ computed   │  │ Scoring  │  │(Popular)│  │
│              │ Cache      │  │ Service  │  │         │  │
│              └───────────┘  └──────────┘  └─────────┘  │
│                                    │                    │
│                                    ▼                    │
│                             ┌──────────┐                │
│                             │ Ranking  │                │
│                             │ & Filter │                │
│                             └──────────┘                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Offline Training Pipeline              │
│                                                         │
│  Event Stream → Feature Store → Model Training → Deploy │
│  (clicks,        (user/item       (batch job,           │
│   purchases,      features)        hourly/daily)        │
│   views)                                                │
└─────────────────────────────────────────────────────────┘
```

---

## Step 3 — Design Deep Dive

### 1. Recommendation Algorithms

#### Collaborative Filtering

"Users who are similar to you liked these items."

```
User-Item Interaction Matrix:

              Item A  Item B  Item C  Item D  Item E
  User 1:       5       3       -       1       -
  User 2:       4       -       -       1       -
  User 3:       1       1       -       5       4
  User 4:       -       -       5       4       -
  User 5:       -       3       4       -       5

User-Based CF:
  User 1 and User 2 have similar ratings → recommend User 2's other items to User 1.

Item-Based CF:
  Items A and B are often rated together → if user liked A, recommend B.

Matrix Factorization (modern approach):
  Decompose the sparse User-Item matrix into two smaller matrices:
  
  User-Item (100M × 10M) ≈ User-Factor (100M × K) × Item-Factor (K × 10M)
  
  K = latent factor dimension (typically 50–200)
  Each user and item is represented as a K-dimensional vector.
  Predicted score = dot product of user vector and item vector.
  
  score(user_1, item_C) = user_1_vector · item_C_vector
```

#### Content-Based Filtering

"You liked items with these attributes, here are similar items."

```
Item features:
  Item A: { category: "electronics", brand: "Apple", price: 999 }
  Item B: { category: "electronics", brand: "Apple", price: 1299 }
  Item C: { category: "books",       brand: null,    price: 15 }

User profile (built from interaction history):
  User 1: { preferred_category: "electronics", preferred_brand: "Apple" }

Similarity: cosine similarity between user profile vector and item feature vector.

  sim(User 1, Item B) = high → recommend Item B
  sim(User 1, Item C) = low  → don't recommend
```

#### Hybrid Approach (What Production Systems Use)

```
Stage 1 — Candidate Generation (broad, fast):
  ├── Collaborative Filtering → 200 candidates
  ├── Content-Based Filtering → 200 candidates
  ├── Trending / Popular items → 50 candidates
  └── Recently viewed similar → 100 candidates
                                 ─────
                                 ~500 candidates (with dedup)

Stage 2 — Ranking (narrow, expensive):
  ML ranking model scores each of the 500 candidates.
  Features: user features + item features + context (time, device, location)
  Output: predicted probability of engagement (click, purchase)
  
  Top 50 items by predicted score are returned.

Stage 3 — Filtering & Business Rules:
  - Remove already-purchased items
  - Remove out-of-stock items
  - Apply diversity rules (don't show 10 phone cases in a row)
  - Boost sponsored/promoted items
  - Apply geographic availability filters
```

### 2. Candidate Generation: Two-Tower Model

```
The dominant architecture in modern recommendation systems:

┌──────────────┐           ┌──────────────┐
│  User Tower  │           │  Item Tower  │
│              │           │              │
│  Input:      │           │  Input:      │
│  - User ID   │           │  - Item ID   │
│  - History   │           │  - Category  │
│  - Demographics│         │  - Price     │
│              │           │  - Features  │
│  Output:     │           │  Output:     │
│  User embed  │           │  Item embed  │
│  (128-dim)   │           │  (128-dim)   │
└──────┬───────┘           └──────┬───────┘
       │                          │
       └──────── dot product ─────┘
                    │
              Relevance Score

At serving time:
  1. Compute user embedding (real-time)
  2. ANN search against pre-computed item embeddings
     (using FAISS, ScaNN, or Milvus)
  3. Return top-K nearest items in embedding space

This makes candidate generation O(log N) instead of O(N).
```

### 3. Feature Store

```
The feature store provides a unified source of features for both
training (offline) and serving (online):

┌─────────────────────────────────────────┐
│              Feature Store              │
│                                         │
│  User Features (online, low-latency):   │
│  ┌─────────────────────────────────┐    │
│  │ user_123:                        │    │
│  │   last_viewed: [item_A, item_B]  │    │ ← Redis / DynamoDB
│  │   purchase_count: 42             │    │
│  │   avg_price: $85                 │    │
│  │   preferred_categories: [...]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Item Features (batch-updated):         │
│  ┌─────────────────────────────────┐    │
│  │ item_A:                          │    │
│  │   embedding: [0.12, 0.34, ...]   │    │ ← Precomputed
│  │   category: "electronics"        │    │
│  │   avg_rating: 4.5                │    │
│  │   purchase_velocity: 150/day     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 4. Real-Time Signal Processing

```
Event Stream:

  User views item → Kafka → Stream Processor → Update Feature Store
  User adds to cart → Kafka → Stream Processor → Trigger re-ranking
  User purchases → Kafka → Stream Processor → Remove from recommendations

Stream processor (Flink / Spark Streaming):
  1. Aggregate recent user behavior (last 30 minutes)
  2. Update user features in Feature Store
  3. Optionally trigger re-computation of user embedding

This allows:
  "User just viewed 3 laptops → immediately boost laptop recommendations"
  instead of waiting for the next batch pipeline run.
```

### 5. Serving Architecture

```
Request flow (< 200ms total):

  1. API receives request for user_123 (5ms)
  
  2. Check pre-computed cache (Redis)  (10ms)
     └── HIT: Return cached recommendations (common path)
     └── MISS: Continue to real-time path
  
  3. Fetch user features from Feature Store (15ms)
  
  4. Candidate generation (50ms)
     ├── ANN search with user embedding
     └── Merge candidates from multiple sources
  
  5. Ranking model inference (30ms)
     └── Score 500 candidates with ML model
  
  6. Post-filtering & business rules (10ms)
  
  7. Return top 50 recommendations
  
  Total: ~120ms (well under 200ms budget)
```

---

## Step 4 — Wrap Up

### Handling Edge Cases

- **Cold start (new user):** No interaction history. Fallback to: popular items, demographic-based recommendations, or ask explicit preferences during onboarding.

- **Cold start (new item):** No interaction data. Use content-based features (category, description, images) to place the item in embedding space. Boost exposure initially to collect interaction data ("exploration").

- **Filter bubble:** User only sees items similar to what they've bought before. Mitigation: inject a small percentage (5–10%) of diverse/exploratory recommendations. Use multi-armed bandit or epsilon-greedy strategies.

- **Popularity bias:** Popular items dominate recommendations. Mitigation: apply inverse-popularity weighting in the ranking model. Score = relevance × (1 / log(popularity)).

### Architecture Summary

1. A **two-stage pipeline** (candidate generation + ranking) keeps latency low while maintaining quality. Candidates are generated cheaply, then scored with an expensive ML model.
2. **Collaborative filtering** and **content-based filtering** provide complementary signals — CF captures taste patterns, content-based handles cold start.
3. **Pre-computed recommendations** in Redis serve the majority of requests instantly. Real-time scoring handles fresh signals.
4. A **feature store** unifies offline training and online serving, ensuring model training and serving use identical feature definitions.
5. **Real-time event streaming** (Kafka + Flink) updates user features within minutes, keeping recommendations fresh.
