import { StatCards, ProgressBar, CategoryCard } from './ui';

export default function Dashboard({ stats, progress, onNavigate, categories }) {
  const pctDone   = stats.total ? Math.round((stats.done   / stats.total) * 100) : 0;
  const pctRevise = stats.total ? Math.round((stats.revise / stats.total) * 100) : 0;

  return (
    <div className="dashboard">
      <StatCards stats={stats} />

      <ProgressBar pctDone={pctDone} pctRevise={pctRevise} />

      <h2 className="section-heading">Categories</h2>
      <div className="category-grid">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            progress={progress}
            onClick={() => onNavigate(cat.id)}
          />
        ))}
      </div>
    </div>
  );
}
