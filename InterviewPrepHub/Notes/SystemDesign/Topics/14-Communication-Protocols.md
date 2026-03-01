# Communication Protocols

## Table of Contents

1. [Overview](#1-overview)
2. [OSI Model Quick Reference](#2-osi-model-quick-reference)
3. [TCP (Transmission Control Protocol)](#3-tcp-transmission-control-protocol)
4. [UDP (User Datagram Protocol)](#4-udp-user-datagram-protocol)
5. [HTTP (HyperText Transfer Protocol)](#5-http-hypertext-transfer-protocol)
6. [REST (Representational State Transfer)](#6-rest-representational-state-transfer)
7. [RPC (Remote Procedure Call)](#7-rpc-remote-procedure-call)
8. [gRPC](#8-grpc)
9. [GraphQL](#9-graphql)
10. [WebSockets](#10-websockets)
11. [Server-Sent Events (SSE)](#11-server-sent-events-sse)
12. [Protocol Comparison](#12-protocol-comparison)
13. [Key Takeaways](#13-key-takeaways)

---

## 1. Overview

Communication protocols define how systems talk to each other. Choosing the right
protocol affects latency, throughput, developer experience, and system complexity.

### The Communication Stack

```
┌──────────────────────────────────────────┐
│  Application Protocols                    │
│  (REST, gRPC, GraphQL, WebSocket)        │
├──────────────────────────────────────────┤
│  HTTP/1.1, HTTP/2, HTTP/3                │
├──────────────────────────────────────────┤
│  TLS (encryption)                         │
├──────────────────────────────────────────┤
│  TCP or UDP                               │
├──────────────────────────────────────────┤
│  IP (Internet Protocol)                  │
├──────────────────────────────────────────┤
│  Network Interface (Ethernet, Wi-Fi)     │
└──────────────────────────────────────────┘
```

---

## 2. OSI Model Quick Reference

| Layer | Name         | Protocol Examples          | Purpose                         |
|-------|-------------|----------------------------|---------------------------------|
| 7     | Application | HTTP, gRPC, SMTP, DNS      | Application-level communication |
| 6     | Presentation| TLS/SSL, JPEG, JSON        | Encryption, serialization       |
| 5     | Session     | Sockets, sessions          | Connection management           |
| 4     | Transport   | TCP, UDP                   | End-to-end delivery             |
| 3     | Network     | IP, ICMP                   | Routing                         |
| 2     | Data Link   | Ethernet, Wi-Fi            | Local network delivery          |
| 1     | Physical    | Cables, radio signals      | Raw bit transmission            |

For system design, you mainly care about layers **4** (TCP/UDP) and **7** (HTTP, gRPC, etc.).

---

## 3. TCP (Transmission Control Protocol)

TCP provides **reliable, ordered, error-checked** delivery of data between applications.

### Three-Way Handshake

```
Client                    Server
  │                         │
  │──── SYN ──────────────►│  "I want to connect"
  │                         │
  │◄─── SYN-ACK ───────────│  "OK, I acknowledge"
  │                         │
  │──── ACK ──────────────►│  "Connection established"
  │                         │
  │     Data transfer...    │
  │                         │
  │──── FIN ──────────────►│  "I'm done"
  │◄─── ACK ───────────────│  "OK"
  │◄─── FIN ───────────────│  "I'm done too"
  │──── ACK ──────────────►│  "Connection closed"
```

### TCP Guarantees

| Feature              | How It Works                                        |
|----------------------|-----------------------------------------------------|
| Reliable delivery    | Retransmits lost packets (using ACKs and timeouts)  |
| Ordered delivery     | Sequence numbers ensure packets are reassembled in order |
| Flow control         | Receiver tells sender how much data it can handle (window size) |
| Congestion control   | Sender slows down when network is congested (slow start, AIMD) |
| Error detection      | Checksums detect corrupted data                     |

### TCP Trade-offs

- **Pro**: Guaranteed delivery, in-order, no data loss
- **Con**: Higher latency (handshake, retransmissions, flow control)
- **Con**: Head-of-line blocking (one lost packet delays all subsequent packets)

### When to Use TCP

- Web traffic (HTTP/HTTPS)
- File transfers (FTP, SFTP)
- Email (SMTP, IMAP)
- Database connections
- Any application where data loss is unacceptable

---

## 4. UDP (User Datagram Protocol)

UDP provides **connectionless, best-effort** delivery. No handshake, no guarantees.

```
Client                    Server
  │                         │
  │──── Data ─────────────►│  (no handshake)
  │──── Data ─────────────►│
  │──── Data ─────────────►│  (some may be lost)
  │──── Data ─────────────►│  (some may arrive out of order)
  │                         │

No connection setup, no ACKs, no retransmission.
```

### UDP Characteristics

| Feature              | TCP                        | UDP                        |
|----------------------|----------------------------|----------------------------|
| Connection           | Connection-oriented        | Connectionless             |
| Reliability          | Guaranteed delivery        | Best-effort                |
| Ordering             | In-order                   | No ordering guarantee      |
| Overhead             | 20+ byte header            | 8 byte header              |
| Latency              | Higher (handshake, ACKs)   | Lower                      |
| Throughput           | Regulated by flow control  | As fast as app can send    |

### When to Use UDP

- **Video/audio streaming**: A few dropped frames are better than buffering
- **Online gaming**: Low latency more important than perfect delivery
- **DNS queries**: Small, stateless request-response
- **IoT sensors**: Lightweight, high-frequency data
- **VoIP**: Real-time voice communication

### QUIC (HTTP/3)

QUIC is a modern protocol built **on top of UDP** that provides TCP-like reliability
with lower latency.

```
TCP+TLS handshake:              QUIC handshake:
  1. TCP SYN                      1. Client Hello (with TLS)
  2. TCP SYN-ACK                  2. Server Hello + data
  3. TCP ACK
  4. TLS Client Hello             Total: 1 RTT (or 0 RTT for repeat connections)
  5. TLS Server Hello
  6. TLS Finished
  
  Total: 3 RTTs
```

Key advantages: No head-of-line blocking, faster connection setup,
connection migration (works across IP changes, e.g., Wi-Fi → cellular).

---

## 5. HTTP (HyperText Transfer Protocol)

HTTP is the foundation of web communication. It's a **request-response** protocol
built on top of TCP (HTTP/1.1, HTTP/2) or QUIC (HTTP/3).

### HTTP Versions

| Version | Year | Key Features                                              |
|---------|------|-----------------------------------------------------------|
| HTTP/1.0| 1996 | One request per connection                                |
| HTTP/1.1| 1997 | Keep-alive, pipelining, chunked transfer                  |
| HTTP/2  | 2015 | Multiplexing, header compression, server push, binary    |
| HTTP/3  | 2022 | QUIC (UDP-based), no head-of-line blocking               |

### HTTP/1.1 vs HTTP/2

```
HTTP/1.1 (6 connections for parallelism):
Connection 1: ──[Request A]──[Response A]──[Request D]──[Response D]──
Connection 2: ──[Request B]──[Response B]──[Request E]──[Response E]──
Connection 3: ──[Request C]──[Response C]──[Request F]──[Response F]──

HTTP/2 (single multiplexed connection):
┌─────────────────────────────────────────────────────────┐
│ Stream 1: ──[Req A]──[Resp A]──                         │
│ Stream 2: ──[Req B]────────[Resp B]──                   │
│ Stream 3: ──[Req C]──[Resp C]──                         │
│ Stream 4: ──────[Req D]──[Resp D]──                     │
│ (all on one TCP connection, interleaved)                │
└─────────────────────────────────────────────────────────┘
```

### HTTP Methods

| Method  | Purpose                        | Idempotent | Safe | Has Body |
|---------|--------------------------------|------------|------|----------|
| GET     | Retrieve resource              | Yes        | Yes  | No       |
| POST    | Create resource / trigger action| No        | No   | Yes      |
| PUT     | Replace resource entirely      | Yes        | No   | Yes      |
| PATCH   | Partially update resource      | No*        | No   | Yes      |
| DELETE  | Delete resource                | Yes        | No   | Optional |
| HEAD    | GET without response body      | Yes        | Yes  | No       |
| OPTIONS | Describe available methods     | Yes        | Yes  | No       |

*PATCH can be made idempotent with proper implementation.

### HTTP Status Codes

| Range | Category      | Common Codes                                        |
|-------|---------------|-----------------------------------------------------|
| 1xx   | Informational | 100 Continue, 101 Switching Protocols               |
| 2xx   | Success       | 200 OK, 201 Created, 204 No Content                 |
| 3xx   | Redirection   | 301 Moved Permanently, 304 Not Modified             |
| 4xx   | Client Error  | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| 5xx   | Server Error  | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

---

## 6. REST (Representational State Transfer)

REST is an **architectural style** (not a protocol) for designing APIs.
It uses HTTP as the transport and treats everything as a **resource**.

### REST Principles

1. **Client-Server**: Separate UI from data storage.
2. **Stateless**: Each request contains all information needed. No server-side sessions.
3. **Cacheable**: Responses must state whether they can be cached.
4. **Uniform Interface**: Consistent resource naming and manipulation.
5. **Layered System**: Client doesn't know if it's talking to origin or intermediary.
6. **Code on Demand** (optional): Server can send executable code to client.

### RESTful API Design

```
Resource: Users

GET    /users           → List all users
GET    /users/123       → Get user 123
POST   /users           → Create a new user
PUT    /users/123       → Replace user 123
PATCH  /users/123       → Update user 123 partially
DELETE /users/123       → Delete user 123

Nested resources:
GET    /users/123/orders      → List orders for user 123
GET    /users/123/orders/456  → Get order 456 for user 123
POST   /users/123/orders      → Create order for user 123
```

### REST Best Practices

| Practice                    | Example                                           |
|-----------------------------|----------------------------------------------------|
| Use nouns, not verbs        | `/users` not `/getUsers`                           |
| Plural resource names       | `/users` not `/user`                               |
| Use HTTP methods for actions | `DELETE /users/123` not `POST /deleteUser`         |
| Version your API             | `/api/v1/users` or `Accept: application/vnd.api.v1+json` |
| Pagination                   | `GET /users?page=2&limit=20`                       |
| Filtering                    | `GET /users?status=active&role=admin`              |
| Sorting                      | `GET /users?sort=-created_at` (descending)         |
| Error responses               | `{"error": {"code": "NOT_FOUND", "message": "..."}}` |
| HATEOAS (links)              | Include links to related resources in responses    |

### REST Pagination Patterns

```json
// Offset-based (simple, but slow for large offsets):
GET /users?page=5&limit=20

{
  "data": [...],
  "pagination": {
    "page": 5,
    "limit": 20,
    "total": 1000,
    "total_pages": 50
  }
}

// Cursor-based (better for large datasets):
GET /users?limit=20&cursor=eyJpZCI6MTAwfQ==

{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ==",
    "has_more": true
  }
}
```

### REST Trade-offs

| Advantage                              | Disadvantage                              |
|----------------------------------------|-------------------------------------------|
| Simple, well-understood                | Over-fetching (get more data than needed) |
| HTTP caching works naturally           | Under-fetching (need multiple requests)   |
| Stateless (easy to scale)              | No real-time support (need polling)       |
| Extensive tooling and documentation    | Multiple round trips for related data     |
| Human-readable                         | Versioning can be painful                 |

---

## 7. RPC (Remote Procedure Call)

RPC makes calling a remote service look like calling a local function.
The client calls a function, and the RPC framework handles serialization,
transport, and deserialization.

### How RPC Works

```
Client                                    Server
┌──────────────┐                    ┌──────────────┐
│ Application  │                    │ Application  │
│              │                    │              │
│ result =     │                    │ def add(a,b):│
│  add(2, 3)   │                    │   return a+b │
└──────┬───────┘                    └──────▲───────┘
       │                                   │
┌──────▼───────┐                    ┌──────┴───────┐
│ Client Stub  │                    │ Server Stub  │
│ serialize    │                    │ deserialize  │
│ {fn: "add",  │                    │ call fn      │
│  args: [2,3]}│                    │ serialize    │
└──────┬───────┘                    │ result       │
       │                            └──────▲───────┘
       │         Network                   │
       └──────────────────────────────────┘
```

### REST vs RPC

| Aspect              | REST                           | RPC                               |
|---------------------|--------------------------------|-----------------------------------|
| Mental model        | Resources (nouns)              | Actions (verbs)                   |
| URL style           | `/users/123`                   | `/getUser`, `/createUser`         |
| Focus               | Data manipulation              | Remote function execution         |
| Coupling            | Loose coupling                 | Tighter coupling                  |
| Discoverability     | Self-describing (HATEOAS)      | Requires documentation/schema     |
| Caching             | HTTP caching works naturally   | Harder to cache                   |
| Best for            | Public APIs, CRUD              | Internal microservice communication|

### Popular RPC Frameworks

| Framework      | Serialization | Transport     | Language Support        |
|----------------|---------------|---------------|------------------------|
| gRPC           | Protocol Buffers | HTTP/2     | Many (polyglot)        |
| Apache Thrift  | Thrift binary  | TCP          | Many                   |
| JSON-RPC       | JSON           | HTTP, TCP    | Any                    |
| XML-RPC        | XML            | HTTP         | Any                    |
| Cap'n Proto    | Zero-copy binary| TCP         | C++, Rust, Java, etc.  |

---

## 8. gRPC

gRPC is Google's high-performance RPC framework. It uses **Protocol Buffers** (protobuf)
for serialization and **HTTP/2** for transport.

### Why gRPC?

```
REST + JSON:                      gRPC + Protobuf:
┌──────────────────┐              ┌──────────────────┐
│ {"name": "Alice",│              │ Binary payload    │
│  "age": 30,      │              │ (much smaller)    │
│  "email": "..."}│              │                   │
│                  │              │                   │
│ ~200 bytes       │              │ ~50 bytes         │
│ Parse JSON (slow)│              │ Parse protobuf    │
│                  │              │ (10-100x faster)  │
└──────────────────┘              └──────────────────┘
```

### Protocol Buffers (Protobuf)

```protobuf
// user.proto — Define your data schema
syntax = "proto3";

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
  repeated string roles = 5;  // array
}

// user_service.proto — Define your API
service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);       // server streaming
  rpc CreateUsers (stream User) returns (CreateUsersResponse);  // client streaming
  rpc Chat (stream Message) returns (stream Message);           // bidirectional
}

message GetUserRequest {
  int64 id = 1;
}
```

### gRPC Communication Patterns

```
1. Unary (simple request-response):
   Client ──[Request]──► Server ──[Response]──► Client

2. Server Streaming (server sends multiple responses):
   Client ──[Request]──► Server ──[Response 1]──► Client
                                 ──[Response 2]──►
                                 ──[Response 3]──►

3. Client Streaming (client sends multiple requests):
   Client ──[Request 1]──► Server
          ──[Request 2]──►
          ──[Request 3]──► ──[Response]──► Client

4. Bidirectional Streaming:
   Client ◄──────────────► Server
   (both send messages independently)
```

### gRPC Features

| Feature            | Description                                          |
|--------------------|------------------------------------------------------|
| Code generation    | Generate client/server code from .proto files        |
| Streaming          | 4 patterns: unary, server, client, bidirectional     |
| Deadlines/Timeouts | Built-in timeout propagation across services         |
| Load balancing     | Client-side, proxy, or look-aside                    |
| Interceptors       | Middleware for auth, logging, monitoring              |
| Health checking    | Standard health check protocol                       |
| Compression        | Built-in gzip compression support                    |

### gRPC Trade-offs

| Advantage                        | Disadvantage                               |
|----------------------------------|--------------------------------------------|
| Very high performance            | Not human-readable (binary)                |
| Strongly typed contracts         | Harder to debug (can't use curl)           |
| Streaming support                | Limited browser support                    |
| Code generation (less boilerplate)| Steeper learning curve                    |
| HTTP/2 multiplexing              | Requires protobuf schema management        |

### When to Use gRPC

- Internal microservice communication (high throughput, low latency)
- Polyglot environments (generate clients in any language from one .proto file)
- Real-time streaming (chat, live feeds, IoT)
- Mobile apps (smaller payloads = less bandwidth)

---

## 9. GraphQL

GraphQL is a query language for APIs. Clients specify exactly what data they need,
eliminating over-fetching and under-fetching.

### The Problem GraphQL Solves

```
REST over-fetching:
  GET /users/123 → Returns ALL 20 fields, but UI only needs name and avatar

REST under-fetching:
  GET /users/123        → Get user
  GET /users/123/posts  → Get posts (second request)
  GET /posts/456/comments → Get comments (third request)
  
  3 round trips to assemble one screen!

GraphQL:
  POST /graphql
  {
    user(id: 123) {
      name
      avatar
      posts(limit: 5) {
        title
        comments(limit: 3) {
          text
          author { name }
        }
      }
    }
  }
  
  1 request, exactly the data needed.
```

### Core Concepts

**Schema Definition:**
```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
  comments: [Comment!]!
}

type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
}

type Mutation {
  createUser(name: String!, email: String!): User!
  updateUser(id: ID!, name: String): User!
}

type Subscription {
  postCreated: Post!
}
```

**Operations:**
- **Query**: Read data (like GET)
- **Mutation**: Write data (like POST/PUT/DELETE)
- **Subscription**: Real-time updates via WebSocket

### GraphQL Trade-offs

| Advantage                                | Disadvantage                              |
|------------------------------------------|-------------------------------------------|
| No over/under-fetching                   | Complex server implementation             |
| Single endpoint                          | Harder to cache (POST for everything)     |
| Strongly typed schema                    | N+1 query problem without DataLoader      |
| Great developer experience               | Potential for expensive nested queries     |
| Self-documenting (introspection)         | Rate limiting is harder (query complexity)|
| Evolve API without versioning            | Steeper learning curve                    |

### When to Use GraphQL

- **Mobile apps**: Minimize bandwidth with exact data fetching
- **Complex UIs**: Dashboard with data from many entities
- **Rapid iteration**: Schema evolves without breaking clients
- **Multiple clients**: Web, mobile, third-party all need different data shapes

### When NOT to Use GraphQL

- Simple CRUD APIs (REST is simpler)
- File uploads (not great in GraphQL)
- Server-to-server communication (gRPC is faster)
- Caching is critical (REST + HTTP caching is easier)

---

## 10. WebSockets

WebSockets provide **full-duplex, bidirectional** communication over a single
long-lived TCP connection.

### How WebSockets Work

```
1. HTTP Upgrade Handshake:
   Client ──► GET /chat HTTP/1.1
              Upgrade: websocket
              Connection: Upgrade
   
   Server ──► HTTP/1.1 101 Switching Protocols
              Upgrade: websocket

2. Full-duplex communication:
   Client ◄──────────────────────► Server
   
   Either side can send messages at any time.
   No request-response requirement.

3. Connection close:
   Either side sends a close frame.
```

### WebSocket vs HTTP

| Feature          | HTTP                         | WebSocket                     |
|------------------|------------------------------|-------------------------------|
| Connection       | Short-lived (per request)    | Long-lived (persistent)       |
| Direction        | Client → Server (request)    | Bidirectional                 |
| Overhead         | Headers on every request     | Minimal framing overhead      |
| Server push      | No (need polling or SSE)     | Yes (native)                  |
| Use case         | Request-response             | Real-time, streaming          |

### WebSocket Use Cases

- **Chat applications** (Slack, Discord)
- **Live notifications** (real-time alerts)
- **Collaborative editing** (Google Docs)
- **Live sports scores / stock tickers**
- **Online gaming** (multiplayer state sync)
- **Live dashboards** (monitoring, analytics)

### Scaling WebSockets

The challenge: WebSocket connections are stateful and long-lived.
If a user connects to Server A, all their messages must go through Server A.

```
Solution: Pub/Sub backend for cross-server communication

Client 1 ──ws──► Server A ──► Redis Pub/Sub ──► Server B ──ws──► Client 2
                                    │
                              All servers subscribe
                              to the same channels
```

Libraries: **Socket.io**, **ws** (Node.js), **Django Channels**, **Action Cable** (Rails).

---

## 11. Server-Sent Events (SSE)

SSE provides a **one-way** channel from server to client over HTTP.
Simpler than WebSockets when you only need server → client updates.

```
Client ──► GET /events (keeps connection open)
           Accept: text/event-stream

Server ──► HTTP/1.1 200 OK
           Content-Type: text/event-stream
           
           data: {"type": "notification", "message": "Hello"}
           
           data: {"type": "update", "count": 42}
           
           event: price-change
           data: {"symbol": "AAPL", "price": 150.25}
           
           ...keeps sending events...
```

### SSE vs WebSocket

| Feature            | SSE                            | WebSocket                    |
|--------------------|--------------------------------|------------------------------|
| Direction          | Server → Client only           | Bidirectional                |
| Protocol           | Plain HTTP                     | WebSocket (upgraded HTTP)    |
| Reconnection       | Automatic (built-in)           | Manual                       |
| Event IDs          | Built-in (for resume)          | Manual                       |
| Binary data        | No (text only)                 | Yes                          |
| Browser support    | Good (except IE)               | Excellent                    |
| Complexity         | Very simple                    | More complex                 |
| Load balancer      | Standard HTTP                  | Needs special config         |

**Use SSE when**: You only need server-to-client updates (notifications, live feeds).
**Use WebSocket when**: You need bidirectional communication (chat, games).

---

## 12. Protocol Comparison

### When to Use What

| Use Case                        | Best Protocol              | Why                              |
|---------------------------------|----------------------------|----------------------------------|
| Public API                      | REST                       | Simple, cacheable, well-known    |
| Internal microservices          | gRPC                       | Fast, typed contracts, streaming |
| Complex data requirements       | GraphQL                    | Flexible queries, no over-fetch  |
| Real-time bidirectional         | WebSocket                  | Full-duplex, low latency         |
| Server push (one-way)           | SSE                        | Simple, auto-reconnect           |
| IoT / Gaming                    | UDP / MQTT / WebSocket     | Low latency, lightweight         |
| File transfer                   | HTTP (multipart) / gRPC    | Streaming support                |
| Browser-to-server               | REST / GraphQL             | Universal support                |

### Performance Comparison

```
Payload size (for same data):
  XML-RPC:     ~1000 bytes
  JSON (REST): ~200 bytes
  Protobuf:    ~50 bytes

Requests per second (typical):
  REST + JSON:   ~10,000 req/sec
  gRPC + Proto:  ~50,000 req/sec
  Raw TCP:       ~100,000+ req/sec

Note: These are rough comparisons. Actual numbers depend heavily
on hardware, payload size, network conditions, and implementation.
```

### Serialization Format Comparison

| Format       | Human-Readable | Size     | Parse Speed | Schema  |
|-------------|----------------|----------|-------------|---------|
| JSON        | Yes            | Large    | Moderate    | Optional (JSON Schema) |
| Protobuf    | No             | Small    | Very fast   | Required (.proto)      |
| MessagePack | No             | Small    | Fast        | None                   |
| Avro        | No             | Small    | Fast        | Required (.avsc)       |
| XML         | Yes            | Very large| Slow       | Optional (XSD)         |
| CBOR        | No             | Small    | Fast        | None                   |

---

## 13. Key Takeaways

### Decision Framework

```
External / Public API?
  │
  ├── Yes ──► REST (simple, ubiquitous)
  │           or GraphQL (if complex data needs)
  │
  └── No (internal) ──► gRPC (performance-critical)
                        or REST (simple services)

Need real-time?
  │
  ├── Bidirectional ──► WebSocket
  │
  └── Server → Client only ──► SSE (simpler)
                                or WebSocket (if might need bidirectional later)
```

### Golden Rules

1. **REST is the default for APIs.** It's simple, well-understood, and cacheable.
2. **gRPC for internal services** when performance matters. The strongly-typed
   contracts and code generation reduce integration bugs.
3. **GraphQL for data-heavy UIs** where different clients need different data shapes.
4. **WebSockets only when you need bidirectional real-time.** They're stateful
   and harder to scale.
5. **HTTP/2 everywhere.** It's faster than HTTP/1.1 with no code changes.
6. **Protocol Buffers are not JSON.** Use protobuf for machine-to-machine,
   JSON for human-readable interfaces.
7. **Don't mix protocols unnecessarily.** Each one adds operational complexity.

---

## 🔥 Senior Interview Questions

1. Compare REST, gRPC, and GraphQL for an application where the mobile client needs a subset of fields, the web app needs the full object, and internal services need high-throughput binary communication. How would you use all three in the same system? [Answer](QnA-Answer-Key.md#14-communication-protocols)

2. Your gRPC service works perfectly in testing but fails in production behind an AWS Application Load Balancer. Why? Discuss HTTP/2, gRPC trailers, and L7 load balancer compatibility issues. [Answer](QnA-Answer-Key.md#14-communication-protocols)

3. An interviewer asks: "Why do we still use HTTP/1.1 when HTTP/2 exists?" Discuss the head-of-line blocking problem in HTTP/2 (at the TCP level), and how HTTP/3 (QUIC) solves it. [Answer](QnA-Answer-Key.md#14-communication-protocols)

4. You're building a real-time collaborative document editor (like Google Docs). Compare WebSockets, Server-Sent Events (SSE), and long polling for this use case. Which would you choose and why? [Answer](QnA-Answer-Key.md#14-communication-protocols)

5. Your REST API returns 200 OK with an error message in the body. Why is this an anti-pattern? How should errors be communicated in REST vs gRPC vs GraphQL? [Answer](QnA-Answer-Key.md#14-communication-protocols)

6. You need to migrate 200 REST microservices to gRPC for performance. How do you do this incrementally without a big-bang migration? Discuss gRPC-Gateway, Envoy transcoding, and the adapter pattern. [Answer](QnA-Answer-Key.md#14-communication-protocols)

7. Explain how TCP's three-way handshake and TLS handshake impact API latency. For a mobile client on a 3G connection making its first API call, how many round trips occur before the first byte of data arrives? How do HTTP/2, TLS 1.3, and 0-RTT help? [Answer](QnA-Answer-Key.md#14-communication-protocols)

8. Compare the serialization overhead of JSON, Protocol Buffers, MessagePack, and Avro. When does serialization format actually matter for system performance, and when is it premature optimization? [Answer](QnA-Answer-Key.md#14-communication-protocols)

9. You have a service that needs to send 1 million notifications per minute to different clients. Compare pull-based (clients polling), push-based (WebSocket/SSE), and hybrid approaches. Calculate the overhead of each. [Answer](QnA-Answer-Key.md#14-communication-protocols)

10. Your system uses synchronous REST calls between 5 microservices in sequence (A → B → C → D → E). The total latency is 500ms. How would you redesign the communication to reduce latency? Discuss parallelization, async messaging, and service aggregation. [Answer](QnA-Answer-Key.md#14-communication-protocols)

---

## 📚 Further Reading

- [gRPC vs REST: Understanding gRPC, OpenAPI and REST (Google Cloud Blog)](https://cloud.google.com/blog/products/api-management/understanding-grpc-openapi-and-rest-and-when-to-use-them) — Google's comparison of when to use each protocol.
- [HTTP/3 Explained (Daniel Stenberg)](https://http3-explained.haxx.se/) — Deep dive into QUIC and HTTP/3 from the curl maintainer.
- [GraphQL Best Practices (Apollo Blog)](https://www.apollographql.com/blog/graphql/basics/graphql-best-practices/) — Practical patterns for GraphQL at scale.
