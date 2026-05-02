import { useMemo, useState } from "react";

// Stable "now" for the lifetime of this render — keeps useMemo deps pure.
function useNow() {
  const [now] = useState(() => Date.now());
  return now;
}
import { STATUS } from "../data/topics";

// Resolve a topicId → topic record using the supplied allTopics list.
function lookupTopic(topicId, allTopics) {
  return allTopics.find((t) => t.id === topicId);
}

// Compact card shown on the Dashboard. Lists topics whose progress flag
// is currently 'revise' (progress is the single source of truth).
// reviewState provides only the scheduling layer (dueAt timestamps).
export default function ReviewQueue({
  allTopics,
  progress,
  reviewState,
  onOpenNote,
}) {
  const now = useNow();
  const items = useMemo(() => {
    const reviseIds = Object.entries(progress)
      .filter(([, status]) => status === STATUS.REVISE)
      .map(([id]) => id);
    return reviseIds
      .map((topicId) => {
        const t = lookupTopic(topicId, allTopics);
        if (!t) return null;
        return {
          id: topicId,
          title: t.title,
          noteFile: t.noteFile || t.solutionFile,
          dueAt: reviewState.state?.[topicId]?.dueAt ?? now,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [progress, reviewState.state, allTopics, now]);

  if (items.length === 0) {
    return (
      <div className="review-queue">
        <div className="review-queue-header">
          <h3>📚 Today's Review</h3>
        </div>
        <p className="review-queue-empty">
          Nothing here yet — mark topics as <em>Revise</em> to add them.
        </p>
      </div>
    );
  }

  return (
    <div className="review-queue">
      <div className="review-queue-header">
        <h3>📚 Today's Review</h3>
        <span className="review-queue-count">{items.length}</span>
      </div>
      <div className="review-queue-list">
        {items.slice(0, 10).map((item) => (
          <button
            key={item.id}
            type="button"
            className="st-topic st-topic--revise"
            onClick={() => onOpenNote?.(item.id)}
            title="Open for review"
          >
            <span className="st-topic-dot st-topic-dot--revise">↻</span>
            <span className="st-topic-name">{item.title}</span>
            <span className="st-topic-status st-topic-status--revise">Revise</span>
          </button>
        ))}
        {items.length > 10 && (
          <p className="review-queue-more">+{items.length - 10} more…</p>
        )}
      </div>
    </div>
  );
}
