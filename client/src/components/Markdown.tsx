import ReactMarkdown from "react-markdown";

/**
 * Lightweight Markdown component
 * 
 * Uses react-markdown instead of streamdown to avoid heavy dependencies:
 * - No katex (math rendering)
 * - No mermaid (diagrams)
 * - No shiki (syntax highlighting)
 * - No tables (GitHub Flavored Markdown disabled)
 * 
 * Supports basic markdown only (headings, lists, links, bold, italic, code blocks, etc.)
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown>
      {children}
    </ReactMarkdown>
  );
}
