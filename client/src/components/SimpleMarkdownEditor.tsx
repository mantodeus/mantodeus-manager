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

export function SimpleMarkdownEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  autoFocus = false,
}: SimpleMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  
  // Sync scroll between textarea and preview
  const handleScroll = () => {
    if (textareaRef.current && previewRef.current) {
      requestAnimationFrame(() => {
        if (textareaRef.current && previewRef.current) {
          previewRef.current.scrollTop = textareaRef.current.scrollTop;
          previewRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
      });
    }
  };
  
  // Also sync on content changes
  useEffect(() => {
    if (textareaRef.current && previewRef.current) {
      requestAnimationFrame(() => {
        if (textareaRef.current && previewRef.current) {
          previewRef.current.scrollTop = textareaRef.current.scrollTop;
          previewRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
      });
    }
  }, [content]);

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
      // Use visual viewport API if available (modern mobile browsers)
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const heightDiff = windowHeight - viewportHeight;
        // Only update if difference is significant (keyboard is open)
        // Store the visual viewport height as the position for the toolbar
        if (heightDiff > 50) {
          // Keyboard is open - position toolbar at bottom of visual viewport
          setKeyboardHeight(windowHeight - viewportHeight);
        } else {
          // Keyboard is closed - position at bottom of screen
          setKeyboardHeight(0);
        }
      } else {
        // Fallback: detect based on window height changes
        const currentHeight = window.innerHeight;
        const storedHeight = sessionStorage.getItem('viewport-height');
        if (storedHeight) {
          const heightDiff = parseInt(storedHeight) - currentHeight;
          if (heightDiff > 50) {
            setKeyboardHeight(heightDiff);
          } else {
            setKeyboardHeight(0);
            // Update stored height when keyboard closes
            sessionStorage.setItem('viewport-height', currentHeight.toString());
          }
        } else {
          sessionStorage.setItem('viewport-height', currentHeight.toString());
          setKeyboardHeight(0);
        }
      }
    };

    // Initial check
    updateKeyboardHeight();

    // Listen to visual viewport changes
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

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
        setIsFocused(true);
      }, 100);
    }
  }, [autoFocus]);

  // Track focus state
  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    // Delay blur to allow toolbar button clicks
    setTimeout(() => {
      if (document.activeElement !== textareaRef.current) {
        setIsFocused(false);
      }
    }, 200);
  };

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
      
      // Use requestAnimationFrame for better cursor placement
      requestAnimationFrame(() => {
        const newCursorPos = start + before.length + text.length + after.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
        setIsFocused(true);
      });
    } else {
      // If no text is selected, insert syntax and place cursor in middle
      const newValue = beforeText + before + after + afterText;
      onChange(newValue);
      
      requestAnimationFrame(() => {
        const newCursorPos = start + before.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
        setIsFocused(true);
      });
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
    
    // Find the line containing the cursor
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      const lineStart = charCount;
      const lineEnd = charCount + lineLength;
      
      // Cursor is in this line if it's between lineStart and lineEnd (inclusive at end for newline)
      if (start >= lineStart && start <= lineEnd) {
        currentLine = i;
        break;
      }
      charCount += lineLength + 1; // +1 for newline
    }
    
    const line = lines[currentLine];
    const wasBullet = line.trim().startsWith("- ");
    const indent = line.match(/^(\s*)/)?.[1] || "";
    
    if (wasBullet) {
      // Remove bullet
      lines[currentLine] = line.replace(/^(\s*)- /, "$1");
    } else {
      // Add bullet
      lines[currentLine] = indent + "- " + line.trimStart();
    }
    
    const newValue = lines.join("\n");
    onChange(newValue);
    
    // Calculate accurate cursor position
    requestAnimationFrame(() => {
      let newCursorPos = start;
      if (wasBullet) {
        // Removed bullet: move cursor back
        newCursorPos = Math.max(0, start - 2);
      } else {
        // Added bullet: move cursor forward
        newCursorPos = start + 2;
      }
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
      setIsFocused(true);
    });
  };
  
  const handleNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start } = getSelection();
    const currentValue = textarea.value;
    const lines = currentValue.split("\n");
    let currentLine = 0;
    let charCount = 0;
    
    // Find the line containing the cursor
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      const lineStart = charCount;
      const lineEnd = charCount + lineLength;
      
      // Cursor is in this line if it's between lineStart and lineEnd (inclusive at end for newline)
      if (start >= lineStart && start <= lineEnd) {
        currentLine = i;
        break;
      }
      charCount += lineLength + 1;
    }
    
    const line = lines[currentLine];
    const wasNumbered = /^\s*\d+\.\s/.test(line);
    const indent = line.match(/^(\s*)/)?.[1] || "";
    
    if (wasNumbered) {
      // Remove numbering
      lines[currentLine] = line.replace(/^(\s*)\d+\.\s/, "$1");
    } else {
      // Add numbering
      lines[currentLine] = indent + "1. " + line.trimStart();
    }
    
    const newValue = lines.join("\n");
    onChange(newValue);
    
    // Calculate accurate cursor position
    requestAnimationFrame(() => {
      let newCursorPos = start;
      if (wasNumbered) {
        // Find how many chars were removed
        const match = line.match(/^(\s*)(\d+)\.\s/);
        if (match) {
          const removedLength = match[0].length;
          newCursorPos = Math.max(0, start - removedLength);
        }
      } else {
        // Added "1. ": move cursor forward
        newCursorPos = start + 3;
      }
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
      setIsFocused(true);
    });
  };
  
  const handleCheckbox = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start } = getSelection();
    const currentValue = textarea.value;
    const lines = currentValue.split("\n");
    let currentLine = 0;
    let charCount = 0;
    
    // Find the line containing the cursor
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      const lineStart = charCount;
      const lineEnd = charCount + lineLength;
      
      // Cursor is in this line if it's between lineStart and lineEnd (inclusive at end for newline)
      if (start >= lineStart && start <= lineEnd) {
        currentLine = i;
        break;
      }
      charCount += lineLength + 1;
    }
    
    const line = lines[currentLine];
    const hasCheckbox = line.trim().startsWith("- [ ] ");
    const hasBullet = line.trim().startsWith("- ");
    const indent = line.match(/^(\s*)/)?.[1] || "";
    
    if (hasCheckbox) {
      // Remove checkbox, keep bullet
      lines[currentLine] = line.replace(/^(\s*)- \[ \] /, "$1- ");
    } else if (hasBullet) {
      // Add checkbox to existing bullet
      lines[currentLine] = line.replace(/^(\s*)- /, "$1- [ ] ");
    } else {
      // Add bullet with checkbox
      lines[currentLine] = indent + "- [ ] " + line.trimStart();
    }
    
    const newValue = lines.join("\n");
    onChange(newValue);
    
    requestAnimationFrame(() => {
      textarea.focus();
      setIsFocused(true);
    });
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
      
      // Find the line containing the cursor
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length;
        const lineStart = charCount;
        const lineEnd = charCount + lineLength;
        
        // Cursor is in this line if it's between lineStart and lineEnd (inclusive at end for newline)
        if (start >= lineStart && start <= lineEnd) {
          currentLine = i;
          break;
        }
        charCount += lineLength + 1;
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
        
        requestAnimationFrame(() => {
          const newCursorPos = start + 1 + newLine.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        });
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
        
        requestAnimationFrame(() => {
          const newCursorPos = start + 1 + newLine.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        });
        return;
      }
      
      // Default: Enter inserts newline (normal behavior)
    }
  };

  // Calculate toolbar position for mobile - truly fixed, independent of scroll
  const toolbarStyle: React.CSSProperties = isMobile && isFocused
    ? {
        position: 'fixed',
        bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
        left: '0',
        right: '0',
        zIndex: 100,
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.5rem)`,
      }
    : {};

  return (
    <div className={cn("relative", className)}>
      <div ref={containerRef}>
        {/* Editor Container with Live Preview */}
        <div className="border rounded-md bg-background relative overflow-hidden">
          {/* Live Preview Layer (rendered markdown) */}
          <div
            ref={previewRef}
            className={cn(
              "absolute inset-0 px-4 py-3 text-sm pointer-events-none overflow-auto",
              isMobile ? "min-h-[300px]" : "min-h-[400px]"
            )}
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              lineHeight: '1.5',
            }}
          >
            {content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_strong]:font-semibold [&_em]:italic [&_del]:line-through [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_ul]:list-disc [&_ul]:list-inside [&_ul]:ml-4 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:ml-4 [&_ol]:my-2 [&_li]:ml-2 [&_p]:my-2">
                <SimpleMarkdown>{content}</SimpleMarkdown>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          
          {/* Textarea Layer (transparent text, visible caret) */}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onScroll={handleScroll}
            placeholder=""
            className={cn(
              "relative resize-none border-none shadow-none focus-visible:ring-0 px-4 py-3 text-sm",
              "bg-transparent caret-foreground",
              isMobile ? "min-h-[300px]" : "min-h-[400px]"
            )}
            style={{ 
              whiteSpace: "pre-wrap",
              color: 'transparent',
              textShadow: '0 0 0 transparent',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            }}
          />
        </div>
      </div>

      {/* Formatting Toolbar - Fixed outside scrollable container, truly independent */}
      {/* On mobile when focused, use portal-like positioning to escape all scroll contexts */}
      {isMobile && isFocused ? (
        <div
          className="fixed left-0 right-0 border-t bg-background/95 backdrop-blur-sm shadow-lg"
          style={{
            bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
            zIndex: 9999,
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.5rem)`,
            transform: 'translateZ(0)', // Force hardware acceleration
            willChange: 'transform',
          }}
        >
          <div className="flex items-center gap-1 p-2 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Button
              variant="ghost"
              size="default"
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
      ) : (
        <div
          className="sticky bottom-0 rounded-md bg-muted/50 mt-2 z-10 flex items-center gap-1 p-2 border"
        >
          <div className="flex items-center gap-1 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleBold();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleItalic();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleStrikethrough();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <StrikethroughIcon className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleBulletList();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleNumberedList();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <ListOrderedIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleCheckbox();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                handleCode();
              }}
              className="h-8 min-w-[32px] flex-shrink-0"
              type="button"
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

