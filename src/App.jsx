import { useCallback, useEffect, useRef, useState } from "react";
import TabNav from "./components/TabNav";
import Dashboard from "./components/Dashboard";
import TopicList from "./components/TopicList";
import NoteViewer from "./components/NoteViewer";
import SettingsDialog from "./components/SettingsDialog";
import SearchPalette from "./components/SearchPalette";
import { SEARCH_INDEX } from "./data/searchIndex";
import { useReviewState } from "./store/useReviewState";
import { useStreakState } from "./store/useStreakState";
import { useViewed } from "./store/useViewed";
import { STATUS } from "./data/topics";
import { useProgress } from "./store/useProgress";
import { useTheme } from "./store/useTheme";
import { useNavState } from "./store/useNavState";
import { ALL_TOPICS, CATEGORIES, SD_PRACTICE_QUESTIONS } from "./data/topics";
import {
  ALL_LLD_PRACTICE,
  ALL_LLD_TOPICS,
  LLD_CATEGORIES,
  LLD_CONCURRENCY_QUESTIONS,
  LLD_EASY_QUESTIONS,
  LLD_EXTRA_QUESTIONS,
  LLD_HARD_QUESTIONS,
  LLD_MEDIUM_QUESTIONS,
  OOD_PRACTICE_QUESTIONS,
  problemCatIds,
} from "./data/lldTopics";
import { ROADMAP_PHASES } from "./data/roadmap";
import { LLD_ROADMAP_PHASES } from "./data/lldRoadmap";
import "./App.css";

function TabSection({
  namespace,
  allTopics,
  categories,
  showPractice,
  practiceGroups,
  roadmapPhases,
  initialDashTab,
  initialTopicId,
  onNavChange,
  recordActivity,
  streak,
}) {
  const { progress, setStatus: rawSetStatus, getStatus, resetAll, stats } =
    useProgress(namespace, allTopics);
  const review = useReviewState(namespace);
  const viewed = useViewed(namespace);
  const [view, setView] = useState("dashboard");
  const [activeNote, setActiveNote] = useState(null);

  // Sync the review queue against the progress source-of-truth.
  // - Any topic flagged 'revise' is enqueued (or refreshed)
  // - Any queued topic that is no longer 'revise' is removed
  // Runs once after progress finishes loading.
  const backfillDone = useRef(false);
  useEffect(() => {
    if (backfillDone.current) return;
    if (Object.keys(progress).length === 0) return;
    backfillDone.current = true;
    for (const [topicId, status] of Object.entries(progress)) {
      if (status === STATUS.REVISE) review.markForReview(topicId);
    }
    // Remove any queued topic that is no longer flagged as revise
    for (const topicId of Object.keys(review.state)) {
      if (progress[topicId] !== STATUS.REVISE) review.removeReview(topicId);
    }
  }, [progress, review]);

  // Wrap setStatus so that flagging a topic as "revise" auto-enqueues it
  // for spaced-repetition review. Also records a streak activity.
  // Status → review queue sync:
  //   Revise  → enqueue (or refresh dueAt to now)
  //   Anything else (Done, not_started) → remove from queue
  const setStatus = useCallback(
    (topicId, status) => {
      rawSetStatus(topicId, status);
      recordActivity?.();
      if (status === STATUS.REVISE) {
        review.markForReview(topicId);
      } else {
        review.removeReview(topicId);
      }
    },
    [rawSetStatus, recordActivity, review],
  );

  // Scroll to top when switching views
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, activeNote]);

  // Allow other parts of the app (e.g. SearchPalette) to open a note in this
  // section by dispatching a CustomEvent. Keeps TabSection decoupled.
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.namespace !== namespace) return;
      setActiveNote({ noteFile: e.detail.noteFile, title: e.detail.title });
    };
    window.addEventListener("open-note", handler);
    return () => window.removeEventListener("open-note", handler);
  }, [namespace]);

  // If viewing a note, show the note viewer
  if (activeNote) {
    return (
      <NoteViewer
        noteFile={activeNote.noteFile}
        title={activeNote.title}
        recordActivity={recordActivity}
        onClose={() => setActiveNote(null)}
      />
    );
  }

  if (view === "dashboard") {
    return (
      <Dashboard
        stats={stats}
        progress={progress}
        onNavigate={setView}
        categories={categories}
        showPractice={showPractice}
        setStatus={setStatus}
        review={review}
        streak={streak}
        viewed={viewed}
        recordActivity={recordActivity}
        onOpenNote={(topic) => setActiveNote(topic)}
        roadmapPhases={roadmapPhases}
        allTopics={allTopics}
        practiceGroups={practiceGroups}
        initialDashTab={initialDashTab}
        initialTopicId={initialTopicId}
        onNavChange={onNavChange}
        onReset={() => {
          if (
            window.confirm(
              "Reset all progress for this section? This cannot be undone.",
            )
          ) {
            resetAll();
          }
        }}
      />
    );
  }

  return (
    <TopicList
      activeCategoryId={view === "all-topics" ? null : view}
      categories={categories}
      getStatus={getStatus}
      setStatus={setStatus}
      onBack={() => setView("dashboard")}
      onOpenNote={(topic) => setActiveNote(topic)}
    />
  );
}

