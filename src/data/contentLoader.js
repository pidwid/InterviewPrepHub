// Unified note resolver across SystemDesign and LowLevelDesign content stores.
// Kept separate from MarkdownRenderer so the file only exports components and
// satisfies react-refresh/only-export-components.
//
// The two stores share some filenames (e.g. "README.md" exists in BOTH
// Notes/SystemDesign/ and Notes/LowLevelDesign/). Callers that know which
// section they're rendering pass `namespace` ("sd" or "lld") so we look in
// that store first; we still fall back to the other store afterwards in
// case the file genuinely lives there (e.g. cross-section quick links).

import { getNoteContent, loadNoteContent } from "./notes";
import { getLLDNoteContent, loadLLDNoteContent } from "./lldNotes";

// Returns the [primary, fallback] pair of sync getters for a namespace.
function syncResolversFor(namespace) {
  if (namespace === "lld") return [getLLDNoteContent, getNoteContent];
  // default: SD first
  return [getNoteContent, getLLDNoteContent];
}

// Returns the [primary, fallback] pair of async loaders for a namespace.
function asyncResolversFor(namespace) {
  if (namespace === "lld") return [loadLLDNoteContent, loadNoteContent];
  return [loadNoteContent, loadLLDNoteContent];
}

// Synchronous resolver — returns cached content or null.
export function getContent(noteFile, namespace) {
  if (!noteFile) return null;
  const [primary, fallback] = syncResolversFor(namespace);
  return primary(noteFile) || fallback(noteFile) || null;
}

// Async resolver — fetches the chunk on demand and caches it.
export async function loadContent(noteFile, namespace) {
  if (!noteFile) return null;
  const cached = getContent(noteFile, namespace);
  if (cached) return cached;
  const [primary, fallback] = asyncResolversFor(namespace);
  return (await primary(noteFile)) || (await fallback(noteFile)) || null;
}
