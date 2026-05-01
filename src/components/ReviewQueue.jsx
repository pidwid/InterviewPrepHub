import { useMemo } from "react";

// Resolve a topicId → topic record using the supplied allTopics list.
function lookupTopic(topicId, allTopics) {
  return allTopics.find((t) => t.id === topicId);
}

// Compact card shown on the Dashboard. Lists ALL topics in the review
// queue (most-overdue first). Reuses the existing .st-topic button styling
// so the look matches the roadmap topic cards.
export default function ReviewQueue({ allTopics, reviewState, onOpenNote }) {
  const items = useMemo(() => {
    return Object.entries(reviewState.state || {})
      .map(([topicId, entry]) => {
        const t = lookupTopic(topicId, allTopics);
        if (!t) return null;
        return {
          id: topicId,
          title: t.title,
          noteFile: t.noteFile || t.solutionFile,
          dueAt: entry.dueAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [reviewState.state, allTopics]);

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
            onClick={() => onOpenNote?.(item.id, item.noteFile, item.title)}
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
