export const TABS = [
  {
    id: 'sd',
    label: 'System Design',
    short: 'SD',
    accent: '#667eea',
  },
  {
    id: 'lld',
    label: 'Low Level Design',
    short: 'LLD',
    accent: '#ed8936',
  },
  {
    id: 'cc',
    label: 'Coding Challenges',
    short: 'CC',
    accent: '#38b2ac',
  },
];

export default function TabNav({ activeTab, onTabChange, tabStats }) {
  return (
    <nav className="tab-nav">
      <div className="tab-nav-inner">
        {TABS.map((tab) => {
          const stats = tabStats[tab.id];
          const pct = stats && stats.total > 0
            ? Math.round((stats.done / stats.total) * 100)
            : 0;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`tab-btn ${isActive ? 'tab-btn--active' : ''}`}
              style={{ '--tab-accent': tab.accent }}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="tab-btn-label">{tab.label}</span>
              <span className="tab-btn-pct">{pct}%</span>
              <div className="tab-btn-bar">
                <div
                  className="tab-btn-bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
