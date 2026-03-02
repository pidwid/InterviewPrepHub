import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { getNoteContent } from "../data/notes";
import { getLLDNoteContent } from "../data/lldNotes";

// Resolve note content from either SD or LLD note stores
export function getContent(noteFile) {
  if (!noteFile) return null;
  return getNoteContent(noteFile) || getLLDNoteContent(noteFile) || null;
}

// ── Study Marker Button ──────────────────────────────────────────────────────
// Shown on hover next to a heading; click to bookmark "studied up to here".
function StudyMarkerButton({ headingId, noteFile, bookmarkedId, onSetBookmark }) {
  if (!noteFile || !onSetBookmark || !headingId) return null;

  const isActive = bookmarkedId === headingId;

  function handleClick(e) {
    e.preventDefault();
    // Toggle: clicking an active bookmark clears it
    onSetBookmark(noteFile, isActive ? null : headingId);
  }

  return (
    <button
      className={`study-marker-btn${isActive ? " study-marker-btn--active" : ""}`}
      title={isActive ? "Clear study marker" : "Mark study position here"}
      onClick={handleClick}
      aria-label={isActive ? "Clear study marker" : "Mark study position"}
    >
      {isActive ? "🔖 Bookmarked" : "📍 Bookmark"}
    </button>
  );
}

// ── Heading wrapper factory ──────────────────────────────────────────────────
// Creates h1–h4 components that show the StudyMarkerButton on hover.
function makeHeadingComponent(Tag, noteFile, bookmarkedId, onSetBookmark) {
  return function HeadingWithMarker({ id, children, ...props }) {
    return (
      <div className="heading-row">
        <Tag id={id} className="heading-row__tag" {...props}>
          {children}
        </Tag>
        <StudyMarkerButton
          headingId={id}
          noteFile={noteFile}
          bookmarkedId={bookmarkedId}
          onSetBookmark={onSetBookmark}
        />
      </div>
    );
  };
}

// ── Base shared components (code, links) ─────────────────────────────────────
const BASE_COMPONENTS = {
  code({ inline, className, children, ...props }) {
    return inline ? (
      <code className="inline-code" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a({ children, href, ...props }) {
    if (href?.startsWith("#")) {
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault();
            const element = document.getElementById(href.slice(1));
            if (element) {
              element.scrollIntoView({ behavior: "smooth" });
            }
          }}
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

// ── MarkdownRenderer ─────────────────────────────────────────────────────────
// noteFile, bookmarkedHeadingId, onSetBookmark are optional.
// When provided, headings get a hover bookmark button.
export default function MarkdownRenderer({
  content,
  noteFile,
  bookmarkedHeadingId,
  onSetBookmark,
}) {
  if (!content) return null;

  const components = noteFile
    ? {
        ...BASE_COMPONENTS,
        h1: makeHeadingComponent("h1", noteFile, bookmarkedHeadingId, onSetBookmark),
        h2: makeHeadingComponent("h2", noteFile, bookmarkedHeadingId, onSetBookmark),
      }
    : BASE_COMPONENTS;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSlug]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
