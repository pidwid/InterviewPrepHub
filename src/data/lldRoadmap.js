// LLD Study roadmap — structured phases with topic references
// Each phase maps to real topic IDs from lldTopics.js so progress is tracked automatically

export const LLD_ROADMAP_PHASES = [
  {
    id: 'lld-phase-1',
    label: 'Phase 1',
    title: 'OOP & Design Foundations',
    week: 'Week 1',
    description: 'Master the OOP fundamentals, class relationships, and SOLID principles that underpin every LLD answer.',
    topics: ['lld-oop', 'lld-relationships', 'lld-solid', 'lld-dry-kiss-yagni'],
  },
  {
    id: 'lld-phase-2',
    label: 'Phase 2',
    title: 'UML & Creational Patterns',
    week: 'Week 1–2',
    description: 'Learn to draw class/sequence diagrams and master Singleton, Factory, Builder, and Prototype patterns.',
    topics: ['lld-uml-diagrams', 'lld-creational'],
  },
  {
    id: 'lld-phase-3',
    label: 'Phase 3',
    title: 'Structural Patterns',
    week: 'Week 2',
    description: 'Adapter, Decorator, Facade, Composite, Proxy — patterns that compose objects into larger structures.',
    topics: ['lld-structural'],
  },
  {
    id: 'lld-phase-4',
    label: 'Phase 4',
    title: 'Behavioral Patterns',
    week: 'Week 2–3',
    description: 'Strategy, Observer, State, Command — patterns that define how objects communicate and behave.',
    topics: ['lld-behavioral'],
  },
  {
    id: 'lld-phase-5',
    label: 'Phase 5',
    title: 'Concurrency & Multi-threading',
    week: 'Week 3',
    description: 'Threads, locks, mutex, semaphores, producer-consumer, deadlock prevention.',
    topics: ['lld-concurrency-notes'],
  },
  {
    id: 'lld-phase-6',
    label: 'Phase 6',
    title: 'Easy LLD Problems',
    week: 'Week 3–4',
    description: 'Apply patterns to classic easy problems: Parking Lot, Vending Machine, Logging Framework.',
    topics: ['lld-parking-lot', 'lld-vending-machine', 'lld-stack-overflow', 'lld-logging-framework', 'lld-traffic-signal', 'lld-coffee-vending', 'lld-task-management'],
  },
  {
    id: 'lld-phase-7',
    label: 'Phase 7',
    title: 'Medium LLD Problems',
    week: 'Week 4–6',
    description: 'Tackle medium-complexity designs: Elevator, LRU Cache, Pub-Sub, Hotel/Library Management.',
    topics: ['lld-elevator', 'lld-lru-cache', 'lld-tic-tac-toe', 'lld-pub-sub', 'lld-atm', 'lld-car-rental', 'lld-hotel-management', 'lld-library', 'lld-linkedin'],
  },
  {
    id: 'lld-phase-8',
    label: 'Phase 8',
    title: 'Hard Problems & Concurrency',
    week: 'Week 6–8',
    description: 'Master hard problems (Chess, Uber, Amazon) and concurrency challenges.',
    topics: ['lld-chess', 'lld-splitwise', 'lld-ride-sharing', 'lld-movie-booking', 'lld-amazon', 'lld-api-rate-limiter', 'lld-in-memory-cache', 'lld-distributed-id', 'lld-cp-blocking-queue', 'lld-cp-ttl-cache', 'lld-cp-concurrent-hashmap', 'lld-cheatsheet'],
  },
];
