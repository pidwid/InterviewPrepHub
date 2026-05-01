// Unified note resolver across SystemDesign and LowLevelDesign content stores.
// Kept separate from MarkdownRenderer so the file only exports components and
// satisfies react-refresh/only-export-components.

import { getNoteContent, loadNoteContent } from "./notes";
import { getLLDNoteContent, loadLLDNoteContent } from "./lldNotes";

// Synchronous resolver — returns cached content or null.
export function getContent(noteFile) {
  if (!noteFile) return null;
  return getNoteContent(noteFile) || getLLDNoteContent(noteFile) || null;
}

// Async resolver — fetches the chunk on demand and caches it.
export async function loadContent(noteFile) {
  if (!noteFile) return null;
  const cached = getContent(noteFile);
  if (cached) return cached;
  return (
    (await loadNoteContent(noteFile)) ||
    (await loadLLDNoteContent(noteFile)) ||
    null
  );
}
