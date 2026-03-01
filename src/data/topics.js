// System Design topics — mapped to local notes
// Status values: 'not_started' | 'revise' | 'done'
// Priority values: 'high' | 'medium' | 'low'

export const CATEGORIES = [
  {
    id: 'core-fundamentals',
    title: 'Core Fundamentals',
    topics: [
      { id: 'note-01', title: 'Performance vs Scalability',          noteFile: '01-Performance-vs-Scalability.md',  priority: 'high',   youtubeId: 'EWS_CIxttVw' },
      { id: 'note-02', title: 'Latency vs Throughput',               noteFile: '02-Latency-vs-Throughput.md',       priority: 'high',   youtubeId: 'X0bnN8oBxeI' },
      { id: 'note-03', title: 'Availability vs Consistency (CAP)',   noteFile: '03-Availability-vs-Consistency.md', priority: 'high',   youtubeId: 'VdrEq0cODu4' },
      { id: 'note-04', title: 'Consistency Patterns',                noteFile: '04-Consistency-Patterns.md',        priority: 'medium', youtubeId: 'm4q7VkgDWrM' },
      { id: 'note-05', title: 'Availability Patterns',               noteFile: '05-Availability-Patterns.md',       priority: 'medium', youtubeId: 'LdvduBxZRLs' },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure & Networking',
    topics: [
      { id: 'note-06', title: 'Domain Name System (DNS)',            noteFile: '06-Domain-Name-System.md',          priority: 'medium', youtubeId: 'SHkbPm1Wrno' },
      { id: 'note-07', title: 'Content Delivery Networks (CDN)',     noteFile: '07-Content-Delivery-Networks.md',   priority: 'medium', youtubeId: 'RI9np1LWzqw' },
      { id: 'note-08', title: 'Load Balancers',                      noteFile: '08-Load-Balancers.md',              priority: 'high',   youtubeId: 'LQuuoHTyYz8' },
      { id: 'note-09', title: 'Reverse Proxy',                       noteFile: '09-Reverse-Proxy.md',               priority: 'medium', youtubeId: '4NB0NDtOwIQ' },
      { id: 'note-10', title: 'Application Layer & Microservices',   noteFile: '10-Application-Layer.md',           priority: 'medium', youtubeId: '7-6F3b14baA' },
    ],
  },
  {
    id: 'data-storage',
    title: 'Data & Storage',
    topics: [
      { id: 'note-11', title: 'Databases (SQL, NoSQL, Replication, Sharding)', noteFile: '11-Databases.md',        priority: 'high',   youtubeId: 'kkeFE6iRfMM' },
      { id: 'note-12', title: 'Caching',                             noteFile: '12-Caching.md',                     priority: 'high',   youtubeId: '1NngTUYPdpI' },
    ],
  },
  {
    id: 'async-comm',
    title: 'Async, Communication & APIs',
    topics: [
      { id: 'note-13', title: 'Asynchronism (Queues, Back Pressure)', noteFile: '13-Asynchronism.md',              priority: 'medium', youtubeId: 'x4k1XEjNzYQ' },
      { id: 'note-14', title: 'Communication Protocols',             noteFile: '14-Communication-Protocols.md',    priority: 'medium', youtubeId: '4vLxWqE94l4' },
      { id: 'note-15', title: 'API Design',                          noteFile: '15-API-Design.md',                 priority: 'high',   youtubeId: 'DQ57zYedMdQ' },
    ],
  },
  {
    id: 'security-reliability',
    title: 'Security & Reliability',
    topics: [
      { id: 'note-16', title: 'Security',                            noteFile: '16-Security.md',                   priority: 'medium', youtubeId: 'fyTxwIa-1U0' },
      { id: 'note-17', title: 'Rate Limiting',                       noteFile: '17-Rate-Limiting.md',              priority: 'high',   youtubeId: 'MIJFyUPG4Z4' },
      { id: 'note-42', title: 'SLO, SLA, SLI & Error Budgets',      noteFile: '42-SLO-SLA-SLI-Error-Budgets.md', priority: 'medium', youtubeId: 'XEOg17OKMKw' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced Topics',
    topics: [
      { id: 'note-18', title: 'Distributed Systems',                 noteFile: '18-Distributed-Systems.md',        priority: 'high',   youtubeId: 'nH4qjmP2KEE' },
      { id: 'note-19', title: 'Event-Driven Architecture',           noteFile: '19-Event-Driven-Architecture.md',  priority: 'medium', youtubeId: 'gOuAqRaDdHA' },
      { id: 'note-20', title: 'Observability',                       noteFile: '20-Observability.md',              priority: 'low',    youtubeId: 'CAQ_a2-9UOI' },
      { id: 'note-21', title: 'Data Pipelines',                      noteFile: '21-Data-Pipelines.md',             priority: 'low',    youtubeId: 'kGT4PcTEPP8' },
      { id: 'note-22', title: 'Containers & Orchestration',          noteFile: '22-Containers-Orchestration.md',   priority: 'medium', youtubeId: 'TlHvYWVUZyc' },
    ],
  },
  {
    id: 'building-blocks',
    title: 'Building Blocks & Components',
    topics: [
      { id: 'note-26', title: 'Unique ID Generation',                noteFile: '26-Unique-ID-Generation.md',       priority: 'medium', youtubeId: 'g3BV_holJK4' },
      { id: 'note-27', title: 'Proximity & Location Services',       noteFile: '27-Proximity-Location-Services.md', priority: 'low',   youtubeId: 'M4lR_Va97cQ' },
      { id: 'note-28', title: 'Search Systems',                      noteFile: '28-Search-Systems.md',             priority: 'medium', youtubeId: 'PuZvF2EyfBM' },
      { id: 'note-29', title: 'Blob & Object Storage',               noteFile: '29-Blob-Object-Storage.md',        priority: 'low',    youtubeId: 'RvaMHMxHjp4' },
      { id: 'note-30', title: 'Distributed Locking',                 noteFile: '30-Distributed-Locking.md',        priority: 'medium', youtubeId: 'qoM6AojLSKY' },
      { id: 'note-43', title: 'Consistent Hashing & Data Partitioning', noteFile: '43-Consistent-Hashing.md',    priority: 'high',   youtubeId: 'UF9Uj9TFzdE' },
      { id: 'note-44', title: 'Service Discovery & Coordination',  noteFile: '44-Service-Discovery.md',          priority: 'medium', youtubeId: 'WL_7OLGp5ko' },
    ],
  },
  {
    id: 'cloud-devops',
    title: 'Cloud & DevOps',
    topics: [
      { id: 'note-31', title: 'Serverless & FaaS',                          noteFile: '31-Serverless-FaaS.md',                        priority: 'low',    youtubeId: 'vxJobGtqKVM' },
      { id: 'note-32', title: 'Cloud Architecture Patterns',                noteFile: '32-Cloud-Architecture-Patterns.md',             priority: 'medium', youtubeId: 'f6zXyq4VPP8' },
      { id: 'note-33', title: 'Infrastructure as Code',                     noteFile: '33-Infrastructure-as-Code.md',                  priority: 'low',    youtubeId: 'l5k1ai_GBDE' },
      { id: 'note-34', title: 'CI/CD & Deployment Pipelines',               noteFile: '34-CICD-Deployment-Pipelines.md',               priority: 'medium', youtubeId: '42UP1fxi2SY' },
      { id: 'note-35', title: 'Disaster Recovery & Business Continuity',    noteFile: '35-Disaster-Recovery-Business-Continuity.md',   priority: 'low',    youtubeId: 'OmASCUJEVy8' },
      { id: 'note-36', title: 'Cost Optimization & Capacity Planning',      noteFile: '36-Cost-Optimization-Capacity-Planning.md',     priority: 'low',    youtubeId: 'UC5xf8FbdJc' },
      { id: 'note-37', title: 'Workflow Orchestration',                     noteFile: '37-Workflow-Orchestration.md',                  priority: 'low',    youtubeId: 'f-18XztyN6c' },
    ],
  },
  {
    id: 'specialized',
    title: 'Specialized Topics',
    topics: [
      { id: 'note-38', title: 'ML System Design',                    noteFile: '38-ML-System-Design.md',           priority: 'medium', youtubeId: 'wI4L11EoW3I' },
      { id: 'note-39', title: 'Advanced Data Modeling',              noteFile: '39-Advanced-Data-Modeling.md',     priority: 'low',    youtubeId: 'TUcPS6dsWx4' },
      { id: 'note-40', title: 'Graph Databases & Social Graphs',     noteFile: '40-Graph-Databases-Social-Graphs.md', priority: 'low', youtubeId: 'Jdj2OsGeiA8' },
      { id: 'note-41', title: 'Content Moderation & Trust Safety',   noteFile: '41-Content-Moderation-Trust-Safety.md', priority: 'low', youtubeId: '9KUC_nHydZg' },
    ],
  },
  {
    id: 'deep-dives',
    title: 'Deep Dives & Reference',
    topics: [
      { id: 'note-23', title: 'Networking Deep Dive',                noteFile: '23-Networking-Deep-Dive.md',        priority: 'low',    youtubeId: 'P6SZLcGE4us' },
      { id: 'note-24', title: 'Estimation & Numbers',                noteFile: '24-Estimation-Numbers.md',          priority: 'high',   youtubeId: 'UC5xf8FbdJc' },
      { id: 'note-25', title: 'Appendix & Additional Resources',     noteFile: '25-Appendix.md',                    priority: 'low' },
      { id: 'note-cheatsheet', title: 'Interview Cheat Sheet',       noteFile: 'Interview-Cheat-Sheet.md',          priority: 'high',   youtubeId: 'i7twT3x5yv8' },
    ],
  },
];

// System Design practice questions — shown on the categories dashboard
export const SD_PRACTICE_QUESTIONS = [
  { id: 'q-pastebin',           title: 'Design Pastebin.com (or Bit.ly)',                      priority: 'high',   solutionFile: 'Solution-Pastebin.md',           youtubeId: 'iUU4O1sWtJA' },
  { id: 'q-twitter-timeline',   title: 'Design Twitter Timeline & Search',                     priority: 'high',   solutionFile: 'Solution-Twitter-Timeline.md',   youtubeId: 'Nfa-uUHuFHg' },
  { id: 'q-web-crawler',        title: 'Design a Web Crawler',                                 priority: 'medium', solutionFile: 'Solution-Web-Crawler.md',         youtubeId: 'krsuaUp__pM' },
  { id: 'q-mint',               title: 'Design Mint.com',                                      priority: 'medium', solutionFile: 'Solution-Mint.md',                youtubeId: 'uq0B009UEFc' },
  { id: 'q-social-network',     title: 'Design Data Structures for a Social Network',          priority: 'high',   solutionFile: 'Solution-Social-Network.md',      youtubeId: 'Qj4-GruzyDU' },
  { id: 'q-key-value-search',   title: 'Design a Key-Value Store for a Search Engine',         priority: 'high',   solutionFile: 'Solution-Key-Value-Store.md',     youtubeId: '6fOoXT1HYxk' },
  { id: 'q-amazon-sales',       title: "Design Amazon's Sales Ranking by Category",            priority: 'medium', solutionFile: 'Solution-Amazon-Sales-Ranking.md', youtubeId: 'y-tA2NW4LNY' },
  { id: 'q-aws-scale',          title: 'Design a System that Scales to Millions of Users on AWS', priority: 'high', solutionFile: 'Solution-Scaling-AWS.md',        youtubeId: 'YkGHxOg9d3M' },
  { id: 'q-url-shortener',      title: 'Design a URL Shortening Service (TinyURL)',            priority: 'high',   solutionFile: 'Solution-URL-Shortener.md',       youtubeId: 'iUU4O1sWtJA' },
  { id: 'q-chat-system',        title: 'Design a Chat System (WhatsApp/Messenger)',            priority: 'high',   solutionFile: 'Solution-Chat-System.md',         youtubeId: 'cr6p0n0N-VA' },
  { id: 'q-notification',       title: 'Design a Notification System',                        priority: 'medium', solutionFile: 'Solution-Notification-System.md', youtubeId: 'CUwt9_l0DOg' },
  { id: 'q-news-feed',          title: 'Design a News Feed System',                           priority: 'high',   solutionFile: 'Solution-News-Feed.md',           youtubeId: 'Qj4-GruzyDU' },
  { id: 'q-video-streaming',    title: 'Design YouTube / Netflix Video Streaming',            priority: 'medium', solutionFile: 'Solution-Video-Streaming.md',     youtubeId: 'IUrQ5_g3XKs' },
  { id: 'q-rate-limiter',       title: 'Design a Rate Limiter',                               priority: 'high',   solutionFile: 'Solution-Rate-Limiter.md',        youtubeId: 'MIJFyUPG4Z4' },
  { id: 'q-search-autocomplete', title: 'Design Search Autocomplete',                         priority: 'medium', solutionFile: 'Solution-Search-Autocomplete.md', youtubeId: 'l38XL9914fs' },

  // Additional questions — solution pages added
  { id: 'q-instagram',          title: 'Design Instagram',                                    priority: 'high',   solutionFile: 'Solution-Instagram.md',           youtubeId: 'VJpfO6KdyWE' },
  { id: 'q-dropbox',            title: 'Design Dropbox / Google Drive',                       priority: 'high',   solutionFile: 'Solution-Dropbox.md',             youtubeId: '_UZ1ngy-kOI' },
  { id: 'q-uber',               title: 'Design Uber / Lyft (Ride Sharing)',                   priority: 'high',   solutionFile: 'Solution-Uber.md',                youtubeId: 'lsKU38RKQSo' },
  { id: 'q-yelp',               title: 'Design Yelp / Nearby Places',                         priority: 'high',   solutionFile: 'Solution-Yelp.md',                youtubeId: 'yz1jtze4qr8' },
  { id: 'q-google-maps',        title: 'Design Google Maps',                                  priority: 'medium', solutionFile: 'Solution-Google-Maps.md',         youtubeId: 'jk3yvVfNvds' },
  { id: 'q-tiktok',             title: 'Design TikTok / Instagram Reels',                     priority: 'high',   solutionFile: 'Solution-TikTok.md',              youtubeId: 'Z-0g_aJL5Fw' },
  { id: 'q-discord',            title: 'Design Discord / Slack',                              priority: 'high',   solutionFile: 'Solution-Discord.md',             youtubeId: 'okrR1KXNLtA' },
  { id: 'q-distributed-cache',  title: 'Design a Distributed Cache',                          priority: 'high',   solutionFile: 'Solution-Distributed-Cache.md',   youtubeId: 'lZ5QuFLCVn0' },
  { id: 'q-payment',            title: 'Design a Payment System (Stripe / PayPal)',            priority: 'high',   solutionFile: 'Solution-Payment-System.md',      youtubeId: 'olfaBgJrUBI' },
  { id: 'q-online-judge',       title: 'Design an Online Judge (LeetCode)',                   priority: 'medium', solutionFile: 'Solution-Online-Judge.md',        youtubeId: '1xHADtekTNg' },
  { id: 'q-google-search',      title: 'Design Google Search',                                priority: 'high',   solutionFile: 'Solution-Google-Search.md',       youtubeId: 'XimFq5BOgsA' },
  { id: 'q-e-commerce',         title: 'Design an E-Commerce Platform (Amazon)',               priority: 'medium', solutionFile: 'Solution-E-Commerce.md',          youtubeId: 'EpASu_1dUdE' },
  { id: 'q-spotify',            title: 'Design Spotify',                                      priority: 'medium', solutionFile: 'Solution-Spotify.md',             youtubeId: '_K-eupuDVEc' },
  { id: 'q-booking',            title: 'Design a Hotel Booking Service (Airbnb)',              priority: 'medium', solutionFile: 'Solution-Hotel-Booking.md',       youtubeId: 'kO0EQNfE2x4' },
  { id: 'q-message-queue',      title: 'Design a Distributed Message Queue (Kafka)',           priority: 'high',   solutionFile: 'Solution-Message-Queue.md',       youtubeId: 'oVZtzZVe9Dg' },
  { id: 'q-live-streaming',     title: 'Design a Live Streaming Platform (Twitch)',            priority: 'medium', solutionFile: 'Solution-Live-Streaming.md',      youtubeId: 'MWjQs9I7clo' },
  { id: 'q-stock-exchange',     title: 'Design a Stock Exchange / Trading System',             priority: 'medium', solutionFile: 'Solution-Stock-Exchange.md',      youtubeId: 'dGYfpO3WJ1o' },
  { id: 'q-top-k',              title: 'Design a Top-K / Heavy Hitters System',               priority: 'high',   solutionFile: 'Solution-Top-K.md',               youtubeId: 'y-tA2NW4LNY' },
  { id: 'q-consistent-hashing', title: 'Design Consistent Hashing',                           priority: 'high',   solutionFile: 'Solution-Consistent-Hashing.md',  youtubeId: 'vccwdhfqIrI' },

  // Additional questions from system-design-primer
  { id: 'q-google-docs',       title: 'Design Google Docs (Collaborative Editor)',            priority: 'high',   solutionFile: 'Solution-Google-Docs.md',          youtubeId: 'M4KIwvPc9cM' },
  { id: 'q-recommendation',    title: 'Design a Recommendation System',                      priority: 'medium', solutionFile: 'Solution-Recommendation.md',       youtubeId: '1JRrN09LXyg' },
  { id: 'q-cdn',               title: 'Design a Content Delivery Network (CDN)',              priority: 'medium', solutionFile: 'Solution-CDN.md',                  youtubeId: '8zX0rue2Hic' },
  { id: 'q-garbage-collection', title: 'Design a Garbage Collection System',                  priority: 'low',    solutionFile: 'Solution-Garbage-Collection.md' },
];

export const ALL_TOPICS = CATEGORIES.flatMap((c) => c.topics);

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
