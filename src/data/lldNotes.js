// Lazy-load markdown notes from Notes/LowLevelDesign as separate chunks.

const lazyLLDModules = import.meta.glob(
  [
    '../../Notes/LowLevelDesign/*.md',
    '../../Notes/LowLevelDesign/Solutions/*.md',
  ],
  { query: '?raw', import: 'default' }
);

const LOADERS = {};
for (const [path, loader] of Object.entries(lazyLLDModules)) {
  LOADERS[path.split('/').pop()] = loader;
}

// Resolved-content cache (populated as notes are opened).
export const LLD_NOTES = {};

export function getLLDNoteContent(filename) {
  return LLD_NOTES[filename] || null;
}

export async function loadLLDNoteContent(filename) {
  if (LLD_NOTES[filename]) return LLD_NOTES[filename];
  const loader = LOADERS[filename];
  if (!loader) return null;
  const content = await loader();
  LLD_NOTES[filename] = content;
  return content;
}
