// Load all markdown notes from the Notes/SystemDesign directory
// Uses Vite's glob import to bundle them at build time

const topicModules = import.meta.glob(
  '../../Notes/SystemDesign/Topics/*.md',
  { query: '?raw', import: 'default', eager: true }
);

const solutionModules = import.meta.glob(
  '../../Notes/SystemDesign/Solutions/*.md',
  { query: '?raw', import: 'default', eager: true }
);

const rootModules = import.meta.glob(
  '../../Notes/SystemDesign/README.md',
  { query: '?raw', import: 'default', eager: true }
);

// Build a map: filename → markdown content
export const NOTES = {};
for (const [path, content] of Object.entries(topicModules)) {
  const filename = path.split('/').pop();
  NOTES[filename] = content;
}
for (const [path, content] of Object.entries(solutionModules)) {
  const filename = path.split('/').pop();
  NOTES[filename] = content;
}
for (const [path, content] of Object.entries(rootModules)) {
  const filename = path.split('/').pop();
  NOTES[filename] = content;
}

// Helper to get note content by filename
export function getNoteContent(filename) {
  return NOTES[filename] || null;
}

// List of all note files (ordered)
export const NOTE_FILES = Object.keys(NOTES).sort();
