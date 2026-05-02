import { getNeighbors } from "../data/noteOrder";

// Footer Next/Previous links shown at the bottom of every note.
//
// Two navigation modes:
//   1. Default (NoteViewer / standalone full-page): dispatches the global
//      `open-note` CustomEvent — same channel SearchPalette uses. The
//      TabSection event listener swaps the activeNote, keeping the user
//      in the full-page note viewer.
//   2. `onNavigate` prop (SidebarLayout / inline content panel): calls
//      the supplied callback with the neighbor descriptor. The caller is
//      responsible for swapping the active topic *within the same view*
//      (Categories / Practice tab), so we don't kick the user out of the
//      sidebar layout into the full-page viewer.
function dispatchOpen({ namespace, noteFile, title }) {
  window.dispatchEvent(
    new CustomEvent("open-note", {
      detail: { namespace, noteFile, title },
    }),
  );
}

export default function NoteNav({ noteFile, onNavigate }) {
  if (!noteFile) return null;
  const { prev, next } = getNeighbors(noteFile);
  if (!prev && !next) return null;

  const go = (neighbor) => {
    if (onNavigate) onNavigate(neighbor);
    else dispatchOpen(neighbor);
  };

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
