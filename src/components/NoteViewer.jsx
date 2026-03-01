import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { getNoteContent } from '../data/notes';
import { getLLDNoteContent } from '../data/lldNotes';
import { getQnAForTopic } from '../data/qna';
import InlinePractice from './InlinePractice';

// Extract topic number from noteFile (e.g., "08-Load-Balancers.md" → 8)
function getTopicNum(noteFile) {
  const m = noteFile?.match(/^(\d+)-/);
  return m ? parseInt(m[1]) : null;
}

export default function NoteViewer({ noteFile, title, onClose }) {
  const content = getNoteContent(noteFile) || getLLDNoteContent(noteFile);
  const [activeTab, setActiveTab] = useState('notes');

  // Scroll to top when the note viewer opens or noteFile changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [noteFile]);

  // Extract topic number from noteFile (e.g., "08-Load-Balancers.md" → 8)
  const topicNum = getTopicNum(noteFile);
  const hasQuestions = topicNum && topicNum <= 24 && getQnAForTopic(topicNum)?.questions?.length > 0;

  if (!content) {
    return (
      <div className="note-viewer">
        <div className="note-viewer-header">
          <button className="back-btn" onClick={onClose}>&larr; Back</button>
          <h2 className="note-viewer-title">{title}</h2>
        </div>
        <div className="note-viewer-empty">
          <p>Note file not found: <code>{noteFile}</code></p>
        </div>
      </div>
    );
  }

  return (
    <div className="note-viewer">
      <div className="note-viewer-header">
        <button className="back-btn" onClick={onClose}>&larr; Back</button>
        <h2 className="note-viewer-title">{title}</h2>
      </div>

      {hasQuestions && (
        <div className="note-viewer-tabs">
          <button
            className={`note-tab ${activeTab === 'notes' ? 'note-tab--active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            &#x1F4D6; Notes
          </button>
          <button
            className={`note-tab ${activeTab === 'practice' ? 'note-tab--active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            &#x1F4DD; Practice ({getQnAForTopic(topicNum).questions.length} Qs)
          </button>
        </div>
      )}

      {activeTab === 'notes' ? (
        <div className="note-viewer-content markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              code({ node, inline, className, children, ...props }) {
                return inline ? (
                  <code className="inline-code" {...props}>{children}</code>
                ) : (
                  <code className={className} {...props}>{children}</code>
                );
              },
              a({ node, children, href, ...props }) {
                return (
                  <a href={href} target="_blank" rel="noreferrer" {...props}>
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>

          {/* Show practice section at the bottom of notes too */}
          {hasQuestions && <InlinePractice topicNum={topicNum} />}
        </div>
      ) : (
        <InlinePractice topicNum={topicNum} />
      )}
    </div>
  );
}
