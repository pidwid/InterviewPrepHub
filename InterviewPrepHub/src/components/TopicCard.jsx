import { STATUS, STATUS_LABELS } from "../data/topics";
import { PriorityBadge } from "./ui";

const STATUS_CYCLE = [STATUS.NOT_STARTED, STATUS.REVISE, STATUS.DONE];

export default function TopicCard({ topic, status, onSetStatus, onOpenNote }) {
  const hasNote = !!topic.noteFile;

  return (
    <div className={`topic-card topic-card--${status}`}>
      <div className="topic-card-info">
        <div className="topic-card-title-row">
          {topic.priority && <PriorityBadge priority={topic.priority} />}
          {hasNote ? (
            <button
              className="topic-card-title topic-card-title--clickable"
              onClick={() => onOpenNote(topic)}
            >
              {topic.title}
            </button>
          ) : (
            <span className="topic-card-title">{topic.title}</span>
          )}
        </div>
      </div>
      <div className="topic-card-actions">
        <div className="status-btn-group">
          {STATUS_CYCLE.map((s) => (
            <button
              key={s}
              className={`status-btn status-btn--${s} ${status === s ? "status-btn--active" : ""}`}
              onClick={() => onSetStatus(topic.id, s)}
              title={STATUS_LABELS[s]}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {hasNote && (
          <button
            className="read-note-btn"
            onClick={() => onOpenNote(topic)}
            title="Read notes"
          >
            &#x1F4D6; Read
          </button>
        )}
      </div>
    </div>
  );
}
