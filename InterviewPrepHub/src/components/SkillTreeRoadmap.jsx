import { useMemo, useState } from "react";

function phaseProgress(phase, progress) {
  const total = phase.topics.length;
  if (total === 0) return { done: 0, revise: 0, total, pct: 0 };
  const done = phase.topics.filter((id) => progress[id] === "done").length;
  const revise = phase.topics.filter((id) => progress[id] === "revise").length;
  return { done, revise, total, pct: Math.round((done / total) * 100) };
}

/*
 * Explicit topic sets for SD time filter, derived from the README study guide.
 * For LLD, fall back to priority-based filtering.
 */
const SD_1W_IDS = new Set([
  'note-01', 'note-03', 'note-08', 'note-11', 'note-12',
  'note-13', 'note-14', 'note-24', 'note-cheatsheet',
]);
const SD_2W_IDS = new Set([
  ...SD_1W_IDS,
  'note-02', 'note-04', 'note-05', 'note-06', 'note-07',
  'note-09', 'note-10', 'note-15', 'note-16', 'note-17',
]);
// 1 month+ = everything

const TIME_OPTIONS = [
  { key: "1w",  label: "1 Week" },
  { key: "2w",  label: "2 Weeks" },
  { key: "1m",  label: "1 Month+" },
  { key: "all", label: "All" },
];

/**
 * Determine if a topic is in scope for the selected time filter.
 * SD uses explicit topic sets from the study guide README.
 * LLD uses priority-based filtering.
 */
function isTopicInScope(topicId, topic, timeKey) {
  if (timeKey === "all" || timeKey === "1m") return true;
  // SD topics start with "note-"
  const isSD = topicId.startsWith('note-');
  if (isSD) {
    if (timeKey === "1w") return SD_1W_IDS.has(topicId);
    if (timeKey === "2w") return SD_2W_IDS.has(topicId);
  }
  // LLD: fall back to priority
  const p = topic?.priority || 'medium';
  if (timeKey === "1w") return p === 'high';
  if (timeKey === "2w") return p === 'high' || p === 'medium';
  return true;
}

export default function SkillTreeRoadmap({ progress, roadmapPhases, allTopics, onTopicClick }) {
  const topicMap = useMemo(
    () => Object.fromEntries((allTopics || []).map((t) => [t.id, t])),
    [allTopics],
  );

  const phases = useMemo(
    () =>
      (roadmapPhases || []).map((p) => ({
        ...p,
        progress: phaseProgress(p, progress),
      })),
    [roadmapPhases, progress],
  );

  const completedCount = phases.filter((p) => p.progress.pct === 100).length;

  const [timeFilter, setTimeFilter] = useState(() => {
    try { return localStorage.getItem("prep_time_filter") || "all"; } catch { return "all"; }
  });

  const handleTimeFilter = (key) => {
    setTimeFilter(key);
    try { localStorage.setItem("prep_time_filter", key); } catch {}
  };

  // Count how many topics are in scope for the selected timeframe
  const scopeInfo = useMemo(() => {
    let inScopeCount = 0;
    let totalCount = 0;
    for (const phase of phases) {
      for (const tid of phase.topics) {
        totalCount++;
        const topic = topicMap[tid];
        if (topic && isTopicInScope(tid, topic, timeFilter)) inScopeCount++;
      }
    }
    return { inScopeCount, totalCount };
  }, [phases, topicMap, timeFilter]);

  return (
    <div className="st-roadmap">
      {/* Time filter */}
      <div className="st-time-filter">
        <span className="st-time-label">Prep time:</span>
        <div className="st-time-buttons">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`st-time-btn ${timeFilter === opt.key ? "st-time-btn--active" : ""}`}
              onClick={() => handleTimeFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {timeFilter !== "all" && (
          <span className="st-time-scope">
            {scopeInfo.inScopeCount}/{scopeInfo.totalCount} topics to cover
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="st-summary">
        <span className="st-summary-label">
          {completedCount}/{phases.length} phases complete
        </span>
        <div className="st-summary-bar">
          <div
            className="st-summary-fill"
            style={{
              width: `${phases.length ? (completedCount / phases.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* All phases */}
      <div className="st-phases">
        {phases.map((phase, idx) => {
          const isComplete = phase.progress.pct === 100;
          const hasProgress = phase.progress.done > 0 || phase.progress.revise > 0;
          const state = isComplete ? "done" : hasProgress ? "active" : "pending";

          return (
            <div key={phase.id} className={`st-phase st-phase--${state}`}>
              {/* Connector line (not on first) */}
              {idx > 0 && (
                <div className={`st-connector ${isComplete || hasProgress ? "st-connector--active" : ""}`} />
              )}

              {/* Phase header */}
              <div className="st-phase-head">
                <div className={`st-phase-dot st-phase-dot--${state}`}>
                  {isComplete ? "✓" : idx + 1}
                </div>
                <div className="st-phase-info">
                  <div className="st-phase-title-row">
                    <span className="st-phase-title">{phase.title}</span>
                    <span className="st-phase-count">
                      {phase.progress.done}/{phase.progress.total}
                    </span>
                  </div>
                  <span className="st-phase-week">{phase.week}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="st-phase-bar">
                <div
                  className="st-phase-bar-fill"
                  style={{ width: `${phase.progress.pct}%` }}
                />
              </div>

              {/* Topics — clickable, dimmed if outside time scope */}
              <div className="st-topics">
                {phase.topics.map((tid, tIdx) => {
                  const topic = topicMap[tid];
                  if (!topic) return null;
                  const status = progress[tid] || "not_started";
                  const inScope = isTopicInScope(tid, topic, timeFilter);
                  return (
                    <button
                      key={tid}
                      className={`st-topic st-topic--${status}${!inScope ? " st-topic--dimmed" : ""}${inScope && timeFilter !== "all" ? " st-topic--highlighted" : ""}`}
                      onClick={() => onTopicClick?.(tid)}
                      title={inScope ? "Open in Categories" : `Skip for ${TIME_OPTIONS.find(o => o.key === timeFilter)?.label} prep`}
                    >
                      <span className={`st-topic-dot st-topic-dot--${status}`}>
                        {status === "done" ? "✓" : status === "revise" ? "↻" : tIdx + 1}
                      </span>
                      <span className="st-topic-name">{topic.title}</span>
                      {status !== "not_started" && (
                        <span className={`st-topic-status st-topic-status--${status}`}>
                          {status === "done" ? "Done" : "Revise"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
