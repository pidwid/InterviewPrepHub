import { STATUS, STATUS_LABELS } from '../data/topics';
import { GitHubIcon } from './ui';

const STATUS_CYCLE = [STATUS.NOT_STARTED, STATUS.REVISE, STATUS.DONE];

export default function TopicCard({ topic, status, onSetStatus }) {
  return (
    <div className={`topic-card topic-card--${status}`}>
      <div className="topic-card-info">
        <a
          href={topic.url}
          target="_blank"
          rel="noreferrer"
          className="topic-card-title"
        >
          {topic.title}
        </a>
      </div>
      <div className="topic-card-actions">
        <div className="status-btn-group">
          {STATUS_CYCLE.map((s) => (
            <button
              key={s}
              className={`status-btn status-btn--${s} ${status === s ? 'status-btn--active' : ''}`}
              onClick={() => onSetStatus(topic.id, s)}
              title={STATUS_LABELS[s]}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {topic.solutionUrl && (
          <a
            href={topic.solutionUrl}
            target="_blank"
            rel="noreferrer"
            className="solution-btn"
            title="View solution on GitHub"
          >
            <GitHubIcon size={12} />
            Solution
          </a>
        )}
      </div>
    </div>
  );
}
