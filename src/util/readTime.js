// Estimate read time for a markdown string. Strips code blocks and
// inline markdown noise so the count reflects readable prose.

const WPM = 220; // average adult reading speed for technical content

export function estimateReadMinutes(markdown) {
  if (!markdown) return 0;
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ") // links keep label, drop URL
    .replace(/[#*_>~`-]/g, " ");
  const words = stripped.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WPM));
}

export function formatReadMinutes(mins) {
  return `${mins} min read`;
}
