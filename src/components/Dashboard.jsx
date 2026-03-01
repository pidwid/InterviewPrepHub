import { useState, useMemo, useCallback } from "react";
import RoadmapSection from "./RoadmapSection";
import IndexPage from "./IndexPage";
import SidebarLayout from "./SidebarLayout";

const DASHBOARD_TABS = [
  { key: "index", label: "\u{1F4D1} Index" },
  { key: "roadmap", label: "\u{1F5FA}\uFE0F Roadmap" },
  { key: "categories", label: "\u{1F4C2} Categories" },
  { key: "practice", label: "\u{1F4DD} Practice" },
];

export default function Dashboard({
  stats,
  progress,
  onNavigate,
  categories,
  showPractice,
  practiceGroups,
  setStatus,
  onOpenNote,
  roadmapPhases,
  allTopics,
  onReset,
  initialDashTab,
  initialTopicId,
  onNavChange,
}) {
  const pctDone = stats.total
    ? Math.round((stats.done / stats.total) * 100)
    : 0;
  const pctRevise = stats.total
    ? Math.round((stats.revise / stats.total) * 100)
    : 0;

  const [dashTab, setDashTab] = useState(initialDashTab || "roadmap");
  const [pendingTopicId, setPendingTopicId] = useState(initialTopicId || null);

  const handleDashTabChange = useCallback(
    (tab) => {
      setDashTab(tab);
      onNavChange?.(tab, null);
    },
    [onNavChange],
  );

  const handleRoadmapTopicClick = useCallback(
    (topicId) => {
      setPendingTopicId(topicId);
      setDashTab("categories");
      onNavChange?.("categories", topicId);
    },
    [onNavChange],
  );

  // Convert practice groups into categories-shaped data for SidebarLayout
  const practiceCategories = useMemo(() => {
    if (!practiceGroups || practiceGroups.length === 0) return [];
    const subGroups = practiceGroups.filter((g) => g.key !== "all");
    if (subGroups.length === 0) {
      return [
        {
          id: "practice-all",
          title: "Practice Questions",
          topics: (practiceGroups[0]?.questions ?? []).map((q) => ({
            ...q,
            noteFile: q.solutionFile,
          })),
        },
      ];
    }
    return subGroups.map((g) => ({
      id: `practice-${g.key}`,
      title: g.label,
      topics: (g.questions ?? []).map((q) => ({
        ...q,
        noteFile: q.solutionFile,
      })),
    }));
  }, [practiceGroups]);

  return (
    <div className="dashboard">
      <div className="dash-tabs">
        {DASHBOARD_TABS.filter((t) => t.key !== "practice" || showPractice).map(
          (t) => (
            <button
              key={t.key}
              className={`dash-tab ${dashTab === t.key ? "dash-tab--active" : ""}`}
              onClick={() => handleDashTabChange(t.key)}
            >
              {t.label}
            </button>
          ),
        )}
        <div className="dash-tabs-right">
          <button
            className="ghost-btn ghost-btn--compact"
            onClick={() => onNavigate("all-topics")}
          >
            All Topics
          </button>
        </div>
      </div>

      <div className="dash-tab-content">
        {dashTab === "index" && (
          <IndexPage
            categories={categories}
            progress={progress}
            onTopicClick={handleRoadmapTopicClick}
            stats={stats}
            pctDone={pctDone}
            pctRevise={pctRevise}
            onReset={onReset}
          />
        )}
        {dashTab === "roadmap" && (
          <RoadmapSection
            progress={progress}
            roadmapPhases={roadmapPhases}
            allTopics={allTopics}
            onTopicClick={handleRoadmapTopicClick}
            onOpenNote={onOpenNote}
          />
        )}
        {dashTab === "categories" && (
          <SidebarLayout
            categories={categories}
            progress={progress}
            setStatus={setStatus}
            initialTopicId={pendingTopicId}
            onInitialTopicConsumed={() => setPendingTopicId(null)}
            onTopicSelect={(topicId) => onNavChange?.("categories", topicId)}
          />
        )}
        {dashTab === "practice" && showPractice && (
          <SidebarLayout
            categories={practiceCategories}
            progress={progress}
            setStatus={setStatus}
            initialTopicId={pendingTopicId}
            onInitialTopicConsumed={() => setPendingTopicId(null)}
            onTopicSelect={(topicId) => onNavChange?.("practice", topicId)}
          />
        )}
      </div>
    </div>
  );
}
