# Design Search Autocomplete (Typeahead)

Search autocomplete (typeahead) provides real-time search suggestions as users type. Google Search, YouTube, Amazon, and Spotify all use this feature. When a user types "sys", the system suggests "system design interview," "system design primer," etc. The system must respond in under 100 ms to feel instantaneous.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are suggestions based on search popularity (trending) or personalized per user?  
**Interviewer:** Start with popularity-based. Mention personalization as an extension.

**Candidate:** How many suggestions should we return?  
**Interviewer:** Top 5 suggestions.

**Candidate:** Do we support spell correction or only prefix matching?  
**Interviewer:** Only prefix matching. "sys" matches "system" but not "sysm" → "system."

**Candidate:** What's the scale?  
**Interviewer:** 10 million DAU, average 10 searches per day, average 4 words per query, 5 characters per word.

**Candidate:** Should suggestions update in real-time (trending) or daily?  
**Interviewer:** Near real-time — new trending terms should appear within 15 minutes.

### Functional Requirements

- Given a prefix, return top 5 most popular search terms starting with that prefix
- Results ranked by search frequency/popularity
- Support English language (lowercase, alphanumeric)
- Suggestions update as popularity changes

### Non-Functional Requirements

- **Latency:** < 100 ms per request (must feel instant)
- **Availability:** 99.99% — autocomplete is high-visibility
- **Scalability:** 10M DAU, peak 24K QPS
- **Freshness:** New trending terms appear within 15 minutes

### Back-of-the-Envelope Estimation

- 10M DAU × 10 searches × 20 chars typed × ~1 request/char = **2 billion requests/day**
- QPS: 2B / 86400 ≈ 23,000 QPS (average), peak ~46,000 QPS
- Unique search terms: ~5 million (power law distribution)
- Storage per term: avg 30 chars + frequency counter = ~40 bytes
- Total data: 5M × 40 bytes = 200 MB (fits in memory!)

---

## Step 2 — High-Level Design

### Core Data Structure: Trie (Prefix Tree)

A **Trie** is the ideal data structure for prefix matching:

```
Root
├── s
│   ├── y
│   │   ├── s
│   │   │   ├── t
│   │   │   │   ├── e
│   │   │   │   │   ├── m [freq: 1000]
│   │   │   │   │   │   ├── " design" [freq: 500]
│   │   │   │   │   │   ├── " of a down" [freq: 200]
│   │   │   │   │   │   └── "s engineering" [freq: 150]
│   │   │   │   │   └── ...
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── ...

Query "sys" → traverse to node 's' → 'y' → 's'
  → return top 5 descendants by frequency
```

### API Design

```
GET /api/v1/autocomplete?q=sys&limit=5
  Response: {
    "suggestions": [
      { "term": "system design interview", "score": 1000 },
      { "term": "system design primer", "score": 500 },
      { "term": "systems engineering", "score": 150 },
      { "term": "systematic review", "score": 120 },
      { "term": "sys admin linux", "score": 95 }
    ]
  }
```

### High-Level Architecture

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────▶│  API Server  │────▶│  Trie Cache  │
│          │     │              │     │  (In-Memory) │
└──────────┘     └──────────────┘     └──────────────┘
                                             ▲
                                             │ rebuild
┌──────────┐     ┌──────────────┐     ┌──────┴───────┐
│  Search  │────▶│  Analytics   │────▶│  Trie Builder│
│  Logs    │     │  Pipeline    │     │  (Offline)   │
└──────────┘     └──────────────┘     └──────────────┘
```

Two independent subsystems:
1. **Query Service** — serves autocomplete requests from Trie cache (real-time)
2. **Data Collection & Trie Build** — aggregates search data, rebuilds Trie (near real-time)

---

## Step 3 — Design Deep Dive

### Trie Data Structure (Optimized)

#### Basic Trie Problem

A naive trie requires traversing all descendants to find top 5 — potentially millions of nodes.

```
Query "s" → must check ALL words starting with 's'
  → could be millions → way too slow
```

#### Optimization: Cache Top-K at Each Node

```
Store the top 5 suggestions at every node in the trie:

Node 's': top5 = ["system design", "spotify", "stack overflow", "sql", "shell"]
Node 'sy': top5 = ["system design", "synonym", "synapse", "syntax", "sydney"]
Node 'sys': top5 = ["system design", "system of a down", "sysadmin", "sysinternals", "syscall"]

Lookup "sys" → go to node → instantly return pre-computed top5
Time: O(prefix_length) — just traverse the prefix, then read cached list
```

```
Trie Node Structure:

