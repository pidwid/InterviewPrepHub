// Low-Level Design topics — mapped to local notes + problem cards
// Merged from:
// - https://github.com/ashishps1/awesome-low-level-design
// - https://github.com/prasadgujar/low-level-design-primer
//
// Concept topics have noteFile (link to local markdown notes).
// Problem topics are card-only (content to be added later).

export const LLD_CATEGORIES = [
  {
    id: 'lld-oop-fundamentals',
    title: 'OOP Fundamentals',
    topics: [
      { id: 'lld-oop', title: 'OOP Fundamentals (Classes, Enums, Interfaces, 4 Pillars)', noteFile: 'LLD-01-OOP-Fundamentals.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-class-relationships',
    title: 'Class Relationships',
    topics: [
      { id: 'lld-relationships', title: 'Class Relationships (Association, Aggregation, Composition, Dependency)', noteFile: 'LLD-02-Class-Relationships.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-design-principles',
    title: 'Design Principles',
    topics: [
      { id: 'lld-solid', title: 'SOLID Principles', noteFile: 'LLD-03-SOLID-Principles.md', priority: 'high' },
      { id: 'lld-dry-kiss-yagni', title: 'DRY, KISS, YAGNI & Other Principles', noteFile: 'LLD-04-Design-Principles.md', priority: 'medium' },
      { id: 'lld-dependency-injection', title: 'Dependency Injection & IoC', priority: 'high' },
    ],
  },
  {
    id: 'lld-uml',
    title: 'UML Diagrams',
    topics: [
      { id: 'lld-uml-diagrams', title: 'UML Diagrams (Class, Sequence, State, Activity, Use Case)', noteFile: 'LLD-05-UML-Diagrams.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-creational-patterns',
    title: 'Creational Design Patterns',
    topics: [
      { id: 'lld-creational', title: 'Creational Patterns (Singleton, Factory, Abstract Factory, Builder, Prototype)', noteFile: 'LLD-06-Creational-Patterns.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-structural-patterns',
    title: 'Structural Design Patterns',
    topics: [
      { id: 'lld-structural', title: 'Structural Patterns (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy)', noteFile: 'LLD-07-Structural-Patterns.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-behavioral-patterns',
    title: 'Behavioral Design Patterns',
    topics: [
      { id: 'lld-behavioral', title: 'Behavioral Patterns (Strategy, Observer, State, Command, Template, Iterator, Chain, Mediator, Memento, Visitor)', noteFile: 'LLD-08-Behavioral-Patterns.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-concurrency',
    title: 'Concurrency & Multi-threading',
    topics: [
      { id: 'lld-concurrency-notes', title: 'Concurrency & Multi-threading', noteFile: 'LLD-09-Concurrency.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-cheat-sheet',
    title: 'Cheat Sheet & Reference',
    topics: [
      { id: 'lld-cheatsheet', title: 'LLD Interview Cheat Sheet', noteFile: 'LLD-10-Interview-Cheat-Sheet.md', priority: 'high' },
    ],
  },
  {
    id: 'lld-problems-easy',
    title: 'LLD Problems — Easy',
    topics: [
      { id: 'lld-parking-lot',       title: 'Design Parking Lot',                    priority: 'high',   youtubeId: 'kzfrbkDcYjA' },
      { id: 'lld-vending-machine',    title: 'Design a Vending Machine',              priority: 'high',   youtubeId: 'bJPmvie_p4w' },
      { id: 'lld-stack-overflow',     title: 'Design Stack Overflow',                 priority: 'medium' },
      { id: 'lld-logging-framework',  title: 'Design Logging Framework',              priority: 'medium', youtubeId: 'hOzH7ecc8vg' },
      { id: 'lld-traffic-signal',     title: 'Design Traffic Signal Control System',  priority: 'low' },
      { id: 'lld-task-management',    title: 'Design a Task Management System',       priority: 'medium' },
      { id: 'lld-deck-of-cards',      title: 'Design a Deck of Cards',                priority: 'medium', youtubeId: 'yENwNPu2Obo' },
      { id: 'lld-bowling-alley',      title: 'Design Bowling Alley Scoring',          priority: 'medium', youtubeId: 'ExF4ZbJkokA' },
    ],
  },
  {
    id: 'lld-problems-medium',
    title: 'LLD Problems — Medium',
    topics: [
      { id: 'lld-elevator',         title: 'Design an Elevator System',                priority: 'high',   youtubeId: 'siqiJAJWUVg' },
      { id: 'lld-lru-cache',        title: 'Design LRU Cache',                         priority: 'high',   youtubeId: 'z9bJUPxzFOw' },
      { id: 'lld-tic-tac-toe',      title: 'Design Tic Tac Toe Game',                  priority: 'high',   youtubeId: 'gktZsX9Z8Kw' },
      { id: 'lld-pub-sub',          title: 'Design Pub Sub System',                    priority: 'high',   youtubeId: '4BEzgPlLKTo' },
      { id: 'lld-atm',              title: 'Design ATM',                               priority: 'medium' },
      { id: 'lld-car-rental',       title: 'Design Car Rental System',                 priority: 'medium', youtubeId: 'H68JE5U7Qvw' },
      { id: 'lld-hotel-management', title: 'Design Hotel Management System',           priority: 'medium' },
      { id: 'lld-library',          title: 'Design a Library Management System',       priority: 'medium', youtubeId: 'fVqv4B8sG1s' },
      { id: 'lld-linkedin',         title: 'Design LinkedIn',                          priority: 'medium' },
      { id: 'lld-hashmap',           title: 'Design a HashMap from Scratch',            priority: 'high' },
      { id: 'lld-notification',      title: 'Design a Notification System',             priority: 'high',   youtubeId: '98DiwRp-KZk' },
      { id: 'lld-url-shortener',     title: 'Design a URL Shortener (LLD)',             priority: 'high',   youtubeId: 'HHUi8F_qAXM' },
      { id: 'lld-text-editor',       title: 'Design a Text Editor / Notepad',           priority: 'medium', youtubeId: 'Hjp4xpDVFww' },
      { id: 'lld-calendar',          title: 'Design a Calendar / Meeting Scheduler',    priority: 'medium', youtubeId: 'MRx40JVmmF4' },
      { id: 'lld-online-auction',   title: 'Design an Online Auction System',          priority: 'low' },
      { id: 'lld-digital-wallet',   title: 'Design a Digital Wallet Service',          priority: 'low',    youtubeId: 'm6DtqSb1BDM' },
      { id: 'lld-airline',          title: 'Design Airline Management System',         priority: 'low',    youtubeId: '5yEoh3toRyE' },
      { id: 'lld-social-network',   title: 'Design a Social Network like Facebook',   priority: 'low',    youtubeId: 'YoS5cp0cirM' },
      { id: 'lld-restaurant',       title: 'Design Restaurant Management System',     priority: 'low',    youtubeId: 'eme8G4-tXuo' },
      { id: 'lld-concert-booking',  title: 'Design Concert Ticket Booking System',    priority: 'low',    youtubeId: 'dX5iHM2jlZw' },
    ],
  },
  {
    id: 'lld-problems-hard',
    title: 'LLD Problems — Hard',
    topics: [
      { id: 'lld-chess',              title: 'Design Chess Game',                          priority: 'high',   youtubeId: 'Mmw-sEUuCNs' },
      { id: 'lld-splitwise',          title: 'Design Splitwise',                           priority: 'high',   youtubeId: '2QvlBrhLLHc' },
      { id: 'lld-ride-sharing',       title: 'Design Ride-Sharing Service like Uber',      priority: 'high',   youtubeId: 'DGtalg5efCw' },
      { id: 'lld-movie-booking',      title: 'Design Movie Ticket Booking System',         priority: 'high',   youtubeId: 'dX5iHM2jlZw' },
      { id: 'lld-amazon',             title: 'Design Online Shopping System like Amazon',   priority: 'high' },
      { id: 'lld-snake-ladder',       title: 'Design a Snake and Ladder Game',             priority: 'medium', youtubeId: 'zRz1GPSH50I' },
      { id: 'lld-cricinfo',           title: 'Design CricInfo',                            priority: 'medium', youtubeId: '9iJ-iTpZH-A' },
      { id: 'lld-course-registration', title: 'Design Course Registration System',         priority: 'low' },
      { id: 'lld-stock-brokerage',    title: 'Design Online Stock Brokerage System',       priority: 'medium', youtubeId: 'DH2-vDPFiE4' },
      { id: 'lld-spotify',            title: 'Design Music Streaming Service like Spotify', priority: 'medium', youtubeId: 'DkLwFqbCsu8' },
      { id: 'lld-food-delivery',      title: 'Design Food Delivery Service like Swiggy',   priority: 'medium', youtubeId: 'XN17WWiUzT4' },
      { id: 'lld-in-memory-fs',        title: 'Design In-Memory File System',                priority: 'high',   youtubeId: 'oXEPfYaMOwI' },
      { id: 'lld-chat-messaging',      title: 'Design a Chat / Messaging System',            priority: 'high',   youtubeId: 'vvhC64hQZMk' },
      { id: 'lld-spreadsheet',         title: 'Design a Spreadsheet (Excel)',                priority: 'medium' },
    ],
  },
  {
    id: 'lld-concurrency-problems',
    title: 'Concurrency Problems',
    topics: [
      { id: 'lld-cp-blocking-queue',    title: 'Design Thread-Safe Blocking Queue',         priority: 'high',   youtubeId: 'NY_Fw6EPMOc' },
      { id: 'lld-cp-ttl-cache',         title: 'Design Thread-Safe Cache with TTL',         priority: 'high',   youtubeId: 'px4W-HXRWKk' },
      { id: 'lld-cp-concurrent-hashmap', title: 'Design Concurrent HashMap',                priority: 'high',   youtubeId: '_A0Wty5Aeis' },
      { id: 'lld-cp-foobar',            title: 'Print FooBar Alternately',                  priority: 'medium', youtubeId: 'qQjSPkC6_gU' },
      { id: 'lld-cp-zero-even-odd',     title: 'Print Zero Even Odd',                       priority: 'medium', youtubeId: 'XP75KkwHiNw' },
      { id: 'lld-cp-fizzbuzz',          title: 'Fizz Buzz Multithreaded',                   priority: 'medium', youtubeId: 'Bw3HHkhaxLw' },
      { id: 'lld-cp-h2o',               title: 'Building H2O Molecule',                     priority: 'low',    youtubeId: 'vMVA1HcTjno' },
      { id: 'lld-cp-bloom-filter',      title: 'Design Concurrent Bloom Filter',            priority: 'low',    youtubeId: 'V3pzxngeLqw' },
      { id: 'lld-cp-merge-sort',        title: 'Multi-threaded Merge Sort',                 priority: 'low',    youtubeId: 'jlJ0H6WeH6s' },
      { id: 'lld-cp-thread-pool',       title: 'Design a Thread Pool',                      priority: 'high',   youtubeId: '3HE8D9g9QNE' },
      { id: 'lld-cp-producer-consumer', title: 'Producer-Consumer with Bounded Buffer',     priority: 'high',   youtubeId: 'A1tnVMpWHh8' },
      { id: 'lld-cp-connection-pool',   title: 'Design a Connection Pool',                  priority: 'high' },
      { id: 'lld-cp-rw-lock',           title: 'Readers-Writers Lock Implementation',       priority: 'medium', youtubeId: '7VqWkc9o7RM' },
    ],
  },
  {
    id: 'lld-extra-problems',
    title: 'Additional Machine Coding Problems',
    topics: [
      { id: 'lld-api-rate-limiter',      title: 'Design an API Rate Limiter',                           priority: 'high',   youtubeId: 'PJ-c0QI-QCk' },
      { id: 'lld-in-memory-cache',       title: 'Design an In-Memory Cache (with Eviction Policies)',   priority: 'high',   youtubeId: 'IaDU8_KjrpY' },
      { id: 'lld-distributed-id',        title: 'Design Distributed ID Generation (Twitter Snowflake)', priority: 'high',   youtubeId: '2Et6unrGoQM' },
      { id: 'lld-json-parser',           title: 'Design a JSON Parser from Scratch',                    priority: 'medium' },
      { id: 'lld-truecaller',            title: 'Design Truecaller',                                    priority: 'medium', youtubeId: 'ZtN2ZtxpfgA' },
      { id: 'lld-amazon-locker',         title: 'Design Amazon Locker Service',                         priority: 'medium', youtubeId: '_V191nQYp4g' },
      { id: 'lld-jira',                  title: 'Design a System like Jira',                            priority: 'medium' },
      { id: 'lld-card-game',             title: 'Design an Online Card Game (e.g. Poker)',              priority: 'low',    youtubeId: 'PbOSdbd2q-M' },
      { id: 'lld-finite-state-machine',  title: 'Implement a Finite State Machine',                    priority: 'low',    youtubeId: 'hHaGYyKwRXY' },
      { id: 'lld-e-commerce-review',     title: 'Design an e-Commerce Review System',                  priority: 'low',    youtubeId: 'pQQTy05sv5Q' },
    ],
  },
];

export const ALL_LLD_TOPICS = LLD_CATEGORIES.flatMap((c) => c.topics);

// Practice question groups for the LLD dashboard
export const problemCatIds = [
  'lld-problems-easy',
  'lld-problems-medium',
  'lld-problems-hard',
  'lld-concurrency-problems',
  'lld-extra-problems',
];

const grab = (id) => LLD_CATEGORIES.find((c) => c.id === id)?.topics ?? [];

export const LLD_EASY_QUESTIONS = grab('lld-problems-easy');
export const LLD_MEDIUM_QUESTIONS = grab('lld-problems-medium');
export const LLD_HARD_QUESTIONS = grab('lld-problems-hard');
export const LLD_CONCURRENCY_QUESTIONS = grab('lld-concurrency-problems');
export const LLD_EXTRA_QUESTIONS = grab('lld-extra-problems');
export const ALL_LLD_PRACTICE = problemCatIds.flatMap((id) => grab(id));

// OOD practice questions (Object-Oriented Design)
export const OOD_PRACTICE_QUESTIONS = [
  { id: 'ood-hashmap',       title: 'Design a Hash Map',                          priority: 'high' },
  { id: 'ood-lru-cache',     title: 'Design a Least Recently Used (LRU) Cache',   priority: 'high',   youtubeId: 'z9bJUPxzFOw' },
  { id: 'ood-call-center',   title: 'Design a Call Center',                       priority: 'medium', youtubeId: 'kflabSxyfCk' },
  { id: 'ood-deck-of-cards', title: 'Design a Deck of Cards',                     priority: 'medium', youtubeId: 'yENwNPu2Obo' },
  { id: 'ood-parking-lot',   title: 'Design a Parking Lot',                       priority: 'high',   youtubeId: 'kzfrbkDcYjA' },
  { id: 'ood-chat-server',   title: 'Design a Chat Server',                       priority: 'medium', youtubeId: 'pjYd8kUYHeE' },
  { id: 'ood-circular-array', title: 'Design a Circular Array',                   priority: 'low' },
];
