# Content Moderation & Trust and Safety

## Table of Contents

1. [Overview](#1-overview)
2. [Types of Harmful Content](#2-types-of-harmful-content)
3. [Automated Detection](#3-automated-detection)
4. [Human Review Pipeline](#4-human-review-pipeline)
5. [System Architecture](#5-system-architecture)
6. [Enforcement Actions](#6-enforcement-actions)
7. [Appeals & Fairness](#7-appeals--fairness)
8. [Proactive vs Reactive Moderation](#8-proactive-vs-reactive-moderation)
9. [Challenges & Trade-offs](#9-challenges--trade-offs)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Any platform with <abbr title="UGC (User-Generated Content): any content — text, images, video, comments — created and posted by users rather than the platform itself.">user-generated content (UGC)</abbr> needs content moderation.
This system prevents abuse, protects users, and ensures compliance with
laws (<abbr title="GDPR: EU's General Data Protection Regulation — governs how personal data of EU citizens must be collected, stored, and processed.">GDPR</abbr>, <abbr title="CSAM: Child Sexual Abuse Material — illegal content whose detection and removal is legally mandated in most jurisdictions.">CSAM</abbr> regulations, <abbr title="Digital Services Act (DSA): EU regulation requiring large online platforms to take down illegal content quickly and be transparent about moderation decisions.">Digital Services Act</abbr>).

```
Scale of the problem:
  YouTube:    500 hours of video uploaded per minute
  Facebook:   ~2 billion posts per day
  Twitter/X:  ~500 million tweets per day
  
  Humans can't review all of it.
  → Need automated systems + human reviewers + feedback loops.
  
  ┌──────────────────────────────────────────────────────┐
  │             Content Moderation Pipeline               │
  │                                                       │
  │  Upload ──► Auto-detect ──► Score ──► Route           │
  │                                        │              │
  │                         ┌──────────────┼──────────┐   │
  │                         ▼              ▼          ▼   │
  │                      Allow         Queue for    Auto- │
  │                    (publish)      human review  block  │
  │                                        │              │
  │                                        ▼              │
  │                                   Human decides       │
  │                                   Allow / Remove      │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Types of Harmful Content

| Category          | Examples                                       | Detection Difficulty |
|------------------|------------------------------------------------|---------------------|
| Spam             | Fake accounts, mass messaging, SEO spam         | Moderate            |
| Hate speech      | Slurs, dehumanization, targeted harassment      | Hard                |
| Violence/Threats | Threats, graphic violence, terrorism            | Moderate-Hard       |
| CSAM             | Child exploitation material                     | Technical (hashing) |
| Misinformation   | False health claims, election interference      | Very Hard           |
| IP Violation     | Copyright, trademark infringement               | Moderate            |
| Nudity/Adult     | Explicit content on non-adult platforms          | Moderate (ML)       |
| Scams/Fraud      | Phishing, financial scams                       | Moderate            |

---

## 3. Automated Detection

### <abbr title="Text classification: an NLP task that assigns a category (e.g. hate speech, spam, safe) to a piece of text using rule-based filters or ML models like BERT.">Text Classification</abbr>

```
NLP Pipeline:
  Input text ──► Preprocessing ──► Model ──► Score ──► Decision

Models:
  - Keyword/regex matching (simple, fast, many false positives)
  - ML classifiers (BERT-based, trained on labeled data)
  - LLMs (GPT-4 for nuanced understanding, expensive)
  
  Approach: Cascade
    Level 1: Fast regex/keyword filter (blocks obvious violations)
    Level 2: ML classifier (scores remaining content)
    Level 3: Human review (for borderline cases)
```

### Image/Video Detection

```
Techniques:
  1. Perceptual Hashing (PhotoDNA, pHash):
     Hash image → compare against known-bad hash database
     Robust to resize, crop, small edits
     Used for: CSAM detection (legally required in many jurisdictions)
     
  2. ML-based classification:
     CNN/Vision Transformer → classify image categories
     (nudity, violence, hate symbols, etc.)
     
  3. OCR + Text Classification:
     Extract text from images → run text classifier
     Catches harmful text embedded in images
     
  4. Video: sample frames → run image classifiers + audio analysis

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Upload  │───►│ Hash     │───►│ ML       │───►│ Decision │
  │  Image   │    │ Compare  │    │ Classify │    │          │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
                   Known-bad?      Score > 0.95?
                   → Block         → Block
                   Score 0.5-0.95?
                   → Human review
```

### Behavioral Signals

```
Not just content — user behavior matters:

  Suspicious patterns:
    - New account posting 100 times in 5 minutes (spam)
    - Account messaging 500 people (phishing)
    - Coordinated behavior (botnet - many accounts, same actions)
    - Unusual login location + changed email + mass messages (hacked)
    
  Graph-based detection:
    - Cluster of new accounts following each other (fake accounts)
    - Same IP, same device fingerprint, different accounts
```

---

## 4. Human Review Pipeline

```
Queue Management:

  ┌────────────────────────────────────────────────────┐
  │               Review Queue System                   │
  │                                                     │
  │  Priority Queue:                                    │
  │    P0: CSAM (legally urgent, < 24h SLA)            │
  │    P1: Imminent threats / violence                  │
  │    P2: Hate speech, harassment                      │
  │    P3: Spam, minor policy violations                │
  │                                                     │
  │  Routing:                                           │
  │    - By language (route to native speakers)         │
  │    - By content type (trained reviewers)            │
  │    - By severity (senior reviewers for edge cases)  │
  │    - Calibration (dual review for quality)          │
  │                                                     │
  │  Reviewer Workflow:                                 │
  │    Review content → Select violation type           │
  │    → Choose action → Submit                         │
  │    → QA sample check (random 5-10% reviewed again)  │
  └────────────────────────────────────────────────────┘
```

### Reviewer Wellbeing

```
Content reviewers are exposed to harmful material.
  - Rotation: Limit exposure time per day
  - Blurring: Auto-blur images until reviewer opts to view
  - Counseling: Mental health support
  - Training: Desensitization protocols
  - AI assistance: Auto-label most severe content
```

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                Content Moderation System                   │
│                                                           │
│  Content Upload                                           │
│       │                                                   │
│       ▼                                                   │
│  ┌──────────────┐    ┌──────────────────┐                │
│  │ Classifier   │───►│ Decision Engine  │                │
│  │ Service      │    │                  │                │
│  │ • Text NLP   │    │ Rules + ML score │                │
│  │ • Image CNN  │    │ → Allow          │                │
│  │ • Hash check │    │ → Queue review   │                │
│  │ • Behavioral │    │ → Auto-block     │                │
│  └──────────────┘    └──────┬───────────┘                │
│                             │                             │
│              ┌──────────────┼──────────────┐             │
│              ▼              ▼              ▼             │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│        │ Publish  │  │ Review   │  │ Block +  │        │
│        │ Content  │  │ Queue    │  │ Notify   │        │
│        └──────────┘  └────┬─────┘  │ User     │        │
│                           │        └──────────┘        │
│                           ▼                             │
│                     ┌──────────┐                        │
│                     │ Human    │                        │
│                     │ Review   │                        │
│                     │ Tool     │──► Feedback to ML model│
│                     └──────────┘    (retrain / improve)│
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Analytics: False positive rate, review time,      │   │
│  │ precision/recall by category, queue depth         │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Enforcement Actions

```
Graduated enforcement (progressive discipline):

  1st violation: Warning + content removed
  2nd violation: Temporary restriction (24h)
  3rd violation: Extended restriction (7 days)
  4th violation: Account suspension (30 days)
  5th violation: Permanent ban

  Severe violations (CSAM, threats):
    Immediate permanent ban + report to authorities

  Action types:
  ┌──────────────────────────────────────────────┐
  │ Content level:                                │
  │  • Remove content                             │
  │  • Reduce distribution ("shadow ban")         │
  │  • Add warning label                          │
  │  • Age-gate content                           │
  │                                               │
  │ Account level:                                │
  │  • Warning                                    │
  │  • Temporary suspension                       │
  │  • Feature restriction (can't post, can read) │
  │  • Permanent ban                              │
  │                                               │
  │ Demonetization:                               │
  │  • Remove ads from content                    │
  │  • Suspend monetization for creator           │
  └──────────────────────────────────────────────┘
```

---

## 7. Appeals & Fairness

```
Appeal Flow:
  1. User receives enforcement notification
  2. User submits appeal with explanation
  3. Different reviewer (not original) reviews appeal
  4. Decision: Uphold or overturn
  5. Some platforms: escalate to independent oversight board

  ┌──────────┐    ┌──────────────┐    ┌──────────────┐
  │ User     │───►│ Appeal Queue │───►│ Senior       │──► Decision
  │ Appeals  │    │ (separate    │    │ Reviewer     │
  │          │    │  from review)│    │ (different   │
  └──────────┘    └──────────────┘    │  person)     │
                                      └──────────────┘

Fairness concerns:
  - Bias in ML models (language, cultural context)
  - Inconsistent human decisions
  - Disproportionate impact on marginalized groups
  - Transparency in policies and enforcement
  
Mitigations:
  - Regular bias audits on ML models
  - Inter-rater reliability testing for human reviewers
  - Transparent community guidelines
  - Published transparency reports (semi-annually)
```

---

## 8. Proactive vs Reactive Moderation

```
Reactive: Wait for reports, then review.
  User reports content → queue → review → action
  ↑ Simple, but harmful content visible until reported

Proactive: Detect and act before anyone reports.
  Upload → auto-scan → action before publication
  ↑ Better UX, catches more, but more false positives

Pre-publication (best for high-risk):
  Content scanned BEFORE publishing.
  Blocks quickly but adds latency to publishing.

Post-publication (most platforms):
  Content published immediately, scanned after.
  Better UX but harmful content briefly visible.

Hybrid:
  High-risk content types (images/video) → pre-publication scan
  Low-risk (text comments) → post-publication scan
```

---

## 9. Challenges & Trade-offs

| Challenge | Description |
|-----------|-------------|
| Context-dependent | "Kill it!" — harmful or gaming slang? |
| Language diversity | Hate speech varies across 100+ languages |
| <abbr title="Adversarial evasion: bad actors deliberately obfuscate harmful content (e.g. 'H@te', zero-width spaces, homoglyphs) to bypass automated filters.">Adversarial evasion</abbr> | "H@te" instead of "Hate", Unicode tricks |
| False positives | Removing legitimate content harms free expression |
| False negatives | Missing harmful content harms users |
| Scale | Billions of pieces of content per day |
| Evolving threats | New harmful trends emerge constantly |
| Legal requirements | Vary by country (EU DSA, US Section 230) |
| Cost | Human reviewers + ML infrastructure is expensive |

### <abbr title="Precision: of all items flagged as harmful, what fraction actually were? High precision = few false positives. Recall: of all genuinely harmful items, what fraction did we catch? High recall = few false negatives.">Precision vs Recall Trade-off</abbr>

```
High precision, low recall:
  Very few false positives (good user experience)
  But misses lots of harmful content

High recall, low precision:
  Catches almost all harmful content
  But over-censors legitimate content

  Most platforms aim for:
    CSAM: Maximize recall (never miss, tolerate false positives)
    Spam: Balance (moderate precision and recall)
    Hate speech: Higher precision (false positives very damaging)
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Multi-layer approach | Automated (fast) + human (nuanced) + feedback loop |
| Cascade classifiers | Fast/cheap first, expensive/accurate second |
| Hash databases for known-bad content | <abbr title="PhotoDNA: Microsoft's perceptual hashing technology that creates a unique hash (signature) of known CSAM images so copies can be detected even after minor edits.">PhotoDNA</abbr> for CSAM is standard and often legally required |
| Human review is still essential | ML can't handle nuance, context, cultural differences |
| Graduated enforcement | Warning → restriction → suspension → ban |
| Appeals process is required | Different reviewer, transparent process |
| Proactive > reactive | Scan before/at publish time, not just on reports |
| ML bias is a real risk | Regular audits, diverse training data |
| Feedback loop improves accuracy | Human decisions retrain the ML models |
| This is a system design problem | Not just ML — queues, routing, SLAs, scale matter |
