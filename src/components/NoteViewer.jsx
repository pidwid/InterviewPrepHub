import { useState, useEffect } from "react";
import MarkdownRenderer, { getContent } from "./MarkdownRenderer";
import { getQnAForTopic } from "../data/qna";
import InlinePractice, { getTopicNumFromNoteFile } from "./InlinePractice";

export default function NoteViewer({ noteFile, title, onClose }) {
  const content = getContent(noteFile);
  const [activeTab, setActiveTab] = useState("notes");

  // Scroll to top when the note viewer opens or noteFile changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [noteFile]);

  const topicNum = getTopicNumFromNoteFile(noteFile);
  const hasQuestions =
    topicNum &&
    topicNum <= 24 &&
    getQnAForTopic(topicNum)?.questions?.length > 0;

  if (!content) {
    return (
      <div className="note-viewer">
        <div className="note-viewer-header">
          <button className="back-btn" onClick={onClose}>
            &larr; Back
          </button>
          <h2 className="note-viewer-title">{title}</h2>
        </div>
        <div className="note-viewer-empty">
          <p>
            Note file not found: <code>{noteFile}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="note-viewer">
      <div className="note-viewer-header">
        <button className="back-btn" onClick={onClose}>
          &larr; Back
        </button>
        <h2 className="note-viewer-title">{title}</h2>
      </div>

      {hasQuestions && (
        <div className="note-viewer-tabs">
          <button
            className={`note-tab ${activeTab === "notes" ? "note-tab--active" : ""}`}
            onClick={() => setActiveTab("notes")}
          >
            &#x1F4D6; Notes
          </button>
          <button
            className={`note-tab ${activeTab === "practice" ? "note-tab--active" : ""}`}
            onClick={() => setActiveTab("practice")}
          >
            &#x1F4DD; Practice ({getQnAForTopic(topicNum).questions.length} Qs)
          </button>
        </div>
      )}

      {activeTab === "notes" ? (
        <div className="note-viewer-content markdown-body">
          <MarkdownRenderer content={content} />
          {hasQuestions && <InlinePractice topicNum={topicNum} />}
        </div>
      ) : (
        <InlinePractice topicNum={topicNum} />
      )}
    </div>
  );
}
