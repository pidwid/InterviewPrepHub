import { useState } from 'react';
import { STATUS } from '../data/topics';
import { FilterBar } from './ui';
import TopicCard from './TopicCard';

export default function TopicList({ activeCategoryId, categories, getStatus, setStatus, onBack }) {
  const [filter, setFilter] = useState('all');

  const category = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId)
    : null;

  const categoriesToShow = category ? [category] : categories;

  function filteredTopics(topics) {
    if (filter === 'all') return topics;
    return topics.filter((t) => getStatus(t.id) === filter);
  }

  return (
    <div className="topic-list-page">
      <div className="topic-list-header">
        <button className="back-btn" onClick={onBack}>
          &larr; Dashboard
        </button>
        <h2 className="topic-list-title">
          {category ? category.title : 'All Topics'}
        </h2>
      </div>

      <FilterBar filter={filter} onFilter={setFilter} />

      {categoriesToShow.map((cat) => {
        const visible = filteredTopics(cat.topics);
        if (visible.length === 0) return null;
        return (
          <div key={cat.id} className="category-section">
            {!category && (
              <h3 className="category-section-title">{cat.title}</h3>
            )}
            <div className="topic-cards">
              {visible.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  status={getStatus(topic.id)}
                  onSetStatus={setStatus}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
