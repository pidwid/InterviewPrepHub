import { useEffect, useState } from "react";

// Thin top-of-screen progress bar that tracks reading position.
// Also persists scroll position per note so refresh resumes where you left off.
export default function ReadingProgress({ noteFile }) {
  const [pct, setPct] = useState(0);

  // Restore previous scroll position on note open
  useEffect(() => {
    if (!noteFile) return;
    const saved = sessionStorage.getItem(`note-scroll:${noteFile}`);
    if (saved) {
      const y = parseInt(saved, 10);
      // Wait for content to render before scrolling
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [noteFile]);

  // Track scroll → update progress bar + persist position
  useEffect(() => {
    if (!noteFile) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        setPct(max > 0 ? Math.min(100, (y / max) * 100) : 0);
        sessionStorage.setItem(`note-scroll:${noteFile}`, String(y));
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [noteFile]);

  if (!noteFile) return null;

  return (
    <div className="reading-progress" aria-hidden="true">
      <div className="reading-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
