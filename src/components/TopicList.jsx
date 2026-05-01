import { useState } from "react";
import { STATUS } from "../data/topics";
import { TIERS, getTier } from "../data/tiers";
import { FilterBar } from "./ui";
import TopicCard from "./TopicCard";

export default function TopicList({
  activeCategoryId,
  categories,
  getStatus,
  setStatus,
  onBack,
  onOpenNote,
}) {
  const [filter, setFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  const category = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId)
    : null;

  const categoriesToShow = category ? [category] : categories;

  function filteredTopics(topics) {
    let result = topics;
    if (filter !== "all") {
      result = result.filter((t) => getStatus(t.id) === filter);
    }
    if (tierFilter !== "all") {
      const max = parseInt(tierFilter, 10);
      result = result.filter((t) => getTier(t.id) <= max);
    }
    return result;
  }

  return (
    <div className="topic-list-page">
      <div className="topic-list-header">
        <button
          className="back-btn"
          onClick={onBack}
          data-ga-event="topics_back"
        >
          &larr; Dashboard
        </button>
        <h2 className="topic-list-title">
          {category ? category.title : "All Topics"}
        </h2>
      </div>

      <FilterBar filter={filter} onFilter={setFilter} />

      <div className="filter-bar" style={{ marginTop: "-1rem" }}>
        {[
          { key: "all", label: "All Tiers" },
          { key: "1", label: `T1 only (${TIERS[1].label})` },
          { key: "2", label: `T1–T2 (${TIERS[2].label})` },
          { key: "3", label: `T1–T3 (${TIERS[3].label})` },
        ].map((opt) => (
          <button
            key={opt.key}
            className={`filter-btn filter-btn--tier-${opt.key} ${tierFilter === opt.key ? "filter-btn--tier-active" : ""}`}
            onClick={() => setTierFilter(opt.key)}
            data-ga-event="tier_filter"
            data-ga-label={opt.key}
          >
            {opt.label}
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
