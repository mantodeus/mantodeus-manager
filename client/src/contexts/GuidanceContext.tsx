/**
 * Guidance Context
 * 
 * Manages the element registry and step-by-step tour guidance for the AI assistant.
 * Elements register themselves with getter functions (not raw refs) to avoid stale references.
 * 
 * Tour Flow:
 * 1. AI returns steps with optional elementId
 * 2. startTour() activates step-by-step mode
 * 3. One step shown at a time, advances on tap or Next button
 * 4. Tour pauses on navigation, resumes when element found
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";

// Element types that can be guided
export type GuidanceElementType = "button" | "menu" | "field" | "badge" | "tab" | "card" | "link";

// Guidance actions
export type GuidanceAction = "highlight" | "pulse" | "spotlight";

// Registered element
export interface GuidanceElement {
  id: string;                              // Namespaced: "invoices.send"
  type: GuidanceElementType;
  label: string;
  getElement: () => HTMLElement | null;    // Getter, not raw ref
}

// Tour step (enhanced with element binding)
export interface TourStep {
  order: number;
  description: string;
  elementId?: string;                      // Optional - some steps are just instructions
  action?: GuidanceAction;
  tooltip?: string;
}

// Warning instruction
export interface GuidanceWarning {
  elementId?: string;
  message: string;
}

// Tour status
export type TourStatus = "idle" | "active" | "paused" | "complete";

// Full guidance payload from AI
export interface GuidancePayload {
  steps?: TourStep[];
  warnings?: GuidanceWarning[];
}

// Context state
interface GuidanceContextState {
  // Registry
  elements: Map<string, GuidanceElement>;
  registerElement: (
    id: string,
    type: GuidanceElementType,
    label: string,
    getElement: () => HTMLElement | null
  ) => void;
  unregisterElement: (id: string) => void;
  
  // Tour state
  tourSteps: TourStep[] | null;
  currentStepIndex: number;
  tourStatus: TourStatus;
  currentStep: TourStep | null;
  totalSteps: number;
  activeWarnings: GuidanceWarning[] | null;
  
  // Convenience flags
  isGuiding: boolean;
  isTourActive: boolean;
  
  // Tour actions
  startTour: (payload: GuidancePayload) => void;
  nextStep: () => void;
  previousStep: () => void;
  pauseTour: () => void;
  resumeTour: () => void;
  cancelTour: () => void;
  
  // Legacy (backwards compat)
  applyGuidance: (payload: GuidancePayload) => void;
  clearGuidance: () => void;
  
  // Helpers
  getVisibleElements: () => { id: string; type: string; label: string }[];
  getElement: (id: string) => HTMLElement | null;
}

const GuidanceContext = createContext<GuidanceContextState | null>(null);

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  // Use ref for elements map to avoid re-renders on registration
  const elementsRef = useRef<Map<string, GuidanceElement>>(new Map());
  const [location] = useLocation();
  const pausedRouteRef = useRef<string | null>(null);
  
  // Auto-scan for elements with data-guide-id attributes
  useEffect(() => {
    const scanForElements = () => {
      // Scope to main content area, not entire document
      const container = document.querySelector(".app-content") || document.body;
      const elements = container.querySelectorAll("[data-guide-id]");
      
      elements.forEach((el) => {
        const id = el.getAttribute("data-guide-id");
        const type = el.getAttribute("data-guide-type") as GuidanceElementType;
        const label = el.getAttribute("data-guide-label");
        
        if (id && type && label) {
          const htmlEl = el as HTMLElement;
          // Check visibility
          const rect = htmlEl.getBoundingClientRect();
          const isVisible = htmlEl.offsetParent !== null && rect.width > 0 && rect.height > 0;
          
          if (isVisible) {
            elementsRef.current.set(id, {
              id,
              type,
              label,
              getElement: () => document.querySelector(`[data-guide-id="${id}"]`) as HTMLElement | null,
            });
          }
        }
      });
    };
    
    // Scan after DOM settles
    const timeoutId = setTimeout(scanForElements, 100);
    
    return () => clearTimeout(timeoutId);
  }, [location]); // Re-scan on route change
  
  // Tour state
  const [tourSteps, setTourSteps] = useState<TourStep[] | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tourStatus, setTourStatus] = useState<TourStatus>("idle");
  const [activeWarnings, setActiveWarnings] = useState<GuidanceWarning[] | null>(null);
  
  // Derived values
  const currentStep = tourSteps && tourStatus === "active" ? tourSteps[currentStepIndex] ?? null : null;
  const totalSteps = tourSteps?.length ?? 0;
  const isGuiding = tourStatus === "active" && currentStep !== null;
  const isTourActive = tourStatus === "active";
  
  // Register an element with its getter
  const registerElement = useCallback((
    id: string,
    type: GuidanceElementType,
    label: string,
    getElement: () => HTMLElement | null
  ) => {
    elementsRef.current.set(id, { id, type, label, getElement });
  }, []);
  
  // Unregister an element
  const unregisterElement = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);
  
  // Start a tour
  const startTour = useCallback((payload: GuidancePayload) => {
    const { steps, warnings } = payload;
    
    if (!steps || steps.length === 0) {
      // No steps, nothing to tour
      setTourSteps(null);
      setTourStatus("idle");
      return;
    }
    
    // Sort steps by order
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    
    setTourSteps(sortedSteps);
    setCurrentStepIndex(0);
    setTourStatus("active");
    setActiveWarnings(warnings && warnings.length > 0 ? warnings : null);
    pausedRouteRef.current = null;
  }, []);
  
  // Advance to next step
  const nextStep = useCallback(() => {
    if (!tourSteps || tourStatus !== "active") return;
    
    const nextIndex = currentStepIndex + 1;
    
    if (nextIndex >= tourSteps.length) {
      // Tour complete
      setTourStatus("complete");
    } else {
      setCurrentStepIndex(nextIndex);
    }
  }, [tourSteps, tourStatus, currentStepIndex]);
  
  // Go to previous step
  const previousStep = useCallback(() => {
    if (!tourSteps || tourStatus !== "active") return;
    
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [tourSteps, tourStatus, currentStepIndex]);
  
  // Pause tour (when navigating away)
  const pauseTour = useCallback(() => {
    if (tourStatus === "active") {
      setTourStatus("paused");
      pausedRouteRef.current = location;
    }
  }, [tourStatus, location]);
  
  // Resume tour
  const resumeTour = useCallback(() => {
    if (tourStatus === "paused") {
      setTourStatus("active");
      pausedRouteRef.current = null;
    }
  }, [tourStatus]);
  
  // Cancel tour entirely
  const cancelTour = useCallback(() => {
    setTourSteps(null);
    setCurrentStepIndex(0);
    setTourStatus("idle");
    setActiveWarnings(null);
    pausedRouteRef.current = null;
  }, []);
  
  // Legacy: applyGuidance now starts a tour
  const applyGuidance = useCallback((payload: GuidancePayload) => {
    startTour(payload);
  }, [startTour]);
  
  // Legacy: clearGuidance now cancels tour
  const clearGuidance = useCallback(() => {
    cancelTour();
  }, [cancelTour]);
  
  // Handle route changes for pause/resume
  useEffect(() => {
    if (tourStatus === "active" && currentStep?.elementId) {
      // Check if current step's element still exists
      const element = elementsRef.current.get(currentStep.elementId);
      const el = element?.getElement();
      
      if (!el) {
        // Element not found, pause tour
        pauseTour();
      }
    } else if (tourStatus === "paused") {
      // Check if we're back on the paused route
      if (location === pausedRouteRef.current || !currentStep?.elementId) {
        // Try to resume - check if element exists now
        setTimeout(() => {
          if (currentStep?.elementId) {
            const element = elementsRef.current.get(currentStep.elementId);
            const el = element?.getElement();
            if (el) {
              resumeTour();
            }
          } else {
            // Step has no element, can resume
            resumeTour();
          }
        }, 150); // Wait for DOM to settle
      }
    }
  }, [location, tourStatus, currentStep, pauseTour, resumeTour]);
  
  // Get list of visible elements for AI context
  const getVisibleElements = useCallback(() => {
    const visible: { id: string; type: string; label: string }[] = [];
    
    elementsRef.current.forEach((element) => {
      const el = element.getElement();
      if (el) {
        const rect = el.getBoundingClientRect();
        if (el.offsetParent !== null && rect.width > 0 && rect.height > 0) {
          visible.push({
            id: element.id,
            type: element.type,
            label: element.label,
          });
        }
      }
    });
    
    return visible;
  }, []);
  
  // Get element by ID
  const getElement = useCallback((id: string): HTMLElement | null => {
    const element = elementsRef.current.get(id);
    return element?.getElement() ?? null;
  }, []);
  
  const value: GuidanceContextState = {
    elements: elementsRef.current,
    registerElement,
    unregisterElement,
    tourSteps,
    currentStepIndex,
    tourStatus,
    currentStep,
    totalSteps,
    activeWarnings,
    isGuiding,
    isTourActive,
    startTour,
    nextStep,
    previousStep,
    pauseTour,
    resumeTour,
    cancelTour,
    applyGuidance,
    clearGuidance,
    getVisibleElements,
    getElement,
  };
  
  return (
    <GuidanceContext.Provider value={value}>
      {children}
      <GuidanceOverlayPortal />
    </GuidanceContext.Provider>
  );
}

// Lazy-load overlay to avoid circular deps
function GuidanceOverlayPortal() {
  const { isGuiding, tourStatus } = useGuidance();
  const [Overlay, setOverlay] = useState<React.ComponentType | null>(null);
  
  const shouldShow = isGuiding || tourStatus === "active";
  
  useEffect(() => {
    if (shouldShow && !Overlay) {
      import("@/components/guidance/GuidanceOverlay").then((mod) => {
        setOverlay(() => mod.GuidanceOverlay);
      });
    }
  }, [shouldShow, Overlay]);
  
  if (!shouldShow || !Overlay) return null;
  return <Overlay />;
}

export function useGuidance() {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error("useGuidance must be used within a GuidanceProvider");
  }
  return context;
}
