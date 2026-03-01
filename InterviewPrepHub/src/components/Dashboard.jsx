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
  getStatus,
  setStatus,
  onOpenNote,
  roadmapPhases,
  allTopics,
  onReset,
}) {
  const pctDone = stats.total
    ? Math.round((stats.done / stats.total) * 100)
    : 0;
  const pctRevise = stats.total
    ? Math.round((stats.revise / stats.total) * 100)
    : 0;

  const [dashTab, setDashTab] = useState("roadmap");
  const [pendingTopicId, setPendingTopicId] = useState(null);

  const handleRoadmapTopicClick = useCallback((topicId) => {
    setPendingTopicId(topicId);
    setDashTab("categories");
  }, []);

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
              onClick={() => setDashTab(t.key)}
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
            onOpenNote={onOpenNote}
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
            getStatus={getStatus}
            setStatus={setStatus}
            onOpenNote={onOpenNote}
            initialTopicId={pendingTopicId}
            onInitialTopicConsumed={() => setPendingTopicId(null)}
          />
        )}
        {dashTab === "practice" && showPractice && (
          <SidebarLayout
            categories={practiceCategories}
            progress={progress}
            getStatus={getStatus}
            setStatus={setStatus}
            onOpenNote={onOpenNote}
          />
        )}
      </div>
    </div>
  );
}
