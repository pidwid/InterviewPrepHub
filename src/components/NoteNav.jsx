import { getNeighbors } from "../data/noteOrder";

// Footer Next/Previous links shown at the bottom of every note.
// Dispatches the same `open-note` CustomEvent the SearchPalette uses,
// so navigation works the same way regardless of source.
function go({ namespace, noteFile, title }) {
  window.dispatchEvent(
    new CustomEvent("open-note", {
      detail: { namespace, noteFile, title },
    }),
  );
}

export default function NoteNav({ noteFile }) {
  if (!noteFile) return null;
  const { prev, next } = getNeighbors(noteFile);
  if (!prev && !next) return null;

  return (
    <nav className="note-nav" aria-label="Note navigation">
      {prev ? (
        <button
          className="note-nav-btn note-nav-btn--prev"
          onClick={() => go(prev)}
          data-ga-event="note_nav"
          data-ga-label="prev"
        >
          <span className="note-nav-arrow">←</span>
          <span className="note-nav-meta">
            <span className="note-nav-label">Previous</span>
            <span className="note-nav-title">{prev.title}</span>
          </span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          className="note-nav-btn note-nav-btn--next"
          onClick={() => go(next)}
          data-ga-event="note_nav"
          data-ga-label="next"
        >
          <span className="note-nav-meta note-nav-meta--right">
            <span className="note-nav-label">Next</span>
            <span className="note-nav-title">{next.title}</span>
          </span>
          <span className="note-nav-arrow">→</span>
        </button>
      ) : (
        <span />
      )}
    </nav>
  );
}