class TrieNode {
    children: Map<char, TrieNode>     // 26 children (a-z) or HashMap
    topSuggestions: List<(term, freq)> // Pre-computed top 5
    isEndOfWord: boolean
    frequency: int                     // search frequency if end of word
}

Memory per node:
  - children pointers: 26 × 8 bytes = 208 bytes (array) or ~50 bytes (hashmap, sparse)
  - topSuggestions: 5 × (30 bytes + 8 bytes) = 190 bytes
  - Total: ~250-400 bytes per node

Total nodes: ~50M (for 5M unique queries, avg 10 chars each)
Total memory: 50M × 300 bytes ≈ 15 GB

With prefix compression: significantly less
```

#### Prefix Compression (Patricia Trie / Radix Tree)

```
Standard Trie:
  s → y → s → t → e → m (6 nodes for "system")

Radix Tree (compressed):
  "system" (1 node!)

Only split when paths diverge:
  "system" ──┬── " design"     (1 branch)
             └── "s engineering" (another branch)

Benefits:
  - Fewer nodes: 50M → ~10M
  - Less memory: 15 GB → 3-5 GB
  - Fits comfortably in memory on a single machine
```

### Data Collection Pipeline

```
How do we know which terms are popular?

Source: Search query logs

Every time a user searches:
  { "query": "system design interview", "timestamp": "2024-01-20T10:15:00Z", "userId": "u_123" }

Pipeline:
  Search Service → Kafka (search-logs topic) → Stream Processor → Frequency Aggregator
```

#### Real-time Frequency Aggregation

```
Use Apache Flink or Kafka Streams:

1. Consume search log events from Kafka
2. Maintain sliding window counters per query term:
   
   Tumbling window (15 minutes):
   ┌──────────────────┐┌──────────────────┐┌──────────────────┐
   │  10:00 - 10:15   ││  10:15 - 10:30   ││  10:30 - 10:45   │
   │                   ││                   ││                   │
   │ "system design":5 ││ "system design":3 ││ "system design":8 │
   │ "spotify": 12     ││ "spotify": 8      ││ "spotify": 15     │
   │ "sql tutorial": 3 ││ "sql tutorial": 1 ││ "sql tutorial": 4 │
   └──────────────────┘└──────────────────┘└──────────────────┘

3. Compute weighted frequency (recent windows count more):
   frequency("system design") = 8×1.0 + 3×0.7 + 5×0.5 = 12.6

4. Output: sorted frequency map → Trie Builder
```

#### Time-Decayed Popularity

```
Why not just count total searches?
  - "World Cup" was searched 10M times in 2022
  - It's not relevant on a random Tuesday in March 2024
  - Need recency weighting

Exponential decay:
  effective_freq = Σ (count_in_window × e^(-λ × age_in_hours))

  λ = 0.01 → gentle decay (long-term popular terms persist)
  λ = 0.1  → aggressive decay (only recent trends matter)

Practical approach: weighted bucket aggregation
  Last 1 hour: weight = 1.0
  Last 6 hours: weight = 0.6
  Last 24 hours: weight = 0.3
  Last 7 days: weight = 0.1
```

### Trie Rebuild & Serving

```
Rebuild Strategy:

Option A: Full Rebuild (every 15 minutes)
  1. Aggregate all query frequencies
  2. Build new Trie from scratch
  3. Serialize to binary format
  4. Deploy to all serving nodes (atomic swap)
  
  Pros: Simple, consistent
  Cons: Rebuild takes a few minutes, slight data delay

Option B: Incremental Update
  1. Only update nodes affected by frequency changes
  2. Propagate top-5 changes up the trie
  
  Pros: Faster updates, less compute
  Cons: Complex, potential race conditions

Chosen: Option A (rebuild) — 5-10M terms rebuild in < 1 minute
```

```
Serving Architecture:

┌──────────────────────────────────────────┐
│  Trie Serving Cluster                     │
│                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Server 1 │ │ Server 2 │ │ Server N │ │
│  │ Trie     │ │ Trie     │ │ Trie     │ │
│  │ (in-mem) │ │ (in-mem) │ │ (in-mem) │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│       ▲            ▲            ▲       │
│       └────────────┼────────────┘       │
│                    │                     │
│           Trie Snapshot (S3)             │
│           (rebuilt every 15 min)         │
└──────────────────────────────────────────┘

Each server:
  - Loads Trie snapshot from S3 on startup
  - Polls for new snapshot every 15 minutes
  - Blue-green swap: build new Trie → swap pointer → old Trie GC'd
  - All servers serve identical results (stateless from client perspective)
```

### Client-Side Optimizations

```
The client should minimize requests:

1. Debouncing:
   - Don't send a request on every keystroke
   - Wait 100-200ms after user stops typing
   - "system" → only 1 request (not 6)

