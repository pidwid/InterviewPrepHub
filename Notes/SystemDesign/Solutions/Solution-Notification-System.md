# Design a Notification System

A notification system sends timely, relevant messages to users across multiple channels: push notifications (iOS/Android), SMS, and email. Services like Facebook, Uber, and Amazon send billions of notifications daily for alerts, marketing, transactional updates, and social interactions.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** What types of notifications do we need to support?  
**Interviewer:** Push notifications (mobile), SMS, and email.

**Candidate:** Is this a real-time system? How fast should notifications be delivered?  
**Interviewer:** Soft real-time — deliver within a few seconds for critical ones (OTP), up to minutes for marketing.

**Candidate:** What triggers notifications?  
**Interviewer:** Other services trigger them — e.g., order service sends "your order shipped," social service sends "X liked your photo."

**Candidate:** Can users opt out of notifications?  
**Interviewer:** Yes, users control which types of notifications they receive, per channel.

**Candidate:** How many notifications per day?  
**Interviewer:** 10 million push, 1 million SMS, 5 million emails per day.

### Functional Requirements

- Support push notifications (iOS APNs, Android FCM), SMS, and email
- Caller services trigger notifications via API
- Users can manage notification preferences (opt-in/opt-out per type & channel)
- Support templated messages with personalization
- Rate limiting to prevent spamming users

### Non-Functional Requirements

- **Scalability:** 10M push + 1M SMS + 5M email = 16M notifications/day
- **Reliability:** No notification loss — at-least-once delivery
- **Low latency:** Critical notifications (OTP, security alerts) within seconds
- **Extensibility:** Easy to add new channels (WhatsApp, Slack, in-app)

### Back-of-the-Envelope Estimation

- 16M notifications/day total ≈ 185 notifications/sec average
- Peak: 4× = ~740/sec (e.g., during sales events)
- Push: 10M/day → 116/sec
- SMS: 1M/day → 12/sec
- Email: 5M/day → 58/sec

---

## Step 2 — High-Level Design

### Third-Party Provider Landscape

We don't build the actual delivery infrastructure — we integrate with providers:

```
Push Notifications:
  - iOS: Apple Push Notification Service (APNs)
  - Android: Firebase Cloud Messaging (FCM)

SMS:
  - Twilio, Amazon SNS, Vonage/Nexmo

Email:
  - Amazon SES, SendGrid, Mailgun
```

### API Design

```
-- Send notification --
POST /api/v1/notifications
  Body: {
    "userId": "user_123",                    // or "userIds" for batch
    "type": "order_shipped",                  // notification type
    "channels": ["push", "email"],            // optional override
    "data": {
      "orderId": "ord_456",
      "trackingUrl": "https://track.example.com/xyz"
    },
    "priority": "high"                        // high, medium, low
  }
  Response: { "notificationId": "notif_789", "status": "queued" }

-- Get user preferences --
GET /api/v1/users/{userId}/notification-preferences
  Response: {
    "push": { "enabled": true, "types": { "marketing": false, "transactional": true } },
    "email": { "enabled": true, "types": { "marketing": true, "transactional": true } },
    "sms": { "enabled": false }
  }

-- Update preferences --
PUT /api/v1/users/{userId}/notification-preferences
  Body: { "sms": { "enabled": true }, "push.types.marketing": false }
```

### High-Level Architecture

```
┌────────────────┐
│ Caller Services│ (Order, Social, Marketing, Auth...)
│                │
└───────┬────────┘
        │
   POST /notifications
        │
┌───────▼────────┐     ┌───────────────────┐
│ Notification   │────▶│ Message Queues     │
│ Service        │     │ (Kafka / SQS)      │
│ (Validation,   │     │                    │
│  Preferences,  │     │ ┌─────────────────┐│
│  Templating)   │     │ │ push_queue      ││
│                │     │ │ sms_queue       ││
│                │     │ │ email_queue     ││
└────────────────┘     │ └─────────────────┘│
                       └─────────┬──────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌─────────┐ ┌──────────┐
              │  Push    │ │  SMS    │ │  Email   │
              │  Worker  │ │  Worker │ │  Worker  │
              └────┬─────┘ └────┬────┘ └────┬─────┘
                   │            │            │
              ┌────▼─────┐ ┌───▼────┐ ┌─────▼────┐
              │ APNs/FCM │ │ Twilio │ │ SendGrid │
              └──────────┘ └────────┘ └──────────┘
```

