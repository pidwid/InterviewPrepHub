import { useEffect, useMemo, useRef, useState } from "react";

// Lightweight fuzzy match — no extra dependencies. Returns a score; higher
// is better. Returns -1 when there's no match. Subsequence-based with bonuses
// for prefix matches and consecutive characters.
function fuzzyScore(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500 - t.length;
  const idx = t.indexOf(q);
  if (idx >= 0) return 200 - idx - t.length / 10;
  // subsequence fallback: every char of q must appear in order in t
  let qi = 0;
  let consecutive = 0;
  let score = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      qi++;
      consecutive++;
      score += 1 + consecutive;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score - t.length / 20 : -1;
}

function ResultRow({ item, active, onSelect }) {
  return (
    <li
      className={`sp-result ${active ? "sp-result--active" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
    >
      <span className={`sp-badge sp-badge--${item.section}`}>
        {item.section.toUpperCase()}
      </span>
      <span className="sp-result-title">{item.title}</span>
      <span className="sp-result-meta">{item.kind}</span>
    </li>
  );
}

/**
 * Cmd+K global search palette. `index` is an array of
 *   { id, title, section: 'sd'|'lld', kind: 'topic'|'practice', noteFile }.
 * onSelect receives the chosen item; the parent decides what to do.
 */
export default function SearchPalette({ index, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return index.slice(0, 30);
    return index
      .map((item) => ({ item, score: fuzzyScore(query, item.title) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((r) => r.item);
  }, [query, index]);

  // Derive a safe active index — no need for an effect to clamp.
  const safeIdx = Math.min(activeIdx, Math.max(results.length - 1, 0));

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(Math.min(safeIdx + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(Math.max(safeIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[safeIdx]) onSelect(results[safeIdx]);
    }
  }

  return (
    <div className="settings-overlay sp-overlay" onClick={onClose}>
      <div
        className="settings-dialog sp-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="sp-input"
          type="text"
          placeholder="Search topics, problems, notes…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <ul className="sp-results">
          {results.length === 0 ? (
            <li className="sp-empty">No matches.</li>
          ) : (
            results.map((item, i) => (
              <ResultRow
                key={`${item.section}:${item.id}`}
                item={item}
                active={i === safeIdx}
                onSelect={onSelect}
              />
            ))
          )}
        </ul>
        <div className="sp-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
