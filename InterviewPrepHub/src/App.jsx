import { useState, useEffect } from "react";
import TabNav from "./components/TabNav";
import Dashboard from "./components/Dashboard";
import TopicList from "./components/TopicList";
import NoteViewer from "./components/NoteViewer";
import { useProgress } from "./store/useProgress";
import { useTheme } from "./store/useTheme";
import { ALL_TOPICS, CATEGORIES, SD_PRACTICE_QUESTIONS } from "./data/topics";
import {
  ALL_LLD_TOPICS,
  LLD_CATEGORIES,
  problemCatIds,
  LLD_EASY_QUESTIONS,
  LLD_MEDIUM_QUESTIONS,
  LLD_HARD_QUESTIONS,
  LLD_CONCURRENCY_QUESTIONS,
  LLD_EXTRA_QUESTIONS,
  ALL_LLD_PRACTICE,
  OOD_PRACTICE_QUESTIONS,
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
}) {
  const { progress, setStatus, getStatus, resetAll, stats } = useProgress(
    namespace,
    allTopics,
  );
  const [view, setView] = useState("dashboard");
  const [activeNote, setActiveNote] = useState(null);

  // Scroll to top when switching views
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, activeNote]);

  // If viewing a note, show the note viewer
  if (activeNote) {
    return (
      <NoteViewer
        noteFile={activeNote.noteFile}
        title={activeNote.title}
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
        getStatus={getStatus}
        setStatus={setStatus}
        onOpenNote={(topic) => setActiveNote(topic)}
        roadmapPhases={roadmapPhases}
        allTopics={allTopics}
        practiceGroups={practiceGroups}
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
  const [activeTab, setActiveTab] = useState("sd");
  const { theme, toggleTheme } = useTheme();

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
      categories: LLD_CATEGORIES.filter(c => !problemCatIds.includes(c.id)),
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
        onTabChange={setActiveTab}
        tabStats={tabStats}
        theme={theme}
        onToggleTheme={toggleTheme}
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
              />
            ) : null,
        )}
      </div>
    </div>
  );
}
