import SkillTreeRoadmap from "./SkillTreeRoadmap";

// Per-namespace Quick Reference cards. The two app sections (System Design
// and Low-Level Design) each have their own Study Guide / Cheat Sheet
// markdown files — keep them separate so the LLD tab doesn't accidentally
// open the SD README.
const QUICK_REFS_BY_NAMESPACE = {
  sd: [
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
  ],
  lld: [
    {
      id: "ref-readme",
      title: "\uD83D\uDCD6 Study Guide",
      noteFile: "README.md",
      desc: "LLD foundations + suggested order",
    },
    {
      id: "ref-cheatsheet",
      title: "\u26A1 LLD Cheat Sheet",
      noteFile: "LLD-10-Interview-Cheat-Sheet.md",
      desc: "5-step framework + GoF at a glance",
    },
  ],
};

// Reusable quick-ref card list. Exported so Dashboard can render it
// alongside the review queue when one is present.
export function QuickRefs({ namespace = "sd", onOpenNote }) {
  const refs = QUICK_REFS_BY_NAMESPACE[namespace] || QUICK_REFS_BY_NAMESPACE.sd;
  return (
    <div className="st-quick-refs">
      {refs.map((ref) => (
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
          data-ga-label={`${namespace}_${ref.id}`}
        >
          <span className="st-quick-ref-title">{ref.title}</span>
          <span className="st-quick-ref-desc">{ref.desc}</span>
        </button>
      ))}
    </div>
  );
}

export default function RoadmapSection({
  namespace,
  progress,
  roadmapPhases,
  allTopics,
  onTopicClick,
  onOpenNote,
  showQuickRefs = true,
}) {
  return (
    <>
      {showQuickRefs && (
        <QuickRefs namespace={namespace} onOpenNote={onOpenNote} />
      )}
      <SkillTreeRoadmap
        progress={progress}
        roadmapPhases={roadmapPhases}
        allTopics={allTopics}
        onTopicClick={onTopicClick}
      />
    </>
  );
}
