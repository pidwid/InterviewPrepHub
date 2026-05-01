// Build the global search index from existing topic & practice data.
// Pure data join — no I/O, runs once at startup, cheap.

import {
  ALL_TOPICS,
  SD_PRACTICE_QUESTIONS,
} from "./topics";
import {
  ALL_LLD_TOPICS,
  ALL_LLD_PRACTICE,
  OOD_PRACTICE_QUESTIONS,
} from "./lldTopics";

function toEntry(section, kind, item) {
  return {
    id: item.id,
    title: item.title,
    section,
    kind,
    noteFile: item.noteFile || item.solutionFile || null,
  };
}

export const SEARCH_INDEX = [
  ...ALL_TOPICS.map((t) => toEntry("sd", "topic", t)),
  ...SD_PRACTICE_QUESTIONS.map((q) => toEntry("sd", "practice", q)),
  ...ALL_LLD_TOPICS.map((t) => toEntry("lld", "topic", t)),
  ...ALL_LLD_PRACTICE.map((q) => toEntry("lld", "practice", q)),
  ...OOD_PRACTICE_QUESTIONS.map((q) => toEntry("lld", "practice", q)),
].filter((e) => e.noteFile); // skip items with nothing to open
