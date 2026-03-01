# Design Amazon's Sales Ranking by Category

Amazon displays a "Best Sellers Rank" for every product, broken down by category. For example, a book might be #1 in "Computer Science" and #342 in "Books." The ranking updates frequently (hourly) and reflects recent sales velocity, not just total sales. This is a data pipeline and real-time analytics problem.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we ranking by total sales or by recent sales velocity?  
**Interviewer:** Recent sales velocity — products that are selling well NOW should rank higher, similar to Amazon's actual algorithm.

**Candidate:** How frequently should rankings update?  
**Interviewer:** Every hour.

**Candidate:** How many products and categories?  
**Interviewer:** 100 million products, 10,000 categories. Each product can belong to multiple categories.

**Candidate:** Do we need historical ranking data?  
**Interviewer:** Yes, users should see rank trends (rising/falling).

**Candidate:** What's the order volume?  
**Interviewer:** 1 million orders per hour at peak (holiday season).

### Functional Requirements

- Compute sales rank for every product within each category it belongs to
- Rankings update hourly based on recent sales velocity
- Users can view a product's current rank in each category
- Users can view the top N best sellers in any category
- Track rank trends over time (is the product rising or falling?)

### Non-Functional Requirements

- **Freshness:** Rankings reflect sales from the last 1-24 hours
- **Scalability:** 100M products, 10K categories, 1M orders/hour
- **Accuracy:** Rankings must correctly reflect relative sales velocity
- **Low query latency:** < 100 ms to fetch rank or top-N list
- **Fault tolerance:** System continues even if some components fail

### Back-of-the-Envelope Estimation

- **Orders:** 1M/hour peak = ~278 orders/sec
- **Products with sales:** Maybe 5M products sell at least once per day
- **Ranking computation:** 10K categories × (sort products by sales) = 10K sort operations per hour
- **Largest category:** "Books" might have 10M products
- **Storage:** Rankings: 100M products × 10 avg categories × 4 bytes rank = 4 GB
- **Historical rankings:** Per hour × 24 × 365 = ~35 TB/year if stored for all products

---

## Step 2 — High-Level Design

### Architecture Overview

This is fundamentally a **stream processing + batch analytics** problem.

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Order   │────▶│  Event       │────▶│  Sales       │
│  Service │     │  Stream      │     │  Aggregator  │
│          │     │  (Kafka)     │     │              │
└──────────┘     └──────────────┘     └──────┬───────┘
                                             │
                                      ┌──────▼───────┐
                                      │  Ranking     │
                                      │  Computer    │
                                      │  (Hourly)    │
                                      └──────┬───────┘
                                             │
                    ┌────────────────────┬────┴──────┐
                    ▼                    ▼           ▼
              ┌──────────┐      ┌───────────┐  ┌────────┐
              │ Rankings │      │ Top-N     │  │ Rank   │
              │ DB       │      │ Cache     │  │ History│
              └──────────┘      └───────────┘  └────────┘
                    │                │
                    ▼                ▼
              ┌──────────────────────────┐
              │  Product API / Website   │
              └──────────────────────────┘
```

### API Design

```
-- Get product rank --
GET /api/v1/products/{productId}/rank
  Response: {
    "productId": "B001234",
    "rankings": [
      { "category": "Computer Science", "rank": 1, "trend": "rising" },
      { "category": "Books", "rank": 342, "trend": "stable" }
    ]
  }

-- Get top sellers in category --
GET /api/v1/categories/{categoryId}/bestsellers?limit=100
  Response: {
    "category": "Computer Science",
    "products": [
      { "productId": "B001234", "rank": 1, "title": "DDIA", "salesVelocity": 520 },
      { "productId": "B005678", "rank": 2, "title": "...", "salesVelocity": 480 }
    ]
  }

-- Get rank history --
GET /api/v1/products/{productId}/rank-history?category=cs&days=30
  Response: {
    "history": [
      { "date": "2024-01-20", "rank": 1 },
      { "date": "2024-01-19", "rank": 3 },
      ...
    ]
  }
```

---

## Step 3 — Design Deep Dive

### Sales Velocity Calculation

Amazon doesn't rank by total all-time sales. They use a **time-decayed sales velocity**:

```
Simple approach: Count sales in last 24 hours
  velocity = COUNT(orders WHERE product_id = ? AND time > NOW() - 24h)

