/**
 * Formatting Buttons Component
 * 
 * Reusable formatting toolbar for markdown editor
 * Used in both desktop unified bar and mobile keyboard-pinned bar
 */

import { Button } from "@/components/ui/button";
import { Bold, Italic, List, Check as CheckIcon, Code } from "@/components/ui/Icon";
import { useState, useEffect, useCallback } from "react";

// Strikethrough icon
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

// Numbered list icon
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

interface FormattingButtonsProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onFormat?: () => void;
  compact?: boolean;
}

export function FormattingButtons({ editorRef, onFormat, compact = false }: FormattingButtonsProps) {
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    bulletList: false,
    numberedList: false,
    checkbox: false,
  });

  // Check formatting state based on current selection
  const checkFormattingState = useCallback(() => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setActiveStates({
        bold: false,
        italic: false,
        strikethrough: false,
        code: false,
        bulletList: false,
        numberedList: false,
        checkbox: false,
      });
      return;
    }

    // Check execCommand states (for bold, italic, strikethrough)
    const bold = document.queryCommandState("bold");
    const italic = document.queryCommandState("italic");
    const strikethrough = document.queryCommandState("strikeThrough");

    // Check if selection is inside a <code> element
    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;
    let code = false;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === "code") {
          code = true;
          break;
        }
      }
      node = node.parentNode;
    }

    // Check if selection is inside a list
    node = range.commonAncestorContainer;
    let bulletList = false;
    let numberedList = false;
    let checkbox = false;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        if (tagName === "ul") {
          bulletList = true;
          // Check if it's a checkbox list
          const hasCheckbox = el.querySelector('input[type="checkbox"]');
          if (hasCheckbox) {
            checkbox = true;
          }
          break;
        } else if (tagName === "ol") {
          numberedList = true;
          break;
        } else if (tagName === "li") {
          const parent = el.parentElement;
          if (parent) {
            const parentTag = parent.tagName.toLowerCase();
            if (parentTag === "ul") {
              bulletList = true;
              const hasCheckbox = el.querySelector('input[type="checkbox"]');
              if (hasCheckbox) {
                checkbox = true;
              }
            } else if (parentTag === "ol") {
              numberedList = true;
            }
          }
          break;
        }
      }
      node = node.parentNode;
    }

    setActiveStates({
      bold,
      italic,
      strikethrough,
      code,
      bulletList,
      numberedList,
      checkbox,
    });
  }, [editorRef]);

  // Listen to selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      // Only check if editor is focused
      if (editorRef.current && document.activeElement === editorRef.current) {
        checkFormattingState();
      }
    };

    // Also check on input events (typing)
    const handleInput = () => {
      setTimeout(checkFormattingState, 0);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener("input", handleInput);
    }

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (editor) {
        editor.removeEventListener("input", handleInput);
      }
    };
  }, [editorRef, checkFormattingState]);

  const handleToolbarPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    editorRef.current?.focus();
  };

  // Formatting handlers using document.execCommand
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Trigger input event to update markdown
    if (onFormat) {
      onFormat();
    } else {
      const event = new Event('input', { bubbles: true });
      editorRef.current?.dispatchEvent(event);
    }
    // Update active states after a brief delay
    setTimeout(checkFormattingState, 0);
  };

  const handleBold = () => execCommand("bold");
  const handleItalic = () => execCommand("italic");
  const handleStrikethrough = () => execCommand("strikeThrough");
  const handleCode = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText) {
        const code = document.createElement("code");
        code.textContent = selectedText;
        range.deleteContents();
        range.insertNode(code);
        if (onFormat) {
          onFormat();
        } else {
          const event = new Event('input', { bubbles: true });
          editorRef.current?.dispatchEvent(event);
        }
      }
    }
  };

  const handleBulletList = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
      if (node) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === "ul") {
          const parent = el.parentNode;
          if (parent) {
            const div = document.createElement("div");
            div.innerHTML = el.innerHTML.replace(/<li>/g, "").replace(/<\/li>/g, "<br>");
            parent.replaceChild(div, el);
          }
        } else {
          const text = el.textContent || "";
          const ul = document.createElement("ul");
          const li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
          el.parentNode?.replaceChild(ul, el);
        }
        if (onFormat) {
          onFormat();
        } else {
          const event = new Event('input', { bubbles: true });
          editorRef.current?.dispatchEvent(event);
        }
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
        if (onFormat) {
          onFormat();
        } else {
          const event = new Event('input', { bubbles: true });
          editorRef.current?.dispatchEvent(event);
        }
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
        if (onFormat) {
          onFormat();
        } else {
          const event = new Event('input', { bubbles: true });
          editorRef.current?.dispatchEvent(event);
        }
      }
    }
  };

  const buttonSize = compact ? "sm" : "default";
  const buttonClassName = compact 
    ? "h-9 w-9 p-0 flex-shrink-0" 
    : "h-9 px-3 flex-shrink-0";
  const iconSize = compact ? "h-4 w-4" : "h-4 w-4";

  return (
    <>
      <Button
        variant={activeStates.bold ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleBold();
        }}
        className={buttonClassName}
        type="button"
      >
        <Bold className={iconSize} />
      </Button>
      <Button
        variant={activeStates.italic ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleItalic();
        }}
        className={buttonClassName}
        type="button"
      >
        <Italic className={iconSize} />
      </Button>
      <Button
        variant={activeStates.strikethrough ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleStrikethrough();
        }}
        className={buttonClassName}
        type="button"
      >
        <StrikethroughIcon className={iconSize} />
      </Button>
      <Button
        variant={activeStates.bulletList ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleBulletList();
        }}
        className={buttonClassName}
        type="button"
      >
        <List className={iconSize} />
      </Button>
      <Button
        variant={activeStates.numberedList ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleNumberedList();
        }}
        className={buttonClassName}
        type="button"
      >
        <ListOrderedIcon className={iconSize} />
      </Button>
      <Button
        variant={activeStates.checkbox ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleCheckbox();
        }}
        className={buttonClassName}
        type="button"
      >
        <CheckIcon className={iconSize} />
      </Button>
      <Button
        variant={activeStates.code ? "default" : "ghost"}
        size={buttonSize}
        onPointerDown={handleToolbarPointerDown}
        onClick={(e) => {
          e.preventDefault();
          handleCode();
        }}
        className={buttonClassName}
        type="button"
      >
        <Code className={iconSize} />
      </Button>
    </>
  );
}