export default function App() {
  const { initial, writeHash } = useNavState();
  const [activeTab, setActiveTab] = useState(initial.tab);
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const streak = useStreakState();

  // Global Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSearchSelect = useCallback(
    (item) => {
      setSearchOpen(false);
      // Switch tab if needed, then dispatch open-note for the target section
      setActiveTab(item.section);
      writeHash(item.section, "roadmap", null);
      // Defer one tick so the target TabSection has mounted its listener
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("open-note", {
            detail: {
              namespace: item.section,
              noteFile: item.noteFile,
              title: item.title,
            },
          }),
        );
      }, 0);
    },
    [writeHash],
  );

  useEffect(() => {
    const canTrack = () => typeof window.gtag === "function";

    const getPagePath = () =>
      `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const trackEvent = (eventName, params = {}) => {
      if (!canTrack()) {
        return;
      }

      window.gtag("event", eventName, {
        page_path: getPagePath(),
        page_title: document.title,
        page_location: window.location.href,
        ...params,
      });
    };

    const trackPageView = () => trackEvent("page_view");

    trackPageView();

    const onHashChange = () => {
      trackPageView();

      const [tab, dashTab, topicId] = window.location.hash
        .replace(/^#/, "")
        .split("/");

      if (tab) {
        trackEvent("section_view", {
          section_name: tab,
          ...(dashTab ? { dash_tab: dashTab } : {}),
          ...(topicId ? { topic_id: topicId } : {}),
        });
      }
    };

    const onClick = (event) => {
      const target = event.target.closest("[data-ga-event]");
      if (!target) {
        return;
      }

      const eventName = target.dataset.gaEvent || "ui_click";
      const label = target.dataset.gaLabel;
      const destination =
        target.getAttribute("href") || target.dataset.gaDestination;

      trackEvent(eventName, {
        ...(label ? { label } : {}),
        ...(destination ? { destination } : {}),
      });
    };

    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const handleTabChange = useCallback(
    (tab) => {
      setActiveTab(tab);
      writeHash(tab, "roadmap", null);
    },
    [writeHash],
  );

  const handleNavChange = useCallback(
    (tab, dashTab, topicId) => {
      writeHash(tab, dashTab, topicId);
    },
    [writeHash],
  );

  const sdProgress = useProgress("sd", ALL_TOPICS);
  const lldProgress = useProgress("lld", ALL_LLD_TOPICS);

  const tabStats = {
    sd: sdProgress.stats,
    lld: lldProgress.stats,
  };

  const SECTIONS = [
    {
      id: "sd",
      allTopics: ALL_TOPICS,
      categories: CATEGORIES,
      showPractice: true,
      practiceGroups: [
        {
          key: "all",
          label: "All",
          questions: SD_PRACTICE_QUESTIONS,
        },
      ],
      roadmapPhases: ROADMAP_PHASES,
    },
    {
      id: "lld",
      allTopics: ALL_LLD_TOPICS,
      categories: LLD_CATEGORIES.filter((c) => !problemCatIds.includes(c.id)),
      showPractice: true,
      practiceGroups: [
        {
          key: "all",
          label: "All",
          questions: [...ALL_LLD_PRACTICE, ...OOD_PRACTICE_QUESTIONS],
        },
        { key: "easy", label: "Easy", questions: LLD_EASY_QUESTIONS },
        { key: "medium", label: "Medium", questions: LLD_MEDIUM_QUESTIONS },
        { key: "hard", label: "Hard", questions: LLD_HARD_QUESTIONS },
        {
          key: "concurrency",
          label: "Concurrency",
          questions: LLD_CONCURRENCY_QUESTIONS,
        },
        { key: "extra", label: "Extra", questions: LLD_EXTRA_QUESTIONS },
        { key: "ood", label: "OOD", questions: OOD_PRACTICE_QUESTIONS },
      ],
      roadmapPhases: LLD_ROADMAP_PHASES,
    },
  ];

  return (
    <div className="app-root">
      <TabNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabStats={tabStats}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <div className="app">
        {SECTIONS.map(
          ({
            id,
            allTopics,
            categories,
            showPractice,
            practiceGroups,
            roadmapPhases,
          }) =>
            activeTab === id ? (
              <TabSection
                key={id}
                namespace={id}
                allTopics={allTopics}
                categories={categories}
                showPractice={showPractice}
                practiceGroups={practiceGroups}
                roadmapPhases={roadmapPhases}
                initialDashTab={
                  initial.tab === id ? initial.dashTab : undefined
                }
                initialTopicId={
                  initial.tab === id ? initial.topicId : undefined
                }
                onNavChange={(dashTab, topicId) =>
                  handleNavChange(id, dashTab, topicId)
                }
                recordActivity={streak.recordActivity}
                streak={streak}
              />
            ) : null,
        )}
      </div>

      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
      {searchOpen && (
        <SearchPalette
          index={SEARCH_INDEX}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />
      )}
    </div>
  );
}
