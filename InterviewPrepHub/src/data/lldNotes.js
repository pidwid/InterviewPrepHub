// Load all markdown notes from the Notes/LowLevelDesign directory
// Uses Vite's glob import to bundle them at build time

const lldNoteModules = import.meta.glob(
  '../../Notes/LowLevelDesign/*.md',
  { query: '?raw', import: 'default', eager: true }
);

// Build a map: filename → markdown content
export const LLD_NOTES = {};
for (const [path, content] of Object.entries(lldNoteModules)) {
  const filename = path.split('/').pop();
  LLD_NOTES[filename] = content;
}

// Helper to get LLD note content by filename
export function getLLDNoteContent(filename) {
  return LLD_NOTES[filename] || null;
}

// List of all LLD note files (ordered)
export const LLD_NOTE_FILES = Object.keys(LLD_NOTES).sort();
