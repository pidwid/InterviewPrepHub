// ─────────────────────────────────────────────
// Shared UI primitives — used across all tabs
// ─────────────────────────────────────────────

// ── Progress bar (full-width, stacked done+revise) ──────────────────────────
export function ProgressBar({ pctDone, pctRevise }) {
  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-label">
        Overall Progress &mdash; <strong>{pctDone}% done</strong>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill progress-bar-fill--done" style={{ width: `${pctDone}%` }} />
        <div className="progress-bar-fill progress-bar-fill--revise" style={{ width: `${pctRevise}%`, left: `${pctDone}%` }} />
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

// ── Stat cards row ───────────────────────────────────────────────────────────
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
  const done = cat.topics.filter((t) => progress[t.id] === 'done').length;
  const revise = cat.topics.filter((t) => progress[t.id] === 'revise').length;
  const pct = cat.topics.length ? Math.round((done / cat.topics.length) * 100) : 0;

  return (
    <button className="category-card" onClick={onClick}>
      <div className="category-card-header">
        <span className="category-card-title">{cat.title}</span>
        <span className="category-card-count">{done}/{cat.topics.length}</span>
      </div>
      <MiniBar total={cat.topics.length} done={done} revise={revise} />
      <div className="category-card-footer">
        <span className={`badge badge--revise ${revise === 0 ? 'badge--dim' : ''}`}>
          {revise} revise
        </span>
        <span className="category-pct">{pct}%</span>
      </div>
    </button>
  );
}

// ── GitHub icon (used in solution button) ───────────────────────────────────
export function GitHubIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
