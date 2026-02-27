// All topics from https://github.com/donnemartin/system-design-primer
// Status values: 'not_started' | 'revise' | 'done'

export const CATEGORIES = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    topics: [
      { id: 'performance-vs-scalability', title: 'Performance vs Scalability', url: 'https://github.com/donnemartin/system-design-primer#performance-vs-scalability' },
      { id: 'latency-vs-throughput', title: 'Latency vs Throughput', url: 'https://github.com/donnemartin/system-design-primer#latency-vs-throughput' },
      { id: 'availability-vs-consistency', title: 'Availability vs Consistency', url: 'https://github.com/donnemartin/system-design-primer#availability-vs-consistency' },
      { id: 'cap-theorem', title: 'CAP Theorem', url: 'https://github.com/donnemartin/system-design-primer#cap-theorem' },
      { id: 'cap-cp', title: 'CAP: CP - Consistency & Partition Tolerance', url: 'https://github.com/donnemartin/system-design-primer#cp---consistency-and-partition-tolerance' },
      { id: 'cap-ap', title: 'CAP: AP - Availability & Partition Tolerance', url: 'https://github.com/donnemartin/system-design-primer#ap---availability-and-partition-tolerance' },
    ],
  },
  {
    id: 'consistency',
    title: 'Consistency Patterns',
    topics: [
      { id: 'weak-consistency', title: 'Weak Consistency', url: 'https://github.com/donnemartin/system-design-primer#weak-consistency' },
      { id: 'eventual-consistency', title: 'Eventual Consistency', url: 'https://github.com/donnemartin/system-design-primer#eventual-consistency' },
      { id: 'strong-consistency', title: 'Strong Consistency', url: 'https://github.com/donnemartin/system-design-primer#strong-consistency' },
    ],
  },
  {
    id: 'availability',
    title: 'Availability Patterns',
    topics: [
      { id: 'failover-active-passive', title: 'Fail-over: Active-Passive', url: 'https://github.com/donnemartin/system-design-primer#active-passive' },
      { id: 'failover-active-active', title: 'Fail-over: Active-Active', url: 'https://github.com/donnemartin/system-design-primer#active-active' },
      { id: 'replication', title: 'Replication', url: 'https://github.com/donnemartin/system-design-primer#availability-patterns' },
      { id: 'availability-numbers', title: 'Availability in Numbers (99.9%, 99.99%)', url: 'https://github.com/donnemartin/system-design-primer#availability-in-numbers' },
    ],
  },
  {
    id: 'dns-cdn',
    title: 'DNS & CDN',
    topics: [
      { id: 'dns', title: 'Domain Name System (DNS)', url: 'https://github.com/donnemartin/system-design-primer#domain-name-system' },
      { id: 'cdn', title: 'Content Delivery Network (CDN)', url: 'https://github.com/donnemartin/system-design-primer#content-delivery-network' },
      { id: 'cdn-push', title: 'CDN: Push', url: 'https://github.com/donnemartin/system-design-primer#push-cdns' },
      { id: 'cdn-pull', title: 'CDN: Pull', url: 'https://github.com/donnemartin/system-design-primer#pull-cdns' },
    ],
  },
  {
    id: 'load-balancing',
    title: 'Load Balancing & Proxies',
    topics: [
      { id: 'load-balancer', title: 'Load Balancer', url: 'https://github.com/donnemartin/system-design-primer#load-balancer' },
      { id: 'lb-layer4', title: 'Layer 4 Load Balancing', url: 'https://github.com/donnemartin/system-design-primer#layer-4-load-balancing' },
      { id: 'lb-layer7', title: 'Layer 7 Load Balancing', url: 'https://github.com/donnemartin/system-design-primer#layer-7-load-balancing' },
      { id: 'lb-horizontal-scaling', title: 'Horizontal Scaling', url: 'https://github.com/donnemartin/system-design-primer#horizontal-scaling' },
      { id: 'reverse-proxy', title: 'Reverse Proxy (Web Server)', url: 'https://github.com/donnemartin/system-design-primer#reverse-proxy-web-server' },
      { id: 'lb-vs-reverse-proxy', title: 'Load Balancer vs Reverse Proxy', url: 'https://github.com/donnemartin/system-design-primer#load-balancer-vs-reverse-proxy' },
    ],
  },
  {
    id: 'application-layer',
    title: 'Application Layer',
    topics: [
      { id: 'microservices', title: 'Microservices', url: 'https://github.com/donnemartin/system-design-primer#microservices' },
      { id: 'service-discovery', title: 'Service Discovery', url: 'https://github.com/donnemartin/system-design-primer#service-discovery' },
    ],
  },
  {
    id: 'databases',
    title: 'Databases',
    topics: [
      { id: 'rdbms', title: 'Relational Database (RDBMS)', url: 'https://github.com/donnemartin/system-design-primer#relational-database-management-system-rdbms' },
      { id: 'master-slave-replication', title: 'Master-Slave Replication', url: 'https://github.com/donnemartin/system-design-primer#master-slave-replication' },
      { id: 'master-master-replication', title: 'Master-Master Replication', url: 'https://github.com/donnemartin/system-design-primer#master-master-replication' },
      { id: 'federation', title: 'Federation', url: 'https://github.com/donnemartin/system-design-primer#federation' },
      { id: 'sharding', title: 'Sharding', url: 'https://github.com/donnemartin/system-design-primer#sharding' },
      { id: 'denormalization', title: 'Denormalization', url: 'https://github.com/donnemartin/system-design-primer#denormalization' },
      { id: 'sql-tuning', title: 'SQL Tuning', url: 'https://github.com/donnemartin/system-design-primer#sql-tuning' },
      { id: 'nosql', title: 'NoSQL', url: 'https://github.com/donnemartin/system-design-primer#nosql' },
      { id: 'key-value-store', title: 'NoSQL: Key-Value Store', url: 'https://github.com/donnemartin/system-design-primer#key-value-store' },
      { id: 'document-store', title: 'NoSQL: Document Store', url: 'https://github.com/donnemartin/system-design-primer#document-store' },
      { id: 'wide-column-store', title: 'NoSQL: Wide Column Store', url: 'https://github.com/donnemartin/system-design-primer#wide-column-store' },
      { id: 'graph-database', title: 'NoSQL: Graph Database', url: 'https://github.com/donnemartin/system-design-primer#graph-database' },
      { id: 'sql-vs-nosql', title: 'SQL or NoSQL', url: 'https://github.com/donnemartin/system-design-primer#sql-or-nosql' },
    ],
  },
  {
    id: 'cache',
    title: 'Caching',
    topics: [
      { id: 'client-caching', title: 'Client Caching', url: 'https://github.com/donnemartin/system-design-primer#client-caching' },
      { id: 'cdn-caching', title: 'CDN Caching', url: 'https://github.com/donnemartin/system-design-primer#cdn-caching' },
      { id: 'web-server-caching', title: 'Web Server Caching', url: 'https://github.com/donnemartin/system-design-primer#web-server-caching' },
      { id: 'database-caching', title: 'Database Caching', url: 'https://github.com/donnemartin/system-design-primer#database-caching' },
      { id: 'application-caching', title: 'Application Caching', url: 'https://github.com/donnemartin/system-design-primer#application-caching' },
      { id: 'cache-aside', title: 'Cache Strategy: Cache-Aside', url: 'https://github.com/donnemartin/system-design-primer#cache-aside' },
      { id: 'write-through', title: 'Cache Strategy: Write-Through', url: 'https://github.com/donnemartin/system-design-primer#write-through' },
      { id: 'write-behind', title: 'Cache Strategy: Write-Behind (Write-Back)', url: 'https://github.com/donnemartin/system-design-primer#write-behind-write-back' },
      { id: 'refresh-ahead', title: 'Cache Strategy: Refresh-Ahead', url: 'https://github.com/donnemartin/system-design-primer#refresh-ahead' },
    ],
  },
  {
    id: 'asynchronism',
    title: 'Asynchronism',
    topics: [
      { id: 'message-queues', title: 'Message Queues', url: 'https://github.com/donnemartin/system-design-primer#message-queues' },
      { id: 'task-queues', title: 'Task Queues', url: 'https://github.com/donnemartin/system-design-primer#task-queues' },
      { id: 'back-pressure', title: 'Back Pressure', url: 'https://github.com/donnemartin/system-design-primer#back-pressure' },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    topics: [
      { id: 'tcp', title: 'Transmission Control Protocol (TCP)', url: 'https://github.com/donnemartin/system-design-primer#transmission-control-protocol-tcp' },
      { id: 'udp', title: 'User Datagram Protocol (UDP)', url: 'https://github.com/donnemartin/system-design-primer#user-datagram-protocol-udp' },
      { id: 'rpc', title: 'Remote Procedure Call (RPC)', url: 'https://github.com/donnemartin/system-design-primer#remote-procedure-call-rpc' },
      { id: 'rest', title: 'Representational State Transfer (REST)', url: 'https://github.com/donnemartin/system-design-primer#representational-state-transfer-rest' },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    topics: [
      { id: 'security', title: 'Security Overview', url: 'https://github.com/donnemartin/system-design-primer#security' },
    ],
  },
  {
    id: 'interview-approach',
    title: 'Interview Approach',
    topics: [
      { id: 'outline-use-cases', title: 'Step 1: Outline Use Cases, Constraints & Assumptions', url: 'https://github.com/donnemartin/system-design-primer#step-1-outline-use-cases-constraints-and-assumptions' },
      { id: 'high-level-design', title: 'Step 2: Create a High Level Design', url: 'https://github.com/donnemartin/system-design-primer#step-2-create-a-high-level-design' },
      { id: 'core-components', title: 'Step 3: Design Core Components', url: 'https://github.com/donnemartin/system-design-primer#step-3-design-core-components' },
      { id: 'scale-design', title: 'Step 4: Scale the Design', url: 'https://github.com/donnemartin/system-design-primer#step-4-scale-the-design' },
      { id: 'back-of-envelope', title: 'Back-of-the-Envelope Calculations', url: 'https://github.com/donnemartin/system-design-primer#back-of-the-envelope-calculations' },
    ],
  },
  {
    id: 'system-design-questions',
    title: 'System Design Questions (with Solutions)',
    topics: [
      { id: 'q-pastebin', title: 'Design Pastebin.com (or Bit.ly)', url: 'https://github.com/donnemartin/system-design-primer#design-pastebincom-or-bitly', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md' },
      { id: 'q-twitter-timeline', title: 'Design Twitter Timeline & Search', url: 'https://github.com/donnemartin/system-design-primer#design-the-twitter-timeline-and-search-or-facebook-feed-and-search', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/twitter/README.md' },
      { id: 'q-web-crawler', title: 'Design a Web Crawler', url: 'https://github.com/donnemartin/system-design-primer#design-a-web-crawler', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/web_crawler/README.md' },
      { id: 'q-mint', title: 'Design Mint.com', url: 'https://github.com/donnemartin/system-design-primer#design-mintcom', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md' },
      { id: 'q-social-network', title: 'Design Data Structures for a Social Network', url: 'https://github.com/donnemartin/system-design-primer#design-the-data-structures-for-a-social-network', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/social_graph/README.md' },
      { id: 'q-key-value-search', title: 'Design a Key-Value Store for a Search Engine', url: 'https://github.com/donnemartin/system-design-primer#design-a-key-value-store-for-a-search-engine', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/query_cache/README.md' },
      { id: 'q-amazon-sales', title: "Design Amazon's Sales Ranking by Category", url: 'https://github.com/donnemartin/system-design-primer#design-amazons-sales-ranking-by-category-feature', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/sales_rank/README.md' },
      { id: 'q-aws-scale', title: 'Design a System that Scales to Millions of Users on AWS', url: 'https://github.com/donnemartin/system-design-primer#design-a-system-that-scales-to-millions-of-users-on-aws', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/scaling_aws/README.md' },
    ],
  },
  {
    id: 'ood-questions',
    title: 'Object-Oriented Design Questions',
    topics: [
      { id: 'ood-hashmap', title: 'Design a Hash Map', url: 'https://github.com/donnemartin/system-design-primer#design-a-hash-map', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/hash_table/hash_map.ipynb' },
      { id: 'ood-lru-cache', title: 'Design a Least Recently Used (LRU) Cache', url: 'https://github.com/donnemartin/system-design-primer#design-a-least-recently-used-cache', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/lru_cache/lru_cache.ipynb' },
      { id: 'ood-call-center', title: 'Design a Call Center', url: 'https://github.com/donnemartin/system-design-primer#design-a-call-center', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/call_center/call_center.ipynb' },
      { id: 'ood-deck-of-cards', title: 'Design a Deck of Cards', url: 'https://github.com/donnemartin/system-design-primer#design-a-deck-of-cards', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/deck_of_cards/deck_of_cards.ipynb' },
      { id: 'ood-parking-lot', title: 'Design a Parking Lot', url: 'https://github.com/donnemartin/system-design-primer#design-a-parking-lot', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/parking_lot/parking_lot.ipynb' },
      { id: 'ood-chat-server', title: 'Design a Chat Server', url: 'https://github.com/donnemartin/system-design-primer#design-a-chat-server', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/online_chat/online_chat.ipynb' },
      { id: 'ood-circular-array', title: 'Design a Circular Array', url: 'https://github.com/donnemartin/system-design-primer#design-a-circular-array', solutionUrl: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/object_oriented_design/circular_buffer/circular_buffer.ipynb' },
    ],
  },
];

export const ALL_TOPICS = CATEGORIES.flatMap((c) => c.topics);
export const TOTAL_TOPICS = ALL_TOPICS.length;

export const STATUS = {
  NOT_STARTED: 'not_started',
  REVISE: 'revise',
  DONE: 'done',
};

export const STATUS_LABELS = {
  [STATUS.NOT_STARTED]: 'Not Started',
  [STATUS.REVISE]: 'Revise',
  [STATUS.DONE]: 'Done',
};
