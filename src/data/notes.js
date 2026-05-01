// Lazy-load markdown notes from Notes/SystemDesign as separate chunks.
// QnA-Answer-Key.md is eager because qna.js parses it at module init for
// the practice tabs; everything else is fetched on demand and cached.

const lazyTopicModules = import.meta.glob(
  '../../Notes/SystemDesign/Topics/*.md',
  { query: '?raw', import: 'default' }
);

const lazySolutionModules = import.meta.glob(
  '../../Notes/SystemDesign/Solutions/*.md',
  { query: '?raw', import: 'default' }
);

const lazyRootModules = import.meta.glob(
  '../../Notes/SystemDesign/README.md',
  { query: '?raw', import: 'default' }
);

const eagerQnAModules = import.meta.glob(
  '../../Notes/SystemDesign/Topics/QnA-Answer-Key.md',
  { query: '?raw', import: 'default', eager: true }
);

// filename → loader fn
const LOADERS = {};
function indexLoaders(modules) {
  for (const [path, loader] of Object.entries(modules)) {
    LOADERS[path.split('/').pop()] = loader;
  }
}
indexLoaders(lazyTopicModules);
indexLoaders(lazySolutionModules);
indexLoaders(lazyRootModules);

// filename → resolved markdown content
export const NOTES = {};
for (const [path, content] of Object.entries(eagerQnAModules)) {
  NOTES[path.split('/').pop()] = content;
}

// Synchronous getter — returns cached content or null.
// Used by callers that already loaded the note (e.g. qna.js for QnA file).
export function getNoteContent(filename) {
  return NOTES[filename] || null;
}

// Async loader — fetches the chunk on demand and caches it.
export async function loadNoteContent(filename) {
  if (NOTES[filename]) return NOTES[filename];
  const loader = LOADERS[filename];
  if (!loader) return null;
  const content = await loader();
  NOTES[filename] = content;
  return content;
}
