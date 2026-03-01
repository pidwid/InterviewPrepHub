import { useState, useMemo, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { getNoteContent } from "../data/notes";
import { getLLDNoteContent } from "../data/lldNotes";
import InlinePractice, { topicHasQuestions, getQuestionCount, getTopicNumFromNoteFile } from "./InlinePractice";

function getContent(noteFile) {
  if (!noteFile) return null;
  return getNoteContent(noteFile) || getLLDNoteContent(noteFile) || null;
}

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
function SidebarCategory({ cat, progress, activeTopic, onSelect, isExpanded, onToggle }) {
  const done = cat.topics.filter((t) => progress[t.id] === "done").length;
  const total = cat.topics.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`sb-category ${isExpanded ? "sb-category--open" : ""}`}>
      <button className="sb-category-header" onClick={onToggle}>
        <span className={`sb-category-chevron ${isExpanded ? "sb-category-chevron--open" : ""}`}>
          ›
        </span>
        <span className="sb-category-title">{cat.title}</span>
        <span className="sb-category-progress">
          <span className="sb-category-pct">{pct}%</span>
          <span className="sb-category-count">{done}/{total}</span>
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
                {topic.priority && (
                  <span className={`sb-priority sb-priority--${topic.priority}`}>
                    {topic.priority === "high" ? "!" : topic.priority === "medium" ? "•" : ""}
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

// ── Content Panel ───────────────────────────────────────────────────────────
function ContentPanel({ topic, status, onSetStatus }) {
  const [activeTab, setActiveTab] = useState('notes');

  // Reset to notes tab when topic changes
  const topicId = topic?.id;
  const prevTopicRef = useState({ id: null });
  if (topicId && topicId !== prevTopicRef[0].id) {
    prevTopicRef[0].id = topicId;
    if (activeTab !== 'notes') setActiveTab('notes');
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

  const content = getContent(topic.noteFile);
  const hasQuestions = topicHasQuestions(topic.noteFile);
  const questionCount = hasQuestions ? getQuestionCount(topic.noteFile) : 0;
  const topicNum = getTopicNumFromNoteFile(topic.noteFile);

  return (
    <div className="sb-content">
      {/* Header bar with title + action buttons */}
      <div className="sb-content-header">
        <div className="sb-content-title-area">
          <h1 className="sb-content-title">{topic.title}</h1>
          {topic.priority && (
            <span className={`priority-badge priority-badge--${topic.priority} priority-badge--small`}>
              {topic.priority}
            </span>
          )}
        </div>
        <div className="sb-content-actions">
          {hasQuestions && (
            <button
              className={`sb-practice-btn ${activeTab === 'practice' ? 'sb-practice-btn--active' : ''}`}
              onClick={() => setActiveTab(activeTab === 'practice' ? 'notes' : 'practice')}
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
              {s === "not_started" ? "Not Started" : s === "revise" ? "↻ Revise" : "✓ Done"}
            </button>
          ))}
        </div>
      </div>

      {/* Content body */}
      {activeTab === 'notes' ? (
        <div className="sb-content-body markdown-body">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  return inline ? (
                    <code className="inline-code" {...props}>{children}</code>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  );
                },
                a({ node, children, href, ...props }) {
                  return (
                    <a href={href} target="_blank" rel="noreferrer" {...props}>
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <div className="sb-no-content">
              <p>No notes available for this topic yet.</p>
              <p className="sb-no-content-hint">
                Create <code>{topic.noteFile}</code> to add content.
              </p>
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
export default function SidebarLayout({ categories, progress, getStatus, setStatus, onOpenNote, initialTopicId, onInitialTopicConsumed }) {
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

  const handleSelectTopic = useCallback((topic) => {
    setActiveTopic(topic);
  }, []);

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
  const totalRevise = allTopics.filter((t) => progress[t.id] === "revise").length;
  const totalPct = allTopics.length ? Math.round((totalDone / allTopics.length) * 100) : 0;

  const activeStatus = activeTopic ? (progress[activeTopic.id] || "not_started") : "not_started";

  // Quick review: pick random revise topic
  const reviseTopics = useMemo(
    () => allTopics.filter((t) => progress[t.id] === "revise"),
    [allTopics, progress]
  );
  const pickRandomRevise = () => {
    if (reviseTopics.length === 0 || !onOpenNote) return;
    const picked = reviseTopics[Math.floor(Math.random() * reviseTopics.length)];
    if (picked.noteFile) {
      onOpenNote(picked);
      setActiveTopic(picked);
    }
  };

  return (
    <div className={`sb-layout ${sidebarCollapsed ? "sb-layout--collapsed" : ""}`}>
      {/* Sidebar */}
      <aside className={`sb-sidebar ${sidebarCollapsed ? "sb-sidebar--collapsed" : ""}`}>
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
                <button className="sb-search-clear" onClick={() => setSearchQuery("")}>
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
      <main className="sb-main">
        <ContentPanel
          topic={activeTopic}
          status={activeStatus}
          onSetStatus={setStatus}
        />
      </main>
    </div>
  );
}
