# Vector Databases & Retrieval-Augmented Generation (RAG)

> An infrastructure note: how vector databases are built, when to use them, and the architecture of production RAG systems.
>
> This is one of the **most-asked emerging topics** in 2025-2026 senior interviews — every team building anything with LLMs needs this.

---

## Table of Contents

1. [What & Why](#what--why)
2. [Embeddings: The Foundation](#embeddings-the-foundation)
3. [Approximate Nearest Neighbor Algorithms](#approximate-nearest-neighbor-algorithms)
4. [Vector Index vs Vector Database](#vector-index-vs-vector-database)
5. [Production Vector DB Comparison](#production-vector-db-comparison)
6. [RAG Architecture End-to-End](#rag-architecture-end-to-end)
7. [Hybrid Search](#hybrid-search)
8. [Scaling & Operational Concerns](#scaling--operational-concerns)
9. [What Could Bite You In an Interview](#what-could-bite-you-in-an-interview)

---

## What & Why

A **vector database** stores high-dimensional numerical vectors ("embeddings") and answers two queries efficiently:

1. **Nearest-neighbor search** — given a query vector, return the *k* stored vectors closest to it under some distance metric.
2. **Filtered nearest-neighbor search** — same as above but constrained by metadata predicates (e.g., `tenant_id = 42 AND price < 50`).

**Why this matters now:**
- LLMs have a **context window limit**. You can't paste your entire knowledge base into a prompt.
- A vector database is the **external memory layer** that retrieves the few most relevant documents, which then get pasted into the prompt at query time. This pattern is **Retrieval-Augmented Generation (RAG)**.
- Same infrastructure also powers **semantic search**, **recommendations**, and **multi-modal search** (image-to-image, image-to-text).

---

## Embeddings: The Foundation

An embedding is a fixed-dimensional vector (commonly 384, 768, 1024, or 1536 dimensions) produced by a neural network — typically a transformer-based encoder like Sentence-BERT or OpenAI's `text-embedding-3-small`/`-large`.

The key property: **semantically similar inputs map to nearby points in vector space.**
- "cell phone" and "smartphone" land close together
- A photo of a beach and a description of "sandy coastline at sunset" land close together (multi-modal)

### Distance Metrics

| Metric | Formula | When to use |
|---|---|---|
| **Cosine similarity** | `cos(θ) = a·b / (\|a\|·\|b\|)` | Most text embeddings (OpenAI, Sentence-BERT). Scale-invariant. |
| **Inner product (dot)** | `a·b` | Already-normalized vectors (faster — avoids the division). |
| **L2 (Euclidean)** | `√Σ(aᵢ-bᵢ)²` | Image embeddings; cases where magnitude matters. |

**Always use the distance metric your embedding model was trained for.** Mixing them silently degrades recall.

---

## Approximate Nearest Neighbor Algorithms

Exact k-NN over millions of high-dimensional vectors is **O(n × d)** per query — doesn't scale. ANN trades a small recall loss (typically 95-99% recall vs exact) for huge speedups.

### HNSW (Hierarchical Navigable Small World)

The most popular algorithm in 2025-2026; default in **Qdrant, Weaviate, Milvus, Pinecone, Chroma, and pgvector**.

- Builds a **multi-layer graph** where each node connects to its closest neighbors at multiple scales (think: hierarchy of "express lanes" + local roads)
- Search descends the layers, narrowing the candidate set quickly
- Query time is **logarithmic in N** even in high dimensions
- **Drawback**: the graph must live in RAM; build time is slow; memory-hungry

### IVF (Inverted File Index)

- Vectors are clustered (k-means) into Voronoi cells
- At query time, only the *k* nearest clusters ("probes") are scanned
- More memory-efficient than HNSW; the right choice when you have **hundreds of millions** of vectors and HNSW won't fit
- Used heavily by **FAISS** and **Milvus**

### Product Quantization (PQ)

A **compression technique** layered on top of HNSW or IVF:
- Splits each vector into sub-vectors and quantizes each sub-vector to a small codebook
- Achieves **8× to 64× compression** with controlled recall loss
- This is what makes **billion-vector indexes feasible on a single beefy machine**
- Pinecone serverless and most large RAG deployments use PQ under the hood

### Trade-offs Quick Reference

| Algorithm | Build time | Query latency | Memory | Best for |
|---|---|---|---|---|
| Exact k-NN | None | O(N) | Vectors only | <100K vectors |
| **HNSW** | Slow | Fastest | High (graph) | <100M vectors, latency-critical |
| **IVF** | Medium | Medium | Lower | 100M-1B vectors |
| **HNSW + PQ** / **IVF + PQ** | Slow | Fast | 8-64× lower | Billion-scale single-node |

---

## Vector Index vs Vector Database

This distinction is **commonly tested** in senior interviews:

| Vector Index (e.g., FAISS) | Vector Database (e.g., Pinecone, Milvus, Qdrant) |
|---|---|
| A library implementing ANN math | A full operational system on top of an index |
| In-memory or memory-mapped | Persistent storage with WAL |
| No CRUD; rebuild on changes | Insert, update, delete, upsert |
| No metadata storage | Rich metadata + filtered search |
| No multi-tenancy / auth | RBAC, namespaces, multi-tenant isolation |
| No replication / HA | Replication, failover, snapshots |
| No API server | gRPC/REST API, client libraries |

**Don't ship raw FAISS to production for anything beyond a single-node prototype.**

---

## Production Vector DB Comparison

| System | Algorithm | Sweet spot | Notes |
|---|---|---|---|
| **pgvector** | HNSW or IVFFlat | <10M vectors; existing Postgres stack | Adds a `vector` type to Postgres. Best for "we already have Postgres." Distance ops: `<->` (L2), `<#>` (inner product), `<=>` (cosine). |
| **Pinecone** | HNSW + PQ (managed) | Managed simplicity; serverless | Closed-source. Lowest operational burden. |
| **Qdrant** | HNSW + PQ | High-performance filtered search | Rust-based; gRPC API; strong metadata filtering. |
| **Weaviate** | HNSW | Hybrid search (vector + BM25) | Built-in modules for embedding generation. |
| **Milvus / Zilliz** | HNSW, IVF, PQ, DiskANN | Billion-vector open-source | Most flexible; production-heavy. |
| **Chroma** | HNSW (via hnswlib) | Local dev, small deployments | Embedded-mode friendly. |
| **Elasticsearch / OpenSearch k-NN** | HNSW | Already on ES stack | Don't introduce ES just for vectors; do introduce vectors if you already have ES. |

**Decision rule of thumb:** Pick **pgvector** unless you've measured a reason not to. The simplification of one database (instead of two) is worth a lot.

---

## RAG Architecture End-to-End

The textbook RAG pipeline has two phases: **indexing** (offline/streaming) and **retrieval + generation** (online).

### Phase 1 — Indexing (Offline)

```
Source documents ──┐
   (PDFs,          ▼
    HTML, Confluence)
                 ┌──────────┐
                 │ Chunker  │  split into ~500-1000 token chunks
                 └────┬─────┘  with ~10% overlap between chunks
                      │
                      ▼
              ┌───────────────┐
              │ Embedding API │  e.g., text-embedding-3-small
              │ (per chunk)   │  → 1536-dim vector
              └───────┬───────┘
                      │
                      ▼
              ┌────────────────┐
              │ Vector DB      │  store vector + chunk text +
              │ (HNSW index)   │  metadata (source_id, chunk_idx,
              └────────────────┘  tenant_id, certified_at, etc.)
```

**Chunking is the hidden art.** Too small → loses context. Too big → retrieval returns the wrong piece. Common starting point: 500-1000 tokens with 10-15% overlap. Better still: split on **semantic boundaries** (headings, paragraphs).

### Phase 2 — Retrieval + Generation (Online)

```
User query
   │
   ▼
┌───────────────┐
│ Embedding API │  embed query with the SAME model used for indexing
└───────┬───────┘
        │ query vector
        ▼
┌───────────────┐
│ Vector DB     │  ANN search: top-k nearest neighbors
│ HNSW + filter │  (apply metadata filter for tenant/permissions)
└───────┬───────┘
        │ top-k chunks (with text)
        ▼
┌───────────────┐
│ Re-ranker     │  optional: cross-encoder re-ranks top-k → top-n
│ (cross-enc)   │  improves precision at the cost of latency
└───────┬───────┘
        │ top-n chunks
        ▼
┌──────────────────────────────────┐
│ Prompt assembly                  │
│ ─────────────────────────────────│
│ system: "You are a helpful..."   │
│ context: [chunk1] [chunk2] ...   │
│ user: <original query>           │
└────────────┬─────────────────────┘
             ▼
        ┌───────┐
        │  LLM  │  generates answer grounded in context
        └───┬───┘
            ▼
         Answer + source citations
```

**Key engineering points:**
- **Same embedding model** must be used for indexing and querying — different models = incompatible vector spaces
- **k is usually small** (5-20). Bigger k means more context to fit in the prompt and more cost.
- **Re-ranking** with a cross-encoder (e.g., `bge-reranker`) on the top-50 from ANN, returning the top-5, often dramatically improves answer quality.
- **Prompt templating** matters: include source IDs so the LLM can cite them.

---

## Hybrid Search

**Pure vector search loses to hybrid search on real RAG queries.** Why?
- Users type **exact terms, IDs, acronyms, error codes** that semantic search can miss
- A user asking "What does ERR_CONNECTION_REFUSED mean?" wants documents that literally contain that string
- Vector embeddings don't preserve exact tokens well — `"v1.2.3"` and `"v1.2.4"` may embed near each other

The fix is **hybrid search**:
1. Run a **keyword search** (BM25) and a **vector search** in parallel
2. Combine the two ranked lists with **Reciprocal Rank Fusion (RRF)** or a learned weighting
3. Return the merged top-k

Most production vector DBs (Weaviate, Qdrant, Milvus, Elasticsearch) support hybrid search natively. **Recommended as the default for any RAG system processing user-typed queries.**

---

## Scaling & Operational Concerns

### Memory Is the Bottleneck

For HNSW at scale, **memory matters more than CPU**:
- A 1536-dim vector at float32 = 6 KB
- 100M vectors = 600 GB just for raw vectors (no graph overhead)
- HNSW graph adds 30-50% on top
- **PQ compression** brings this down 8-64×; with PQ you can fit 100M vectors in ~100 GB

### Filtered Search Pitfalls

Combining metadata filters with ANN is harder than it looks:
- **Pre-filter**: filter the dataset first, then ANN over the survivors. Accurate but slow if the filter eliminates 99% — the ANN can return fewer than k results.
- **Post-filter**: ANN first, filter survivors. Fast but may return < k results if the filter is selective.
- **Modern systems** (Qdrant, Milvus) use **filtered HNSW** that prunes the graph during traversal. Best of both.

### Updates and Deletes

- HNSW graph doesn't gracefully handle deletes — most implementations **mark and skip** then periodically **rebuild** the affected sections
- Frequent updates to embeddings (e.g., when re-indexing with a new embedding model) usually mean **rebuild from scratch** in a separate index, then atomic swap

### Multi-Tenancy

Two patterns:
- **Namespace per tenant** (Pinecone-style): isolation by index/collection — simple, expensive at high tenant counts
- **Single index + tenant filter**: cheaper, requires filtered search to be fast (see above)

### Embedding Drift

The trickiest operational issue:
- You upgrade your embedding model from `text-embedding-ada-002` to `text-embedding-3-small`
- All your stored vectors are now in a **different vector space** — incompatible
- Solution: maintain two indexes, dual-write during migration, cut over atomically. Plan for this from day one.

---

## What Could Bite You In an Interview

- **"Why not just use Postgres for everything?"** — At under ~10M vectors with infrequent updates, you can. Beyond that, dedicated vector DBs are faster (purpose-built indexes, filtered HNSW, PQ compression) and easier to scale horizontally.
- **"How do you handle freshness — a doc just got updated?"** — Streaming indexing pipeline (Kafka → embedding worker → vector DB upsert). Eventual consistency is usually fine for RAG (~minutes lag acceptable).
- **"How do you evaluate retrieval quality?"** — Offline: NDCG@k, MRR, recall@k against a labeled query set. Online: A/B test answer quality, user thumbs-up rate, follow-up question rate.
- **"What about prompt injection?"** — Sanitize retrieved chunks (strip system-prompt-like patterns), use structured prompting, add output-side guardrails. RAG **doesn't fix** prompt injection — it can **expose** it via untrusted source documents.
- **"Cost?"** — Embedding API calls (the OpenAI bill compounds), vector DB storage (memory dominates), LLM tokens at query time (the answer cost). For a typical chatbot: ~$0.001-0.01 per query end-to-end depending on model choice.

---

## Quick Mental Model

> A vector database is **a search engine for meaning**: BM25 indexes word *positions*; a vector DB indexes *semantic location in a learned vector space*. Same operational concerns (sharding, replication, freshness, recall vs latency) — just a different kind of index.

---

> **Sources for this note.** pgvector official README and AWS Database Blog deep dive (IVFFlat & HNSW); Meta FAISS paper and library; Qdrant / Weaviate / Milvus documentation pages; "Vector Database Deep Dive" (Ajit Singh, 2026); Atlan's vector database overview; Databricks "What is pgvector" guide. Specific algorithm trade-offs are well-documented; managed-service performance numbers (e.g., "Pinecone p95 23 ms") are workload-specific.
