/**
 * Guidance Overlay Component
 * 
 * Renders highlight for the current tour step only (one at a time).
 * Click on highlighted element OR use Next button to advance.
 */

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useGuidance, type TourStep, type GuidanceAction } from "@/contexts/GuidanceContext";
import { usePortalRoot } from "@/hooks/usePortalRoot";
import { cn } from "@/lib/utils";

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidanceOverlay() {
  const { 
    currentStep, 
    tourStatus, 
    getElement, 
    nextStep,
    cancelTour,
  } = useGuidance();
  const portalRoot = usePortalRoot();
  const portalTarget =
    portalRoot ?? (typeof document !== "undefined" ? document.body : null);
  
  const [position, setPosition] = useState<HighlightPosition | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);

  // Calculate position for current step's element
  const updatePosition = useCallback(() => {
    if (!currentStep?.elementId || tourStatus !== "active") {
      setPosition(null);
      setElement(null);
      return;
    }

    const el = getElement(currentStep.elementId);
    if (!el) {
      setPosition(null);
      setElement(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setPosition(null);
      setElement(null);
      return;
    }

    setElement(el);
    setPosition({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });
  }, [currentStep, tourStatus, getElement]);

  // Update positions on scroll/resize and step change
  useEffect(() => {
    updatePosition();

    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    // Recheck after DOM settles
    const timeoutId = setTimeout(updatePosition, 100);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [updatePosition, currentStep]);

  // Handle element click to advance
  useEffect(() => {
    if (!element || tourStatus !== "active") return;

    const handleClick = (e: Event) => {
      // Advance to next step when user clicks the highlighted element
      e.stopPropagation();
      nextStep();
    };

    // Add click listener to the actual element
    element.addEventListener("click", handleClick, { capture: true });
    
    return () => {
      element.removeEventListener("click", handleClick, { capture: true });
    };
  }, [element, tourStatus, nextStep]);

  // Cancel tour on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelTour();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelTour]);

  // If no element to highlight for this step, don't render overlay
  // (the step instruction will still show in AssistantPanel)
  if (!position || !currentStep?.elementId || tourStatus !== "active") {
    return null;
  }
  if (!portalTarget) return null;

  const action: GuidanceAction = currentStep.action || "pulse";
  const tooltip = currentStep.tooltip;
  const isSpotlight = action === "spotlight";
  const padding = 6;

  return createPortal(
    <div className="guidance-overlay fixed inset-0 z-[9998] pointer-events-none">
      {/* Spotlight backdrop */}
      {isSpotlight && (
        <div
          className="fixed inset-0 bg-black/60 animate-in fade-in duration-300"
          style={{ pointerEvents: "auto" }}
          onClick={() => cancelTour()}
        />
      )}

      {/* Highlight ring - clickable to advance */}
      <div
        className={cn(
          "absolute rounded-xl transition-all duration-300",
          action === "highlight" && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          action === "pulse" && "ring-3 ring-primary ring-offset-2 ring-offset-background",
          isSpotlight && "ring-4 ring-primary bg-background shadow-2xl z-[9999]"
        )}
        style={{
          top: position.top - padding,
          left: position.left - padding,
          width: position.width + padding * 2,
          height: position.height + padding * 2,
          pointerEvents: "none", // Let clicks through to the actual element
          // Pulsing animation for pulse action
          animation: action === "pulse" ? "guidance-pulse 2s ease-in-out infinite" : undefined,
        }}
      />

      {/* Tooltip below element */}
      {tooltip && (
        <div
          className={cn(
            "absolute z-[10000] px-3 py-2 rounded-lg shadow-lg",
            "bg-primary text-primary-foreground",
            "text-sm max-w-[280px] text-center",
            "animate-in fade-in slide-in-from-top-2 duration-300"
          )}
          style={{
            top: position.top + position.height + padding + 10,
            left: position.left + position.width / 2,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          {/* Arrow pointing up */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "8px solid hsl(var(--primary))",
            }}
          />
          <span className="font-medium">{tooltip}</span>
        </div>
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes guidance-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.7);
          }
          50% {
            box-shadow: 0 0 0 12px hsl(var(--primary) / 0);
          }
        }
      `}</style>
    </div>,
    portalTarget
  );
}