---

## Step 3 — Design Deep Dive

### Notification Flow (Detailed)

```
1. Caller Service sends: POST /notifications
   { userId: "u_123", type: "order_shipped", data: {...} }

2. Notification Service:
   a. Validate request (required fields, auth)
   b. Look up user preferences:
      - Is this notification type enabled for user? If disabled → drop
      - Which channels does user prefer?
   c. Look up user contact info:
      - Push: device tokens (user may have multiple devices)
      - SMS: phone number
      - Email: email address
   d. Render template:
      - "order_shipped" template: "Your order {{orderId}} has shipped!"
      - Fill in data: "Your order ORD-456 has shipped!"
   e. Rate limit check:
      - Has user received too many notifications recently?
      - If yes → drop or delay
   f. Publish to per-channel message queues:
      - push_queue: { deviceTokens: [...], message: "...", badge: 3 }
      - email_queue: { to: "user@example.com", subject: "...", body: "..." }

3. Channel Workers consume from queues:
   a. Push Worker:
      - Call APNs for iOS devices, FCM for Android
      - Handle responses: success, invalid token (cleanup), rate limited (retry)
   b. SMS Worker:
      - Call Twilio API
      - Handle: delivered, failed, blocked number
   c. Email Worker:
      - Call SendGrid API with template
      - Handle: bounced, unsubscribed, delivered

4. Log delivery status in notifications_log table
```

### Device Token Management

Users may have multiple devices (phone, tablet, watch):

```
device_tokens table:
| user_id | device_id    | platform | token                  | active | last_used  |
|---------|--------------|----------|------------------------|--------|------------|
| u_123   | dev_iphone   | ios      | abc123...              | true   | 2024-01-20 |
| u_123   | dev_ipad     | ios      | def456...              | true   | 2024-01-18 |
| u_123   | dev_android  | android  | ghi789...              | false  | 2023-05-01 |

When sending push:
  - Fetch ALL active device tokens for user
  - Send to each device
  - If APNs/FCM returns "invalid token" → mark as inactive

Token refresh:
  - Apps register/update token on every launch
  - Tokens can change (app reinstall, OS update)
```

### Notification Templates

```
Template System:
  Templates stored in DB, rendered server-side

template: "order_shipped"
  push_title: "Order Shipped! 📦"
  push_body: "Your order #{{orderId}} is on its way. Track it here."
  email_subject: "Your order #{{orderId}} has shipped"
  email_body: "<h1>Great news!</h1><p>Order #{{orderId}} shipped via {{carrier}}...</p>"
  sms_body: "Your order #{{orderId}} has shipped. Track: {{trackingUrl}}"

Rendering:
  template.render({ orderId: "ORD-456", carrier: "FedEx", trackingUrl: "..." })

Benefits:
  - Non-engineers can update copy without code changes
  - A/B test different message variants
  - Localization: different templates per language
```

### User Preference Model

```
notification_preferences:
| user_id | channel | type          | enabled |
|---------|---------|---------------|---------|
| u_123   | push    | transactional | true    |
| u_123   | push    | marketing     | false   |
| u_123   | push    | social        | true    |
| u_123   | email   | transactional | true    |
| u_123   | email   | marketing     | true    |
| u_123   | sms     | transactional | true    |
| u_123   | sms     | marketing     | false   |

Query: Should we send this notification?
  SELECT enabled FROM notification_preferences
  WHERE user_id = ? AND channel = ? AND type = ?

Cache: Redis hash per user
  HGET prefs:u_123 "push:marketing" → "false"
```

### Rate Limiting

Protect users from notification spam:

```
Rules:
  - Max 3 push notifications per hour per user
  - Max 1 SMS per day per user (SMS costs money)
  - Max 5 marketing emails per week per user
  - Critical notifications (OTP, security) bypass rate limiting

Implementation: Redis sliding window

def should_send(user_id, channel):
    key = f"rate:{user_id}:{channel}"
    current = redis.llen(key)
    if current >= LIMIT[channel]:
        return False  # Rate limited
    redis.lpush(key, now())
    redis.ltrim(key, 0, LIMIT[channel] - 1)
    redis.expire(key, WINDOW[channel])
    return True
```

### Reliability: At-Least-Once Delivery

