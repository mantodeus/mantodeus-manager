/**
 * Mobile Markdown Bar Component
 * 
 * Fixed position bar that appears above the keyboard on mobile devices.
 * Rendered at page level (not inside editor) to avoid scroll jitter.
 */

import { useState, useEffect, useRef } from "react";
import { FormattingButtons } from "@/components/FormattingButtons";

interface MobileMarkdownBarProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onFormat?: () => void;
}

export function MobileMarkdownBar({ editorRef, onFormat }: MobileMarkdownBarProps) {
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, offset));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Only show when keyboard is open
  const isKeyboardOpen = keyboardOffset > 0;
  if (!isKeyboardOpen) return null;

  return (
    <>
      <style>{`
        .mobile-markdown-bar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          background: hsl(var(--background));
          border-top: 1px solid hsl(var(--border));
          padding: 6px 8px;
          display: flex;
          justify-content: center;
          gap: 6px;
        }
      `}</style>
      <div
        className="mobile-markdown-bar"
        style={{
          transform: `translateY(-${keyboardOffset}px)`,
        }}
      >
        <FormattingButtons editorRef={editorRef} onFormat={onFormat} compact />
      </div>
    </>
  );
}

