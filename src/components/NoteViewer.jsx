import { useState, useEffect } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import NoteNav from "./NoteNav";
import ReadingProgress from "./ReadingProgress";
import { getContent, loadContent } from "../data/contentLoader";
import { getQnAForTopic } from "../data/qna";
import InlinePractice, { getTopicNumFromNoteFile } from "./InlinePractice";

export default function NoteViewer({
  noteFile,
  title,
  recordActivity,
  onClose,
}) {
  // Read cached content synchronously each render — instant for already-loaded
  // notes. The async path below populates the cache and triggers a re-render.
  const cached = getContent(noteFile);
  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");
  const content = cached || (fetched?.file === noteFile ? fetched.md : null);

  // Note: scroll restore is handled by ReadingProgress (per-note position).
  // We avoid resetting scroll here so refresh resumes where you left off.

  // Record a streak activity after 30s of viewing the note
  useEffect(() => {
    if (!recordActivity || !noteFile) return undefined;
    const t = setTimeout(() => recordActivity(), 30_000);
    return () => clearTimeout(t);
  }, [noteFile, recordActivity]);

  // Lazy-load the markdown chunk on demand
  useEffect(() => {
    if (getContent(noteFile)) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return loadContent(noteFile);
      })
      .then((md) => {
        if (!cancelled) {
          setFetched({ file: noteFile, md });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
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
          <button
            className="back-btn"
            onClick={onClose}
            data-ga-event="note_back"
            data-ga-label={title}
          >
            &larr; Back
          </button>

          <h2 className="note-viewer-title">{title}</h2>
        </div>
        <div className="note-viewer-empty">
          {loading ? (
            <p>Loading…</p>
          ) : (
            <p>
              Note file not found: <code>{noteFile}</code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="note-viewer">
      <ReadingProgress noteFile={noteFile} />
      <div className="note-viewer-header">
        <button
          className="back-btn"
          onClick={onClose}
          data-ga-event="note_back"
          data-ga-label={title}
        >
          &larr; Back
        </button>
        <h2 className="note-viewer-title">{title}</h2>
      </div>

      {hasQuestions && (
        <div className="note-viewer-tabs">
          <button
            className={`note-tab ${activeTab === "notes" ? "note-tab--active" : ""}`}
            onClick={() => setActiveTab("notes")}
            data-ga-event="note_tab"
            data-ga-label="notes"
          >
            &#x1F4D6; Notes
          </button>
          <button
            className={`note-tab ${activeTab === "practice" ? "note-tab--active" : ""}`}
            onClick={() => setActiveTab("practice")}
            data-ga-event="note_tab"
            data-ga-label="practice"
          >
            &#x1F4DD; Practice ({getQnAForTopic(topicNum).questions.length} Qs)
          </button>
        </div>
      )}

      {activeTab === "notes" ? (
        <div className="note-viewer-content markdown-body">
          <MarkdownRenderer content={content} />
          {hasQuestions && <InlinePractice topicNum={topicNum} />}
          <NoteNav noteFile={noteFile} />
        </div>
      ) : (
        <InlinePractice topicNum={topicNum} />
      )}
    </div>
  );
}
