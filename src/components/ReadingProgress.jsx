import { useEffect, useState } from "react";

// Thin top-of-screen progress bar that tracks reading position.
// Also persists scroll position per note so refresh resumes where you left off.
//
// The sessionStorage key is namespaced (`note-scroll:${ns}:${noteFile}`) so
// shared filenames like README.md don't share scroll position across the
// SD and LLD tabs.
export default function ReadingProgress({ noteFile, namespace }) {
  const [pct, setPct] = useState(0);
  const ns = namespace || "sd";
  const storageKey = noteFile ? `note-scroll:${ns}:${noteFile}` : null;

  // Restore previous scroll position on note open
  useEffect(() => {
    if (!storageKey) return;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const y = parseInt(saved, 10);
      // Wait for content to render before scrolling
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [storageKey]);

  // Track scroll → update progress bar + persist position
  useEffect(() => {
    if (!storageKey) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        setPct(max > 0 ? Math.min(100, (y / max) * 100) : 0);
        sessionStorage.setItem(storageKey, String(y));
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [storageKey]);

  if (!noteFile) return null;

  return (
    <div className="reading-progress" aria-hidden="true">
      <div className="reading-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
