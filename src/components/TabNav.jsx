import { getStorageMode } from "../store/storageMiddleware";

export const TABS = [
  {
    id: "sd",
    label: "System Design",
    short: "SD",
    accent: "#667eea",
  },

  {
    id: "lld",
    label: "Low Level Design",
    short: "LLD",
    accent: "#e53e3e",
  },
];

export default function TabNav({
  activeTab,
  onTabChange,
  tabStats,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenSearch,
}) {
  const storageMode = getStorageMode();

  return (
    <nav className="tab-nav">
      <div className="tab-nav-inner">
        <div className="tab-nav-brand-container">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="Logo"
            className="tab-nav-logo"
          />
          <span className="tab-nav-brand">Interview Prep Hub</span>
        </div>
        {TABS.map((tab) => {
          const stats = tabStats[tab.id];
          const pct =
            stats && stats.total > 0
              ? Math.round((stats.done / stats.total) * 100)
              : 0;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`tab-btn ${isActive ? "tab-btn--active" : ""}`}
              style={{ "--tab-accent": tab.accent }}
              onClick={() => onTabChange(tab.id)}
              data-ga-event="tab_switch"
              data-ga-label={tab.id}
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
        <div className="tab-nav-actions">
          {onOpenSearch && (
            <button
              className="theme-toggle-btn"
              onClick={onOpenSearch}
              title="Search (⌘K / Ctrl+K)"
              aria-label="Open search"
              data-ga-event="search_open"
            >
              🔍
            </button>
          )}
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            data-ga-event="theme_toggle"
            data-ga-label={theme === "dark" ? "to_light" : "to_dark"}
          >
            {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
          </button>
          <button
            className="settings-nav-btn"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Open settings"
            data-ga-event="settings_open"
          >
            <span className="settings-nav-icon">&#x2699;&#xFE0F;</span>
            {storageMode === "turso" && (
              <span className="settings-nav-badge" title="Turso DB active">
                &#x2601;&#xFE0F;
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
