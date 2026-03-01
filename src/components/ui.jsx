// ─────────────────────────────────────────────
// Shared UI primitives — used across all tabs
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

// ── View mode hook (persisted in localStorage) ──────────────────────────────
export function useViewMode(key = "viewMode") {
  const [mode, setModeRaw] = useState(() => {
    try {
      return localStorage.getItem(key) || "card";
    } catch {
      return "card";
    }
  });
  const setMode = useCallback(
    (m) => {
      setModeRaw(m);
      try {
        localStorage.setItem(key, m);
      } catch {}
    },
    [key],
  );
  return [mode, setMode];
}

// ── View toggle button (card ↔ list) ─────────────────────────────────────────
export function ViewToggle({ mode, onToggle }) {
  return (
    <button
      className="view-toggle-btn"
      onClick={() => onToggle(mode === "card" ? "list" : "card")}
      title={mode === "card" ? "Switch to list view" : "Switch to card view"}
    >
      {mode === "card" ? "☰ List" : "▦ Cards"}
    </button>
  );
}

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

// ── Mini bar (inline, used inside category cards) ───────────────────────────
export function MiniBar({ total, done, revise }) {
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  const pctRevise = total ? Math.round((revise / total) * 100) : 0;
  return (
    <div className="mini-bar-track">
      <div className="mini-bar-fill--done" style={{ width: `${pctDone}%` }} />
      <div className="mini-bar-fill--revise" style={{ width: `${pctRevise}%`, marginLeft: `${pctDone}%` }} />
    </div>
  );
}

// ── Stat cards row (compact inline) ──────────────────────────────────────────
export function StatCards({ stats }) {
  const cards = [
    { key: 'total', label: 'Total', value: stats.total, mod: 'total' },
    { key: 'done', label: 'Done', value: stats.done, mod: 'done' },
    { key: 'revise', label: 'Revise', value: stats.revise, mod: 'revise' },
    { key: 'notStarted', label: 'Not Started', value: stats.notStarted, mod: 'not-started' },
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
    <span className={`priority-badge priority-badge--${priority}${small ? " priority-badge--small" : ""}`}>
      {priority}
    </span>
  );
}

// ── Generic ghost button (border only) ──────────────────────────────────────
export function GhostBtn({ onClick, children, danger = false, className = '' }) {
  return (
    <button
      className={`ghost-btn ${danger ? 'ghost-btn--danger' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── Primary filled button ────────────────────────────────────────────────────
export function PrimaryBtn({ onClick, children, className = '' }) {
  return (
    <button className={`primary-btn ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

// ── Filter pill buttons ──────────────────────────────────────────────────────
const FILTER_LABELS = { all: 'All', not_started: 'Not Started', revise: 'Revise', done: 'Done' };

export function FilterBar({ filter, onFilter }) {
  return (
    <div className="filter-bar">
      {Object.entries(FILTER_LABELS).map(([key, label]) => (
        <button
          key={key}
          className={`filter-btn filter-btn--${key} ${filter === key ? 'filter-btn--active' : ''}`}
          onClick={() => onFilter(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Category card ────────────────────────────────────────────────────────────
export function CategoryCard({ cat, progress, onClick }) {
  const done = cat.topics.filter((t) => progress[t.id] === "done").length;
  const revise = cat.topics.filter((t) => progress[t.id] === "revise").length;
  const pct = cat.topics.length
    ? Math.round((done / cat.topics.length) * 100)
    : 0;

  // Compute dominant priority for category
  const priorities = cat.topics.map((t) => t.priority).filter(Boolean);
  const highCount = priorities.filter((p) => p === "high").length;
  const medCount = priorities.filter((p) => p === "medium").length;
  const dominantPriority =
    highCount > 0 ? "high" : medCount > 0 ? "medium" : "low";

  return (
    <button
      className={`category-card category-card--priority-${dominantPriority}`}
      onClick={onClick}
    >
      <div className="category-card-header">
        <span className="category-card-title">{cat.title}</span>
        <span className="category-card-count">
          {done}/{cat.topics.length}
        </span>
      </div>
      <MiniBar total={cat.topics.length} done={done} revise={revise} />
      <div className="category-card-footer">
        <span
          className={`badge badge--revise ${revise === 0 ? "badge--dim" : ""}`}
        >
          {revise} revise
        </span>
        <span className="category-pct">{pct}%</span>
      </div>
    </button>
  );
}
