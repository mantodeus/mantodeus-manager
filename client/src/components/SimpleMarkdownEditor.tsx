/**
 * Simple Markdown Editor Component (WYSIWYG)
 * 
 * WYSIWYG editor that:
 * - Shows formatted text (NO markdown syntax visible)
 * - Stores markdown behind the scenes
 * - Formatting toolbar with limited markdown subset
 * - Enter key inserts newlines correctly
 * - Lists auto-continue on Enter
 */

import { useRef, useEffect, useState } from "react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { cn } from "@/lib/utils";

interface SimpleMarkdownEditorProps {
  content: string; // Raw markdown text
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  editorRef?: React.RefObject<HTMLDivElement>; // Optional external ref
}

// Strikethrough icon (simple SVG)
function StrikethroughIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 12h14"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16"
      />
    </svg>
  );
}

// Numbered list icon (simple SVG)
function ListOrderedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
      />
    </svg>
  );
}

// Convert HTML/DOM to markdown with proper line break preservation
function htmlToMarkdown(element: HTMLElement | null): string {
  if (!element) return "";
  
  // First, check if element has any text content at all
  const textContent = element.textContent || "";
  if (!textContent.trim()) {
    return "";
  }
  
  let markdown = "";
  const nodes = Array.from(element.childNodes);
  let inList = false;
  let listType: "ul" | "ol" | null = null;
  let lastWasBlock = false;
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (inList) {
        // Text nodes in lists are handled by list items
        continue;
      }
      markdown += text;
      lastWasBlock = false;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === "ul") {
        if (inList && listType !== "ul") {
          markdown += "\n\n";
        } else if (markdown && !markdown.endsWith("\n\n")) {
          markdown += "\n\n";
        }
        inList = true;
        listType = "ul";
        const items = Array.from(el.querySelectorAll(":scope > li"));
        for (const item of items) {
          const checkbox = item.querySelector('input[type="checkbox"]');
          const itemText = processInlineMarkdown(item);
          if (checkbox) {
            const isChecked = (checkbox as HTMLInputElement).checked;
            markdown += `- [${isChecked ? "x" : " "}] ${itemText}\n`;
          } else {
            markdown += `- ${itemText}\n`;
          }
        }
        inList = false;
        listType = null;
        lastWasBlock = true;
      } else if (tagName === "ol") {
        if (inList && listType !== "ol") {
          markdown += "\n\n";
        } else if (markdown && !markdown.endsWith("\n\n")) {
          markdown += "\n\n";
        }
        inList = true;
        listType = "ol";
        const items = Array.from(el.querySelectorAll(":scope > li"));
        items.forEach((item, index) => {
          const itemText = processInlineMarkdown(item);
          markdown += `${index + 1}. ${itemText}\n`;
        });
        inList = false;
        listType = null;
        lastWasBlock = true;
      } else if (tagName === "li") {
        // Handled by parent ul/ol
        continue;
      } else if (tagName === "div" || tagName === "p") {
        if (inList) {
          markdown += "\n\n";
          inList = false;
          listType = null;
        }
        const inner = processInlineMarkdown(el);
        
        // Check if div contains only <br> tags (empty paragraph)
        const hasOnlyBreaks = el.querySelectorAll("br").length > 0 && 
                              el.textContent?.trim() === "";
        
        // Add paragraph break before this block if there was previous content
        if (markdown && !markdown.endsWith("\n\n") && lastWasBlock) {
          markdown += "\n\n";
        }
        
        if (hasOnlyBreaks || (!inner.trim() && i < nodes.length - 1)) {
          // Empty paragraph - add double newline
          if (markdown && !markdown.endsWith("\n\n")) {
            markdown += "\n\n";
          }
        } else if (inner.trim()) {
          markdown += inner;
          // Add paragraph break after if not last node
          if (i < nodes.length - 1) {
            markdown += "\n\n";
          }
        }
        lastWasBlock = true;
      } else if (tagName === "br") {
        if (!inList) {
          // Single <br> = soft line break (\n)
          // Multiple consecutive <br> = paragraph break (\n\n)
          if (markdown.endsWith("\n")) {
            // Already has one newline, make it double
            if (!markdown.endsWith("\n\n")) {
              markdown += "\n";
            }
          } else {
            markdown += "\n";
          }
        }
        lastWasBlock = false;
      } else {
        // Inline elements are handled by processInlineMarkdown
        if (!inList) {
          markdown += processInlineMarkdown(el);
        }
        lastWasBlock = false;
      }
    }
  }
  
  // DO NOT trim - preserve whitespace exactly (including trailing newlines/spaces)
  return markdown;
}

