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

import { useRef, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, Check as CheckIcon, Code } from "@/components/ui/Icon";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { cn } from "@/lib/utils";

interface SimpleMarkdownEditorProps {
  content: string; // Raw markdown text
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
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

// Convert HTML/DOM to markdown
function htmlToMarkdown(element: HTMLElement | null): string {
  if (!element) return "";
  
  let markdown = "";
  const nodes = Array.from(element.childNodes);
  let inList = false;
  let listType: "ul" | "ol" | null = null;
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (inList) {
        // Text nodes in lists are handled by list items
        continue;
      }
      markdown += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === "ul") {
        if (inList && listType !== "ul") {
          markdown += "\n";
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
      } else if (tagName === "ol") {
        if (inList && listType !== "ol") {
          markdown += "\n";
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
      } else if (tagName === "li") {
        // Handled by parent ul/ol
        continue;
      } else if (tagName === "div" || tagName === "p") {
        if (inList) {
          markdown += "\n";
          inList = false;
          listType = null;
        }
        const inner = processInlineMarkdown(el);
        if (inner.trim() || i === nodes.length - 1) {
          markdown += inner;
          if (i < nodes.length - 1) {
            markdown += "\n";
          }
        }
      } else if (tagName === "br") {
        if (!inList) {
          markdown += "\n";
        }
      } else {
        // Inline elements are handled by processInlineMarkdown
        if (!inList) {
          markdown += processInlineMarkdown(el);
        }
      }
    }
  }
  
  return markdown.trim();
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

// Convert markdown to HTML for display
function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  
  // Use a temporary div to render markdown and extract HTML
  const tempDiv = document.createElement("div");
  tempDiv.className = "prose prose-sm dark:prose-invert max-w-none";
  
  // Create a wrapper to render SimpleMarkdown component output
  // Since we can't directly render React components here, we'll parse manually
  const lines = markdown.split("\n");
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
  
  const processInline = (text: string): string => {
    // Process inline markdown: code, bold, strikethrough, italic
    let result = text;
    
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
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Checkbox list
    if (/^-\s+\[([ x])\]\s+/.test(trimmed)) {
      flushList();
      inList = true;
      listType = "checkbox";
      const content = trimmed.replace(/^-\s+\[([ x])\]\s+/, "");
      listItems.push(`<li><input type="checkbox" ${trimmed.includes("[x]") ? "checked" : ""} disabled> ${processInline(content)}</li>`);
      continue;
    }
    
    // Bullet list
    if (/^-\s+/.test(trimmed)) {
      if (!inList || listType !== "bullet") {
        flushList();
        inList = true;
        listType = "bullet";
      }
      const content = trimmed.replace(/^-\s+/, "");
      listItems.push(`<li>${processInline(content)}</li>`);
      continue;
    }
    
    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listType !== "numbered") {
        flushList();
        inList = true;
        listType = "numbered";
      }
      const content = trimmed.replace(/^\d+\.\s+/, "");
      listItems.push(`<li>${processInline(content)}</li>`);
      continue;
    }
    
    // Regular line
    flushList();
    if (trimmed) {
      elements.push(`<div>${processInline(trimmed)}</div>`);
    } else {
      elements.push(`<div><br></div>`);
    }
  }
  
  flushList();
  
  return elements.join("");
}

export function SimpleMarkdownEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  autoFocus = false,
}: SimpleMarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const isUpdatingRef = useRef(false);
  const isUserInputRef = useRef(false);
  const lastContentRef = useRef<string>("");

  // Detect mobile for toolbar positioning
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Detect keyboard and position toolbar above it on mobile
  useEffect(() => {
    if (!isMobile) return;

    const updateKeyboardHeight = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const windowHeight = window.innerHeight;
        // Calculate keyboard height: difference between window height and visual viewport
        const keyboardOffset = Math.max(0, windowHeight - viewport.height);
        if (keyboardOffset > 50) {
          // Keyboard is open - store the height
          setKeyboardHeight(keyboardOffset);
        } else {
          // Keyboard is closed
          setKeyboardHeight(0);
        }
      } else {
        // Fallback for browsers without visual viewport API
        const currentHeight = window.innerHeight;
        const storedHeight = sessionStorage.getItem('viewport-height');
        if (storedHeight) {
          const heightDiff = parseInt(storedHeight) - currentHeight;
          if (heightDiff > 50) {
            setKeyboardHeight(heightDiff);
          } else {
            setKeyboardHeight(0);
            sessionStorage.setItem('viewport-height', currentHeight.toString());
          }
        } else {
          sessionStorage.setItem('viewport-height', currentHeight.toString());
          setKeyboardHeight(0);
        }
      }
    };

    updateKeyboardHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateKeyboardHeight);
      window.visualViewport.addEventListener('scroll', updateKeyboardHeight);
    } else {
      window.addEventListener('resize', updateKeyboardHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateKeyboardHeight);
        window.visualViewport.removeEventListener('scroll', updateKeyboardHeight);
      } else {
        window.removeEventListener('resize', updateKeyboardHeight);
      }
    };
  }, [isMobile]);

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
    const markdown = htmlToMarkdown(editorRef.current);
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

  // Handle Enter key for list continuation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        
        while (node && node.nodeType !== Node.ELEMENT_NODE) {
          node = node.parentNode;
        }
        
        if (node) {
          const el = node as HTMLElement;
          if (el.tagName.toLowerCase() === "li") {
            const text = el.textContent?.trim() || "";
            if (!text) {
              // Exit list on empty line
              return;
            }
            // Continue list - handled by browser default
          }
        }
      }
    }
  };

  const handleToolbarPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    editorRef.current?.focus();
  };

  const showToolbar = isMobile ? isFocused : true;
  
  // On mobile, position toolbar at top of keyboard (keyboardHeight from bottom)
  // On desktop, position at bottom of action bar
  const toolbarBottom = isMobile
    ? (keyboardHeight > 0 
        ? `${keyboardHeight}px` 
        : `var(--bottom-safe-area, 0px)`)
    : "var(--notes-action-bar-height, 0px)";

  return (
    <div className={cn("relative", className)}>
      <div ref={containerRef}>
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
            isMobile ? "min-h-[300px]" : "min-h-[400px]"
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

      {/* Formatting Toolbar */}
      {showToolbar && (
        <div
          className={cn(
            "fixed left-0 right-0 border-t bg-background/95 backdrop-blur-sm shadow-lg",
            !isMobile && "mx-auto max-w-screen-2xl"
          )}
          style={{
            bottom: toolbarBottom,
            zIndex: 9999,
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.5rem)`,
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          <div className="flex items-center gap-1 p-2 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleBold();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <Bold className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleItalic();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <Italic className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleStrikethrough();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <StrikethroughIcon className="h-5 w-5" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleBulletList();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <List className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleNumberedList();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <ListOrderedIcon className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleCheckbox();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <CheckIcon className="h-5 w-5" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
            <Button
              variant="ghost"
              size="default"
              onPointerDown={handleToolbarPointerDown}
              onClick={(e) => {
                e.preventDefault();
                handleCode();
              }}
              className="min-w-[44px] h-[44px] flex-shrink-0"
              type="button"
            >
              <Code className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
