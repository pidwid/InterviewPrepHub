# Search Systems

## Table of Contents

1. [Overview](#1-overview)
2. [Inverted Index](#2-inverted-index)
3. [Full-Text Search Engines](#3-full-text-search-engines)
4. [Text Analysis Pipeline](#4-text-analysis-pipeline)
5. [Ranking & Relevance](#5-ranking--relevance)
6. [Typeahead / Autocomplete](#6-typeahead--autocomplete)
7. [Search Architecture at Scale](#7-search-architecture-at-scale)
8. [Fuzzy Search & Spell Correction](#8-fuzzy-search--spell-correction)
9. [Faceted Search & Filtering](#9-faceted-search--filtering)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Search is one of the most common features in modern applications — from
e-commerce product search (Amazon) to web search (Google) to internal
document search (Slack, Confluence). At its core, search solves the
problem: **given a query, find the most relevant documents, fast.**

```
User types: "blue running shoes"

Naive approach:
  SELECT * FROM products WHERE description LIKE '%blue running shoes%'
  → Full table scan, O(n), no relevance ranking, no typo tolerance
  → Unusable at scale

Search engine approach:
  Pre-build an inverted index → O(1) lookup per term
  Intersect posting lists → fast candidate set
  Score by relevance (TF-IDF, BM25) → ranked results
  → Millisecond response at billion-document scale
```

---

## 2. Inverted Index

The foundational data structure of search. Maps every word (term) to the list
of documents that contain it.

```
Documents:
  Doc1: "The quick brown fox"
  Doc2: "The quick brown dog"
  Doc3: "The lazy brown fox"

Forward Index (what's in each doc):
  Doc1 → [the, quick, brown, fox]
  Doc2 → [the, quick, brown, dog]
  Doc3 → [the, lazy, brown, fox]

Inverted Index (which docs contain each term):
  the   → [Doc1, Doc2, Doc3]
  quick → [Doc1, Doc2]
  brown → [Doc1, Doc2, Doc3]
  fox   → [Doc1, Doc3]
  dog   → [Doc2]
  lazy  → [Doc3]

Query: "quick fox"
  quick → [Doc1, Doc2]
  fox   → [Doc1, Doc3]
  Intersection → [Doc1] ← Result!
```

### Posting List with Positions

```
For phrase queries like "quick brown", positions matter:

  quick → [(Doc1, pos:2), (Doc2, pos:2)]
  brown → [(Doc1, pos:3), (Doc2, pos:3), (Doc3, pos:3)]

Phrase "quick brown":
  Find docs where quick.pos + 1 == brown.pos
  Doc1: quick at 2, brown at 3 ✓
  Doc2: quick at 2, brown at 3 ✓
  → Results: [Doc1, Doc2]
```

### Posting List with Term Frequency

```
Enhanced posting list:
  fox → [(Doc1, tf:1, positions:[4]), (Doc3, tf:3, positions:[1,5,8])]
  
  tf (term frequency) = how many times term appears in doc
  Used for relevance scoring.
```

---

## 3. Full-Text Search Engines

### Elasticsearch

```
Architecture:
  ┌─────────────────────────────────────────────────┐
  │                  Cluster                         │
  │  ┌──────────────┐  ┌──────────────┐             │
  │  │   Node 1     │  │   Node 2     │             │
  │  │ ┌──────────┐ │  │ ┌──────────┐ │             │
  │  │ │ Shard 0P │ │  │ │ Shard 0R │ │ P = Primary │
  │  │ ├──────────┤ │  │ ├──────────┤ │ R = Replica │
  │  │ │ Shard 1R │ │  │ │ Shard 1P │ │             │
  │  │ └──────────┘ │  │ └──────────┘ │             │
  │  └──────────────┘  └──────────────┘             │
  └─────────────────────────────────────────────────┘
  
  Index → split into Shards → replicated for HA
  Each shard is a Lucene index (inverted index + doc values)
```

### Core Concepts

| Concept    | Description                                           |
|-----------|-------------------------------------------------------|
| Index     | Collection of documents (like a DB table)             |
| Document  | JSON object stored in an index (like a DB row)        |
| Shard     | Horizontal partition of an index                      |
| Replica   | Copy of a shard for HA and read scaling               |
| Mapping   | Schema definition (field types, analyzers)            |
| Analyzer  | Text processing pipeline (tokenize, filter, normalize)|

### Elasticsearch vs Solr vs Typesense vs Meilisearch

| Feature       | Elasticsearch | Solr         | Typesense    | Meilisearch  |
|-------------- |-------------- |------------- |------------- |------------- |
| Built on      | Lucene        | Lucene       | Custom C++   | Custom Rust  |
| Scale         | Massive       | Large        | Medium       | Small-Medium |
| Complexity    | High          | High         | Low          | Low          |
| Real-time     | Near-RT (~1s) | Configurable | Instant      | Instant      |
| Typo tolerance| Plugin        | Plugin       | Built-in     | Built-in     |
| Best for      | Large-scale   | Enterprise   | Dev-friendly | Dev-friendly |

---

## 4. Text Analysis Pipeline

Before indexing, text passes through an analysis pipeline:

```
Input: "The Quick Brown Fox's Jumping!"

  ┌────────────────┐
  │ Character      │  "The Quick Brown Fox's Jumping!"
  │ Filters        │  → "the quick brown fox's jumping!"
  └───────┬────────┘
          ▼
  ┌────────────────┐
  │ Tokenizer      │  → ["the", "quick", "brown", "fox's", "jumping"]
  └───────┬────────┘
          ▼
  ┌────────────────┐
  │ Token Filters  │
  │ • Lowercase    │  → ["the", "quick", "brown", "fox's", "jumping"]
  │ • Stop words   │  → ["quick", "brown", "fox's", "jumping"]
  │ • Possessives  │  → ["quick", "brown", "fox", "jumping"]
  │ • Stemming     │  → ["quick", "brown", "fox", "jump"]
  └───────┬────────┘
          ▼
  Indexed terms: ["quick", "brown", "fox", "jump"]
```

### Key Analysis Concepts

| Concept         | Description                                        | Example                    |
|----------------|--------------------------------------------------|----------------------------|
| Tokenization   | Split text into individual terms                   | "New York" → ["New","York"] |
| Lowercasing    | Normalize to lowercase                            | "FOX" → "fox"              |
| Stop words     | Remove common words (the, is, a)                  | Skip indexing "the"        |
| Stemming       | Reduce words to root form                          | "running" → "run"          |
| Lemmatization  | Linguistically reduce to base form                 | "better" → "good"          |
| Synonyms       | Map related words                                  | "laptop" ↔ "notebook"      |
| N-grams        | Generate substrings for partial matching           | "fox" → ["fo","ox","fox"]  |
| Edge N-grams   | N-grams from the start (for autocomplete)          | "fox" → ["f","fo","fox"]   |

---

## 5. Ranking & Relevance

### TF-IDF (Term Frequency - Inverse Document Frequency)

```
TF(t, d) = (# of times term t appears in doc d) / (total terms in d)
IDF(t)   = log(total docs / docs containing term t)
TF-IDF   = TF × IDF

Example (10,000 docs):
  Query: "rare fox"
  
  "rare" appears in 10 docs:
    IDF("rare") = log(10000/10) = 3.0
    
  "fox" appears in 5,000 docs:
    IDF("fox") = log(10000/5000) = 0.3
    
  → "rare" is much more discriminative than "fox"
  → Documents matching "rare" get higher scores
```

### BM25 (Best Matching 25)

The modern standard. Improves on TF-IDF with saturation and length normalization.

```
BM25(q, d) = Σ IDF(t) × [TF(t,d) × (k₁ + 1)] / [TF(t,d) + k₁ × (1 - b + b × |d|/avgdl)]

Where:
  k₁ = 1.2 (term frequency saturation)
  b  = 0.75 (document length normalization)
  |d| = document length
  avgdl = average document length

Key insight: TF-IDF scores keep growing with term frequency.
BM25 saturates — 10 occurrences isn't 2x better than 5.

  Score
    │     BM25 (saturates)
    │    ╭───────────────
    │   ╱
    │  ╱    TF-IDF (linear)
    │ ╱  ╱
    │╱╱
    └──────────────────── Term Frequency
```

### Additional Ranking Signals

| Signal           | Description                                      |
|-----------------|--------------------------------------------------|
| Field boosting  | Title matches ranked higher than body matches    |
| Recency         | Newer documents scored higher                    |
| Popularity      | Click-through rate, page views                   |
| Personalization | User's past behavior, preferences                |
| Proximity       | How close query terms are to each other          |
| PageRank        | Importance based on incoming links (web search)  |

---

## 6. Typeahead / Autocomplete

### Trie-Based Approach

```
Prefix Trie for suggestions:

          (root)
         ╱    ╲
        c      d
       ╱ ╲      ╲
      a   o      o
     ╱     ╲      ╲
    t       f      g
   ╱ ╲      ╲
  ∅   s     f
              ╲
               e
                ╲
                 e

  "ca" → [cat, cats]
  "co" → [coffee]
  "do" → [dog]

Each node stores:
  - Character
  - Is end of word?
  - Top K suggestions (pre-computed)
  - Frequency/score for ranking
```

### Typeahead Architecture

```
User types "ne" → "new" → "new y"

┌──────────┐    ┌────────────┐    ┌───────────────────────┐
│  Client   │   │ API Server │    │ Suggestion Service    │
│           │──►│            │──►│                       │
│ Debounce  │   │ (rate limit)│   │ Trie lookup "new y"  │
│ 100-300ms │   │            │◄──│ → ["new york", ...]  │
│           │◄──│            │   │                       │
└──────────┘    └────────────┘    └───────────────────────┘
                                         │
                                  ┌──────┴──────┐
                                  │  In-memory  │
                                  │  Trie/Cache │ Updated offline
                                  │  (Redis)    │ from query logs
                                  └─────────────┘
```

### Design Decisions

| Decision              | Options                                          |
|----------------------|--------------------------------------------------|
| Data structure       | Trie (prefix), FST (Lucene), hash map            |
| Update frequency     | Real-time (expensive) vs periodic rebuild (hourly)|
| Personalization      | User history overlay on global suggestions       |
| Ranking              | Frequency, recency, trending, user-specific      |
| Client-side caching  | Cache prefix results in browser/app              |

---

## 7. Search Architecture at Scale

### Indexing Pipeline

```
Data Sources → Indexing Pipeline → Search Index → Query Service

┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Database    │    │ Indexing     │    │ Elasticsearch    │
│ (source of  │──► │ Pipeline     │──► │ Cluster          │
│  truth)     │    │              │    │                  │
├─────────────┤    │ • Extract    │    │ ┌──────┐ ┌──────┐│
│ CDC / Queue │──► │ • Transform  │    │ │Shard1│ │Shard2││
│ (Kafka)     │    │ • Enrich     │    │ └──────┘ └──────┘│
├─────────────┤    │ • Analyze    │    └──────────────────┘
│ File Store  │──► │ • Index      │           │
│ (S3)        │    └──────────────┘           ▼
└─────────────┘                        ┌────────────┐
                                       │ Query API  │
                                       │ • Parse    │
                                       │ • Search   │
                                       │ • Rank     │
                                       │ • Return   │
                                       └────────────┘
```

### Sharding Strategies for Search

```
Document-based sharding:                 Term-based sharding:
  Shard 1: Docs 1-1M                      Shard 1: Terms A-M
  Shard 2: Docs 1M-2M                     Shard 2: Terms N-Z
  
  Query → scatter to all shards           Query "blue fox":
  → gather & merge results                  "blue" → Shard 1
  → re-rank top results                     "fox"  → Shard 1
                                             Intersection on Shard 1
  Pros: Even load distribution
  Cons: Every query hits all shards       Pros: Some queries hit fewer shards
                                          Cons: Uneven load (common terms)

Document-based is far more common in practice.
```

### Search Latency Optimization

```
Techniques:
  1. Caching: Cache frequent queries (80/20 rule)
  2. Warm indexes: Keep hot shards in memory
  3. Early termination: Stop after finding enough good results
  4. Index segments: Fewer, larger segments = fewer disk seeks
  5. Routing: Send queries to local replicas first
  6. Two-phase retrieval:
     Phase 1: Cheap scoring (BM25) → top 1000 candidates
     Phase 2: Expensive scoring (ML re-ranking) → top 10
```

---

## 8. Fuzzy Search & Spell Correction

### Edit Distance (Levenshtein)

```
"kitten" → "sitting" = edit distance 3
  kitten → sitten  (substitution)
  sitten → sittin  (substitution)
  sittin → sitting (insertion)

For search:
  Query: "runnign"
  Candidate: "running"
  Edit distance: 1 (transposition)
  → Include in results if distance ≤ 2
```

### Phonetic Matching

```
Soundex: Words that sound alike get the same code.
  "Smith" → S530
  "Smyth" → S530
  Match!

Metaphone: More accurate than Soundex.
  "Stephen" → STFN
  "Steven"  → STFN
  Match!
```

### Techniques Summary

| Technique       | How It Works                              | Speed     |
|----------------|-------------------------------------------|-----------|
| Edit distance  | Allow N character edits                    | Moderate  |
| N-gram overlap | Compare character n-grams                  | Fast      |
| Phonetic codes | Match by pronunciation                     | Fast      |
| BK-trees       | Tree optimized for edit distance queries   | Fast      |
| Fuzzy automata | Build DFA from query with allowed errors   | Very fast |

---

## 9. Faceted Search & Filtering

```
Amazon product search: "laptop"
  Results: 50,000 laptops
  
  Facets (aggregations):
  ┌──────────────────┐
  │ Brand            │
  │  □ Apple (5,000) │
  │  □ Dell (8,000)  │
  │  □ Lenovo (6,000)│
  │                  │
  │ Price Range      │
  │  □ $0-$500 (15K) │
  │  □ $500-$1K (20K)│
  │  □ $1K+ (15K)    │
  │                  │
  │ RAM              │
  │  □ 8GB (20,000)  │
  │  □ 16GB (18,000) │
  │  □ 32GB (12,000) │
  └──────────────────┘

Implementation:
  - Doc values / column store alongside inverted index
  - Aggregation queries compute facet counts
  - Filters are applied as boolean queries (very fast)
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| Inverted index is the foundation | Maps terms → documents. Know it cold |
| BM25 is the modern scoring standard | Replaces TF-IDF with saturation and length normalization |
| Analysis pipeline matters | Tokenization, stemming, synonyms determine what's findable |
| Search is separate from the DB | Keep search index (ES) in sync with source-of-truth DB via CDC/queue |
| Typeahead uses tries or prefix indexes | Pre-compute top-K suggestions, debounce client requests |
| Fuzzy search handles typos | Edit distance ≤ 2 catches most typos |
| Shard by document, not by term | Document-based sharding is standard; scatter-gather for queries |
| Caching is critical | Most queries follow power-law distribution — cache the top queries |
| Two-phase ranking | Cheap retrieval first (BM25), expensive re-ranking second (ML) |
