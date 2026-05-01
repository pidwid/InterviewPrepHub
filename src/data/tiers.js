// ── Topic Tiers ─────────────────────────────────────────────────────────────
//
// Single source of truth for "how essential is this topic for senior
// SWE interviews". The tier of a topic is derived purely from its ID
// (no per-topic field needed). The same membership lists drive both:
//   1. The Roadmap "Time Budget" filter (1w / 2w / 1m / all)
//   2. The Tier badge shown in sidebar / topic header
//   3. The Index page tier filter
//
// Adjustments from the previous time-filter sets:
//   • Moved 'note-17' (Rate Limiting)        T2 → T1   — universal screen
//   • Moved 'note-26' (Unique ID Generation) T3 → T2   — Twitter snowflake
//   • Moved 'lld-tic-tac-toe'                T2 → T1   — most-asked entry-level
//   • Moved 'lld-elevator'                   T2 → T1   — top-3 LLD problem
//   • Moved 'lld-vending-machine'            T2 → T1   — top-3 LLD problem

// ── Tier 1: Core (must-know in 1 week, ~15-20 hours) ───────────────────────
const T1_SD = new Set([
  'note-01',          // Performance vs Scalability
  'note-03',          // Availability vs Consistency (CAP)
  'note-08',          // Load Balancers
  'note-11',          // Databases
  'note-12',          // Caching
  'note-15',          // API Design
  'note-17',          // Rate Limiting           ← promoted from T2
  'note-24',          // Estimation Numbers
  'note-43',          // Consistent Hashing
  'note-cheatsheet',  // Cheat Sheet
]);

const T1_LLD = new Set([
  'lld-oop',
  'lld-solid',
  'lld-uml-diagrams',
  'lld-creational',
  'lld-structural',
  'lld-behavioral',
  'lld-parking-lot',
  'lld-lru-cache',
  'lld-vending-machine', // ← promoted from T2
  'lld-elevator',        // ← promoted from T2
  'lld-tic-tac-toe',     // ← promoted from T2
  'lld-cheatsheet',
]);

// ── Tier 2: Important (add for 2 weeks, ~30-40 hours total) ────────────────
const T2_SD_NEW = new Set([
  'note-02',  // Latency vs Throughput
  'note-04',  // Consistency Patterns
  'note-05',  // Availability Patterns
  'note-06',  // DNS
  'note-10',  // Application Layer / Microservices
  'note-13',  // Asynchronism
  'note-18',  // Distributed Systems
  'note-26',  // Unique ID Generation     ← promoted from T3
  'note-30',  // Distributed Locking
  'note-44',  // Service Discovery
  'note-46',  // Vector Databases & RAG (modern, important)
  'note-47',  // Feature Flags & Experimentation (modern, important)
  'note-48',  // Edge Computing (modern, important)
]);
const T2_SD = new Set([...T1_SD, ...T2_SD_NEW]);

const T2_LLD_NEW = new Set([
  'lld-relationships',
  'lld-dependency-injection',
  'lld-hashmap',
  'lld-concurrency-notes',
  'lld-thread-pool',
  'lld-stripe-payment',          // commonly asked at fintech / marketplace
  'lld-distributed-counter',     // staff-level data-structure problem
  'lld-notification-throttler',  // ubiquitous at consumer companies
]);
const T2_LLD = new Set([...T1_LLD, ...T2_LLD_NEW]);

// ── Tier 3: Recommended (add for 1 month, ~60 hours total) ─────────────────
const T3_SD_NEW = new Set([
  'note-07',  // CDN
  'note-09',  // Reverse Proxy
  'note-14',  // Communication Protocols
  'note-16',  // Security
  'note-19',  // Event-Driven Architecture
  'note-22',  // Containers Orchestration
  'note-28',  // Search Systems
  'note-32',  // Cloud Architecture Patterns
  'note-34',  // CI/CD Deployment Pipelines
  'note-38',  // ML System Design
]);
const T3_SD = new Set([...T2_SD, ...T3_SD_NEW]);

