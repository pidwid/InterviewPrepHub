import { useMemo } from "react";
import { localDateKey as dateKey } from "../store/useStreakState";

// GitHub-style activity heatmap (52 weeks × 7 days) + streak headline stats.
// Pure SVG, no dependencies.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 52;

function intensityClass(count) {
  if (!count) return "sh-cell sh-cell--0";
  if (count >= 5) return "sh-cell sh-cell--4";
  if (count >= 3) return "sh-cell sh-cell--3";
  if (count >= 2) return "sh-cell sh-cell--2";
  return "sh-cell sh-cell--1";
}

export default function StreakHeatmap({ state, stats }) {
  const cells = useMemo(() => {
    // Build a 7×52 grid ending today (Sunday-to-Saturday columns)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Anchor on the most recent Saturday so the rightmost column is "this week"
    const dow = today.getDay();
    const lastDayOfGrid = new Date(today.getTime() + (6 - dow) * DAY_MS);

    const rows = [];
    for (let row = 0; row < 7; row++) {
      const weeks = [];
      for (let col = 0; col < WEEKS; col++) {
        const offsetDays = (WEEKS - 1 - col) * 7 + (6 - row);
        const d = new Date(lastDayOfGrid.getTime() - offsetDays * DAY_MS);
        const key = dateKey(d);
        const count = d > today ? null : state[key] || 0;
        weeks.push({ key, count });
      }
      rows.push(weeks);
    }
    return rows;
  }, [state]);

  return (
    <div className="streak-heatmap">
      <div className="streak-stats">
        <div className="streak-stat">
          <span className="streak-stat-value">🔥 {stats.current}</span>
          <span className="streak-stat-label">current streak</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-value">🏆 {stats.longest}</span>
          <span className="streak-stat-label">longest streak</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-value">📅 {stats.total}</span>
          <span className="streak-stat-label">total study days</span>
        </div>
      </div>
      <svg
        className="streak-grid"
        viewBox={`0 0 ${WEEKS * 13} ${7 * 13}`}
        role="img"
        aria-label="Study activity heatmap"
      >
        {cells.map((row, r) =>
          row.map(({ key, count }, c) => {
            if (count === null) return null;
            return (
              <rect
                key={key}
                x={c * 13}
                y={r * 13}
                width={11}
                height={11}
                rx={2}
                className={intensityClass(count)}
              >
                <title>{`${key}: ${count} ${count === 1 ? "activity" : "activities"}`}</title>
              </rect>
            );
          }),
        )}
      </svg>
    </div>
  );
}
