import SkillTreeRoadmap from "./SkillTreeRoadmap";

const QUICK_REFS = [
  {
    id: "ref-readme",
    title: "\uD83D\uDCD6 Study Guide",
    noteFile: "README.md",
    desc: "Suggested study order & how to use",
  },
  {
    id: "ref-cheatsheet",
    title: "\u26A1 Interview Cheat Sheet",
    noteFile: "Interview-Cheat-Sheet.md",
    desc: "Last-minute refresher before interviews",
  },
];

// Reusable quick-ref card list. Exported so Dashboard can render it
// alongside the review queue when one is present.
export function QuickRefs({ onOpenNote }) {
  return (
    <div className="st-quick-refs">
      {QUICK_REFS.map((ref) => (
        <button
          key={ref.id}
          className="st-quick-ref"
          onClick={() =>
            onOpenNote?.({
              id: ref.id,
              title: ref.title,
              noteFile: ref.noteFile,
            })
          }
          data-ga-event="quick_ref_open"
          data-ga-label={ref.id}
        >
          <span className="st-quick-ref-title">{ref.title}</span>
          <span className="st-quick-ref-desc">{ref.desc}</span>
        </button>
      ))}
    </div>
  );
}

export default function RoadmapSection({
  progress,
  roadmapPhases,
  allTopics,
  onTopicClick,
  onOpenNote,
  showQuickRefs = true,
}) {
  return (
    <>
      {showQuickRefs && <QuickRefs onOpenNote={onOpenNote} />}
      <SkillTreeRoadmap
        progress={progress}
        roadmapPhases={roadmapPhases}
        allTopics={allTopics}
        onTopicClick={onTopicClick}
      />
    </>
  );
}