// Process inline markdown formatting in an element
function processInlineMarkdown(element: HTMLElement): string {
  let result = "";
  const nodes = Array.from(element.childNodes);
  
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const inner = processInlineMarkdown(el);
      
      if (tagName === "strong" || tagName === "b") {
        result += `**${inner}**`;
      } else if (tagName === "em" || tagName === "i") {
        result += `*${inner}*`;
      } else if (tagName === "del" || tagName === "s") {
        result += `~~${inner}~~`;
      } else if (tagName === "code") {
        result += `\`${inner}\``;
      } else if (tagName === "input" && (el as HTMLInputElement).type === "checkbox") {
        // Skip checkbox input, it's handled by list item
        continue;
      } else {
        result += inner;
      }
    }
  }
  
  return result;
}

// Convert markdown to HTML for display, preserving line breaks correctly
function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // Process inline markdown: code, bold, strikethrough, italic
  const processInline = (text: string): string => {
    let result = text;
    
    // Escape HTML first
    result = result
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Code (highest priority)
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Strikethrough
    result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // Italic (must come after bold to avoid conflicts)
    result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    return result;
  };

  const elements: string[] = [];
  let inList = false;
  let listType: "bullet" | "numbered" | "checkbox" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === "numbered") {
        elements.push(`<ol>${listItems.join("")}</ol>`);
      } else {
        elements.push(`<ul>${listItems.join("")}</ul>`);
      }
      listItems = [];
      listType = null;
      inList = false;
    }
  };

  // Process line by line, detecting paragraph breaks (\n\n) vs soft breaks (\n)
  const lines = markdown.split("\n");
  let currentParagraph: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isLastLine = i === lines.length - 1;
    const nextLine = !isLastLine ? lines[i + 1] : null;
    const nextIsEmpty = nextLine !== null && nextLine.trim() === "";
    
    // Check if this is a paragraph break (current line empty AND next line empty)
    const isParagraphBreak = trimmed === "" && nextIsEmpty;
    
    // Checkbox list
    if (/^-\s+\[([ x])\]\s+/.test(trimmed)) {
      flushList();
      // Flush any current paragraph
      if (currentParagraph.length > 0) {
        const paraContent = currentParagraph.join("<br>");
        elements.push(`<div>${processInline(paraContent)}</div>`);
        currentParagraph = [];
      }
      inList = true;
      listType = "checkbox";
      const content = trimmed.replace(/^-\s+\[([ x])\]\s+/, "");
      listItems.push(`<li><input type="checkbox" ${trimmed.includes("[x]") ? "checked" : ""} disabled> ${processInline(content)}</li>`);
      continue;
    }
    
    // Bullet list
    if (/^-\s+/.test(trimmed) && !/^-\s+\[/.test(trimmed)) {
      flushList();
      // Flush any current paragraph
      if (currentParagraph.length > 0) {
        const paraContent = currentParagraph.join("<br>");
        elements.push(`<div>${processInline(paraContent)}</div>`);
        currentParagraph = [];
      }
      if (!inList || listType !== "bullet") {
        inList = true;
        listType = "bullet";
      }
      const content = trimmed.replace(/^-\s+/, "");
      listItems.push(`<li>${processInline(content)}</li>`);
      continue;
    }
    
    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      flushList();
      // Flush any current paragraph
      if (currentParagraph.length > 0) {
        const paraContent = currentParagraph.join("<br>");
        elements.push(`<div>${processInline(paraContent)}</div>`);
        currentParagraph = [];
      }
      if (!inList || listType !== "numbered") {
        inList = true;
        listType = "numbered";
      }
      const content = trimmed.replace(/^\d+\.\s+/, "");
      listItems.push(`<li>${processInline(content)}</li>`);
      continue;
    }
    
    // Regular content
    flushList();
    
    if (isParagraphBreak) {
      // Flush current paragraph and add paragraph break
      if (currentParagraph.length > 0) {
        const paraContent = currentParagraph.join("<br>");
        elements.push(`<div>${processInline(paraContent)}</div>`);
        currentParagraph = [];
      }
      elements.push(`<div><br></div>`);
      i++; // Skip next empty line
    } else if (trimmed === "") {
      // Empty line but not a paragraph break - treat as soft break
      if (currentParagraph.length > 0) {
        currentParagraph.push("");
      }
    } else {
      // Add line to current paragraph (will be joined with <br>)
      currentParagraph.push(trimmed);
    }
  }
  
  // Flush any remaining paragraph
  flushList();
  if (currentParagraph.length > 0) {
    const paraContent = currentParagraph.join("<br>");
    elements.push(`<div>${processInline(paraContent)}</div>`);
  }

  return elements.join("");
}

