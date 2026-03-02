import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import MarkdownRenderer, { getContent } from "./MarkdownRenderer";
import { useBookmarks } from "../store/useBookmarks";
import InlinePractice, {
  topicHasQuestions,
  getQuestionCount,
  getTopicNumFromNoteFile,
} from "./InlinePractice";

// ── Status helpers ──────────────────────────────────────────────────────────
const STATUS_ICON = {
  done: "✓",
  revise: "↻",
  not_started: "○",
};

const STATUS_CLS = {
  done: "sb-status--done",
  revise: "sb-status--revise",
  not_started: "sb-status--default",
};

// ── Sidebar Item ────────────────────────────────────────────────────────────
function SidebarCategory({
  cat,
  progress,
  activeTopic,
  onSelect,
  isExpanded,
  onToggle,
  hasBookmarkFn,
}) {
  const done = cat.topics.filter((t) => progress[t.id] === "done").length;
  const total = cat.topics.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`sb-category ${isExpanded ? "sb-category--open" : ""}`}>
      <button className="sb-category-header" onClick={onToggle}>
        <span
          className={`sb-category-chevron ${isExpanded ? "sb-category-chevron--open" : ""}`}
        >
          ›
        </span>
        <span className="sb-category-title">{cat.title}</span>
        <span className="sb-category-progress">
          <span className="sb-category-pct">{pct}%</span>
          <span className="sb-category-count">
            {done}/{total}
          </span>
        </span>
      </button>
      {isExpanded && (
        <div className="sb-topic-list">
          {cat.topics.map((topic, idx) => {
            const status = progress[topic.id] || "not_started";
            const isActive = activeTopic?.id === topic.id;
            return (
              <button
                key={topic.id}
                className={`sb-topic-item ${isActive ? "sb-topic-item--active" : ""} ${STATUS_CLS[status]}`}
                onClick={() => onSelect(topic)}
              >
                <span className="sb-topic-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={`sb-topic-dot ${STATUS_CLS[status]}`}>
                  {STATUS_ICON[status]}
                </span>
                <span className="sb-topic-name">{topic.title}</span>
                {hasBookmarkFn?.(topic.noteFile || topic.solutionFile) && (
                  <span className="sb-bookmark-dot" title="Study marker inside">🔖</span>
                )}
                {topic.priority && (
                  <span
                    className={`sb-priority sb-priority--${topic.priority}`}
                  >
                    {topic.priority === "high"
                      ? "!"
                      : topic.priority === "medium"
                        ? "•"
                        : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── YouTube Embed ────────────────────────────────────────────────────────────
function YouTubeEmbed({ videoId }) {
  return (
    <div className="yt-embed-wrap">
      <iframe
        className="yt-embed-frame"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

// ── Content Panel ───────────────────────────────────────────────────────────
function ContentPanel({
  topic,
  status,
  onSetStatus,
  scrollRef,
  getBookmark,
  onSetBookmark,
}) {
  const [activeTab, setActiveTab] = useState("notes");

  // Reset to notes tab and scroll to top when topic changes
  const topicId = topic?.id;
  const prevTopicRef = useState({ id: null });
  if (topicId && topicId !== prevTopicRef[0].id) {
    prevTopicRef[0].id = topicId;
    if (activeTab !== "notes") setActiveTab("notes");
    scrollRef?.current?.scrollTo(0, 0);
  }

  if (!topic) {
    return (
      <div className="sb-content sb-content--empty">
        <div className="sb-empty-state">
          <span className="sb-empty-icon">📖</span>
          <h2>Select a topic</h2>
          <p>Choose a topic from the sidebar to start reading.</p>
        </div>
      </div>
    );
  }

  const targetFile = topic.noteFile || topic.solutionFile;
  const content = getContent(targetFile);
  const hasQuestions = topicHasQuestions(targetFile);
  const questionCount = hasQuestions ? getQuestionCount(targetFile) : 0;
  const topicNum = getTopicNumFromNoteFile(targetFile);
  const hasVideo = !!topic.youtubeId;

  return (
    <div className="sb-content">
      {/* Header bar with title + action buttons */}
      <div className="sb-content-header">
        <div className="sb-content-title-area">
          <h1 className="sb-content-title">{topic.title}</h1>
          {topic.priority && (
            <span
              className={`priority-badge priority-badge--${topic.priority} priority-badge--small`}
            >
              {topic.priority}
            </span>
          )}
        </div>
        <div className="sb-content-actions">
          {hasVideo && (
            <button
              className={`sb-practice-btn ${activeTab === "video" ? "sb-practice-btn--active" : ""}`}
              onClick={() =>
                setActiveTab(activeTab === "video" ? "notes" : "video")
              }
            >
              ▶ Video
            </button>
          )}
          {hasQuestions && (
            <button
              className={`sb-practice-btn ${activeTab === "practice" ? "sb-practice-btn--active" : ""}`}
              onClick={() =>
                setActiveTab(activeTab === "practice" ? "notes" : "practice")
              }
            >
              📝 Practice ({questionCount} Qs)
            </button>
          )}
          {["not_started", "revise", "done"].map((s) => (
            <button
              key={s}
              className={`sb-action-btn sb-action-btn--${s} ${status === s ? "sb-action-btn--active" : ""}`}
              onClick={() => onSetStatus(topic.id, s)}
            >
              {s === "not_started"
                ? "Not Started"
                : s === "revise"
                  ? "↻ Revise"
                  : "✓ Done"}
            </button>
          ))}
        </div>
      </div>

      {/* Bookmark banner */}
      {activeTab === "notes" && getBookmark?.(targetFile) && (
        <div className="sb-bookmark-banner">
          <span className="sb-bookmark-banner-icon">🔖</span>
          <span className="sb-bookmark-banner-text">Study marker set</span>
          <button
            className="sb-bookmark-banner-jump"
            onClick={() => {
              const el = document.getElementById(getBookmark(targetFile));
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Jump to marker ↓
          </button>
          <button
            className="sb-bookmark-banner-clear"
            onClick={() => onSetBookmark(targetFile, null)}
            title="Clear marker"
          >
            ×
          </button>
        </div>
      )}

      {/* Content body */}
      {activeTab === "video" ? (
        <div className="sb-content-body">
          <YouTubeEmbed videoId={topic.youtubeId} />
        </div>
      ) : activeTab === "notes" ? (
        <div className="sb-content-body markdown-body">
          {content ? (
            <MarkdownRenderer
              content={content}
              noteFile={targetFile}
              bookmarkedHeadingId={getBookmark?.(targetFile)}
              onSetBookmark={onSetBookmark}
            />
          ) : (
            <div className="sb-no-content">
              <p>No notes available for this topic yet.</p>
              {targetFile && (
                <p className="sb-no-content-hint">
                  Create <code>{targetFile}</code> to add content.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="sb-content-body">
          <InlinePractice topicNum={topicNum} />
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar Layout ─────────────────────────────────────────────────────
export default function SidebarLayout({
  categories,
  progress,
  setStatus,
  initialTopicId,
  onInitialTopicConsumed,
  onTopicSelect,
}) {
  const mainRef = useRef(null);
  const { getBookmark, setBookmark, hasBookmark } = useBookmarks();
  const [activeTopic, setActiveTopic] = useState(null);
  const [expandedCats, setExpandedCats] = useState(() => {
    // Start with first category expanded
    return categories.length > 0 ? new Set([categories[0].id]) : new Set();
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleCategory = useCallback((catId) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const handleSelectTopic = useCallback(
    (topic) => {
      setActiveTopic(topic);
      onTopicSelect?.(topic.id);
    },
    [onTopicSelect],
  );

  // Auto-select topic when navigated from roadmap
  useEffect(() => {
    if (!initialTopicId) return;
    // Find the topic across all categories
    for (const cat of categories) {
      const topic = cat.topics.find((t) => t.id === initialTopicId);
      if (topic) {
        setActiveTopic(topic);
        setExpandedCats((prev) => new Set([...prev, cat.id]));
        break;
      }
    }
    onInitialTopicConsumed?.();
  }, [initialTopicId, categories, onInitialTopicConsumed]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        topics: cat.topics.filter((t) => t.title.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.topics.length > 0);
  }, [categories, searchQuery]);

  // Overall stats
  const allTopics = categories.flatMap((c) => c.topics);
  const totalDone = allTopics.filter((t) => progress[t.id] === "done").length;
  const totalRevise = allTopics.filter(
    (t) => progress[t.id] === "revise",
  ).length;
  const totalPct = allTopics.length
    ? Math.round((totalDone / allTopics.length) * 100)
    : 0;

  const activeStatus = activeTopic
    ? progress[activeTopic.id] || "not_started"
    : "not_started";

  // Quick review: pick random revise topic
  const reviseTopics = useMemo(
    () => allTopics.filter((t) => progress[t.id] === "revise"),
    [allTopics, progress],
  );
  const pickRandomRevise = () => {
    if (reviseTopics.length === 0) return;
    const picked =
      reviseTopics[Math.floor(Math.random() * reviseTopics.length)];
    if (picked.noteFile || picked.solutionFile) {
      handleSelectTopic(picked);
      // Expand the category containing the picked topic
      for (const cat of categories) {
        if (cat.topics.some((t) => t.id === picked.id)) {
          setExpandedCats((prev) => new Set([...prev, cat.id]));
          break;
        }
      }
    }
  };

  return (
    <div
      className={`sb-layout ${sidebarCollapsed ? "sb-layout--collapsed" : ""}`}
    >
      {/* Sidebar */}
      <aside
        className={`sb-sidebar ${sidebarCollapsed ? "sb-sidebar--collapsed" : ""}`}
      >
        {!sidebarCollapsed && (
          <>
            {/* Overall progress */}
            <div className="sb-sidebar-progress">
              <div className="sb-sidebar-progress-bar">
                <div
                  className="sb-sidebar-progress-fill sb-sidebar-progress-fill--done"
                  style={{ width: `${totalPct}%` }}
                />
                <div
                  className="sb-sidebar-progress-fill sb-sidebar-progress-fill--revise"
                  style={{
                    width: `${allTopics.length ? Math.round((totalRevise / allTopics.length) * 100) : 0}%`,
                    left: `${totalPct}%`,
                  }}
                />
              </div>
              <div className="sb-sidebar-progress-info">
                <span className="sb-sidebar-progress-label">
                  {totalDone}/{allTopics.length} done · {totalRevise} revise
                </span>
                {reviseTopics.length > 0 && (
                  <button
                    className="sb-quick-review-btn"
                    onClick={pickRandomRevise}
                  >
                    &#x1F500; Quick Review ({reviseTopics.length})
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="sb-sidebar-search">
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sb-search-input"
              />
              {searchQuery && (
                <button
                  className="sb-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </div>

            {/* Category list */}
            <nav className="sb-category-nav">
              {filteredCategories.map((cat) => (
                <SidebarCategory
                  key={cat.id}
                  cat={cat}
                  progress={progress}
                  activeTopic={activeTopic}
                  onSelect={handleSelectTopic}
                  isExpanded={expandedCats.has(cat.id)}
                  onToggle={() => toggleCategory(cat.id)}
                  hasBookmarkFn={hasBookmark}
                />
              ))}
              {filteredCategories.length === 0 && (
                <p className="sb-no-results">No topics match "{searchQuery}"</p>
              )}
            </nav>
          </>
        )}
      </aside>

      {/* Collapse/expand toggle on vertical divider */}
      <button
        className="sb-edge-collapse"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? "»" : "«"}
      </button>

      {/* Content */}
      <main className="sb-main" ref={mainRef}>
        <ContentPanel
          topic={activeTopic}
          status={activeStatus}
          onSetStatus={setStatus}
          scrollRef={mainRef}
          getBookmark={getBookmark}
          onSetBookmark={setBookmark}
        />
      </main>
    </div>
  );
}
