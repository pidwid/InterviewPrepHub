import { useMemo, useState } from "react";
import { STATUS } from "../data/topics";
import { TIME_BUDGETS, isInTimeBudget } from "../data/tiers";
import { useBookmarks } from "../store/useBookmarks";
import { TierBadge, TierLegend } from "./ui";

function phaseProgress(phase, progress) {
  const total = phase.topics.length;
  if (total === 0) return { done: 0, revise: 0, total, pct: 0 };
  const done = phase.topics.filter((id) => progress[id] === STATUS.DONE).length;
  const revise = phase.topics.filter((id) => progress[id] === STATUS.REVISE).length;
  return { done, revise, total, pct: Math.round((done / total) * 100) };
}

// Time budget options come from the canonical tier system in data/tiers.js.
// Each budget maps to a maximum visible tier. See that file for membership.
const TIME_OPTIONS = TIME_BUDGETS.map((b) => ({ key: b.key, label: b.label }));

function isTopicInScope(topicId, _topic, timeKey) {
  return isInTimeBudget(topicId, timeKey);
}

export default function SkillTreeRoadmap({ progress, roadmapPhases, allTopics, onTopicClick }) {
  const { hasBookmark } = useBookmarks();
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
    try { return localStorage.getItem("prep_time_filter") || "all"; } catch (_) { return "all"; }
  });

  const handleTimeFilter = (key) => {
    setTimeFilter(key);
    try { localStorage.setItem("prep_time_filter", key); } catch (_) {
      // Ignore
    }
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
      <TierLegend />

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
                  const status = progress[tid] || STATUS.NOT_STARTED;
                  const inScope = isTopicInScope(tid, topic, timeFilter);
                  return (
                    <button
                      key={tid}
                      className={`st-topic st-topic--${status}${!inScope ? " st-topic--dimmed" : ""}${inScope && timeFilter !== "all" ? " st-topic--highlighted" : ""}`}
                      onClick={() => onTopicClick?.(tid)}
                      title={inScope ? "Open in Categories" : `Skip for ${TIME_OPTIONS.find(o => o.key === timeFilter)?.label} prep`}
                    >
                      <span className={`st-topic-dot st-topic-dot--${status}`}>
                        {status === STATUS.DONE ? "✓" : status === STATUS.REVISE ? "↻" : tIdx + 1}
                      </span>
                      <span className="st-topic-name">{topic.title}</span>
                      <TierBadge topicId={topic.id} small />
                      {hasBookmark(topic.noteFile || topic.solutionFile) && (
                        <span className="st-bookmark-dot" title="Study marker set">🔖</span>
                      )}
                      {status !== STATUS.NOT_STARTED && (
                        <span className={`st-topic-status st-topic-status--${status}`}>
                          {status === STATUS.DONE ? "Done" : "Revise"}
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
