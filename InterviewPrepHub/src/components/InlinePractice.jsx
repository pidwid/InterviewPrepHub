import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getQnAForTopic } from '../data/qna';

const QNA_STORAGE_KEY = 'qna_progress';

function loadQnAProgress() {
  try {
    const raw = localStorage.getItem(QNA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveQnAProgress(progress) {
  localStorage.setItem(QNA_STORAGE_KEY, JSON.stringify(progress));
}

/**
 * Shared practice questions component.
 * Accepts `topicNum` (1-24) to load QnA for that SD topic.
 */
export default function InlinePractice({ topicNum }) {
  const topic = getQnAForTopic(topicNum);
  const [qnaProgress, setQnAProgress] = useState(() => loadQnAProgress());
  const [revealedMap, setRevealedMap] = useState({});

  const toggleReveal = useCallback((qId) => {
    setRevealedMap(prev => ({ ...prev, [qId]: !prev[qId] }));
  }, []);

  const markAnswer = useCallback((qId, result) => {
    const next = { ...qnaProgress, [qId]: result };
    setQnAProgress(next);
    saveQnAProgress(next);
  }, [qnaProgress]);

  const revealAll = useCallback(() => {
    const all = {};
    topic.questions.forEach(q => { all[q.id] = true; });
    setRevealedMap(all);
  }, [topic]);

  const hideAll = useCallback(() => {
    setRevealedMap({});
  }, []);

  if (!topic || topic.questions.length === 0) return null;

  const correct = topic.questions.filter(q => qnaProgress[q.id] === 'correct').length;
  const incorrect = topic.questions.filter(q => qnaProgress[q.id] === 'incorrect').length;
  const remaining = topic.questions.length - correct - incorrect;

  return (
    <div className="inline-practice">
      <div className="inline-practice-header">
        <h2 className="inline-practice-title">&#x1F4DD; Practice Questions</h2>
        <div className="inline-practice-stats">
          <span className="qna-pill qna-pill--correct">{correct} correct</span>
          <span className="qna-pill qna-pill--incorrect">{incorrect} missed</span>
          <span className="qna-pill qna-pill--remaining">{remaining} remaining</span>
        </div>
      </div>
      <div className="inline-practice-actions">
        <button className="qna-action-btn" onClick={revealAll}>Show All Answers</button>
        <button className="qna-action-btn" onClick={hideAll}>Hide All Answers</button>
      </div>
      <div className="inline-practice-questions">
        {topic.questions.map((q) => {
          const isRevealed = revealedMap[q.id];
          const status = qnaProgress[q.id];
          return (
            <div key={q.id} className={`inline-q-card ${isRevealed ? 'inline-q-card--revealed' : ''}`}>
              <div className="inline-q-header" onClick={() => toggleReveal(q.id)}>
                <span className="inline-q-badge">Q{q.num}</span>
                <p className="inline-q-text">{q.question}</p>
                <span className={`inline-q-chevron ${isRevealed ? 'inline-q-chevron--open' : ''}`}>
                  &#x25BC;
                </span>
              </div>
              {isRevealed && (
                <div className="inline-q-answer">
                  <div className="inline-q-answer-content markdown-body markdown-body--compact">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {q.answer}
                    </ReactMarkdown>
                  </div>
                  <div className="inline-q-assess">
                    <button
                      className={`qna-assess-btn qna-assess-btn--correct ${status === 'correct' ? 'qna-assess-btn--selected' : ''}`}
                      onClick={(e) => { e.stopPropagation(); markAnswer(q.id, 'correct'); }}
                    >
                      &#x2705; Got it
                    </button>
                    <button
                      className={`qna-assess-btn qna-assess-btn--incorrect ${status === 'incorrect' ? 'qna-assess-btn--selected' : ''}`}
                      onClick={(e) => { e.stopPropagation(); markAnswer(q.id, 'incorrect'); }}
                    >
                      &#x274C; Missed it
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Helper: extract topic number from a noteFile name.
 * e.g. "08-Load-Balancers.md" → 8, "lld-oop.md" → null
 */
export function getTopicNumFromNoteFile(noteFile) {
  if (!noteFile) return null;
  const m = noteFile.match(/^(\d+)-/);
  return m ? parseInt(m[1]) : null;
}

/**
 * Helper: check if a topic has practice questions.
 */
export function topicHasQuestions(noteFile) {
  const num = getTopicNumFromNoteFile(noteFile);
  if (!num || num > 24) return false;
  const topic = getQnAForTopic(num);
  return topic?.questions?.length > 0;
}

/**
 * Helper: get question count for a topic.
 */
export function getQuestionCount(noteFile) {
  const num = getTopicNumFromNoteFile(noteFile);
  if (!num || num > 24) return 0;
  const topic = getQnAForTopic(num);
  return topic?.questions?.length || 0;
}
