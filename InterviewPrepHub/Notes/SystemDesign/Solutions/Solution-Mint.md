# Design Mint.com

Mint.com is a personal finance management platform that aggregates financial data from multiple banks, credit cards, loans, and investment accounts. It provides budgeting, spending tracking, bill reminders, and financial insights. The key challenges are secure third-party bank integration, data aggregation, and real-time financial analytics.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What are the key features we're designing?  
**Interviewer:** Account aggregation (pulling data from banks), transaction categorization, budgeting, spending analytics, and bill reminders.

**Candidate:** How do we connect to banks?  
**Interviewer:** Use a third-party aggregation service like Plaid or Yodlee. Don't design the bank integration protocol itself.

**Candidate:** How many users?  
**Interviewer:** 10 million registered users, 2 million DAU.

**Candidate:** How frequently should financial data be updated?  
**Interviewer:** At least once daily, with manual refresh available.

**Candidate:** Is security a primary concern?  
**Interviewer:** Absolutely — financial data is extremely sensitive. Encryption and compliance are critical.

### Functional Requirements

- Users link bank accounts, credit cards, loans, investments via Plaid/Yodlee
- System aggregates and normalizes transactions from all accounts
- Automatic transaction categorization (groceries, dining, transport, etc.)
- Budget creation and tracking (monthly spending limits per category)
- Spending analytics and trends (monthly/yearly breakdowns)
- Bill reminders and due date alerts

### Non-Functional Requirements

- **Security:** End-to-end encryption, SOC 2 compliance, never store bank credentials
- **Reliability:** Financial data must be accurate and consistent
- **Freshness:** Data updated at least once daily
- **Scalability:** 10M users, millions of transactions per day
- **Availability:** 99.9% uptime

### Back-of-the-Envelope Estimation

- 10M users, average 3 linked accounts each → 30M accounts
- Average 50 transactions/account/month → 1.5B transactions/month = 50M/day
- Average transaction record: 200 bytes → 10 GB/day new data
- Historical data: 5 years × 120 GB/year = 600 GB
- Daily sync: 30M accounts × 1 API call = 30M external API calls/day

---

## Step 2 — High-Level Design

### API Design

```
-- Link a bank account --
POST /api/v1/accounts/link
  Body: { "plaidToken": "link-sandbox-xxx", "institutionId": "ins_1" }
  Response: { "accountId": "acc_123", "type": "checking", "balance": 5420.50 }

-- Get all accounts --
GET /api/v1/accounts
  Response: { "accounts": [
    { "id": "acc_123", "institution": "Chase", "type": "checking", "balance": 5420.50 },
    { "id": "acc_456", "institution": "Amex", "type": "credit", "balance": -1200.00 }
  ]}

-- Get transactions --
GET /api/v1/transactions?accountId=acc_123&from=2024-01-01&to=2024-01-31&category=dining
  Response: { "transactions": [...], "total": -342.50, "count": 15 }

-- Create budget --
POST /api/v1/budgets
  Body: { "category": "dining", "monthlyLimit": 500, "alertThreshold": 0.8 }

-- Get spending summary --
GET /api/v1/analytics/spending?period=monthly&month=2024-01
  Response: {
    "totalSpending": 4200,
    "byCategory": { "dining": 342, "groceries": 680, "transport": 250, ... },
    "vsLastMonth": { "dining": "+12%", "groceries": "-5%", ... }
  }
```

### High-Level Architecture

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────▶│  API Gateway │────▶│  App Servers │
│ (Mobile/ │     │  (Auth,Rate  │     │  (Stateless) │
│  Web)    │     │   Limit)     │     │              │
└──────────┘     └──────────────┘     └──────┬───────┘
                                             │
                    ┌────────────────┬────────┼──────────┐
                    ▼                ▼        ▼          ▼
              ┌──────────┐   ┌──────────┐ ┌───────┐ ┌────────┐
              │ Account  │   │ Budget   │ │ Alert │ │Analytics│
              │ Service  │   │ Service  │ │Service│ │ Service │
              └────┬─────┘   └──────────┘ └───────┘ └────────┘
                   │
              ┌────▼──────┐
              │  Plaid /  │  (Third-party bank API)
              │  Yodlee   │
              └────┬──────┘
                   │
              ┌────▼──────┐     ┌──────────────┐
              │  Data     │────▶│  Transaction │
              │  Sync     │     │  DB          │
              │  Pipeline │     │  (PostgreSQL)│
              └───────────┘     └──────────────┘
```

---

## Step 3 — Design Deep Dive

### Bank Account Linking Flow

```
1. User clicks "Link Account" in app
2. App opens Plaid Link widget (iframe/WebView)
3. User authenticates with their bank inside Plaid's UI
   - Mint NEVER sees bank credentials
   - Plaid handles OAuth / credential encryption
