// Parse the QnA-Answer-Key.md into structured data for the flashcard system
import { getNoteContent } from './notes';

const QNA_FILENAME = 'QnA-Answer-Key.md';

// Topic metadata mapping (id → note file for cross-reference)
const TOPIC_META = [
  { num: 1,  title: 'Performance vs Scalability',   noteFile: '01-Performance-vs-Scalability.md' },
  { num: 2,  title: 'Latency vs Throughput',         noteFile: '02-Latency-vs-Throughput.md' },
  { num: 3,  title: 'Availability vs Consistency',   noteFile: '03-Availability-vs-Consistency.md' },
  { num: 4,  title: 'Consistency Patterns',           noteFile: '04-Consistency-Patterns.md' },
  { num: 5,  title: 'Availability Patterns',          noteFile: '05-Availability-Patterns.md' },
  { num: 6,  title: 'Domain Name System',             noteFile: '06-Domain-Name-System.md' },
  { num: 7,  title: 'Content Delivery Networks',      noteFile: '07-Content-Delivery-Networks.md' },
  { num: 8,  title: 'Load Balancers',                 noteFile: '08-Load-Balancers.md' },
  { num: 9,  title: 'Reverse Proxy',                  noteFile: '09-Reverse-Proxy.md' },
  { num: 10, title: 'Application Layer',              noteFile: '10-Application-Layer.md' },
  { num: 11, title: 'Databases',                      noteFile: '11-Databases.md' },
  { num: 12, title: 'Caching',                        noteFile: '12-Caching.md' },
  { num: 13, title: 'Asynchronism',                   noteFile: '13-Asynchronism.md' },
  { num: 14, title: 'Communication Protocols',        noteFile: '14-Communication-Protocols.md' },
  { num: 15, title: 'API Design',                     noteFile: '15-API-Design.md' },
  { num: 16, title: 'Security',                       noteFile: '16-Security.md' },
  { num: 17, title: 'Rate Limiting',                  noteFile: '17-Rate-Limiting.md' },
  { num: 18, title: 'Distributed Systems',            noteFile: '18-Distributed-Systems.md' },
  { num: 19, title: 'Event-Driven Architecture',      noteFile: '19-Event-Driven-Architecture.md' },
  { num: 20, title: 'Observability',                  noteFile: '20-Observability.md' },
  { num: 21, title: 'Data Pipelines',                 noteFile: '21-Data-Pipelines.md' },
  { num: 22, title: 'Containers & Orchestration',     noteFile: '22-Containers-Orchestration.md' },
  { num: 23, title: 'Networking Deep Dive',            noteFile: '23-Networking-Deep-Dive.md' },
  { num: 24, title: 'Estimation & Numbers',            noteFile: '24-Estimation-Numbers.md' },
];

function parseQnA(markdown) {
  const topics = [];
  // Split by topic sections: ## N. Title
  const topicRegex = /^## (\d+)\. (.+)$/gm;
  const matches = [...markdown.matchAll(topicRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const topicNum = parseInt(match[1]);
    const topicTitle = match[2].trim();
    const startIdx = match.index + match[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const sectionContent = markdown.slice(startIdx, endIdx);

    const meta = TOPIC_META.find(t => t.num === topicNum);

    // Parse individual questions within this section
    const questions = [];
    // Questions start with **Q followed by a number
    const qRegex = /\*\*Q(\d+)\.\s*(.*?)\*\*/g;
    const qMatches = [...sectionContent.matchAll(qRegex)];

    for (let j = 0; j < qMatches.length; j++) {
      const qMatch = qMatches[j];
      const qNum = parseInt(qMatch[1]);
      const questionText = qMatch[2].trim();
      const qStartIdx = qMatch.index + qMatch[0].length;
      const qEndIdx = j + 1 < qMatches.length ? qMatches[j + 1].index : sectionContent.length;
      
      let answerContent = sectionContent.slice(qStartIdx, qEndIdx).trim();
      // Remove leading **A:** or **A :**
      answerContent = answerContent.replace(/^\s*\*\*A:\*\*\s*/m, '').trim();
      // Remove trailing --- separator
      answerContent = answerContent.replace(/\n---\s*$/, '').trim();

      questions.push({
        id: `q-${topicNum}-${qNum}`,
        num: qNum,
        question: questionText,
        answer: answerContent,
      });
    }

    topics.push({
      id: `topic-${topicNum}`,
      num: topicNum,
      title: topicTitle,
      noteFile: meta?.noteFile || null,
      questions,
    });
  }

  return topics;
}

// Parse once and export
let _parsedQnA = null;

export function getQnATopics() {
  if (!_parsedQnA) {
    const content = getNoteContent(QNA_FILENAME);
    if (content) {
      _parsedQnA = parseQnA(content);
    } else {
      _parsedQnA = [];
    }
  }
  return _parsedQnA;
}

export function getQnAForTopic(topicNum) {
  const topics = getQnATopics();
  return topics.find(t => t.num === topicNum) || null;
}

export function getTotalQuestionCount() {
  return getQnATopics().reduce((sum, t) => sum + t.questions.length, 0);
}
