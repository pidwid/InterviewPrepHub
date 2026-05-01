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
          <button
            className="reset-progress-btn"
            onClick={onReset}
            data-ga-event="progress_reset"
          >
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

// ── Tier badge ──────────────────────────────────────────────────────────────
//
// Renders the tier of a topic as a small pill. Tier is derived from the
// topic id (see data/tiers.js) — no per-topic field is required.
import { getTierMeta } from "../data/tiers";

export function TierBadge({ topicId, small }) {
  if (!topicId) return null;
  const meta = getTierMeta(topicId);
  return (
    <span
      className={`tier-badge tier-badge--${meta.color}${
        small ? " tier-badge--small" : ""
      }`}
      title={`${meta.short} — ${meta.desc}`}
    >
      {meta.label}
    </span>
  );
}

// ── Tier legend (compact horizontal explainer) ─────────────────────────────
//
// Used on Index / Roadmap to explain what tier badges mean at a glance.
import { TIERS } from "../data/tiers";

export function TierLegend() {
  return (
    <div className="tier-legend" role="note">
      <span className="tier-legend-label">Tiers:</span>
      {[1, 2, 3, 4].map((t) => {
        const meta = TIERS[t];
        return (
          <span
            key={t}
            className={`tier-legend-item tier-badge tier-badge--${meta.color}`}
            title={meta.desc}
          >
            {meta.label}
          </span>
        );
      })}
      <span className="tier-legend-help">
        Sized for time available. Hover for details.
      </span>
    </div>
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
          className={`filter-btn filter-btn--${key} ${
            filter === key ? "filter-btn--active" : ""
          }`}
          onClick={() => onFilter(key)}
          data-ga-event="status_filter"
          data-ga-label={key}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
