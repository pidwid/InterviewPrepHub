// System Design topics — mapped to local notes
// Status values: 'not_started' | 'revise' | 'done'
// Priority values: 'high' | 'medium' | 'low'

export const CATEGORIES = [
  {
    id: 'core-fundamentals',
    title: 'Core Fundamentals',
    topics: [
      { id: 'note-01', title: 'Performance vs Scalability', noteFile: '01-Performance-vs-Scalability.md', priority: 'high' },
      { id: 'note-02', title: 'Latency vs Throughput', noteFile: '02-Latency-vs-Throughput.md', priority: 'high' },
      { id: 'note-03', title: 'Availability vs Consistency (CAP)', noteFile: '03-Availability-vs-Consistency.md', priority: 'high' },
      { id: 'note-04', title: 'Consistency Patterns', noteFile: '04-Consistency-Patterns.md', priority: 'medium' },
      { id: 'note-05', title: 'Availability Patterns', noteFile: '05-Availability-Patterns.md', priority: 'medium' },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure & Networking',
    topics: [
      { id: 'note-06', title: 'Domain Name System (DNS)', noteFile: '06-Domain-Name-System.md', priority: 'medium' },
      { id: 'note-07', title: 'Content Delivery Networks (CDN)', noteFile: '07-Content-Delivery-Networks.md', priority: 'medium' },
      { id: 'note-08', title: 'Load Balancers', noteFile: '08-Load-Balancers.md', priority: 'high' },
      { id: 'note-09', title: 'Reverse Proxy', noteFile: '09-Reverse-Proxy.md', priority: 'medium' },
      { id: 'note-10', title: 'Application Layer & Microservices', noteFile: '10-Application-Layer.md', priority: 'medium' },
    ],
  },
  {
    id: 'data-storage',
    title: 'Data & Storage',
    topics: [
      { id: 'note-11', title: 'Databases (SQL, NoSQL, Replication, Sharding)', noteFile: '11-Databases.md', priority: 'high' },
      { id: 'note-12', title: 'Caching', noteFile: '12-Caching.md', priority: 'high' },
    ],
  },
  {
    id: 'async-comm',
    title: 'Async, Communication & APIs',
    topics: [
      { id: 'note-13', title: 'Asynchronism (Queues, Back Pressure)', noteFile: '13-Asynchronism.md', priority: 'medium' },
      { id: 'note-14', title: 'Communication Protocols', noteFile: '14-Communication-Protocols.md', priority: 'medium' },
      { id: 'note-15', title: 'API Design', noteFile: '15-API-Design.md', priority: 'high' },
    ],
  },
  {
    id: 'security-reliability',
    title: 'Security & Reliability',
    topics: [
      { id: 'note-16', title: 'Security', noteFile: '16-Security.md', priority: 'medium' },
      { id: 'note-17', title: 'Rate Limiting', noteFile: '17-Rate-Limiting.md', priority: 'high' },
      { id: 'note-42', title: 'SLO, SLA, SLI & Error Budgets', noteFile: '42-SLO-SLA-SLI-Error-Budgets.md', priority: 'medium' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced Topics',
    topics: [
      { id: 'note-18', title: 'Distributed Systems', noteFile: '18-Distributed-Systems.md', priority: 'high' },
      { id: 'note-19', title: 'Event-Driven Architecture', noteFile: '19-Event-Driven-Architecture.md', priority: 'medium' },
      { id: 'note-20', title: 'Observability', noteFile: '20-Observability.md', priority: 'low' },
      { id: 'note-21', title: 'Data Pipelines', noteFile: '21-Data-Pipelines.md', priority: 'low' },
      { id: 'note-22', title: 'Containers & Orchestration', noteFile: '22-Containers-Orchestration.md', priority: 'medium' },
    ],
  },
  {
    id: 'building-blocks',
    title: 'Building Blocks & Components',
    topics: [
      { id: 'note-26', title: 'Unique ID Generation', noteFile: '26-Unique-ID-Generation.md', priority: 'medium' },
      { id: 'note-27', title: 'Proximity & Location Services', noteFile: '27-Proximity-Location-Services.md', priority: 'low' },
      { id: 'note-28', title: 'Search Systems', noteFile: '28-Search-Systems.md', priority: 'medium' },
      { id: 'note-29', title: 'Blob & Object Storage', noteFile: '29-Blob-Object-Storage.md', priority: 'low' },
      { id: 'note-30', title: 'Distributed Locking', noteFile: '30-Distributed-Locking.md', priority: 'medium' },
    ],
  },
  {
    id: 'cloud-devops',
    title: 'Cloud & DevOps',
    topics: [
      { id: 'note-31', title: 'Serverless & FaaS', noteFile: '31-Serverless-FaaS.md', priority: 'low' },
      { id: 'note-32', title: 'Cloud Architecture Patterns', noteFile: '32-Cloud-Architecture-Patterns.md', priority: 'medium' },
      { id: 'note-33', title: 'Infrastructure as Code', noteFile: '33-Infrastructure-as-Code.md', priority: 'low' },
      { id: 'note-34', title: 'CI/CD & Deployment Pipelines', noteFile: '34-CICD-Deployment-Pipelines.md', priority: 'medium' },
      { id: 'note-35', title: 'Disaster Recovery & Business Continuity', noteFile: '35-Disaster-Recovery-Business-Continuity.md', priority: 'low' },
      { id: 'note-36', title: 'Cost Optimization & Capacity Planning', noteFile: '36-Cost-Optimization-Capacity-Planning.md', priority: 'low' },
      { id: 'note-37', title: 'Workflow Orchestration', noteFile: '37-Workflow-Orchestration.md', priority: 'low' },
    ],
  },
  {
    id: 'specialized',
    title: 'Specialized Topics',
    topics: [
      { id: 'note-38', title: 'ML System Design', noteFile: '38-ML-System-Design.md', priority: 'medium' },
      { id: 'note-39', title: 'Advanced Data Modeling', noteFile: '39-Advanced-Data-Modeling.md', priority: 'low' },
      { id: 'note-40', title: 'Graph Databases & Social Graphs', noteFile: '40-Graph-Databases-Social-Graphs.md', priority: 'low' },
      { id: 'note-41', title: 'Content Moderation & Trust Safety', noteFile: '41-Content-Moderation-Trust-Safety.md', priority: 'low' },
    ],
  },
  {
    id: 'deep-dives',
    title: 'Deep Dives & Reference',
    topics: [
      { id: 'note-23', title: 'Networking Deep Dive', noteFile: '23-Networking-Deep-Dive.md', priority: 'low' },
      { id: 'note-24', title: 'Estimation & Numbers', noteFile: '24-Estimation-Numbers.md', priority: 'high' },
      { id: 'note-25', title: 'Appendix & Additional Resources', noteFile: '25-Appendix.md', priority: 'low' },
      { id: 'note-cheatsheet', title: 'Interview Cheat Sheet', noteFile: 'Interview-Cheat-Sheet.md', priority: 'high' },
    ],
  },
];

// System Design practice questions — shown on the categories dashboard
export const SD_PRACTICE_QUESTIONS = [
  { id: 'q-pastebin', title: 'Design Pastebin.com (or Bit.ly)', priority: 'high', solutionFile: 'Solution-Pastebin.md' },
  { id: 'q-twitter-timeline', title: 'Design Twitter Timeline & Search', priority: 'high', solutionFile: 'Solution-Twitter-Timeline.md' },
  { id: 'q-web-crawler', title: 'Design a Web Crawler', priority: 'medium', solutionFile: 'Solution-Web-Crawler.md' },
  { id: 'q-mint', title: 'Design Mint.com', priority: 'medium', solutionFile: 'Solution-Mint.md' },
  { id: 'q-social-network', title: 'Design Data Structures for a Social Network', priority: 'high', solutionFile: 'Solution-Social-Network.md' },
  { id: 'q-key-value-search', title: 'Design a Key-Value Store for a Search Engine', priority: 'high', solutionFile: 'Solution-Key-Value-Store.md' },
  { id: 'q-amazon-sales', title: "Design Amazon's Sales Ranking by Category", priority: 'medium', solutionFile: 'Solution-Amazon-Sales-Ranking.md' },
  { id: 'q-aws-scale', title: 'Design a System that Scales to Millions of Users on AWS', priority: 'high', solutionFile: 'Solution-Scaling-AWS.md' },
  { id: 'q-url-shortener', title: 'Design a URL Shortening Service (TinyURL)', priority: 'high', solutionFile: 'Solution-URL-Shortener.md' },
  { id: 'q-chat-system', title: 'Design a Chat System (WhatsApp/Messenger)', priority: 'high', solutionFile: 'Solution-Chat-System.md' },
  { id: 'q-notification', title: 'Design a Notification System', priority: 'medium', solutionFile: 'Solution-Notification-System.md' },
  { id: 'q-news-feed', title: 'Design a News Feed System', priority: 'high', solutionFile: 'Solution-News-Feed.md' },
  { id: 'q-video-streaming', title: 'Design YouTube / Netflix Video Streaming', priority: 'medium', solutionFile: 'Solution-Video-Streaming.md' },
  { id: 'q-rate-limiter', title: 'Design a Rate Limiter', priority: 'high', solutionFile: 'Solution-Rate-Limiter.md' },
  { id: 'q-search-autocomplete', title: 'Design Search Autocomplete', priority: 'medium', solutionFile: 'Solution-Search-Autocomplete.md' },
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

export const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const PRIORITY_LABELS = {
  [PRIORITY.HIGH]: 'High',
  [PRIORITY.MEDIUM]: 'Medium',
  [PRIORITY.LOW]: 'Low',
};