```
Problem: What if a worker crashes after consuming a message
         but before sending the notification?

Solution: Message acknowledgment pattern

1. Worker pulls message from queue (message becomes invisible)
2. Worker processes the notification
3. Worker sends to APNs/FCM/Twilio/SendGrid
4. On success → Worker acknowledges (deletes) the message
5. On failure → Message becomes visible again → reprocessed

Idempotency:
  - Assign each notification a unique notificationId
  - Before sending, check: "Did we already send notif_789?"
  - notifications_log table: if exists and status = "sent" → skip
  - Prevents duplicate notifications on retry

Dead Letter Queue (DLQ):
  - After 3 failed attempts → move to DLQ
  - Alert ops team to investigate
  - Common issues: invalid token, provider outage, bad template
```

### Priority System

```
Priority Queues:

High Priority:
  - OTP codes, security alerts, payment confirmations
  - Dedicated workers, processed immediately
  - SLA: < 10 seconds

Medium Priority:
  - Order updates, social notifications (likes, comments)
  - Standard workers
  - SLA: < 1 minute

Low Priority:
  - Marketing campaigns, weekly digests
  - Batch processing, scheduled delivery
  - SLA: < 1 hour

Implementation:
  - Separate Kafka topics or SQS queues per priority
  - More workers allocated to high-priority queue
  - Low-priority queue processed during off-peak hours
```

### Analytics & Monitoring

```
Notification Events Pipeline:

Each notification generates events:
  CREATED   → notification request received
  QUEUED    → placed in channel queue
  SENT      → delivered to provider (APNs/Twilio/SendGrid)
  DELIVERED → provider confirmed delivery
  OPENED    → user opened email / tapped push
  CLICKED   → user clicked link in notification
  FAILED    → delivery failed
  BOUNCED   → email bounced
  UNSUBSCRIBED → user opted out

Analytics Dashboard:
  - Delivery rate by channel (sent / created)
  - Open rate by notification type (opened / delivered)
  - Click-through rate (clicked / opened)
  - Failure rate and reasons
  - Average delivery latency

Alerting:
  - Delivery rate drops below 95% → page on-call
  - Queue depth exceeds threshold → auto-scale workers
  - Provider API errors spike → switch to backup provider
```

### Database Schema

**notifications_log:**

| Column | Type | Notes |
|--------|------|-------|
| notification_id | UUID | Primary key |
| user_id | UUID | Recipient |
| type | VARCHAR | "order_shipped", "otp", etc. |
| channel | ENUM | push, sms, email |
| status | ENUM | created, queued, sent, delivered, failed |
| content | JSON | Rendered message |
| provider_response | JSON | APNs/Twilio response |
| created_at | DATETIME | |
| sent_at | DATETIME | Nullable |

Partition by `created_at` (time-based), retention 90 days.

---

## Step 4 — Wrap Up

### Architecture Summary

```
Caller Services → Notification API (validate, preferences, template, rate-limit)
                    │
               Message Queues (per channel × priority)
               ┌────┼────┐
               ▼    ▼    ▼
             Push  SMS  Email Workers
               │    │    │
             APNs  Twilio SendGrid
             FCM
               │
          Notification Log (analytics, dedup, audit)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Decoupling | Message queues per channel | Independent scaling, failure isolation |
| Delivery guarantee | At-least-once + idempotency | No lost notifications, no duplicates |
| Rate limiting | Redis sliding window | Protect users from spam |
| Templates | Server-side rendering | Non-engineers can update, A/B testable |
| Preferences | Per-channel, per-type | Fine-grained user control |
| Priority | Separate queues per priority | SLA differentiation |

### Additional Talking Points

- **Batching** — Group multiple notifications for same user into digest (e.g., "5 people liked your photo")
- **Scheduling** — "Do not disturb" hours — queue notifications for appropriate time
- **Fallback** — If push fails, fall back to SMS or email
- **Localization** — Detect user's language, use localized template
- **Rich push** — Actionable buttons ("Mark as read", "Reply"), images, deep links
- **Campaign management** — Marketing team schedules bulk notifications with targeting rules
- **Compliance** — CAN-SPAM (email), TCPA (SMS), GDPR (EU data rights), one-click unsubscribe
- **Cost control** — SMS is expensive ($0.01-0.05/msg); prefer push for non-critical notifications
