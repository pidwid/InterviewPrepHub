// Study roadmap — structured phases with topic references
// Each phase maps to real topic IDs from topics.js so progress is tracked automatically

export const ROADMAP_PHASES = [
  {
    id: 'phase-1',
    label: 'Phase 1',
    title: 'Core Foundations',
    week: 'Week 1–2',
    description: 'Understand the fundamental trade-offs that drive every design decision.',
    topics: ['note-01', 'note-02', 'note-03', 'note-04', 'note-05', 'note-24'],
  },
  {
    id: 'phase-2',
    label: 'Phase 2',
    title: 'Infrastructure & Networking',
    week: 'Week 2–3',
    description: 'Learn how requests flow from users to servers and back.',
    topics: ['note-06', 'note-07', 'note-08', 'note-09', 'note-10'],
  },
  {
    id: 'phase-3',
    label: 'Phase 3',
    title: 'Data Layer',
    week: 'Week 3–4',
    description: 'Master storage, retrieval, and API design patterns.',
    topics: ['note-11', 'note-12', 'note-15'],
  },
  {
    id: 'phase-4',
    label: 'Phase 4',
    title: 'Communication & Reliability',
    week: 'Week 4–5',
    description: 'Async messaging, protocols, rate limiting, and security.',
    topics: ['note-13', 'note-14', 'note-17', 'note-16', 'note-42'],
  },
  {
    id: 'phase-5',
    label: 'Phase 5',
    title: 'Distributed & Advanced',
    week: 'Week 5–6',
    description: 'Distributed systems, event-driven patterns, and containers.',
    topics: ['note-18', 'note-19', 'note-22', 'note-20', 'note-21'],
  },
  {
    id: 'phase-6',
    label: 'Phase 6',
    title: 'Building Blocks',
    week: 'Week 6–7',
    description: 'Reusable components: ID generation, search, locking, storage.',
    topics: ['note-26', 'note-28', 'note-30', 'note-27', 'note-29'],
  },
  {
    id: 'phase-7',
    label: 'Phase 7',
    title: 'Cloud, DevOps & Specialized',
    week: 'Week 7–8',
    description: 'Cloud patterns, CI/CD, ML systems, and niche topics.',
    topics: ['note-32', 'note-34', 'note-31', 'note-38', 'note-33', 'note-35', 'note-36', 'note-37'],
  },
  {
    id: 'phase-8',
    label: 'Phase 8',
    title: 'Polish & Final Review',
    week: 'Week 8+',
    description: 'Deep dives, specialized topics, and the cheat sheet.',
    topics: ['note-23', 'note-39', 'note-40', 'note-41', 'note-25', 'note-cheatsheet'],
  },
];