2. Local Cache:
   - Cache recent autocomplete results on client
   - "sys" → results cached → user types "syst" → check cache first
   - Only query server if cache miss
   - Cache invalidation: clear after 5 minutes

3. Prefetching:
   - When user types "s", server returns suggestions
   - Client can pre-fetch results for top suggestion prefixes
   - Reduces subsequent request latency

4. Request Cancellation:
   - If user types "sys" → request sent
   - User quickly types "t" → cancel previous request, send "syst"
   - Prevents wasted network calls
```

### Scaling for High QPS

```
46K QPS peak — how to handle:

1. Trie fits in memory (3-5 GB) → cache-friendly
   - Each lookup: O(prefix_length) ≈ O(20) → microseconds
   - Single server: ~100K QPS capacity
   - 46K QPS → could serve from ~1 server, but replicate for availability

2. CDN/Browser caching:
   - Autocomplete responses are HIGHLY cacheable
   - Same prefix → same results for all users (popularity-based)
   - Cache at CDN with 15-minute TTL
   - "sys" results cached at edge → most users never hit origin
   - Cache hit ratio: 80-90%
   - Effective origin QPS: 46K × 0.1 = 4.6K QPS → easily handled

3. Sharding (for very large datasets):
   - Shard by first character: Server A handles 'a-f', Server B handles 'g-m', ...
   - Or shard by prefix range for more even distribution
   - Each shard fits in memory independently
```

### Filtering Inappropriate Content

```
Some autocomplete suggestions must be filtered:
  - Hateful, violent, or sexually explicit terms
  - Copyrighted/trademarked terms (legal issues)
  - Personally identifiable information

Implementation:
  1. Blocklist: maintain set of banned terms and phrases
  2. During Trie build: skip any term on the blocklist
  3. Run ML classifier on new terms before adding to Trie
  4. Manual review queue for flagged terms

  blocklist = {"hate_term_1", "offensive_phrase", ...}
  
  if term in blocklist or classifier.is_offensive(term):
      skip  # Don't add to Trie
```

### Multi-Language Support

```
Challenges:
  - Different character sets (Latin, CJK, Arabic, Cyrillic)
  - CJK: no word boundaries, different tokenization needed
  - Right-to-left languages (Arabic, Hebrew)

Solutions:
  - Separate Trie per language
  - Detect language from user's locale/settings
  - Unicode-aware Trie nodes (use HashMap instead of array[26])
  - For CJK: character-level prefix matching (not word-level)
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
Data Pipeline:
  Search Logs → Kafka → Flink (aggregate) → Frequency Store
    → Trie Builder (every 15 min) → Trie Snapshot (S3)
    → Serving Nodes load snapshot into memory

Query Path:
  Client (debounce, local cache) → CDN (cached?) → API Server
    → Trie lookup O(prefix_len) → return top 5 → cache at CDN

  Latency: < 50ms (mostly CDN cached)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data structure | Trie (radix tree) with cached top-K | O(prefix_len) lookup, O(1) for results |
| Build strategy | Full rebuild every 15 min | Simple, consistent, fast enough |
| Frequency model | Time-decayed weighted buckets | Trending terms surface quickly |
| Caching | CDN + client-side cache | 80-90% requests never hit origin |
| Client optimization | Debounce + cancel + local cache | Reduce requests by 5-10× |
| Scale | Replicated in-memory Trie | 3-5 GB fits on single node |

### Additional Talking Points

- **Personalization** — Boost suggestions based on user's search history (combine global popularity with personal score)
- **Trending queries** — Detect sudden spikes (e.g., breaking news) and promote in suggestions
- **Spell correction** — "systm desgin" → "system design" (edit distance / fuzzy matching as separate feature)
- **Query completion vs entity suggestions** — "apple" could suggest the query "apple stock price" or the entity "Apple Inc."
- **Zero-prefix suggestions** — What to show before user types anything (trending, personalized recommendations)
- **AB testing** — Test different ranking algorithms, number of suggestions, UI layouts
- **Privacy** — Don't leak other users' searches; aggregate before building suggestions
- **Mobile-specific** — Larger suggestion tiles for touch, voice-to-text integration

---

## Sources / Cross-Refs
- *Alex Xu — System Design Interview* (Vol. 1, 2020), Ch. 13 ("Design a Search Autocomplete System").
- Google Research blog — *Query suggestion for mobile*: https://research.google/blog/
- Elasticsearch — completion suggester docs: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#completion-suggester
- *Introduction to Algorithms* (Cormen et al., 4e), Ch. 12 (Tries / Radix trees).
- 28-Search-Systems.md (this repo).
- Solution-Google-Search.md, Solution-Top-K.md (related).