export function SimpleMarkdownEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  autoFocus = false,
  editorRef: externalEditorRef,
}: SimpleMarkdownEditorProps) {
  const internalEditorRef = useRef<HTMLDivElement>(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isUpdatingRef = useRef(false);
  const isUserInputRef = useRef(false);
  const lastContentRef = useRef<string>("");

  // Update editor HTML when markdown content changes (from props)
  // BUT only if the change came from outside (not from user typing)
  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current) return;
    
    // If this change came from user input, don't update (prevents cursor jumping)
    if (isUserInputRef.current) {
      isUserInputRef.current = false;
      lastContentRef.current = content;
      return;
    }
    
    // Only update if content actually changed from external source
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;
    
    const html = markdownToHtml(content || "");
    const currentHtml = editorRef.current.innerHTML.trim();
    const normalizedHtml = html.trim();
    
    // Only update if HTML actually differs
    if (currentHtml !== normalizedHtml) {
      isUpdatingRef.current = true;
      const selection = window.getSelection();
      let savedRange: Range | null = null;
      
      // Save cursor position
      if (selection && selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
      
      editorRef.current.innerHTML = normalizedHtml || "";
      
      // Try to restore cursor position
      if (savedRange) {
        try {
          // Check if the saved range is still valid
          if (editorRef.current.contains(savedRange.startContainer)) {
            selection?.removeAllRanges();
            selection?.addRange(savedRange);
          } else {
            // Place cursor at end if saved position is invalid
            const newRange = document.createRange();
            newRange.selectNodeContents(editorRef.current);
            newRange.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        } catch {
          // If restoration fails, place cursor at end
          const newRange = document.createRange();
          newRange.selectNodeContents(editorRef.current);
          newRange.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        }
      }
      
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    }
  }, [content]);

  // Initialize editor content on mount
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && content) {
      isUpdatingRef.current = true;
      editorRef.current.innerHTML = markdownToHtml(content);
      lastContentRef.current = content;
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    }
  }, []); // Only run on mount

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.focus();
        setIsFocused(true);
      }, 100);
    }
  }, [autoFocus]);

  // Track focus state
  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (document.activeElement !== editorRef.current) {
        setIsFocused(false);
      }
    }, 200);
  };

  // Handle content changes
  const handleInput = () => {
    if (isUpdatingRef.current || !editorRef.current) return;
    
    // Mark that this change came from user input
    isUserInputRef.current = true;
    
    const html = editorRef.current.innerHTML;
    
    // Check if editor has actual content (not just empty divs/brs)
    const hasContent = editorRef.current.textContent && editorRef.current.textContent.trim().length > 0;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleMarkdownEditor.tsx:479',message:'handleInput entry',data:{htmlLength:html.length,hasContent,textContentLength:editorRef.current.textContent?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Convert HTML to markdown
    let markdown = htmlToMarkdown(editorRef.current);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleMarkdownEditor.tsx:491',message:'after htmlToMarkdown',data:{markdownLength:markdown.length,markdownPreview:markdown.substring(0,50),hasContent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // If editor has text content but markdown is empty, preserve at least a newline
    // This happens when user types but HTML structure hasn't formed yet
    if (hasContent && !markdown.trim()) {
      // Extract plain text as fallback
      markdown = editorRef.current.textContent || "";
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleMarkdownEditor.tsx:497',message:'fallback to textContent',data:{markdownLength:markdown.length,markdownPreview:markdown.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SimpleMarkdownEditor.tsx:502',message:'calling onChange',data:{finalMarkdownLength:markdown.length,finalMarkdownPreview:markdown.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    lastContentRef.current = markdown;
    onChange(markdown);
  };

  // Formatting handlers using document.execCommand
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleBold = () => execCommand("bold");
  const handleItalic = () => execCommand("italic");
  const handleStrikethrough = () => execCommand("strikeThrough");
  const handleCode = () => {
    // Wrap selection in <code> tag
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText) {
        const code = document.createElement("code");
        code.textContent = selectedText;
        range.deleteContents();
        range.insertNode(code);
        handleInput();
      }
    }
  };

  const handleBulletList = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      
      // Find the containing block element
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
      
      if (node) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === "ul") {
          // Convert to regular div
          const parent = el.parentNode;
          if (parent) {
            const div = document.createElement("div");
            div.innerHTML = el.innerHTML.replace(/<li>/g, "").replace(/<\/li>/g, "<br>");
            parent.replaceChild(div, el);
          }
        } else {
          // Convert to list
          const text = el.textContent || "";
          const ul = document.createElement("ul");
          const li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
          el.parentNode?.replaceChild(ul, el);
        }
        handleInput();
      }
    }
  };

  const handleNumberedList = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
      
      if (node) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === "ol") {
          const parent = el.parentNode;
          if (parent) {
            const div = document.createElement("div");
            div.innerHTML = el.innerHTML.replace(/<li>/g, "").replace(/<\/li>/g, "<br>");
            parent.replaceChild(div, el);
          }
        } else {
          const text = el.textContent || "";
          const ol = document.createElement("ol");
          const li = document.createElement("li");
          li.textContent = text;
          ol.appendChild(li);
          el.parentNode?.replaceChild(ol, el);
        }
        handleInput();
      }
    }
  };

  const handleCheckbox = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
      
      if (node) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === "li" && el.parentElement?.tagName.toLowerCase() === "ul") {
          const checkbox = el.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.remove();
            el.textContent = el.textContent?.replace(/^\[[ x]\]\s*/, "") || "";
          } else {
            const text = el.textContent || "";
            el.innerHTML = `<input type="checkbox" disabled> ${text}`;
          }
        } else {
          const text = el.textContent || "";
          const ul = document.createElement("ul");
          const li = document.createElement("li");
          li.innerHTML = `<input type="checkbox" disabled> ${text}`;
          ul.appendChild(li);
          el.parentNode?.replaceChild(ul, el);
        }
        handleInput();
      }
    }
  };

  // Handle Enter key: Enter = paragraph, Shift+Enter = soft break
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    
    // Find containing block element
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentNode;
    }
    
    if (!node) return;
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Shift+Enter = soft line break (<br>)
    if (e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertLineBreak"); // inserts <br>
      // Trigger input event to update markdown
      setTimeout(() => {
        if (editorRef.current) {
          const event = new Event('input', { bubbles: true });
          editorRef.current.dispatchEvent(event);
        }
      }, 0);
      return;
    }

    // Enter = new paragraph
    // Special handling for list items
    if (tagName === "li") {
      const text = el.textContent?.trim() || "";
      if (!text) {
        // Exit list on empty line - let browser default handle it
        return;
      }
      // Continue list - let browser default handle it
      return;
    }

    // For non-list elements, create explicit paragraph break
    e.preventDefault();
    
    // Insert <br><br> to create a paragraph break
    // Then wrap in div structure if needed
    document.execCommand("insertHTML", false, "<br><br>");
    
    // Trigger input event to update markdown
    setTimeout(() => {
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
    }, 0);
  };

  const handleToolbarPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    editorRef.current?.focus();
  };

  return (
    <div className={cn("relative flex flex-col", className)} ref={containerRef}>
      {/* WYSIWYG Editor - contentEditable div showing formatted text */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "border rounded-md bg-background px-4 py-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_strong]:font-semibold [&_em]:italic [&_del]:line-through",
          "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono",
          "[&_ul]:list-disc [&_ul]:list-inside [&_ul]:ml-0 [&_ul]:my-0",
          "[&_ol]:list-decimal [&_ol]:list-inside [&_ol]:ml-0 [&_ol]:my-0",
          "[&_li]:ml-0 [&_p]:my-0 [&_div]:my-0",
"min-h-[300px] md:min-h-[400px]"
        )}
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: "1.5",
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>

    </div>
  );
}