const T3_LLD_NEW = new Set([
  'lld-dry-kiss-yagni',
  'lld-concurrency-deep-dive',
  'lld-pub-sub',
  'lld-coffee-vending',
  'lld-api-rate-limiter',
  'lld-chess',
  'lld-distributed-id',
  'lld-in-memory-cache',
  'lld-cp-blocking-queue',
  'lld-cp-concurrent-hashmap',
  'lld-order-matching',          // specialized fintech / HFT
  'lld-versioned-doc-store',     // specialized; Notion / Figma / Git-like systems
]);
const T3_LLD = new Set([...T2_LLD, ...T3_LLD_NEW]);

// ── Tier metadata ──────────────────────────────────────────────────────────
export const TIERS = {
  1: { key: 1, label: 'Core',        short: 'T1', color: 'tier-1', desc: 'Must-know — appears in nearly every senior SWE interview' },
  2: { key: 2, label: 'Important',   short: 'T2', color: 'tier-2', desc: 'Important — common in FAANG and top-tier company interviews' },
  3: { key: 3, label: 'Recommended', short: 'T3', color: 'tier-3', desc: 'Recommended — strengthens senior+/staff candidacy' },
  4: { key: 4, label: 'Reference',   short: 'T4', color: 'tier-4', desc: 'Reference — niche or operational depth, look up as needed' },
};

// ── Practice question tiers (SD design problems) ──────────────────────────
// LLD practice questions use lld-* ids and inherit their tier from T*_LLD.
const T1_Q = new Set([
  'q-url-shortener', 'q-twitter-timeline', 'q-rate-limiter', 'q-news-feed',
  'q-chat-system', 'q-distributed-cache', 'q-search-autocomplete',
  'q-notification', 'q-instagram', 'q-uber', 'q-message-queue',
  'q-consistent-hashing', 'q-pastebin',
]);
const T2_Q = new Set([
  'q-yelp', 'q-google-maps', 'q-dropbox', 'q-payment', 'q-online-judge',
  'q-tiktok', 'q-discord', 'q-video-streaming', 'q-live-streaming',
  'q-web-crawler', 'q-mint', 'q-key-value-search', 'q-top-k', 'q-spotify',
  'q-booking', 'q-cdn', 'q-google-docs',
]);
const T3_Q = new Set([
  'q-amazon-sales', 'q-aws-scale', 'q-social-network', 'q-google-search',
  'q-e-commerce', 'q-stock-exchange', 'q-recommendation', 'q-garbage-collection',
]);

// ── Lookup ────────────────────────────────────────────────────────────────
//
// Returns 1, 2, 3, or 4 for a given topic id.
export function getTier(topicId) {
  if (!topicId) return 4;
  // Practice questions
  if (topicId.startsWith('q-')) {
    if (T1_Q.has(topicId)) return 1;
    if (T2_Q.has(topicId)) return 2;
    if (T3_Q.has(topicId)) return 3;
    return 4;
  }
  // SD topic notes vs LLD notes
  const isSD = topicId.startsWith('note-');
  const t1 = isSD ? T1_SD : T1_LLD;
  const t2 = isSD ? T2_SD : T2_LLD;
  const t3 = isSD ? T3_SD : T3_LLD;
  if (t1.has(topicId)) return 1;
  if (t2.has(topicId)) return 2;
  if (t3.has(topicId)) return 3;
  return 4;
}

export function getTierMeta(topicId) {
  return TIERS[getTier(topicId)];
}

// ── Time-budget filter ────────────────────────────────────────────────────
//
// 1w → only T1 visible
// 2w → T1 + T2 visible
// 1m → T1 + T2 + T3 visible
// all → everything visible
export const TIME_BUDGETS = [
  { key: '1w',  label: '1 Week (~30h)',     maxTier: 1 },
  { key: '2w',  label: '2 Weeks (~70h)',    maxTier: 2 },
  { key: '1m',  label: '1 Month (~120h)',   maxTier: 3 },
  { key: 'all', label: 'Comprehensive',     maxTier: 4 },
];

export function isInTimeBudget(topicId, budgetKey) {
  const budget = TIME_BUDGETS.find((b) => b.key === budgetKey);
  if (!budget) return true;
  return getTier(topicId) <= budget.maxTier;
}
