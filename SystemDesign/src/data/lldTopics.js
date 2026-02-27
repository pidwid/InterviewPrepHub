// Merged from:
// - https://github.com/ashishps1/awesome-low-level-design
// - https://github.com/prasadgujar/low-level-design-primer
//
// All URLs sourced directly from the README links in each repo.

const ALGOMASTER = 'https://algomaster.io/learn/lld';
const ALGOMASTER_CONCURRENCY = 'https://algomaster.io/learn/concurrency-interview';
const AWESOME_LLD = 'https://github.com/ashishps1/awesome-low-level-design';
const AWESOME_PROBLEMS = `${AWESOME_LLD}/blob/main/problems`;
const AWESOME_SOLUTIONS = `${AWESOME_LLD}/tree/main/solutions/python`;
const PRASAD = 'https://github.com/prasadgujar/low-level-design-primer/blob/master';

export const LLD_CATEGORIES = [
  {
    id: 'lld-oop-fundamentals',
    title: 'OOP Fundamentals',
    topics: [
      { id: 'lld-classes-objects',  title: 'Classes and Objects', url: `${ALGOMASTER}/classes-and-objects` },
      { id: 'lld-enums',            title: 'Enums',               url: `${ALGOMASTER}/enums` },
      { id: 'lld-interfaces',       title: 'Interfaces',          url: `${ALGOMASTER}/interfaces` },
      { id: 'lld-encapsulation',    title: 'Encapsulation',       url: `${ALGOMASTER}/encapsulation` },
      { id: 'lld-abstraction',      title: 'Abstraction',         url: `${ALGOMASTER}/abstraction` },
      { id: 'lld-inheritance',      title: 'Inheritance',         url: `${ALGOMASTER}/inheritance` },
      { id: 'lld-polymorphism',     title: 'Polymorphism',        url: `${ALGOMASTER}/polymorphism` },
    ],
  },
  {
    id: 'lld-class-relationships',
    title: 'Class Relationships',
    topics: [
      { id: 'lld-association',  title: 'Association',  url: `${ALGOMASTER}/association` },
      { id: 'lld-aggregation',  title: 'Aggregation',  url: `${ALGOMASTER}/aggregation` },
      { id: 'lld-composition',  title: 'Composition',  url: `${ALGOMASTER}/composition` },
      { id: 'lld-dependency',   title: 'Dependency',   url: `${ALGOMASTER}/dependency` },
    ],
  },
  {
    id: 'lld-design-principles',
    title: 'Design Principles',
    topics: [
      { id: 'lld-dry',          title: 'DRY Principle',                  url: `${ALGOMASTER}/dry` },
      { id: 'lld-yagni',        title: 'YAGNI Principle',                url: `${ALGOMASTER}/yagni` },
      { id: 'lld-kiss',         title: 'KISS Principle',                 url: `${ALGOMASTER}/kiss` },
      { id: 'lld-solid-pictures', title: 'SOLID Principles (with Pictures)', url: 'https://medium.com/backticks-tildes/the-s-o-l-i-d-principles-in-pictures-b34ce2f1e898' },
      { id: 'lld-solid-code',   title: 'SOLID Principles (with Code)',   url: 'https://blog.algomaster.io/p/solid-principles-explained-with-code' },
    ],
  },
  {
    id: 'lld-uml',
    title: 'UML Diagrams',
    topics: [
      { id: 'lld-class-diagram',         title: 'Class Diagram',         url: `${ALGOMASTER}/class-diagram` },
      { id: 'lld-use-case-diagram',      title: 'Use Case Diagram',      url: `${ALGOMASTER}/use-case-diagram` },
      { id: 'lld-sequence-diagram',      title: 'Sequence Diagram',      url: `${ALGOMASTER}/sequence-diagram` },
      { id: 'lld-activity-diagram',      title: 'Activity Diagram',      url: `${ALGOMASTER}/activity-diagram` },
      { id: 'lld-state-machine-diagram', title: 'State Machine Diagram', url: `${ALGOMASTER}/state-machine-diagram` },
    ],
  },
  {
    id: 'lld-creational-patterns',
    title: 'Creational Design Patterns',
    topics: [
      { id: 'lld-singleton',       title: 'Singleton',       url: `${ALGOMASTER}/singleton` },
      { id: 'lld-factory-method',  title: 'Factory Method',  url: `${ALGOMASTER}/factory-method` },
      { id: 'lld-abstract-factory', title: 'Abstract Factory', url: `${ALGOMASTER}/abstract-factory` },
      { id: 'lld-builder',         title: 'Builder',         url: `${ALGOMASTER}/builder` },
      { id: 'lld-prototype',       title: 'Prototype',       url: `${ALGOMASTER}/prototype` },
    ],
  },
  {
    id: 'lld-structural-patterns',
    title: 'Structural Design Patterns',
    topics: [
      { id: 'lld-adapter',    title: 'Adapter',    url: `${ALGOMASTER}/adapter` },
      { id: 'lld-bridge',     title: 'Bridge',     url: `${ALGOMASTER}/bridge` },
      { id: 'lld-composite',  title: 'Composite',  url: `${ALGOMASTER}/composite` },
      { id: 'lld-decorator',  title: 'Decorator',  url: `${ALGOMASTER}/decorator` },
      { id: 'lld-facade',     title: 'Facade',     url: `${ALGOMASTER}/facade` },
      { id: 'lld-flyweight',  title: 'Flyweight',  url: `${ALGOMASTER}/flyweight` },
      { id: 'lld-proxy',      title: 'Proxy',      url: `${ALGOMASTER}/proxy` },
    ],
  },
  {
    id: 'lld-behavioral-patterns',
    title: 'Behavioral Design Patterns',
    topics: [
      { id: 'lld-iterator',               title: 'Iterator',               url: `${ALGOMASTER}/iterator` },
      { id: 'lld-observer',               title: 'Observer',               url: `${ALGOMASTER}/observer` },
      { id: 'lld-strategy',               title: 'Strategy',               url: `${ALGOMASTER}/strategy` },
      { id: 'lld-state',                  title: 'State',                  url: `${ALGOMASTER}/state` },
      { id: 'lld-template-method',        title: 'Template Method',        url: `${ALGOMASTER}/template-method` },
      { id: 'lld-visitor',                title: 'Visitor',                url: `${ALGOMASTER}/visitor` },
      { id: 'lld-mediator',               title: 'Mediator',               url: `${ALGOMASTER}/mediator` },
      { id: 'lld-memento',                title: 'Memento',                url: `${ALGOMASTER}/memento` },
      { id: 'lld-chain-of-responsibility', title: 'Chain of Responsibility', url: `${ALGOMASTER}/chain-of-responsibility` },
      { id: 'lld-command',                title: 'Command',                url: `${ALGOMASTER}/command` },
    ],
  },
  {
    id: 'lld-concurrency',
    title: 'Concurrency and Multi-threading',
    topics: [
      { id: 'lld-concurrency-intro',         title: 'Introduction to Concurrency',          url: `${ALGOMASTER_CONCURRENCY}/introduction-to-concurrency` },
      { id: 'lld-concurrency-vs-parallelism', title: 'Concurrency vs Parallelism',           url: `${ALGOMASTER_CONCURRENCY}/concurrency-vs-parallelism` },
      { id: 'lld-processes-vs-threads',       title: 'Processes vs Threads',                 url: `${ALGOMASTER_CONCURRENCY}/processes-vs-threads` },
      { id: 'lld-thread-lifecycle',           title: 'Thread Lifecycle and States',          url: `${ALGOMASTER_CONCURRENCY}/thread-lifecycle-and-states` },
      { id: 'lld-race-conditions',            title: 'Race Conditions and Critical Sections', url: `${ALGOMASTER_CONCURRENCY}/race-conditions-and-critical-sections` },
      { id: 'lld-mutex',                      title: 'Mutex (Mutual Exclusion)',             url: `${ALGOMASTER_CONCURRENCY}/mutex` },
      { id: 'lld-semaphores',                 title: 'Semaphores',                           url: `${ALGOMASTER_CONCURRENCY}/semaphores` },
      { id: 'lld-condition-variables',        title: 'Condition Variables',                  url: `${ALGOMASTER_CONCURRENCY}/condition-variables` },
      { id: 'lld-coarse-fine-locking',        title: 'Coarse-grained vs Fine-grained Locking', url: `${ALGOMASTER_CONCURRENCY}/coarse-vs-fine-grained-locking` },
      { id: 'lld-reentrant-locks',            title: 'Reentrant Locks',                      url: `${ALGOMASTER_CONCURRENCY}/reentrant-locks` },
      { id: 'lld-try-lock',                   title: 'Try-Lock and Timed Locking',           url: `${ALGOMASTER_CONCURRENCY}/try-lock-and-timed-locking` },
      { id: 'lld-cas',                        title: 'Compare-and-Swap (CAS)',               url: `${ALGOMASTER_CONCURRENCY}/compare-and-swap` },
      { id: 'lld-deadlock',                   title: 'Deadlock',                             url: `${ALGOMASTER_CONCURRENCY}/deadlock` },
      { id: 'lld-livelock',                   title: 'Livelock',                             url: `${ALGOMASTER_CONCURRENCY}/livelock` },
      { id: 'lld-signaling-pattern',          title: 'Signaling Pattern',                    url: `${ALGOMASTER_CONCURRENCY}/signaling-pattern` },
      { id: 'lld-thread-pool',                title: 'Thread Pool Pattern',                  url: `${ALGOMASTER_CONCURRENCY}/thread-pool-pattern` },
      { id: 'lld-producer-consumer',          title: 'Producer-Consumer Pattern',            url: `${ALGOMASTER_CONCURRENCY}/producer-consumer-pattern` },
      { id: 'lld-reader-writer',              title: 'Reader-Writer Pattern',                url: `${ALGOMASTER_CONCURRENCY}/reader-writer-pattern` },
    ],
  },
  {
    id: 'lld-problems-easy',
    title: 'LLD Problems — Easy',
    topics: [
      { id: 'lld-parking-lot',      title: 'Design Parking Lot',                url: `${AWESOME_PROBLEMS}/parking-lot.md`,             solutionUrl: `${AWESOME_SOLUTIONS}/parking-lot` },
      { id: 'lld-stack-overflow',   title: 'Design Stack Overflow',             url: `${AWESOME_PROBLEMS}/stack-overflow.md`,          solutionUrl: `${AWESOME_SOLUTIONS}/stack-overflow` },
      { id: 'lld-vending-machine',  title: 'Design a Vending Machine',          url: `${AWESOME_PROBLEMS}/vending-machine.md`,         solutionUrl: `${AWESOME_SOLUTIONS}/vending-machine` },
      { id: 'lld-logging-framework', title: 'Design Logging Framework',         url: `${AWESOME_PROBLEMS}/logging-framework.md`,       solutionUrl: `${AWESOME_SOLUTIONS}/logging-framework` },
      { id: 'lld-traffic-signal',   title: 'Design Traffic Signal Control System', url: `${AWESOME_PROBLEMS}/traffic-signal.md`,       solutionUrl: `${AWESOME_SOLUTIONS}/traffic-signal-system` },
      { id: 'lld-coffee-vending',   title: 'Design Coffee Vending Machine',     url: `${AWESOME_PROBLEMS}/coffee-vending-machine.md`,  solutionUrl: `${AWESOME_SOLUTIONS}/coffee-vending-machine` },
      { id: 'lld-task-management',  title: 'Design a Task Management System',   url: `${AWESOME_PROBLEMS}/task-management-system.md`,  solutionUrl: `${AWESOME_SOLUTIONS}/task-management-system` },
    ],
  },
  {
    id: 'lld-problems-medium',
    title: 'LLD Problems — Medium',
    topics: [
      { id: 'lld-atm',              title: 'Design ATM',                           url: `${AWESOME_PROBLEMS}/atm.md`,                       solutionUrl: `${AWESOME_SOLUTIONS}/atm` },
      { id: 'lld-linkedin',         title: 'Design LinkedIn',                      url: `${AWESOME_PROBLEMS}/linkedin.md`,                  solutionUrl: `${AWESOME_SOLUTIONS}/linkedin` },
      { id: 'lld-lru-cache',        title: 'Design LRU Cache',                     url: `${AWESOME_PROBLEMS}/lru-cache.md`,                 solutionUrl: `${AWESOME_SOLUTIONS}/lru-cache` },
      { id: 'lld-tic-tac-toe',      title: 'Design Tic Tac Toe Game',              url: `${AWESOME_PROBLEMS}/tic-tac-toe.md`,               solutionUrl: `${AWESOME_SOLUTIONS}/tic-tac-toe` },
      { id: 'lld-pub-sub',          title: 'Design Pub Sub System',                url: `${AWESOME_PROBLEMS}/pub-sub-system.md`,            solutionUrl: `${AWESOME_SOLUTIONS}/pub-sub-system` },
      { id: 'lld-elevator',         title: 'Design an Elevator System',            url: `${AWESOME_PROBLEMS}/elevator-system.md`,           solutionUrl: `${AWESOME_SOLUTIONS}/elevator-system` },
      { id: 'lld-car-rental',       title: 'Design Car Rental System',             url: `${AWESOME_PROBLEMS}/car-rental-system.md`,         solutionUrl: `${AWESOME_SOLUTIONS}/car-rental-system` },
      { id: 'lld-online-auction',   title: 'Design an Online Auction System',      url: `${AWESOME_PROBLEMS}/online-auction-system.md`,     solutionUrl: `${AWESOME_SOLUTIONS}/online-auction-system` },
      { id: 'lld-hotel-management', title: 'Design Hotel Management System',       url: `${AWESOME_PROBLEMS}/hotel-management-system.md`,   solutionUrl: `${AWESOME_SOLUTIONS}/hotel-management-system` },
      { id: 'lld-digital-wallet',   title: 'Design a Digital Wallet Service',      url: `${AWESOME_PROBLEMS}/digital-wallet-service.md`,    solutionUrl: `${AWESOME_SOLUTIONS}/digital-wallet-service` },
      { id: 'lld-airline',          title: 'Design Airline Management System',     url: `${AWESOME_PROBLEMS}/airline-management-system.md`, solutionUrl: `${AWESOME_SOLUTIONS}/airline-management-system` },
      { id: 'lld-library',          title: 'Design a Library Management System',   url: `${AWESOME_PROBLEMS}/library-management-system.md`, solutionUrl: `${AWESOME_SOLUTIONS}/library-management-system` },
      { id: 'lld-social-network',   title: 'Design a Social Network like Facebook', url: `${AWESOME_PROBLEMS}/social-networking-service.md`, solutionUrl: `${AWESOME_SOLUTIONS}/social-networking-service` },
      { id: 'lld-restaurant',       title: 'Design Restaurant Management System',  url: `${AWESOME_PROBLEMS}/restaurant-management-system.md`, solutionUrl: `${AWESOME_SOLUTIONS}/restaurant-management-system` },
      { id: 'lld-concert-booking',  title: 'Design a Concert Ticket Booking System', url: `${AWESOME_PROBLEMS}/concert-ticket-booking-system.md`, solutionUrl: `${AWESOME_SOLUTIONS}/concert-ticket-booking-system` },
    ],
  },
  {
    id: 'lld-problems-hard',
    title: 'LLD Problems — Hard',
    topics: [
      { id: 'lld-cricinfo',          title: 'Design CricInfo',                           url: `${AWESOME_PROBLEMS}/cricinfo.md`,                    solutionUrl: `${AWESOME_SOLUTIONS}/cricinfo` },
      { id: 'lld-splitwise',         title: 'Design Splitwise',                          url: `${AWESOME_PROBLEMS}/splitwise.md`,                   solutionUrl: `${AWESOME_SOLUTIONS}/splitwise` },
      { id: 'lld-chess',             title: 'Design Chess Game',                         url: `${AWESOME_PROBLEMS}/chess-game.md`,                  solutionUrl: `${AWESOME_SOLUTIONS}/chess-game` },
      { id: 'lld-snake-ladder',      title: 'Design a Snake and Ladder game',            url: `${AWESOME_PROBLEMS}/snake-and-ladder.md`,            solutionUrl: `${AWESOME_SOLUTIONS}/snake-and-ladder` },
      { id: 'lld-ride-sharing',      title: 'Design Ride-Sharing Service like Uber',     url: `${AWESOME_PROBLEMS}/ride-sharing-service.md`,        solutionUrl: `${AWESOME_SOLUTIONS}/ride-sharing-service` },
      { id: 'lld-course-registration', title: 'Design Course Registration System',       url: `${AWESOME_PROBLEMS}/course-registration-system.md`,  solutionUrl: `${AWESOME_SOLUTIONS}/course-registration-system` },
      { id: 'lld-movie-booking',     title: 'Design Movie Ticket Booking System',        url: `${AWESOME_PROBLEMS}/movie-ticket-booking-system.md`, solutionUrl: `${AWESOME_SOLUTIONS}/movie-ticket-booking-system` },
      { id: 'lld-amazon',            title: 'Design Online Shopping System like Amazon', url: `${AWESOME_PROBLEMS}/online-shopping-service.md`,     solutionUrl: `${AWESOME_SOLUTIONS}/online-shopping-service` },
      { id: 'lld-stock-brokerage',   title: 'Design Online Stock Brokerage System',      url: `${AWESOME_PROBLEMS}/online-stock-brokerage-system.md`, solutionUrl: `${AWESOME_SOLUTIONS}/online-stock-brokerage-system` },
      { id: 'lld-spotify',           title: 'Design Music Streaming Service like Spotify', url: `${AWESOME_PROBLEMS}/music-streaming-service.md`,   solutionUrl: `${AWESOME_SOLUTIONS}/music-streaming-service` },
      { id: 'lld-food-delivery',     title: 'Design Online Food Delivery Service like Swiggy', url: `${AWESOME_PROBLEMS}/food-delivery-service.md`, solutionUrl: `${AWESOME_SOLUTIONS}/food-delivery-service` },
    ],
  },
  {
    id: 'lld-concurrency-problems',
    title: 'Concurrency Problems',
    topics: [
      { id: 'lld-cp-foobar',             title: 'Print FooBar Alternately',          url: `${ALGOMASTER_CONCURRENCY}/print-foobar-alternately` },
      { id: 'lld-cp-zero-even-odd',       title: 'Print Zero Even Odd',              url: `${ALGOMASTER_CONCURRENCY}/print-zero-even-odd` },
      { id: 'lld-cp-fizzbuzz',            title: 'Fizz Buzz Multithreaded',          url: `${ALGOMASTER_CONCURRENCY}/fizz-buzz-multithreaded` },
      { id: 'lld-cp-h2o',                 title: 'Building H2O Molecule',            url: `${ALGOMASTER_CONCURRENCY}/building-h2o` },
      { id: 'lld-cp-ttl-cache',           title: 'Design Thread-Safe Cache with TTL', url: `${ALGOMASTER_CONCURRENCY}/design-thread-safe-cache-with-ttl` },
      { id: 'lld-cp-concurrent-hashmap',  title: 'Design Concurrent HashMap',        url: `${ALGOMASTER_CONCURRENCY}/design-concurrent-hashmap` },
      { id: 'lld-cp-blocking-queue',      title: 'Design Thread-Safe Blocking Queue', url: `${ALGOMASTER_CONCURRENCY}/design-thread-safe-blocking-queue` },
      { id: 'lld-cp-bloom-filter',        title: 'Design Concurrent Bloom Filter',   url: `${ALGOMASTER_CONCURRENCY}/design-concurrent-bloom-filter` },
      { id: 'lld-cp-merge-sort',          title: 'Multi-threaded Merge Sort',        url: `${ALGOMASTER_CONCURRENCY}/multi-threaded-merge-sort` },
    ],
  },
  {
    id: 'lld-prasad-extra',
    title: 'Additional Machine Coding Problems',
    topics: [
      { id: 'lld-truecaller',         title: 'Design Truecaller',                               url: `${PRASAD}/questions.md`, solutionUrl: 'https://github.com/gopalbala/truecaller' },
      { id: 'lld-card-game',          title: 'Design an Online Card Game (e.g. Poker)',          url: `${PRASAD}/questions.md` },
      { id: 'lld-ride-sharing-2',     title: 'Design a Ride Sharing App (collision resolution)', url: `${PRASAD}/questions.md`, solutionUrl: 'https://github.com/anomaly2104/lld-cab-booking-ola-uber-grab-lyft' },
      { id: 'lld-jira',               title: 'Design a System like Jira',                       url: `${PRASAD}/questions.md` },
      { id: 'lld-amazon-locker',       title: 'Design Amazon Locker Service',                    url: `${PRASAD}/solutions.md`, solutionUrl: 'https://github.com/gopalbala/amazonlocker' },
      { id: 'lld-bill-sharing',        title: 'Design Bill/Expense Sharing like Splitwise',      url: `${PRASAD}/solutions.md`, solutionUrl: 'https://github.com/gopalbala/billsharing' },
      { id: 'lld-distributed-id',      title: 'Design Distributed ID Generation like Twitter Snowflake', url: `${PRASAD}/solutions.md`, solutionUrl: 'https://github.com/gopalbala/distributed-idgen' },
      { id: 'lld-api-rate-limiter',    title: 'Design an API Rate Limiter',                     url: `${PRASAD}/questions.md` },
      { id: 'lld-json-parser',         title: 'Design a JSON Parser from Scratch',              url: `${PRASAD}/solutions.md` },
      { id: 'lld-in-memory-cache',     title: 'Design an In-Memory Cache (with eviction policies)', url: `${PRASAD}/questions.md`, solutionUrl: 'https://github.com/anomaly2104/cache-low-level-system-design' },
      { id: 'lld-finite-state-machine', title: 'Implement a Finite State Machine',             url: `${PRASAD}/questions.md` },
      { id: 'lld-e-commerce-review',   title: 'Design an e-Commerce Review System',            url: `${PRASAD}/solutions.md`, solutionUrl: 'https://github.com/gopalbala/reviews' },
    ],
  },
];

export const ALL_LLD_TOPICS = LLD_CATEGORIES.flatMap((c) => c.topics);
