/**
 * Formatting Buttons Component
 * 
 * Reusable formatting toolbar for markdown editor
 * Used in both desktop unified bar and mobile keyboard-pinned bar
 */

import { Button } from "@/components/ui/button";
import { Bold, Italic, List, Check as CheckIcon, Code } from "@/components/ui/Icon";
import { useRef } from "react";

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
        variant="ghost"
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
        variant="ghost"
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
        variant="ghost"
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
        variant="ghost"
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
        variant="ghost"
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
        variant="ghost"
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
        variant="ghost"
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

