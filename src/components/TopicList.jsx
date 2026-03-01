import { useState } from 'react';
import { STATUS } from '../data/topics';
import { FilterBar } from './ui';
import TopicCard from './TopicCard';

export default function TopicList({
  activeCategoryId,
  categories,
  getStatus,
  setStatus,
  onBack,
  onOpenNote,
}) {
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const category = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId)
    : null;

  const categoriesToShow = category ? [category] : categories;

  function filteredTopics(topics) {
    let result = topics;
    if (filter !== "all") {
      result = result.filter((t) => getStatus(t.id) === filter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    return result;
  }

  return (
    <div className="topic-list-page">
      <div className="topic-list-header">
        <button className="back-btn" onClick={onBack}>
          &larr; Dashboard
        </button>
        <h2 className="topic-list-title">
          {category ? category.title : "All Topics"}
        </h2>
      </div>

      <FilterBar filter={filter} onFilter={setFilter} />

      <div className="filter-bar" style={{ marginTop: "-1rem" }}>
        {["all", "high", "medium", "low"].map((p) => (
          <button
            key={p}
            className={`filter-btn filter-btn--priority-${p} ${priorityFilter === p ? "filter-btn--priority-active" : ""}`}
            onClick={() => setPriorityFilter(p)}
          >
            {p === "all"
              ? "All Priorities"
              : `${p.charAt(0).toUpperCase() + p.slice(1)} Priority`}
          </button>
        ))}
      </div>

      {categoriesToShow.map((cat) => {
        const visible = filteredTopics(cat.topics);
        if (visible.length === 0) return null;
        return (
          <div key={cat.id} className="category-section">
            {!category && (
              <h3 className="category-section-title">{cat.title}</h3>
            )}
            <div className="topic-cards-grid">
              {visible.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  status={getStatus(topic.id)}
                  onSetStatus={setStatus}
                  onOpenNote={onOpenNote}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
