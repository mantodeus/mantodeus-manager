/**
 * Simple Markdown Editor Component
 * 
 * Apple Notes-style editor:
 * - Plain textarea (no rich text, no contentEditable)
 * - Markdown stored as raw text
 * - Formatting toolbar with limited markdown subset
 * - Enter key inserts newlines correctly
 * - Lists auto-continue on Enter
 * - Empty list item exits list
 */

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, List, CheckSquare, Code } from "@/components/ui/Icon";
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

export function SimpleMarkdownEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  autoFocus = false,
}: SimpleMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile for toolbar positioning
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  // Get selection range
  const getSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { start: 0, end: 0, text: "" };
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end);
    
    return { start, end, text };
  };

  // Insert text at cursor position
  const insertText = (before: string, after: string = "", selectText: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start, end } = getSelection();
    const currentValue = textarea.value;
    const beforeText = currentValue.substring(0, start);
    const afterText = currentValue.substring(end);
    
    const newValue = beforeText + before + selectText + after + afterText;
    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      const newCursorPos = start + before.length + selectText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Wrap selected text with markdown syntax
  const wrapSelection = (before: string, after: string = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start, end, text } = getSelection();
    const currentValue = textarea.value;
    const beforeText = currentValue.substring(0, start);
    const afterText = currentValue.substring(end);
    
    // If text is selected, wrap it
    if (text) {
      const newValue = beforeText + before + text + after + afterText;
      onChange(newValue);
      
      setTimeout(() => {
        const newCursorPos = start + before.length + text.length + after.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // If no text is selected, insert syntax and place cursor in middle
      const newValue = beforeText + before + after + afterText;
      onChange(newValue);
      
      setTimeout(() => {
        const newCursorPos = start + before.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  // Formatting button handlers
  const handleBold = () => wrapSelection("**", "**");
  const handleItalic = () => wrapSelection("*", "*");
  const handleStrikethrough = () => wrapSelection("~~", "~~");
  const handleCode = () => wrapSelection("`", "`");
  
  const handleBulletList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start } = getSelection();
    const currentValue = textarea.value;
    const lines = currentValue.split("\n");
    let currentLine = 0;
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }
    
    const line = lines[currentLine];
    if (line.trim().startsWith("- ")) {
      // Remove bullet
      lines[currentLine] = line.replace(/^(\s*)- /, "$1");
    } else {
      // Add bullet
      const indent = line.match(/^(\s*)/)?.[1] || "";
      lines[currentLine] = indent + "- " + line.trimStart();
    }
    
    const newValue = lines.join("\n");
    onChange(newValue);
    
    setTimeout(() => {
      const newCursorPos = start + (line.trim().startsWith("- ") ? -2 : 2);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };
  
  const handleNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start } = getSelection();
    const currentValue = textarea.value;
    const lines = currentValue.split("\n");
    let currentLine = 0;
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    
    const line = lines[currentLine];
    if (/^\s*\d+\.\s/.test(line)) {
      // Remove numbering
      lines[currentLine] = line.replace(/^(\s*)\d+\.\s/, "$1");
    } else {
      // Add numbering
      const indent = line.match(/^(\s*)/)?.[1] || "";
      lines[currentLine] = indent + "1. " + line.trimStart();
    }
    
    const newValue = lines.join("\n");
    onChange(newValue);
    
    setTimeout(() => {
      const newCursorPos = start + (line.match(/^\s*\d+\.\s/) ? -3 : 3);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };
  
  const handleCheckbox = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start } = getSelection();
    const currentValue = textarea.value;
    const lines = currentValue.split("\n");
    let currentLine = 0;
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    
    const line = lines[currentLine];
    if (line.trim().startsWith("- [ ] ")) {
      // Remove checkbox
      lines[currentLine] = line.replace(/^(\s*)- \[ \] /, "$1- ");
    } else if (line.trim().startsWith("- ")) {
      // Add checkbox
      lines[currentLine] = line.replace(/^(\s*)- /, "$1- [ ] ");
    } else {
      // Add bullet with checkbox
      const indent = line.match(/^(\s*)/)?.[1] || "";
      lines[currentLine] = indent + "- [ ] " + line.trimStart();
    }
    
    const newValue = lines.join("\n");
    onChange(newValue);
    
    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  // Handle Enter key for list continuation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { start } = getSelection();
      const currentValue = textarea.value;
      const lines = currentValue.split("\n");
      let currentLine = 0;
      let charCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= start) {
          currentLine = i;
          break;
        }
        charCount += lines[i].length + 1;
      }
      
      const line = lines[currentLine];
      
      // Check if we're in a bullet list
      const bulletMatch = line.match(/^(\s*)- (\[ \] )?(.*)$/);
      if (bulletMatch) {
        const [, indent, checkbox, content] = bulletMatch;
        // If line is empty, exit list
        if (!content.trim()) {
          // Don't prevent default - let Enter insert newline and exit list
          return;
        }
        // Continue list
        e.preventDefault();
        const newLine = indent + "- " + (checkbox || "");
        const newValue = currentValue.substring(0, start) + "\n" + newLine + currentValue.substring(start);
        onChange(newValue);
        
        setTimeout(() => {
          const newCursorPos = start + 1 + newLine.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        return;
      }
      
      // Check if we're in a numbered list
      const numberedMatch = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (numberedMatch) {
        const [, indent, num, content] = numberedMatch;
        // If line is empty, exit list
        if (!content.trim()) {
          return;
        }
        // Continue list with next number
        e.preventDefault();
        const nextNum = parseInt(num) + 1;
        const newLine = indent + nextNum + ". ";
        const newValue = currentValue.substring(0, start) + "\n" + newLine + currentValue.substring(start);
        onChange(newValue);
        
        setTimeout(() => {
          const newCursorPos = start + 1 + newLine.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        return;
      }
      
      // Default: Enter inserts newline (normal behavior)
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Editor */}
      <div className="border rounded-md bg-background">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[400px] resize-none border-none shadow-none focus-visible:ring-0 px-4 py-3 font-mono text-sm"
          style={{ whiteSpace: "pre-wrap" }}
        />
      </div>

      {/* Formatting Toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/50",
          isMobile
            ? "sticky bottom-0 z-10 border-t rounded-t-md rounded-b-none"
            : "sticky bottom-0"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBold}
          title="Bold"
          type="button"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleItalic}
          title="Italic"
          type="button"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStrikethrough}
          title="Strikethrough"
          type="button"
        >
          <StrikethroughIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBulletList}
          title="Bullet List"
          type="button"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNumberedList}
          title="Numbered List"
          type="button"
        >
          <ListOrderedIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCheckbox}
          title="Checkbox"
          type="button"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCode}
          title="Code"
          type="button"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

