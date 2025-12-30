import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Lightweight Markdown component
 * 
 * Uses react-markdown instead of streamdown to avoid heavy dependencies:
 * - No katex (math rendering)
 * - No mermaid (diagrams)
 * - No shiki (syntax highlighting)
 * 
 * Supports basic markdown + GitHub Flavored Markdown (tables, strikethrough, etc.)
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}
