import { useState, useMemo } from "react";
import { StatCards, ProgressBar } from "./ui";

const STATUS_DOT = {
  done: "✓",
  revise: "↻",
  not_started: "○",
};

const STATUS_CLASS = {
  done: "index-status--done",
  revise: "index-status--revise",
  not_started: "index-status--not-started",
};

export default function IndexPage({ categories, progress, onOpenNote, stats, pctDone, pctRevise, onReset }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        topics: c.topics.filter((t) => t.title.toLowerCase().includes(q)),
      }))
      .filter((c) => c.topics.length > 0);
  }, [categories, search]);

  const totalTopics = categories.flatMap((c) => c.topics).length;
  let globalIdx = 0;

  return (
    <div className="index-page">
      {stats && (
        <div className="stats-progress-row">
          <StatCards stats={stats} />
          <ProgressBar
            pctDone={pctDone}
            pctRevise={pctRevise}
            onReset={onReset}
          />
        </div>
      )}

      <div className="index-controls">
        <div className="index-search">
          <span className="search-bar-icon">&#x1F50D;</span>
          <input
            type="text"
            className="search-bar-input"
            placeholder="Filter topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="search-bar-clear"
              onClick={() => setSearch("")}
            >
              &times;
            </button>
          )}
        </div>
        <span className="index-count">{totalTopics} topics</span>
      </div>

      {filtered.map((cat) => (
        <div key={cat.id} className="index-category">
          <div className="index-category-title">{cat.title}</div>
          <div className="index-topic-list">
            {cat.topics.map((topic) => {
              globalIdx++;
              const status = progress[topic.id] || "not_started";
              return (
                <button
                  key={topic.id}
                  className={`index-topic-row ${STATUS_CLASS[status]}`}
                  onClick={() => topic.noteFile && onOpenNote(topic)}
                  disabled={!topic.noteFile}
                >
                  <span className="index-topic-num">{globalIdx}</span>
                  <span className={`index-topic-dot ${STATUS_CLASS[status]}`}>
                    {STATUS_DOT[status]}
                  </span>
                  <span className="index-topic-name">{topic.title}</span>
                  {topic.priority && (
                    <span
                      className={`priority-badge priority-badge--${topic.priority} priority-badge--small`}
                    >
                      {topic.priority}
                    </span>
                  )}
                  {topic.noteFile && (
                    <span className="index-topic-arrow">›</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="index-empty">No topics match &ldquo;{search}&rdquo;</p>
      )}
    </div>
  );
}
