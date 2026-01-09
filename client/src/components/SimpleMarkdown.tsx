/**
 * Simple Markdown Renderer
 * 
 * Renders only a limited markdown subset:
 * - Bold: **text**
 * - Italic: *text*
 * - Strikethrough: ~~text~~
 * - Bullet list: - item
 * - Numbered list: 1. item
 * - Checkbox: - [ ] item
 * - Inline code: `code`
 * - Line breaks (newlines)
 * 
 * NO headings, tables, blockquotes, or advanced markdown
 */

import { cn } from "@/lib/utils";

interface SimpleMarkdownProps {
  children: string;
  className?: string;
}

export function SimpleMarkdown({ children, className }: SimpleMarkdownProps) {
  if (!children) return null;

  // Pre-process: strip heading markers (we don't render them, so remove the syntax)
  const cleanedText = children
    .replace(/^#{1,6}\s+/gm, "") // Remove # ## ### etc. at start of lines
    .replace(/---+/g, ""); // Remove horizontal rules
  
  // Split into lines for processing
  const lines = cleanedText.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listType: "bullet" | "numbered" | "checkbox" | null = null;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === "numbered") {
        elements.push(
          <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 ml-4">
            {listItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 ml-4">
            {listItems}
          </ul>
        );
      }
      listItems = [];
      listType = null;
      inList = false;
    }
  };

  // Process inline markdown in text (simpler, non-recursive approach)
  const processInline = (text: string): React.ReactNode => {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Process in order: code (highest priority), then bold, italic, strikethrough
    while (remaining.length > 0) {
      // Find the earliest special character
      const codeIdx = remaining.indexOf("`");
      const boldIdx = remaining.indexOf("**");
      const strikeIdx = remaining.indexOf("~~");
      const italicIdx = remaining.indexOf("*");

      // Filter out false positives (bold markers that are actually italic)
      // A * is italic only if it's not part of a ** sequence
      const isItalicMarker = italicIdx >= 0 && 
        (boldIdx === -1 || italicIdx < boldIdx || italicIdx > boldIdx + 1) &&
        remaining[italicIdx + 1] !== "*";
      const realItalicIdx = isItalicMarker ? italicIdx : -1;

      const indices = [
        { type: "code", idx: codeIdx },
        { type: "bold", idx: boldIdx },
        { type: "strike", idx: strikeIdx },
        { type: "italic", idx: realItalicIdx },
      ].filter((item) => item.idx >= 0);

      if (indices.length === 0) {
        // No more special characters
        parts.push(remaining);
        break;
      }

      // Sort by index
      indices.sort((a, b) => a.idx - b.idx);
      const first = indices[0];

      // Add text before the special character
      if (first.idx > 0) {
        parts.push(remaining.substring(0, first.idx));
      }

      // Process the special character
      if (first.type === "code") {
        const codeEnd = remaining.indexOf("`", first.idx + 1);
        if (codeEnd > first.idx) {
          const codeText = remaining.substring(first.idx + 1, codeEnd);
          parts.push(
            <code key={`code-${key++}`} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
              {codeText}
            </code>
          );
          remaining = remaining.substring(codeEnd + 1);
        } else {
          parts.push("`");
          remaining = remaining.substring(first.idx + 1);
        }
      } else if (first.type === "bold") {
        const boldEnd = remaining.indexOf("**", first.idx + 2);
        if (boldEnd > first.idx) {
          const boldText = remaining.substring(first.idx + 2, boldEnd);
          parts.push(
            <strong key={`bold-${key++}`} className="font-semibold">
              {boldText}
            </strong>
          );
          remaining = remaining.substring(boldEnd + 2);
        } else {
          parts.push("**");
          remaining = remaining.substring(first.idx + 2);
        }
      } else if (first.type === "strike") {
        const strikeEnd = remaining.indexOf("~~", first.idx + 2);
        if (strikeEnd > first.idx) {
          const strikeText = remaining.substring(first.idx + 2, strikeEnd);
          parts.push(
            <del key={`strike-${key++}`} className="line-through">
              {strikeText}
            </del>
          );
          remaining = remaining.substring(strikeEnd + 2);
        } else {
          parts.push("~~");
          remaining = remaining.substring(first.idx + 2);
        }
      } else if (first.type === "italic") {
        const italicEnd = remaining.indexOf("*", first.idx + 1);
        // Check if this is actually part of a bold marker (**)
        const nextChar = remaining[first.idx + 1];
        if (italicEnd > first.idx && nextChar !== "*") {
          const italicText = remaining.substring(first.idx + 1, italicEnd);
          parts.push(
            <em key={`italic-${key++}`} className="italic">
              {italicText}
            </em>
          );
          remaining = remaining.substring(italicEnd + 1);
        } else {
          parts.push("*");
          remaining = remaining.substring(first.idx + 1);
        }
      }
    }

    return parts.length === 1 ? parts[0] : parts;
  };

  // Process each line
  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check for numbered list: 1. item
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const [, , content] = numberedMatch;
      if (!inList || listType !== "numbered") {
        flushList();
        inList = true;
        listType = "numbered";
      }
      listItems.push(
        <li key={`item-${index}`} className="ml-2">
          <span>{processInline(content)}</span>
        </li>
      );
      return;
    }

    // Check for checkbox: - [ ] item or - [x] item
    const checkboxMatch = trimmed.match(/^-\s+\[([ x])\]\s+(.+)$/);
    if (checkboxMatch) {
      const [, checked, content] = checkboxMatch;
      if (!inList || listType !== "checkbox") {
        flushList();
        inList = true;
        listType = "checkbox";
      }
      listItems.push(
        <li key={`item-${index}`} className="ml-2 flex items-start gap-2">
          <input
            type="checkbox"
            checked={checked === "x"}
            readOnly
            className="mt-1 shrink-0"
          />
          <span>{processInline(content)}</span>
        </li>
      );
      return;
    }

    // Check for bullet list: - item
    const bulletMatch = trimmed.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      const [, content] = bulletMatch;
      if (!inList || listType !== "bullet") {
        flushList();
        inList = true;
        listType = "bullet";
      }
      listItems.push(
        <li key={`item-${index}`} className="ml-2">
          <span>{processInline(content)}</span>
        </li>
      );
      return;
    }

    // Not a list item - flush any current list
    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<br key={`br-${index}`} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${index}`} className="my-2">
        {processInline(trimmed)}
      </p>
    );
  });

  // Flush any remaining list
  flushList();

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {elements}
    </div>
  );
}

