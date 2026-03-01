// ─────────────────────────────────────────────
// Shared UI primitives — used across all tabs
// ─────────────────────────────────────────────

// ── Progress bar (full-width, stacked done+revise) ──────────────────────────
export function ProgressBar({ pctDone, pctRevise, onReset }) {
  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-header">
        <div className="progress-bar-label">
          Overall Progress &mdash; <strong>{pctDone}% done</strong>
        </div>
        {onReset && (
          <button className="reset-progress-btn" onClick={onReset}>
            &#x21BB; Reset
          </button>
        )}
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill progress-bar-fill--done"
          style={{ width: `${pctDone}%` }}
        />
        <div
          className="progress-bar-fill progress-bar-fill--revise"
          style={{ width: `${pctRevise}%`, left: `${pctDone}%` }}
        />
      </div>
      <div className="progress-bar-legend">
        <span className="legend-dot legend-dot--done" /> Done
        <span className="legend-dot legend-dot--revise" /> Revise
        <span className="legend-dot legend-dot--not-started" /> Not Started
      </div>
    </div>
  );
}

// ── Stat cards row (compact inline) ──────────────────────────────────────────
export function StatCards({ stats }) {
  const cards = [
    { key: "total", label: "Total", value: stats.total, mod: "total" },
    { key: "done", label: "Done", value: stats.done, mod: "done" },
    { key: "revise", label: "Revise", value: stats.revise, mod: "revise" },
    {
      key: "notStarted",
      label: "Not Started",
      value: stats.notStarted,
      mod: "not-started",
    },
  ];
  return (
    <div className="stat-cards">
      {cards.map(({ key, label, value, mod }) => (
        <div key={key} className={`stat-card stat-card--${mod}`}>
          <span className="stat-number">{value}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Priority badge ──────────────────────────────────────────────────────────
export function PriorityBadge({ priority, small }) {
  if (!priority) return null;
  return (
    <span
      className={`priority-badge priority-badge--${priority}${small ? " priority-badge--small" : ""}`}
    >
      {priority}
    </span>
  );
}

// ── Filter pill buttons ──────────────────────────────────────────────────────
const FILTER_LABELS = {
  all: "All",
  not_started: "Not Started",
  revise: "Revise",
  done: "Done",
};

export function FilterBar({ filter, onFilter }) {
  return (
    <div className="filter-bar">
      {Object.entries(FILTER_LABELS).map(([key, label]) => (
        <button
          key={key}
          className={`filter-btn filter-btn--${key} ${filter === key ? "filter-btn--active" : ""}`}
          onClick={() => onFilter(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
