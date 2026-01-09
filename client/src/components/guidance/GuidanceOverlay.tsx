/**
 * Guidance Overlay Component
 * 
 * Renders highlight overlays and tooltips for AI guidance.
 * Uses CSS positioning - never steals pointer events (except spotlight).
 */

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useGuidance, type GuidanceInstruction } from "@/contexts/GuidanceContext";
import { cn } from "@/lib/utils";

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HighlightState {
  instruction: GuidanceInstruction;
  position: HighlightPosition;
  element: HTMLElement;
}

export function GuidanceOverlay() {
  const { activeGuidance, getElement, clearGuidance } = useGuidance();
  const [highlights, setHighlights] = useState<HighlightState[]>([]);

  // Calculate positions for all guided elements
  const updatePositions = useCallback(() => {
    if (!activeGuidance || activeGuidance.length === 0) {
      setHighlights([]);
      return;
    }

    const newHighlights: HighlightState[] = [];

    for (const instruction of activeGuidance) {
      const element = getElement(instruction.elementId);
      if (!element) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      newHighlights.push({
        instruction,
        element,
        position: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        },
      });
    }

    setHighlights(newHighlights);
  }, [activeGuidance, getElement]);

  // Update positions on scroll/resize
  useEffect(() => {
    updatePositions();

    const handleUpdate = () => updatePositions();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [updatePositions]);

  // Clear guidance on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearGuidance();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearGuidance]);

  if (highlights.length === 0) return null;

  const hasSpotlight = highlights.some((h) => h.instruction.action === "spotlight");

  return createPortal(
    <div className="guidance-overlay fixed inset-0 z-[9998] pointer-events-none">
      {/* Spotlight backdrop - only if spotlight action is present */}
      {hasSpotlight && (
        <div
          className="fixed inset-0 bg-black/50 animate-in fade-in duration-300"
          style={{ pointerEvents: "auto" }}
          onClick={() => clearGuidance()}
        />
      )}

      {/* Render each highlight */}
      {highlights.map((highlight, index) => (
        <HighlightBox
          key={`${highlight.instruction.elementId}-${index}`}
          highlight={highlight}
          hasSpotlight={hasSpotlight}
        />
      ))}
    </div>,
    document.body
  );
}

interface HighlightBoxProps {
  highlight: HighlightState;
  hasSpotlight: boolean;
}

function HighlightBox({ highlight, hasSpotlight }: HighlightBoxProps) {
  const { instruction, position } = highlight;
  const { action, tooltip } = instruction;

  const padding = 4; // Padding around element

  return (
    <>
      {/* Highlight ring */}
      <div
        className={cn(
          "absolute rounded-lg transition-all duration-300",
          action === "highlight" && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          action === "pulse" && "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse",
          action === "spotlight" && "ring-4 ring-primary bg-background shadow-2xl z-[9999]"
        )}
        style={{
          top: position.top - padding,
          left: position.left - padding,
          width: position.width + padding * 2,
          height: position.height + padding * 2,
          pointerEvents: action === "spotlight" ? "auto" : "none",
        }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className={cn(
            "absolute z-[10000] px-3 py-2 rounded-lg shadow-lg",
            "bg-popover text-popover-foreground border border-border",
            "text-sm max-w-[250px]",
            "animate-in fade-in slide-in-from-bottom-2 duration-300"
          )}
          style={{
            top: position.top + position.height + padding + 8,
            left: position.left + position.width / 2,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <div className="relative">
            {/* Arrow */}
            <div
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: "6px solid hsl(var(--border))",
              }}
            />
            {tooltip}
          </div>
        </div>
      )}
    </>
  );
}
