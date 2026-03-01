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

// Shared markdown component config for code blocks and anchor links
const MARKDOWN_COMPONENTS = {
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

export default function MarkdownRenderer({ content }) {
  if (!content) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSlug]}
      components={MARKDOWN_COMPONENTS}
    >
      {content}
    </ReactMarkdown>
  );
}
