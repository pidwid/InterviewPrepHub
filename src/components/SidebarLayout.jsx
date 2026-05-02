import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { STATUS } from "../data/topics";
import MarkdownRenderer from "./MarkdownRenderer";
import NoteNav from "./NoteNav";
import { getContent, loadContent } from "../data/contentLoader";
import { useBookmarks } from "../store/useBookmarks";
import { TierBadge } from "./ui";
import {
  estimateReadMinutes,
  formatReadMinutes,
} from "../util/readTime";
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
// Layout breakpoint — keep in sync with sidebar.css
const MOBILE_BREAKPOINT = 760;

function SidebarCategory({
  cat,
  progress,
  activeTopic,
  onSelect,
  isExpanded,
  onToggle,
  hasBookmarkFn,
  isViewedFn,
}) {
  const done = cat.topics.filter((t) => progress[t.id] === STATUS.DONE).length;
  const total = cat.topics.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`sb-category ${isExpanded ? "sb-category--open" : ""}`}>
      <button
        className="sb-category-header"
        onClick={onToggle}
        data-ga-event="category_toggle"
        data-ga-label={cat.id}
      >
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
            const status = progress[topic.id] || STATUS.NOT_STARTED;
            const isActive = activeTopic?.id === topic.id;
            return (
              <button
                key={topic.id}
                className={`sb-topic-item ${isActive ? "sb-topic-item--active" : ""} ${STATUS_CLS[status]}`}
                onClick={() => onSelect(topic)}
                data-ga-event="topic_select"
                data-ga-label={topic.id}
              >
                <span className="sb-topic-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={`sb-topic-dot ${STATUS_CLS[status]}`}>
                  {STATUS_ICON[status]}
                </span>
                <span className="sb-topic-name">{topic.title}</span>
                {isViewedFn?.(topic.id) && status === STATUS.NOT_STARTED && (
                  <span className="sb-viewed-dot" title="Started — open to continue">
                    ◐
                  </span>
                )}
                {hasBookmarkFn?.(topic.noteFile || topic.solutionFile) && (
                  <span className="sb-bookmark-dot" title="Study marker inside">
                    🔖
                  </span>
                )}
                <TierBadge topicId={topic.id} small />
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
  recordActivity,
  markViewed,
  onNavigateNote,
}) {
  const [activeTab, setActiveTab] = useState("notes");
  const [fetched, setFetched] = useState(null);
  const [scrollPct, setScrollPct] = useState(0);

  // Reset tab to "notes" when topic changes (scroll restore handles position)
  const topicId = topic?.id;
  const prevTopicRef = useState({ id: null });
  if (topicId && topicId !== prevTopicRef[0].id) {
    prevTopicRef[0].id = topicId;
    if (activeTab !== "notes") setActiveTab("notes");
  }

  // Save & restore scroll position per topic on the inner scroll container.
  // Also drives the reading progress bar.
  const targetFileForFetch = topic?.noteFile || topic?.solutionFile;
  // Re-run restore when content finishes loading (so DOM is tall enough)
  const contentLoaded = !!getContent(targetFileForFetch);
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el || !targetFileForFetch) return undefined;
    const saved = sessionStorage.getItem(`sb-scroll:${targetFileForFetch}`);
    const targetY = saved ? parseInt(saved, 10) : 0;
    // Wait for content + paint, then jump to saved position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.scrollTo(0, targetY));
    });
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        const y = el.scrollTop;
        setScrollPct(max > 0 ? Math.min(100, (y / max) * 100) : 0);
        sessionStorage.setItem(`sb-scroll:${targetFileForFetch}`, String(y));
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, targetFileForFetch, contentLoaded]);

  // Record a streak activity AND mark this topic as viewed after 30s.
  // Both fire from the same timer to keep "the user actually engaged
  // with this content" semantics aligned across features.
  useEffect(() => {
    if (!targetFileForFetch) return undefined;
    const t = setTimeout(() => {
      recordActivity?.();
      if (topic?.id) markViewed?.(topic.id);
    }, 30_000);
    return () => clearTimeout(t);
  }, [targetFileForFetch, recordActivity, markViewed, topic?.id]);

  // Lazy-load the markdown chunk for the selected topic
  useEffect(() => {
    if (!targetFileForFetch) return undefined;
    if (getContent(targetFileForFetch)) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => loadContent(targetFileForFetch))
      .then((md) => {
        if (!cancelled) setFetched({ file: targetFileForFetch, md });
      });
    return () => {
      cancelled = true;
    };
  }, [targetFileForFetch]);

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
  // Lazy-load markdown chunks. Cached hits are returned synchronously; the
  // first time a note is opened, fetched.md fills in after a re-render.
  const cached = getContent(targetFile);
  const content =
    cached || (fetched?.file === targetFile ? fetched.md : null);
  const hasQuestions = topicHasQuestions(targetFile);
  const questionCount = hasQuestions ? getQuestionCount(targetFile) : 0;
  const topicNum = getTopicNumFromNoteFile(targetFile);
  const hasVideo = !!topic.youtubeId;

  return (
    <div className="sb-content">
      {/* Reading progress bar (top of content panel) */}
      <div className="sb-progress" aria-hidden="true">
        <div className="sb-progress-fill" style={{ width: `${scrollPct}%` }} />
      </div>
      {/* Header bar with title + action buttons */}
      <div className="sb-content-header">
        <div className="sb-content-title-area">
          <h1 className="sb-content-title">{topic.title}</h1>
          <TierBadge topicId={topic.id} />
          {content && (
            <span className="sb-read-time" title="Estimated read time">
              {formatReadMinutes(estimateReadMinutes(content))}
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
              data-ga-event="content_tab"
              data-ga-label="video"
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
              data-ga-event="content_tab"
              data-ga-label="practice"
            >
              📝 Practice ({questionCount} Qs)
            </button>
          )}
          {[STATUS.NOT_STARTED, STATUS.REVISE, STATUS.DONE].map((s) => (
            <button
              key={s}
              className={`sb-action-btn sb-action-btn--${s} ${status === s ? "sb-action-btn--active" : ""}`}
              onClick={() => onSetStatus(topic.id, s)}
              data-ga-event="status_change"
              data-ga-label={`${topic.id}:${s}`}
            >
              {s === STATUS.NOT_STARTED
                ? "Not Started"
                : s === STATUS.REVISE
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
            data-ga-event="bookmark_jump"
            data-ga-label={targetFile}
          >
            Jump to marker ↓
          </button>
          <button
            className="sb-bookmark-banner-clear"
            onClick={() => onSetBookmark(targetFile, null)}
            title="Clear marker"
            data-ga-event="bookmark_clear"
            data-ga-label={targetFile}
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
            <>
              <MarkdownRenderer
                content={content}
                noteFile={targetFile}
                bookmarkedHeadingId={getBookmark?.(targetFile)}
                onSetBookmark={onSetBookmark}
              />
              <NoteNav noteFile={targetFile} onNavigate={onNavigateNote} />
            </>
          ) : fetched && fetched.file === targetFile && fetched.md === null ? (
            <div className="sb-no-content">
              <div className="sb-no-content-icon" aria-hidden="true">📝</div>
              <h2 className="sb-no-content-title">
                Notes for <em>{topic.title}</em> aren't ready yet
              </h2>
              <p className="sb-no-content-body">
                This topic doesn't have written notes attached. You can still
                mark it as <strong>Done</strong> or <strong>Revise</strong>{" "}
                using the buttons above to track your study progress.
              </p>
              {targetFile && (
                <details className="sb-no-content-details">
                  <summary>Want to contribute notes?</summary>
                  <p>
                    Create the file <code>{targetFile}</code> in the{" "}
                    <code>Notes/</code> directory and it will appear here
                    automatically.
                  </p>
                </details>
              )}
            </div>
          ) : (
            <div className="sb-no-content">
              <p>Loading…</p>
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
  recordActivity,
  viewed,
}) {
  const mainRef = useRef(null);
  const { getBookmark, setBookmark, hasBookmark } = useBookmarks();
  const [activeTopic, setActiveTopic] = useState(null);
  const [expandedCats, setExpandedCats] = useState(() => {
    // Start with first category expanded
    return categories.length > 0 ? new Set([categories[0].id]) : new Set();
  });
  // Auto-collapse the sidebar on mobile so the content panel gets the
  // full viewport. The same `sidebarCollapsed` flag drives both desktop
  // (slim icon column) and mobile (hidden drawer) — we just toggle a
  // body class so CSS can render the right variant.
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth <= MOBILE_BREAKPOINT,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth <= MOBILE_BREAKPOINT
      : false,
  );
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
      // On mobile, close the drawer after picking a topic
      if (typeof window !== "undefined" &&
          window.innerWidth <= MOBILE_BREAKPOINT) {
        setSidebarCollapsed(true);
      }
    },
    [onTopicSelect],
  );

  // In-place Next/Previous handler used by the footer NoteNav.
  // Resolves the neighbor (which is keyed by noteFile / solutionFile) to a
  // topic in the *current* categories list (Categories tab vs Practice tab
  // expose different category arrays). If we find one, we swap the active
  // topic *within* this SidebarLayout — the user stays on the same dashTab
  // (Categories or Practice) and the sidebar stays visible. If we can't
  // find it (e.g. the neighbor lives in the other dashTab), we fall back
  // to the global open-note event so the app can route appropriately.
  const handleNavigateNote = useCallback(
    (neighbor) => {
      if (!neighbor?.noteFile) return;
      let foundTopic = null;
      let foundCatId = null;
      for (const cat of categories) {
        const t = cat.topics.find(
          (x) =>
            x.noteFile === neighbor.noteFile ||
            x.solutionFile === neighbor.noteFile,
        );
        if (t) {
          foundTopic = t;
          foundCatId = cat.id;
          break;
        }
      }
      if (foundTopic) {
        setActiveTopic(foundTopic);
        setExpandedCats((prev) => new Set([...prev, foundCatId]));
        onTopicSelect?.(foundTopic.id);
        // Scroll the content panel back to the top of the new note
        if (mainRef.current) {
          requestAnimationFrame(() => {
            mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
          });
        }
        if (
          typeof window !== "undefined" &&
          window.innerWidth <= MOBILE_BREAKPOINT
        ) {
          setSidebarCollapsed(true);
        }
        return;
      }
      // Fall back to the global event (e.g. neighbor lives in a different
      // dashTab / namespace).
      window.dispatchEvent(
        new CustomEvent("open-note", {
          detail: {
            namespace: neighbor.namespace,
            noteFile: neighbor.noteFile,
            title: neighbor.title,
          },
        }),
      );
    },
    [categories, onTopicSelect],
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
  const totalDone = allTopics.filter((t) => progress[t.id] === STATUS.DONE).length;
  const totalRevise = allTopics.filter(
    (t) => progress[t.id] === STATUS.REVISE,
  ).length;
  const totalPct = allTopics.length
    ? Math.round((totalDone / allTopics.length) * 100)
    : 0;

  const activeStatus = activeTopic
    ? progress[activeTopic.id] || STATUS.NOT_STARTED
    : STATUS.NOT_STARTED;

  // Quick review: pick random revise topic
  const reviseTopics = useMemo(
    () => allTopics.filter((t) => progress[t.id] === STATUS.REVISE),
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
      className={`sb-layout ${sidebarCollapsed ? "sb-layout--collapsed" : ""} ${isMobile ? "sb-layout--mobile" : ""} ${isMobile && !sidebarCollapsed ? "sb-layout--drawer-open" : ""}`}
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
                    data-ga-event="quick_review"
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
                data-ga-event="sidebar_search"
              />
              {searchQuery && (
                <button
                  className="sb-search-clear"
                  onClick={() => setSearchQuery("")}
                  data-ga-event="sidebar_search_clear"
                >
                  ×
                </button>
              )}
            </div>

            {/* Category list */}
            <nav className="sb-category-nav">
              {filteredCategories.map((cat) => (
                <SidebarCategory
                  isViewedFn={viewed?.isViewed}
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
        data-ga-event="sidebar_toggle"
        data-ga-label={sidebarCollapsed ? "expand" : "collapse"}
      >
        {sidebarCollapsed ? "»" : "«"}
      </button>

      {/* Mobile-only: hamburger toggle (top-left of content) and a
          backdrop that closes the drawer when tapped. The backdrop only
          appears when the drawer is open. */}
      {isMobile && (
        <button
          className="sb-mobile-toggle"
          onClick={() => setSidebarCollapsed((c) => !c)}
          aria-label={sidebarCollapsed ? "Open menu" : "Close menu"}
          data-ga-event="sidebar_mobile_toggle"
        >
          {sidebarCollapsed ? "☰" : "✕"}
        </button>
      )}
      {isMobile && !sidebarCollapsed && (
        <div
          className="sb-mobile-backdrop"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <main className="sb-main" ref={mainRef}>
        <ContentPanel
          topic={activeTopic}
          status={activeStatus}
          onSetStatus={setStatus}
          scrollRef={mainRef}
          getBookmark={getBookmark}
          onSetBookmark={setBookmark}
          recordActivity={recordActivity}
          markViewed={viewed?.markViewed}
          onNavigateNote={handleNavigateNote}
        />
      </main>
    </div>
  );
}