Better approach: Exponential decay (recent sales weight more)
  velocity = Σ (sale_count × e^(-λ × hours_ago))
  
  Where λ = decay factor (e.g., 0.1)
  - Sale 1 hour ago:  weight = e^(-0.1 × 1) = 0.905
  - Sale 12 hours ago: weight = e^(-0.1 × 12) = 0.301
  - Sale 24 hours ago: weight = e^(-0.1 × 24) = 0.091

This ensures a product that sold 100 units today ranks higher than 
one that sold 100 units yesterday, even though total is the same.
```

**Practical implementation using hourly buckets:**

```
Maintain hourly sales counts per product:

hourly_sales:
| product_id | hour_bucket          | sales_count |
|------------|----------------------|-------------|
| B001234    | 2024-01-20T10:00     | 45          |
| B001234    | 2024-01-20T09:00     | 38          |
| B001234    | 2024-01-20T08:00     | 52          |
| ...        | (keep 24-48 hours)   | ...         |

Velocity = Σ (sales_count[h] × decay_weight[h])
         = 45 × 1.0 + 38 × 0.905 + 52 × 0.819 + ...
```

### Data Pipeline: Order to Ranking

```
Step 1: Order Event Ingestion
─────────────────────────────
Order placed → Order Service publishes event to Kafka

Event: {
  "orderId": "ord_123",
  "productId": "B001234",
  "categoryIds": ["cat_cs", "cat_books"],
  "quantity": 1,
  "timestamp": "2024-01-20T10:15:00Z"
}

Kafka topic: "order-events"
Partitioned by: productId (all events for same product go to same partition)

Step 2: Real-time Sales Aggregation
────────────────────────────────────
Stream processor (Kafka Streams / Flink) consumes events:

For each order event:
  1. Extract product_id and category_ids
  2. Increment hourly counter:
     HINCRBY product_sales:{product_id} {hour_bucket} {quantity}
  3. Add product to "dirty set" for each category:
     SADD dirty_products:{category_id} {product_id}

This runs continuously, processing 278 events/sec.

Step 3: Hourly Ranking Computation
──────────────────────────────────
Every hour, a batch job computes rankings:

For each category_id in all_categories:
  1. Get all products in category (from product-category mapping)
  2. For each product, compute velocity score:
     score = Σ(hourly_count[h] × decay_weight[h]) for h in last 24 hours
  3. Sort products by score descending
  4. Assign rank = position in sorted list
  5. Write rankings to DB and cache
  6. Compare with previous rank → compute trend (rising/falling/stable)
```

### Ranking Computation at Scale

Sorting 10M products (largest category) every hour:

```
Approach A: Sort in Memory
  - 10M products × (8 bytes productId + 8 bytes score) = 160 MB
  - Fits in memory on a single machine
  - Sort: O(n log n) = 10M × log(10M) ≈ 230M comparisons
  - Time: < 30 seconds on modern hardware
  - Simple and effective for most categories

Approach B: MapReduce (for truly massive scale)
  - Partition products by category
  - Map: compute velocity score per product
  - Shuffle: group by category
  - Reduce: sort within category, assign ranks
  - Use Spark/Flink for distributed computation

Approach C: Incremental Updates (Optimization)
  - Only re-rank products that had sales in the last hour
  - "Dirty set" of products per category
  - If only 1% of products in a category had sales:
    10M × 1% = 100K products to re-sort
  - Insert updated scores into a pre-sorted structure

For Amazon's scale: Approach A for most categories,
  Approach B for the largest ones
```

### Storage Design

```
Rankings Database (DynamoDB or Cassandra):

Table: product_rankings
  Partition Key: product_id
  Sort Key: category_id
  Attributes: rank, velocity_score, previous_rank, trend, updated_at

  Example:
  | product_id | category_id | rank | velocity | prev_rank | trend   |
  | B001234    | cat_cs      | 1    | 520.5    | 3         | rising  |
  | B001234    | cat_books   | 342  | 520.5    | 340       | falling |