4. Plaid returns a public_token to the client
5. Client sends public_token to Mint backend
6. Backend exchanges public_token for access_token via Plaid API
7. Store encrypted access_token in Vault (NOT in main DB)
8. Fetch initial account data and transactions
9. Store account metadata and transactions in DB
```

```
┌────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Client │──▶│ Plaid    │──▶│ Bank     │   │ Mint     │
│        │   │ Link UI  │   │ (Chase)  │   │ Backend  │
└───┬────┘   └────┬─────┘   └──────────┘   └────┬─────┘
    │              │                              │
    │──open link──▶│                              │
    │              │──auth with bank──────────────▶│
    │              │◀─────────────────────────────│
    │◀─public_token│                              │
    │──────────────public_token──────────────────▶│
    │              │◀────exchange for access_token─│
    │              │──────access_token────────────▶│
    │◀─────────────────account data───────────────│
```

### Data Sync Pipeline

Daily synchronization is a massive batch operation:

```
30M accounts need to be synced every 24 hours
= 30M / 86400 ≈ 350 accounts/sec

Pipeline:
1. Scheduler triggers sync for accounts (staggered, not all at once)
2. Account Sync Worker:
   a. Retrieve access_token from Vault
   b. Call Plaid API: GET /transactions?start=last_sync_date
   c. Receive new transactions since last sync
   d. Categorize transactions (ML categorizer)
   e. Write transactions to DB
   f. Update account balance
   g. Check budget thresholds → trigger alerts if needed
   h. Update last_sync_timestamp
```

```
┌────────────┐     ┌──────────────┐     ┌──────────┐
│ Scheduler  │────▶│ Sync Queue   │────▶│ Sync     │
│ (Cron)     │     │ (Kafka)      │     │ Workers  │
└────────────┘     └──────────────┘     └────┬─────┘
                                             │
                    ┌────────────────────┬────┴─────┐
                    ▼                    ▼          ▼
              ┌──────────┐      ┌──────────┐  ┌────────┐
              │  Plaid   │      │ Category │  │  DB    │
              │  API     │      │ ML Model │  │ Write  │
              └──────────┘      └──────────┘  └────────┘
```

**Reliability measures:**
- Each account sync is an idempotent task (can be retried safely)
- Dead letter queue for failed syncs (retry with exponential backoff)
- Circuit breaker on Plaid API (if Plaid is down, back off)
- Transaction deduplication: use `(plaid_transaction_id)` as unique key

### Transaction Categorization

```
Approach: Multi-tier categorization

Tier 1: Merchant Mapping (exact match)
  - "STARBUCKS #12345" → category: "Coffee & Dining"
  - Maintained merchant database: 100K+ known merchants
  - Fast, accurate for known merchants

Tier 2: Rule-based (pattern matching)
  - Contains "UBER" or "LYFT" → "Transport"
  - Contains "AMAZON" → "Shopping"
  - MCC (Merchant Category Code) from bank → map to category

Tier 3: ML Classifier (for unknown merchants)
  - Features: merchant name, amount, MCC, time of day, frequency
  - Model: Multi-class classification (Random Forest or BERT)
  - Training data: user corrections + labeled transactions
  - Accuracy: ~90%, users can manually correct

Category Hierarchy:
├── Housing (rent, mortgage, utilities)
├── Food (groceries, dining, coffee)
├── Transport (gas, public transit, rideshare)
├── Shopping (clothing, electronics, general)
├── Entertainment (streaming, movies, games)
├── Health (medical, pharmacy, gym)
├── Bills (insurance, phone, internet)
├── Income (salary, freelance, refunds)
└── Other
```

### Budget Engine

```
Budget Model:
  - User sets monthly limit per category (e.g., Dining = $500)
  - System tracks spending in real-time

Budget Check (on each new transaction):
1. Identify transaction category
2. Query: total spending this month for that category
3. Compare against budget limit
4. If > threshold (e.g., 80%) → send alert
5. If > 100% → send "over budget" notification

Optimization:
  - Don't query all transactions each time
  - Maintain running totals in a budget_tracking table

budget_tracking:
  | user_id | category | month   | spent   | limit  |
  | u_123   | dining   | 2024-01 | 450.00  | 500.00 |
  | u_123   | grocery  | 2024-01 | 320.00  | 800.00 |

  On new transaction:
    UPDATE budget_tracking
    SET spent = spent + txn_amount
    WHERE user_id = ? AND category = ? AND month = ?
