# API Design

## Table of Contents

1. [Overview](#1-overview)
2. [API Design Principles](#2-api-design-principles)
3. [RESTful API Design Patterns](#3-restful-api-design-patterns)
4. [API Versioning](#4-api-versioning)
5. [Pagination](#5-pagination)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Error Handling](#7-error-handling)
8. [Rate Limiting & Throttling](#8-rate-limiting--throttling)
9. [API Gateway](#9-api-gateway)
10. [API Documentation](#10-api-documentation)
11. [Backward Compatibility](#11-backward-compatibility)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. Overview

API design is one of the most impactful decisions in system design. A well-designed API
is easy to use, hard to misuse, and can evolve without breaking clients. A poorly designed
API creates friction, bugs, and painful migrations.

### What Makes an API Good?

| Quality           | Description                                                  |
|-------------------|--------------------------------------------------------------|
| Intuitive         | Developers can guess how it works without reading all docs   |
| Consistent        | Same patterns and conventions everywhere                     |
| Hard to misuse    | Error messages guide users to correct usage                  |
| Evolvable         | Can add features without breaking existing clients           |
| Well-documented   | Every endpoint, parameter, and error code is documented      |
| Performant        | Response times are predictable and reasonable                |
| Secure            | Authentication, authorization, input validation              |

---

## 2. API Design Principles

### Principle 1: Design for the Consumer

Start from the client's perspective, not the database schema.

```
BAD (exposing internal DB structure):
  GET /api/user_account_records?account_type_id=3&status_flag=1

GOOD (consumer-friendly):
  GET /api/users?type=premium&status=active
```

### Principle 2: Use Nouns for Resources, HTTP Methods for Actions

```
BAD (verbs in URLs):
  POST   /api/createUser
  POST   /api/deleteUser/123
  GET    /api/getUserOrders/123

GOOD (resources + methods):
  POST   /api/users              (create)
  DELETE /api/users/123          (delete)
  GET    /api/users/123/orders   (list orders)
```

### Principle 3: Be Consistent

Pick a convention and stick to it everywhere:

```
Naming: snake_case or camelCase (not both)
  ✓ created_at, user_id, first_name  (snake_case — common in REST)
  ✓ createdAt, userId, firstName      (camelCase — common in JavaScript)
  ✗ created_at, userId, first-name    (mixed — NEVER)

Pluralization: Always plural for collections
  ✓ /users, /orders, /products
  ✗ /user, /order, /product

Response envelope:
  ✓ Always wrap in { "data": [...] }   OR
  ✓ Always return raw array [...]
  ✗ Sometimes wrapped, sometimes not
```

### Principle 4: Use Proper HTTP Semantics

```
GET    → Read (never modifies data, cacheable)
POST   → Create (or trigger complex action)
PUT    → Full replace
PATCH  → Partial update
DELETE → Remove

Use correct status codes:
  201 Created     (after POST that creates something)
  204 No Content  (after DELETE or PUT with no response body)
  400 Bad Request (invalid input)
  404 Not Found   (resource doesn't exist)
  409 Conflict    (duplicate, version conflict)
  422 Unprocessable Entity (validation errors)
```

### Principle 5: <abbr title="Idempotency: an operation that can be applied multiple times without changing the result after the first successful call. Critical for safe retries.">Idempotency</abbr>

Clients should be able to safely retry requests.

```
Idempotent by nature:
  GET    /users/123           (same user every time)
  PUT    /users/123           (same full replacement)
  DELETE /users/123           (deleted, or already deleted)

NOT idempotent by nature:
  POST   /users               (creates duplicate user on retry!)

Making POST idempotent:
  Client sends: POST /orders
                Idempotency-Key: "abc-123-def-456"
  
  Server: 
    - First request: create order, store idempotency key
    - Retry: find stored key, return same response (no duplicate order)
```

---

## 3. RESTful API Design Patterns

### Resource Relationships

```
Nested resources (parent-child):
  GET /users/123/orders         → Orders belonging to user 123
  GET /users/123/orders/456     → Specific order for user 123

Flat resources with filtering:
  GET /orders?user_id=123       → Same result, flat URL

When to nest:
  - Strong ownership (user → orders)
  - Max 2 levels deep (/users/123/orders is fine)
  - Deeper nesting (/users/123/orders/456/items/789) → use flat URLs instead
```

### Bulk Operations

```
// Batch create
POST /users/batch
{
  "users": [
    {"name": "Alice", "email": "alice@example.com"},
    {"name": "Bob", "email": "bob@example.com"}
  ]
}

// Batch update
PATCH /users/batch
{
  "updates": [
    {"id": 123, "status": "active"},
    {"id": 456, "status": "inactive"}
  ]
}

// Partial success response
{
  "succeeded": [{"id": 123, "status": "updated"}],
  "failed": [{"id": 456, "error": "not_found"}]
}
```

### Search and Filtering

```
Simple filtering:
  GET /products?category=electronics&min_price=100&max_price=500

Full-text search:
  GET /products?q=wireless+headphones

Complex filtering (when simple query params aren't enough):
  POST /products/search
  {
    "filters": {
      "category": ["electronics", "accessories"],
      "price": {"min": 100, "max": 500},
      "in_stock": true
    },
    "sort": [{"field": "price", "order": "asc"}],
    "pagination": {"limit": 20, "cursor": "abc123"}
  }
```

### Actions (Non-CRUD Operations)

For operations that don't map cleanly to CRUD:

```
// Sub-resource approach
POST /orders/123/cancel          (cancel an order)
POST /users/123/verify-email     (trigger verification)
POST /payments/123/refund        (process refund)

// Controller-style (less common)
POST /api/notifications/send-bulk
{
  "user_ids": [1, 2, 3],
  "message": "System maintenance tonight"
}
```

### Long-Running Operations

For operations that take more than a few seconds:

```
1. Client: POST /api/reports/generate
   Server: 202 Accepted
   {
     "status": "processing",
     "status_url": "/api/reports/jobs/abc123"
   }

2. Client: GET /api/reports/jobs/abc123  (poll)
   Server: 200 OK
   {
     "status": "processing",
     "progress": 45
   }

3. Client: GET /api/reports/jobs/abc123  (poll again)
   Server: 200 OK
   {
     "status": "completed",
     "result_url": "/api/reports/abc123/download"
   }
```

---

## 4. API Versioning

APIs evolve. Versioning lets you make breaking changes without breaking existing clients.

### Versioning Strategies

| Strategy        | Example                                       | Pros                    | Cons                         |
|-----------------|-----------------------------------------------|-------------------------|------------------------------|
| URL path        | `/api/v1/users`                               | Obvious, simple         | Not "pure" REST              |
| Query parameter | `/api/users?version=1`                        | Optional                | Easy to forget               |
| Header          | `Accept: application/vnd.api.v1+json`         | Clean URLs              | Less visible, harder to test |
| Content negotiation | `Accept: application/vnd.myapi+json; v=2` | REST-purist approved    | Complex                      |

**Most common in practice**: URL path versioning (`/api/v1/...`). Simple, explicit,
and easy for developers to understand at a glance.

### What Counts as a Breaking Change?

| Breaking (requires new version)              | Non-Breaking (safe to deploy)           |
|----------------------------------------------|-----------------------------------------|
| Removing a field from response               | Adding a new field to response          |
| Renaming a field                             | Adding a new optional parameter         |
| Changing a field's data type                 | Adding a new endpoint                   |
| Removing an endpoint                         | Adding a new HTTP method to endpoint    |
| Changing required/optional status of a param | Making a required param optional        |
| Changing error response format               | Adding new enum values                  |
| Changing authentication mechanism            | Bug fixes                               |

### Version Lifecycle

```
v1 (current)  ──── Stable, supported ────────────►
                          │
v2 (new)      ────────────┤── Announced ──── GA ──────►
                          │
v1 (deprecated)───────────┤── Deprecated ── Sunset ── Removed
                          │   (6 months     (12 months)
                          │    warning)
```

**Best practice**: Support at least 2 versions simultaneously. Give clients
6-12 months to migrate before sunsetting an old version.

---

## 5. Pagination

Never return unbounded lists. Always paginate.

### Offset-Based Pagination

```
GET /users?page=3&limit=20

Response:
{
  "data": [...20 users...],
  "pagination": {
    "page": 3,
    "limit": 20,
    "total_count": 1523,
    "total_pages": 77,
    "has_next": true,
    "has_prev": true
  }
}

SQL: SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 40;
```

**Pros**: Simple, supports jumping to arbitrary pages.
**Cons**: Slow for large offsets (DB must scan and discard rows), inconsistent
if data changes between pages (items can be skipped or duplicated).

### Cursor-Based Pagination

```
GET /users?limit=20&cursor=eyJpZCI6MTAwfQ==

Response:
{
  "data": [...20 users...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ==",
    "prev_cursor": "eyJpZCI6ODF9",
    "has_next": true,
    "has_prev": true
  }
}

SQL: SELECT * FROM users WHERE id > 100 ORDER BY id LIMIT 20;
```

The cursor is typically a base64-encoded value of the last item's sort key.

**Pros**: Consistent results (no skipping/duplicating), fast (uses index).
**Cons**: Can't jump to arbitrary pages, cursor is opaque to clients.

### When to Use Which

| Scenario                              | Best Approach        |
|---------------------------------------|----------------------|
| Admin dashboard with page numbers     | Offset-based         |
| Infinite scroll (social feed)         | Cursor-based         |
| Large dataset (millions of rows)      | Cursor-based         |
| Real-time data (frequently changing)  | Cursor-based         |
| Small dataset (< 10K items)           | Either works         |
| Export/sync (need all data)           | Cursor-based         |

---

## 6. Authentication & Authorization

### Authentication (Who are you?)

| Method           | Flow                                                | Use Case                   |
|------------------|-----------------------------------------------------|----------------------------|
| API Key          | Send key in header: `X-API-Key: abc123`             | Server-to-server, simple    |
| Bearer Token     | `Authorization: Bearer <jwt>`                       | User sessions, mobile apps  |
| <abbr title="OAuth 2.0: an authorization framework that lets third-party apps access a user's data without sharing the user's password. Uses access tokens granted by an authorization server.">OAuth 2.0</abbr>        | Redirect flow → authorization code → access token   | Third-party access          |
| Basic Auth       | `Authorization: Basic base64(user:pass)`            | Internal/development only   |
| <abbr title="mTLS (mutual TLS): both client and server present certificates. The connection is encrypted and both sides verify each other's identity, preventing unauthorized service-to-service calls.">mTLS</abbr>             | Client certificate verification                     | High-security service-to-service |

### <abbr title="JSON Web Token (JWT): a compact token format that encodes user claims in a signed string. Often used for stateless authentication.">JWT</abbr>

```
Header.Payload.Signature

Header:  {"alg": "HS256", "typ": "JWT"}
Payload: {"sub": "user_123", "name": "Alice", "exp": 1700000000, "roles": ["admin"]}
Signature: HMAC-SHA256(base64(header) + "." + base64(payload), secret)

Total: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.abc123signature
```

**JWT Pros**: Stateless (no server-side session storage), self-contained (carries claims).
**JWT Cons**: Can't be revoked until expiry (unless using a blocklist), size grows with claims.

### OAuth 2.0 Authorization Code Flow

```
User ──► Client App ──► Auth Server ──► User Login Page
                                              │
User enters credentials ──────────────────────┘
                                              │
Auth Server ──► Client App (with auth code)   │
                    │                          │
Client App ──► Auth Server (exchange code for tokens)
                    │
Auth Server ──► Client App
                {
                  "access_token": "...",    (short-lived: 15 min - 1 hour)
                  "refresh_token": "...",   (long-lived: days - weeks)
                  "token_type": "Bearer",
                  "expires_in": 3600
                }
```

### Authorization (What can you do?)

```
Role-Based Access Control (<abbr title="RBAC: permissions are tied to roles (admin, editor, viewer).">RBAC</abbr>):
  admin  → can do everything
  editor → can create, read, update
  viewer → can only read

Attribute-Based Access Control (<abbr title="ABAC: permissions are decided by attributes such as user department, resource type, time of day, or clearance level.">ABAC</abbr>):
  if user.department == "engineering" AND resource.type == "code" → allow
  if user.clearance >= resource.classification → allow

Resource-Based:
  User can only access their own resources:
  GET /users/123/orders → only works if authenticated user IS user 123
```


---

## 7. Error Handling

### Consistent Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid parameters",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address",
        "value": "not-an-email"
      },
      {
        "field": "age",
        "message": "Must be between 0 and 150",
        "value": -5
      }
    ],
    "request_id": "req_abc123",
    "documentation_url": "https://api.example.com/docs/errors#VALIDATION_ERROR"
  }
}
```

### Error Code Design

| HTTP Status | Error Code          | When to Use                             |
|-------------|---------------------|-----------------------------------------|
| 400         | INVALID_REQUEST     | Malformed request body or parameters    |
| 400         | VALIDATION_ERROR    | Specific field validation failures      |
| 401         | UNAUTHENTICATED     | Missing or invalid credentials          |
| 403         | FORBIDDEN           | Valid credentials but no permission      |
| 404         | NOT_FOUND           | Resource doesn't exist                  |
| 409         | CONFLICT            | Resource already exists, version conflict|
| 422         | UNPROCESSABLE       | Request is valid but semantically wrong |
| 429         | RATE_LIMITED        | Too many requests                       |
| 500         | INTERNAL_ERROR      | Unexpected server error                 |
| 502         | BAD_GATEWAY         | Upstream service error                  |
| 503         | SERVICE_UNAVAILABLE | Temporary overload or maintenance       |

### Error Handling Best Practices

1. **Include a request ID** in every response (error or success).
   This makes debugging in logs trivial.
2. **Never expose internal details** in production errors.
   No stack traces, no SQL queries, no internal paths.
3. **Use machine-readable error codes** (not just messages).
   Clients can programmatically handle `RATE_LIMITED` vs parsing "you've been rate limited."
4. **Provide actionable messages** telling the user how to fix the problem.
5. **Link to documentation** for complex errors.

---

## 8. Rate Limiting & Throttling

Rate limiting protects your API from abuse, ensures fair usage, and prevents cascading failures.

### Common Algorithms

#### 1. Fixed Window

```
Window: 60 seconds, Limit: 100 requests

Time 0:00 - 0:59  → Count = 0...100 (allowed)
Time 1:00 - 1:59  → Count resets to 0

Problem: Burst at window boundary
  Time 0:50 - 0:59  → 100 requests (allowed)
  Time 1:00 - 1:10  → 100 requests (allowed)
  → 200 requests in 20 seconds!
```

#### 2. Sliding Window Log

Track timestamps of all requests. Count requests in the last N seconds.

```
Limit: 100 requests per 60 seconds

Request at T=90: 
  Count requests with timestamp > 30 (90 - 60)
  If count < 100 → allow
  Else → reject
  
Pro: No boundary burst problem
Con: Memory-intensive (stores all timestamps)
```

#### 3. Sliding Window Counter

Approximation: Weight the previous window's count by the overlap percentage.

```
Window: 60 seconds, Limit: 100
Previous window (0:00-0:59): 60 requests
Current window (1:00-1:59):  40 requests so far
Current time: 1:15 (25% into current window)

Weighted count = 60 * (1 - 0.25) + 40 = 45 + 40 = 85
85 < 100 → allow

Pro: More accurate than fixed window, less memory than log
```

#### 4. Token Bucket

A bucket holds tokens. Each request consumes a token. Tokens are added at a fixed rate.

```
Bucket capacity: 10 tokens
Refill rate: 1 token/second

Request arrives:
  Bucket has tokens? → Consume 1 token → Allow
  Bucket empty? → Reject (429)

Allows short bursts (up to bucket capacity) but limits sustained rate.
```

#### 5. Leaky Bucket

Requests enter a FIFO queue processed at a fixed rate. Queue overflow → reject.

```
Queue capacity: 10
Process rate: 1 request/second

Request arrives:
  Queue not full? → Add to queue
  Queue full? → Reject (429)

Smooths out bursts into a steady flow.
```

### Rate Limiting in Headers

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100          ← Max requests per window
X-RateLimit-Remaining: 42       ← Requests remaining in window
X-RateLimit-Reset: 1700000060   ← Unix timestamp when window resets
Retry-After: 30                 ← Seconds to wait (on 429 response)
```

### Distributed Rate Limiting

When you have multiple API servers, rate limits must be enforced centrally.

```
Server A ──► Redis (central counter) ◄── Server B
               │
          INCR user:123:rate
          EXPIRE user:123:rate 60
               │
          if count > limit → 429
```

Use Redis with atomic operations:
```python
def is_rate_limited(user_id, limit=100, window=60):
    key = f"rate:{user_id}:{int(time.time()) // window}"
    count = redis.incr(key)
    if count == 1:
        redis.expire(key, window)
    return count > limit
```

---

## 9. API Gateway

An API Gateway is a single entry point for all client requests, sitting between
clients and backend services.

### Architecture

```
                    ┌───────────────────────────────────┐
                    │         API Gateway                │
                    │                                    │
Mobile ────────────►│  - Authentication                 │────► User Service
                    │  - Rate Limiting                   │
Web ───────────────►│  - Request Routing                 │────► Order Service
                    │  - Protocol Translation            │
Third-Party ───────►│  - Response Transformation         │────► Product Service
                    │  - Caching                         │
                    │  - Logging & Monitoring             │────► Payment Service
                    │  - SSL Termination                 │
                    └───────────────────────────────────┘
```

### API Gateway Responsibilities

| Feature                   | Description                                       |
|---------------------------|---------------------------------------------------|
| Authentication            | Validate tokens/API keys before reaching services |
| Rate limiting             | Enforce per-client rate limits                    |
| Request routing           | Route `/users/*` to User Service, `/orders/*` to Order Service |
| Protocol translation      | REST → gRPC, or aggregate multiple gRPC calls into one REST response |
| Response transformation   | Filter fields, rename fields, merge responses     |
| Caching                   | Cache frequent responses at the gateway level     |
| Load balancing            | Distribute requests across service instances      |
| Circuit breaking          | Stop forwarding to failing services               |
| Request/response logging  | Centralized logging and monitoring                |
| CORS handling             | Handle cross-origin policies centrally            |

### <abbr title="Backend for Frontend (BFF): a pattern where you create a dedicated backend per client type (mobile, web, admin) so each gets the exact data shape it needs without over-fetching.">Backend for Frontend (BFF)</abbr> Pattern

Different clients often need different API shapes:

```
Mobile App ──► Mobile BFF ──► Backend Services
                             (smaller payloads, fewer fields)

Web App ────► Web BFF ─────► Backend Services
                             (richer responses, more data)

Admin ──────► Admin BFF ───► Backend Services
                             (full access, bulk operations)
```

Each BFF is optimized for its specific client's needs.

### Popular API Gateways

| Gateway          | Type          | Key Features                                |
|------------------|---------------|---------------------------------------------|
| AWS API Gateway  | Managed       | Deep AWS integration, Lambda support        |
| Kong             | Open source   | Plugin ecosystem, Lua-based, high performance|
| Nginx            | Open source   | Reverse proxy + gateway, very fast          |
| Envoy            | Open source   | Service mesh proxy, gRPC-native             |
| Tyk              | Open source   | Go-based, developer portal                  |
| Apigee (Google)  | Managed       | Enterprise, analytics, developer portal     |
| Azure API Mgmt   | Managed       | Azure integration, policies                 |

---

## 10. API Documentation

Good documentation is as important as good API design.

### OpenAPI (Swagger) Specification

```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0

paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
    post:
      summary: Create user
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
```

### Documentation Best Practices

1. **Working examples** for every endpoint (copy-paste curl commands)
2. **Error examples** showing what happens when things go wrong
3. **Authentication guide** explaining how to get and use tokens
4. **Rate limit documentation** so clients know their limits
5. **Changelog** documenting every API change
6. **Interactive sandbox** (Swagger UI, Postman collection)

---

## 11. Backward Compatibility

### Strategies for API Evolution

#### 1. Additive Changes Only

```json
// v1 response
{"id": 123, "name": "Alice"}

// v1.1 response (new field added — NOT breaking)
{"id": 123, "name": "Alice", "email": "alice@example.com"}

// Clients that don't know about "email" simply ignore it.
```

#### 2. Deprecation Headers

```
HTTP/1.1 200 OK
Sunset: Sat, 01 Jan 2025 00:00:00 GMT
Deprecation: true
Link: <https://api.example.com/v2/users>; rel="successor-version"
```

#### 3. Feature Flags / Opt-In

```
GET /api/users
X-Features: new-response-format

// Server returns new format only for clients that opt in.
```

### Migration Checklist

1. Announce deprecation (email, docs, headers)
2. Provide migration guide with examples
3. Set sunset date (6-12 months out)
4. Monitor usage of deprecated endpoints
5. Send reminders as sunset approaches
6. Shut down deprecated version
7. Monitor for errors from clients that didn't migrate

---

## 12. Key Takeaways

### API Design Checklist

```
□ Resources are nouns, actions use HTTP methods
□ Consistent naming convention (snake_case or camelCase)
□ Proper HTTP status codes
□ Pagination on all list endpoints
□ Versioning strategy chosen (URL path recommended)
□ Authentication mechanism defined
□ Rate limiting configured
□ Error responses follow consistent format
□ Request IDs in all responses
□ OpenAPI/Swagger documentation
□ Backward compatibility plan
```

### Golden Rules

1. **Design APIs from the consumer's perspective**, not your database schema.
2. **Be consistent** — same patterns and conventions everywhere.
3. **Never return unbounded lists** — always paginate.
4. **Use cursor-based pagination** for large or real-time datasets.
5. **Version from day one** — it's much harder to add later.
6. **Make operations idempotent** wherever possible.
7. **Document everything** — if it's not documented, it doesn't exist.
8. **Plan for backward compatibility** — breaking changes are expensive.

---

## 🔥 Senior Interview Questions

1. You're designing a public API for a platform with 10,000 third-party developers. How do you design a versioning strategy that allows evolving the API without breaking existing integrations? Compare URL versioning, header versioning, and content negotiation. [Answer](QnA-Answer-Key.md#15-api-design)

2. An API returns a list of 10 million records. Compare offset-based pagination vs cursor-based pagination vs keyset pagination. When does each break down? What happens to offset pagination when records are inserted during paginating? [Answer](QnA-Answer-Key.md#15-api-design)

3. A client sends a payment request. Due to a network timeout, they retry. You now have two payment requests. How do you make this idempotent? Walk through the idempotency key pattern from design to implementation to storage. [Answer](QnA-Answer-Key.md#15-api-design)

4. Your API currently returns a 2MB JSON response for a user profile endpoint because it includes embedded relationships (posts, friends, settings). How would you redesign this? Compare field filtering, sparse fieldsets (JSON:API), GraphQL, and BFF (Backend-for-Frontend) patterns. [Answer](QnA-Answer-Key.md#15-api-design)

5. You're designing an API gateway that handles authentication, rate limiting, request transformation, and routing for 50 microservices. At what point does the gateway become a bottleneck or a "god service"? How do you scale it? [Answer](QnA-Answer-Key.md#15-api-design)

6. Explain the differences between PUT, PATCH, and POST. A developer uses POST for everything. Why is this problematic? How do PUT and PATCH differ in terms of idempotency, partial updates, and caching? [Answer](QnA-Answer-Key.md#15-api-design)

7. Your REST API has grown to 300 endpoints over 3 years. Nobody knows which endpoints are still used. How do you deprecate endpoints safely? Discuss API analytics, sunset headers, and deprecation policies. [Answer](QnA-Answer-Key.md#15-api-design)

8. Compare REST API authentication approaches: API keys, OAuth 2.0 (authorization code, client credentials), and JWT bearer tokens. For a B2B SaaS product with partners, which would you choose and why? [Answer](QnA-Answer-Key.md#15-api-design)

9. An interviewer asks you to design the API for a ride-sharing app (like Uber). Walk through the key endpoints, resource naming, HTTP methods, error handling, and real-time updates (ride status). How do you handle the "request a ride" workflow that spans multiple services? [Answer](QnA-Answer-Key.md#15-api-design)

10. You need to support both a mobile app (limited bandwidth) and an admin dashboard (needs all data) from the same API. Compare building two separate APIs, using GraphQL, using BFF pattern, and using sparse fieldsets. What are the organizational implications of each? [Answer](QnA-Answer-Key.md#15-api-design)

---

## 📚 Further Reading

- [Microsoft REST API Design Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md) — Industry-standard API design patterns used at Microsoft.
- [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/) — One of the most comprehensive API standards in the industry.
- [How to Design a Good API and Why It Matters (Joshua Bloch, YouTube)](https://www.youtube.com/watch?v=aAb7hSCtvGw) — Timeless talk by the author of Effective Java.