Table: category_bestsellers
  Partition Key: category_id
  Sort Key: rank
  Attributes: product_id, velocity_score, title

  Example:
  | category_id | rank | product_id | velocity | title          |
  | cat_cs      | 1    | B001234    | 520.5    | DDIA           |
  | cat_cs      | 2    | B005678    | 480.2    | Clean Code     |
  | cat_cs      | 3    | B009012    | 445.1    | System Design  |
  
  Query: Top 100 in category → simple range query on sort key
```

### Caching Strategy

```
Two cache patterns:

1. Top-N Cache (per category):
   Key: bestsellers:{categoryId}
   Value: sorted list of top 100 products with their ranks
   TTL: 1 hour (refreshed after each ranking computation)
   
   This serves the "Best Sellers" page — very high traffic.

2. Product Rank Cache:
   Key: rank:{productId}
   Value: { "cat_cs": 1, "cat_books": 342, ... }
   TTL: 1 hour
   
   This serves the rank display on individual product pages.

Cache warming: After each hourly ranking computation,
  proactively update both caches (don't wait for reads).
```

### Rank History and Trends

```
Daily snapshots for rank history:

rank_history table:
  | product_id | category_id | date       | rank | velocity |
  | B001234    | cat_cs      | 2024-01-20 | 1    | 520.5    |
  | B001234    | cat_cs      | 2024-01-19 | 3    | 480.2    |
  | B001234    | cat_cs      | 2024-01-18 | 5    | 422.1    |

Trend computation:
  trend = "rising"  if current_rank < previous_rank
  trend = "falling" if current_rank > previous_rank
  trend = "stable"  if current_rank == previous_rank
  trend = "new"     if no previous rank (first appearance)

Storage: Only store daily snapshots (not hourly) for history
  100M products × 10 categories × 365 days × 20 bytes = ~7.3 TB/year
  
Retention: Keep 1 year of daily, 5 years of weekly aggregates
```

### Handling Edge Cases

```
1. New Products:
   - No sales history → no rank initially
   - After first sale, assign rank in next hourly computation
   - Show "New Release" badge instead of rank for first 7 days

2. Products in Multiple Categories:
   - Same product has different ranks in different categories
   - Velocity score is the same; rank depends on competition in each category
   - Product "DDIA": #1 in Computer Science, #342 in all Books

3. Holiday Sales Spikes:
   - Black Friday: 10× normal order volume
   - Auto-scale Kafka consumers and aggregation workers
   - Rankings may be more volatile (fast-changing)

4. Seasonal Products:
   - Christmas decorations spike in December
   - Exponential decay naturally handles this
   - After the season, velocity drops and rank falls

5. Ties:
   - Same velocity score → break tie by total historical sales
   - Or by product rating, review count, etc.
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
Order Service ──▶ Kafka (order-events)
                     │
              Stream Processor (Flink)
                     │
              ┌──────┴──────┐
              ▼              ▼
        Redis Counters    Dirty Sets
        (hourly sales)   (per category)
              │              │
              └──────┬───────┘
                     │
              Hourly Rank Job
              (sort, assign ranks)
                     │
              ┌──────┼──────┐
              ▼      ▼      ▼
           Rankings  Cache   History
           DB       (Redis)  DB
              │      │
              ▼      ▼
           Product Pages / Best Sellers Page
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sales metric | Exponential decay velocity | Recent sales matter more |
| Update frequency | Hourly batch | Good freshness vs compute cost |
| Ingestion | Kafka + stream processing | Handle 1M orders/hour |
| Ranking computation | In-memory sort | 10M products sorts in < 30s |
| Storage | DynamoDB (rankings) + Redis (cache) | Fast range queries + fast lookups |
| History | Daily snapshots | Balance storage vs granularity |

### Additional Talking Points

- **Sub-category rankings** — Recursive: rank in "Fiction > Sci-Fi > Hard Sci-Fi" inherits from parent
- **Weighted velocity** — Weight by revenue (not units): a $100 book sale counts more than a $5 one
- **A/B testing** — Test different decay factors, update frequencies
- **Global vs regional** — Different rankings per country/marketplace (amazon.com vs amazon.co.uk)
- **Anti-gaming** — Detect fake purchases intended to boost rank; filter suspicious orders
- **Real-time leaderboard** — For top 100, could use Redis Sorted Sets updated in real-time (not hourly)
- **Machine learning** — Predict future rank based on sales trends, precompute for recommendation