```

### Database Schema

**Accounts Table:**

| Column | Type | Notes |
|--------|------|-------|
| account_id | UUID | Primary key |
| user_id | UUID | Foreign key |
| plaid_account_id | VARCHAR | From Plaid |
| institution_name | VARCHAR | "Chase", "Amex" |
| account_type | ENUM | checking, savings, credit, investment |
| current_balance | DECIMAL | Latest known balance |
| last_synced_at | DATETIME | Last successful sync |

**Transactions Table:**

| Column | Type | Notes |
|--------|------|-------|
| transaction_id | UUID | Primary key |
| plaid_txn_id | VARCHAR | Unique (dedup key) |
| account_id | UUID | Foreign key |
| user_id | UUID | Denormalized for query efficiency |
| amount | DECIMAL | Positive = credit, negative = debit |
| merchant_name | VARCHAR | Raw merchant string |
| category | VARCHAR | Auto or user-assigned |
| date | DATE | Transaction date |
| pending | BOOLEAN | Pending vs posted |

**Indexes:** `(user_id, date)`, `(user_id, category, date)`, `(plaid_txn_id)` unique

**Budgets Table:**

| Column | Type |
|--------|------|
| budget_id | UUID |
| user_id | UUID |
| category | VARCHAR |
| monthly_limit | DECIMAL |
| alert_threshold | DECIMAL |

### Spending Analytics

```
Pre-computed Aggregations (materialized views or batch jobs):

Monthly Summary:
  SELECT category, SUM(amount), COUNT(*)
  FROM transactions
  WHERE user_id = ? AND date BETWEEN ? AND ?
  GROUP BY category

Trend Analysis:
  - Compare current month vs previous month per category
  - Year-over-year spending comparison
  - Average daily spending rate

Implementation:
  - Real-time: query from DB for small date ranges
  - Historical: pre-aggregate in analytics table (nightly batch job)

analytics_monthly:
  | user_id | month   | category  | total_spent | txn_count | avg_txn |
  | u_123   | 2024-01 | dining    | 450.00      | 15        | 30.00   |
```

### Security Architecture

```
┌──────────────────────────────────────────┐
│  Security Layers                          │
│                                           │
│  1. Transport: TLS 1.3 everywhere         │
│  2. Auth: JWT + OAuth 2.0, MFA            │
│  3. API: Rate limiting, input validation  │
│  4. Secrets: Bank tokens in HashiCorp     │
│     Vault (not in DB)                     │
│  5. Data: AES-256 encryption at rest      │
│  6. PII: Tokenize account numbers         │
│  7. Access: RBAC + audit logging          │
│  8. Compliance: SOC 2, PCI DSS           │
└──────────────────────────────────────────┘

Key principle: Mint never stores bank passwords.
Plaid handles bank authentication.
Mint only stores encrypted Plaid access tokens.
```

### Notification / Alert System

```
Alert Triggers:
  - Budget threshold exceeded (80%, 100%)
  - Large transaction detected (> $500)
  - Bill due date approaching (3 days before)
  - Account balance low (< $100)
  - Suspicious transaction pattern

Delivery:
  - Push notification (FCM/APNs)
  - Email (SES)
  - SMS (for critical alerts like low balance)

Architecture:
  Transaction processed → Alert Evaluator → Alert Queue (Kafka)
    → Notification Service → Push/Email/SMS
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
Client ──▶ API Gateway (Auth, Rate Limit, TLS)
              │
         App Servers (Stateless)
              │
    ┌─────────┼──────────┬──────────┐
    ▼         ▼          ▼          ▼
  Account   Budget    Analytics   Alert
  Service   Service   Service     Service
    │         │          │          │
    ▼         ▼          ▼          ▼
  Plaid    Budget     Monthly    Kafka →
  API      Tracker    Aggregator  Push/Email
    │
  Sync Queue (Kafka) → Sync Workers → PostgreSQL
                                         │
                          Vault (encrypted tokens)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bank integration | Plaid / Yodlee | Never store bank credentials |
| Token storage | HashiCorp Vault | Encrypted, audited, rotatable |
| Categorization | Merchant map + ML | High accuracy, handles unknowns |
| Budget tracking | Running totals table | Avoid re-aggregating all transactions |
| Analytics | Pre-computed daily + real-time | Balance freshness and performance |
| Sync schedule | Staggered daily batch | Spread load, respect API rate limits |

### Additional Talking Points

- **Open Banking APIs** — In EU (PSD2) and UK, banks provide standardized APIs; reduces Plaid dependency
- **Investment tracking** — Portfolio value, asset allocation, gains/losses (different data model)
- **Credit score integration** — Partner with TransUnion/Experian for credit monitoring
- **Financial goals** — Save $10K for vacation; track progress from linked savings accounts
- **Data export** — CSV/PDF export for tax preparation
- **Multi-currency** — Exchange rate conversion for international accounts
- **Offline access** — Cache recent data on device for viewing without connectivity
