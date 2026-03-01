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
      { id: 'lld-dependency-injection', title: 'Dependency Injection & IoC', noteFile: 'LLD-11-Dependency-Injection.md', priority: 'high' },
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
      { id: 'lld-concurrency-deep-dive', title: 'Concurrency Deep Dive (Primitives, Deadlock, Patterns)', noteFile: 'LLD-12-Concurrency-Deep-Dive.md', priority: 'high' },
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
      { id: 'lld-parking-lot',       title: 'Design Parking Lot',                    priority: 'high',   solutionFile: 'Solution-Parking-Lot.md', youtubeId: 'kzfrbkDcYjA' },
      { id: 'lld-vending-machine',    title: 'Design a Vending Machine',              priority: 'high',   solutionFile: 'Solution-Vending-Machine.md', youtubeId: 'bJPmvie_p4w' },
      { id: 'lld-stack-overflow',     title: 'Design Stack Overflow',                 priority: 'medium', solutionFile: 'Solution-Stack-Overflow.md' },
      { id: 'lld-logging-framework',  title: 'Design Logging Framework',              priority: 'medium', solutionFile: 'Solution-Logging-Framework.md', youtubeId: 'hOzH7ecc8vg' },
      { id: 'lld-traffic-signal',     title: 'Design Traffic Signal Control System',  priority: 'low',    solutionFile: 'Solution-Traffic-Signal.md' },
      { id: 'lld-task-management',    title: 'Design a Task Management System',       priority: 'medium', solutionFile: 'Solution-Task-Management.md' },
      { id: 'lld-deck-of-cards',      title: 'Design a Deck of Cards',                priority: 'medium', solutionFile: 'Solution-Deck-Of-Cards.md', youtubeId: 'yENwNPu2Obo' },
      { id: 'lld-bowling-alley',      title: 'Design Bowling Alley Scoring',          priority: 'medium', solutionFile: 'Solution-Bowling-Alley.md', youtubeId: 'ExF4ZbJkokA' },
      { id: 'lld-coffee-vending',    title: 'Design Coffee Vending Machine',         priority: 'medium', solutionFile: 'Solution-Coffee-Vending.md' },
    ],
  },
  {
    id: 'lld-problems-medium',
    title: 'LLD Problems — Medium',
    topics: [
      { id: 'lld-elevator',         title: 'Design an Elevator System',                priority: 'high',   solutionFile: 'Solution-Elevator.md', youtubeId: 'siqiJAJWUVg' },
      { id: 'lld-lru-cache',        title: 'Design LRU Cache',                         priority: 'high',   solutionFile: 'Solution-LRU-Cache.md', youtubeId: 'z9bJUPxzFOw' },
      { id: 'lld-tic-tac-toe',      title: 'Design Tic Tac Toe Game',                  priority: 'high',   solutionFile: 'Solution-Tic-Tac-Toe.md', youtubeId: 'gktZsX9Z8Kw' },
      { id: 'lld-pub-sub',          title: 'Design Pub Sub System',                    priority: 'high',   solutionFile: 'Solution-Pub-Sub.md', youtubeId: '4BEzgPlLKTo' },
      { id: 'lld-atm',              title: 'Design ATM',                               priority: 'medium', solutionFile: 'Solution-ATM.md' },
      { id: 'lld-car-rental',       title: 'Design Car Rental System',                 priority: 'medium', solutionFile: 'Solution-Car-Rental.md', youtubeId: 'H68JE5U7Qvw' },
      { id: 'lld-hotel-management', title: 'Design Hotel Management System',           priority: 'medium', solutionFile: 'Solution-Hotel-Management.md' },
      { id: 'lld-library',          title: 'Design a Library Management System',       priority: 'medium', solutionFile: 'Solution-Library.md', youtubeId: 'fVqv4B8sG1s' },
      { id: 'lld-linkedin',         title: 'Design LinkedIn',                          priority: 'medium', solutionFile: 'Solution-LinkedIn.md' },
      { id: 'lld-hashmap',           title: 'Design a HashMap from Scratch',            priority: 'high',   solutionFile: 'Solution-Hashmap.md' },
      { id: 'lld-notification',      title: 'Design a Notification System',             priority: 'high',   solutionFile: 'Solution-Notification.md', youtubeId: '98DiwRp-KZk' },
      { id: 'lld-url-shortener',     title: 'Design a URL Shortener (LLD)',             priority: 'high',   solutionFile: 'Solution-URL-Shortener.md', youtubeId: 'HHUi8F_qAXM' },
      { id: 'lld-text-editor',       title: 'Design a Text Editor / Notepad',           priority: 'medium', solutionFile: 'Solution-Text-Editor.md', youtubeId: 'Hjp4xpDVFww' },
      { id: 'lld-calendar',          title: 'Design a Calendar / Meeting Scheduler',    priority: 'medium', solutionFile: 'Solution-Calendar.md', youtubeId: 'MRx40JVmmF4' },
      { id: 'lld-online-auction',   title: 'Design an Online Auction System',          priority: 'low',    solutionFile: 'Solution-Online-Auction.md' },
      { id: 'lld-digital-wallet',   title: 'Design a Digital Wallet Service',          priority: 'low',    solutionFile: 'Solution-Digital-Wallet.md', youtubeId: 'm6DtqSb1BDM' },
      { id: 'lld-airline',          title: 'Design Airline Management System',         priority: 'low',    solutionFile: 'Solution-Airline.md', youtubeId: '5yEoh3toRyE' },
      { id: 'lld-social-network',   title: 'Design a Social Network like Facebook',   priority: 'low',    solutionFile: 'Solution-Social-Network.md', youtubeId: 'YoS5cp0cirM' },
      { id: 'lld-restaurant',       title: 'Design Restaurant Management System',     priority: 'low',    solutionFile: 'Solution-Restaurant.md', youtubeId: 'eme8G4-tXuo' },
      { id: 'lld-concert-booking',  title: 'Design Concert Ticket Booking System',    priority: 'low',    solutionFile: 'Solution-Concert-Booking.md', youtubeId: 'dX5iHM2jlZw' },
      { id: 'lld-voting-system',   title: 'Design an Online Voting System',          priority: 'medium', solutionFile: 'Solution-Voting-System.md' },
      { id: 'lld-inventory',       title: 'Design Inventory Management System',      priority: 'medium', solutionFile: 'Solution-Inventory.md' },
      { id: 'lld-payment-gateway', title: 'Design a Payment Gateway (Razorpay)',     priority: 'medium', solutionFile: 'Solution-Payment-Gateway.md', youtubeId: 'olfaBgJrUBI' },
      { id: 'lld-lms',             title: 'Design Learning Management System',       priority: 'low',    solutionFile: 'Solution-LMS.md' },
    ],
  },
  {
    id: 'lld-problems-hard',
    title: 'LLD Problems — Hard',
    topics: [
      { id: 'lld-chess',              title: 'Design Chess Game',                          priority: 'high',   solutionFile: 'Solution-Chess.md', youtubeId: 'Mmw-sEUuCNs' },
      { id: 'lld-splitwise',          title: 'Design Splitwise',                           priority: 'high',   solutionFile: 'Solution-Splitwise.md', youtubeId: '2QvlBrhLLHc' },
      { id: 'lld-ride-sharing',       title: 'Design Ride-Sharing Service like Uber',      priority: 'high',   solutionFile: 'Solution-Ride-Sharing.md', youtubeId: 'DGtalg5efCw' },
      { id: 'lld-movie-booking',      title: 'Design Movie Ticket Booking System',         priority: 'high',   solutionFile: 'Solution-Movie-Booking.md', youtubeId: 'dX5iHM2jlZw' },
      { id: 'lld-amazon',             title: 'Design Online Shopping System like Amazon',   priority: 'high',   solutionFile: 'Solution-Amazon.md' },
      { id: 'lld-snake-ladder',       title: 'Design a Snake and Ladder Game',             priority: 'medium', solutionFile: 'Solution-Snake-Ladder.md', youtubeId: 'zRz1GPSH50I' },
      { id: 'lld-cricinfo',           title: 'Design CricInfo',                            priority: 'medium', solutionFile: 'Solution-Cricinfo.md', youtubeId: '9iJ-iTpZH-A' },
      { id: 'lld-course-registration', title: 'Design Course Registration System',         priority: 'low',    solutionFile: 'Solution-Course-Registration.md' },
      { id: 'lld-stock-brokerage',    title: 'Design Online Stock Brokerage System',       priority: 'medium', solutionFile: 'Solution-Stock-Brokerage.md', youtubeId: 'DH2-vDPFiE4' },
      { id: 'lld-spotify',            title: 'Design Music Streaming Service like Spotify', priority: 'medium', solutionFile: 'Solution-Spotify.md', youtubeId: 'DkLwFqbCsu8' },
      { id: 'lld-food-delivery',      title: 'Design Food Delivery Service like Swiggy',   priority: 'medium', solutionFile: 'Solution-Food-Delivery.md', youtubeId: 'XN17WWiUzT4' },
      { id: 'lld-in-memory-fs',        title: 'Design In-Memory File System',                priority: 'high',   solutionFile: 'Solution-In-Memory-FS.md', youtubeId: 'oXEPfYaMOwI' },
      { id: 'lld-chat-messaging',      title: 'Design a Chat / Messaging System',            priority: 'high',   solutionFile: 'Solution-Chat-Messaging.md', youtubeId: 'vvhC64hQZMk' },
      { id: 'lld-spreadsheet',         title: 'Design a Spreadsheet (Excel)',                priority: 'medium', solutionFile: 'Solution-Spreadsheet.md' },
      { id: 'lld-logistics',           title: 'Design a Logistics / Delivery System',       priority: 'medium', solutionFile: 'Solution-Logistics.md' },
      { id: 'lld-survey',              title: 'Design a Survey System (Google Forms)',       priority: 'low',    solutionFile: 'Solution-Survey.md' },
    ],
  },
  {
    id: 'lld-concurrency-problems',
    title: 'Concurrency Problems',
    topics: [
      { id: 'lld-cp-blocking-queue',    title: 'Design Thread-Safe Blocking Queue',         priority: 'high',   solutionFile: 'Solution-Blocking-Queue.md', youtubeId: 'NY_Fw6EPMOc' },
      { id: 'lld-cp-ttl-cache',         title: 'Design Thread-Safe Cache with TTL',         priority: 'high',   solutionFile: 'Solution-TTL-Cache.md', youtubeId: 'px4W-HXRWKk' },
      { id: 'lld-cp-concurrent-hashmap', title: 'Design Concurrent HashMap',                priority: 'high',   solutionFile: 'Solution-Concurrent-HashMap.md', youtubeId: '_A0Wty5Aeis' },
      { id: 'lld-cp-foobar',            title: 'Print FooBar Alternately',                  priority: 'medium', solutionFile: 'Solution-FooBar.md', youtubeId: 'qQjSPkC6_gU' },
      { id: 'lld-cp-zero-even-odd',     title: 'Print Zero Even Odd',                       priority: 'medium', solutionFile: 'Solution-Zero-Even-Odd.md', youtubeId: 'XP75KkwHiNw' },
      { id: 'lld-cp-fizzbuzz',          title: 'Fizz Buzz Multithreaded',                   priority: 'medium', solutionFile: 'Solution-FizzBuzz.md', youtubeId: 'Bw3HHkhaxLw' },
      { id: 'lld-cp-h2o',               title: 'Building H2O Molecule',                     priority: 'low',    solutionFile: 'Solution-H2O.md', youtubeId: 'vMVA1HcTjno' },
      { id: 'lld-cp-bloom-filter',      title: 'Design Concurrent Bloom Filter',            priority: 'low',    solutionFile: 'Solution-Bloom-Filter.md', youtubeId: 'V3pzxngeLqw' },
      { id: 'lld-cp-merge-sort',        title: 'Multi-threaded Merge Sort',                 priority: 'low',    solutionFile: 'Solution-Merge-Sort.md', youtubeId: 'jlJ0H6WeH6s' },
      { id: 'lld-cp-thread-pool',       title: 'Design a Thread Pool',                      priority: 'high',   solutionFile: 'Solution-Thread-Pool.md', youtubeId: '3HE8D9g9QNE' },
      { id: 'lld-cp-producer-consumer', title: 'Producer-Consumer with Bounded Buffer',     priority: 'high',   solutionFile: 'Solution-Producer-Consumer.md', youtubeId: 'A1tnVMpWHh8' },
      { id: 'lld-cp-connection-pool',   title: 'Design a Connection Pool',                  priority: 'high',   solutionFile: 'Solution-Connection-Pool.md' },
      { id: 'lld-cp-rw-lock',           title: 'Readers-Writers Lock Implementation',       priority: 'medium', solutionFile: 'Solution-RW-Lock.md', youtubeId: '7VqWkc9o7RM' },
    ],
  },
  {
    id: 'lld-extra-problems',
    title: 'Additional Machine Coding Problems',
    topics: [
      { id: 'lld-api-rate-limiter',      title: 'Design an API Rate Limiter',                           priority: 'high',   solutionFile: 'Solution-API-Rate-Limiter.md', youtubeId: 'PJ-c0QI-QCk' },
      { id: 'lld-in-memory-cache',       title: 'Design an In-Memory Cache (with Eviction Policies)',   priority: 'high',   solutionFile: 'Solution-In-Memory-Cache.md', youtubeId: 'IaDU8_KjrpY' },
      { id: 'lld-distributed-id',        title: 'Design Distributed ID Generation (Twitter Snowflake)', priority: 'high',   solutionFile: 'Solution-Distributed-ID.md', youtubeId: '2Et6unrGoQM' },
      { id: 'lld-json-parser',           title: 'Design a JSON Parser from Scratch',                    priority: 'medium', solutionFile: 'Solution-JSON-Parser.md' },
      { id: 'lld-truecaller',            title: 'Design Truecaller',                                    priority: 'medium', solutionFile: 'Solution-Truecaller.md', youtubeId: 'ZtN2ZtxpfgA' },
      { id: 'lld-amazon-locker',         title: 'Design Amazon Locker Service',                         priority: 'medium', solutionFile: 'Solution-Amazon-Locker.md', youtubeId: '_V191nQYp4g' },
      { id: 'lld-jira',                  title: 'Design a System like Jira',                            priority: 'medium', solutionFile: 'Solution-Jira.md' },
      { id: 'lld-card-game',             title: 'Design an Online Card Game (e.g. Poker)',              priority: 'low',    solutionFile: 'Solution-Card-Game.md', youtubeId: 'PbOSdbd2q-M' },
      { id: 'lld-finite-state-machine',  title: 'Implement a Finite State Machine',                    priority: 'low',    solutionFile: 'Solution-FSM.md', youtubeId: 'hHaGYyKwRXY' },
      { id: 'lld-e-commerce-review',     title: 'Design an e-Commerce Review System',                  priority: 'low',    solutionFile: 'Solution-ECommerce-Review.md', youtubeId: 'pQQTy05sv5Q' },
      { id: 'lld-in-memory-db',          title: 'Design an In-Memory Database with Indexing',          priority: 'medium', solutionFile: 'Solution-In-Memory-DB.md' },
      { id: 'lld-config-management',     title: 'Design a Configuration Management System',            priority: 'low',    solutionFile: 'Solution-Config-Management.md' },
      { id: 'lld-home-automation',       title: 'Design a Home Automation System',                     priority: 'low',    solutionFile: 'Solution-Home-Automation.md' },
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
  { id: 'ood-hashmap',       title: 'Design a Hash Map',                          priority: 'high',   solutionFile: 'Solution-OOD-Hashmap.md' },
  { id: 'ood-lru-cache',     title: 'Design a Least Recently Used (LRU) Cache',   priority: 'high',   solutionFile: 'Solution-OOD-LRU-Cache.md', youtubeId: 'z9bJUPxzFOw' },
  { id: 'ood-call-center',   title: 'Design a Call Center',                       priority: 'medium', solutionFile: 'Solution-OOD-Call-Center.md', youtubeId: 'kflabSxyfCk' },
  { id: 'ood-deck-of-cards', title: 'Design a Deck of Cards',                     priority: 'medium', solutionFile: 'Solution-OOD-Deck-Of-Cards.md', youtubeId: 'yENwNPu2Obo' },
  { id: 'ood-parking-lot',   title: 'Design a Parking Lot',                       priority: 'high',   solutionFile: 'Solution-OOD-Parking-Lot.md', youtubeId: 'kzfrbkDcYjA' },
  { id: 'ood-chat-server',   title: 'Design a Chat Server',                       priority: 'medium', solutionFile: 'Solution-OOD-Chat-Server.md', youtubeId: 'pjYd8kUYHeE' },
  { id: 'ood-circular-array', title: 'Design a Circular Array',                   priority: 'low',    solutionFile: 'Solution-OOD-Circular-Array.md' },
];
