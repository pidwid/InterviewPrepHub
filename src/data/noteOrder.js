// Build per-section ordered lists of {noteFile, title, namespace} so the note
// viewer can offer Next/Previous navigation. Order = roadmap phase order
// (the recommended study sequence). Falls back to category order if a note
// isn't in any roadmap phase.

import { ALL_TOPICS, SD_PRACTICE_QUESTIONS } from "./topics";
import {
  ALL_LLD_TOPICS,
  ALL_LLD_PRACTICE,
  OOD_PRACTICE_QUESTIONS,
} from "./lldTopics";
import { ROADMAP_PHASES } from "./roadmap";
import { LLD_ROADMAP_PHASES } from "./lldRoadmap";

function buildOrder(namespace, allTopics, practice, phases) {
  const byId = new Map();
  for (const t of allTopics) byId.set(t.id, t);
  for (const p of practice) byId.set(p.id, p);

  const seen = new Set();
  const ordered = [];

  // Roadmap-first: phases define recommended study order
  for (const phase of phases) {
    for (const tid of phase.topics) {
      const t = byId.get(tid);
      if (!t || seen.has(t.id)) continue;
      const file = t.noteFile || t.solutionFile;
      if (!file) continue;
      ordered.push({ namespace, id: t.id, title: t.title, noteFile: file });
      seen.add(t.id);
    }
  }
  // Append anything missed (in category/practice order)
  for (const t of [...allTopics, ...practice]) {
    if (seen.has(t.id)) continue;
    const file = t.noteFile || t.solutionFile;
    if (!file) continue;
    ordered.push({ namespace, id: t.id, title: t.title, noteFile: file });
    seen.add(t.id);
  }
  return ordered;
}

const SD_ORDER = buildOrder("sd", ALL_TOPICS, SD_PRACTICE_QUESTIONS, ROADMAP_PHASES);
const LLD_ORDER = buildOrder(
  "lld",
  ALL_LLD_TOPICS,
  [...ALL_LLD_PRACTICE, ...OOD_PRACTICE_QUESTIONS],
  LLD_ROADMAP_PHASES,
);

// Look up the prev/next note for a given file. Returns { prev, next } where
// each is { namespace, noteFile, title } or null.
export function getNeighbors(noteFile) {
  for (const order of [SD_ORDER, LLD_ORDER]) {
    const idx = order.findIndex((e) => e.noteFile === noteFile);
    if (idx >= 0) {
      return {
        prev: idx > 0 ? order[idx - 1] : null,
        next: idx < order.length - 1 ? order[idx + 1] : null,
      };
    }
  }
  return { prev: null, next: null };
}
