/**
 * Guidance Context
 * 
 * Manages the element registry and active guidance state for the AI assistant.
 * Elements register themselves with getter functions (not raw refs) to avoid stale references.
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

// Instruction from AI
export interface GuidanceInstruction {
  elementId: string;
  action: GuidanceAction;
  tooltip?: string;
  priority: number;
}

// Step instruction
export interface GuidanceStep {
  order: number;
  description: string;
}

// Warning instruction
export interface GuidanceWarning {
  elementId?: string;
  message: string;
}

// Full guidance payload from AI
export interface GuidancePayload {
  guidance?: GuidanceInstruction[];
  steps?: GuidanceStep[];
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
  
  // Active guidance
  activeGuidance: GuidanceInstruction[] | null;
  activeSteps: GuidanceStep[] | null;
  activeWarnings: GuidanceWarning[] | null;
  isGuiding: boolean;
  
  // Actions
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
  
  // Guidance state
  const [activeGuidance, setActiveGuidance] = useState<GuidanceInstruction[] | null>(null);
  const [activeSteps, setActiveSteps] = useState<GuidanceStep[] | null>(null);
  const [activeWarnings, setActiveWarnings] = useState<GuidanceWarning[] | null>(null);
  
  const isGuiding = activeGuidance !== null && activeGuidance.length > 0;
  
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
  
  // Apply guidance from AI response
  const applyGuidance = useCallback((payload: GuidancePayload) => {
    const { guidance, steps, warnings } = payload;
    
    // Filter guidance to only elements that exist and are visible
    const validGuidance = guidance?.filter(g => {
      const element = elementsRef.current.get(g.elementId);
      if (!element) return false;
      
      const el = element.getElement();
      if (!el) return false;
      
      // Check visibility
      const rect = el.getBoundingClientRect();
      return el.offsetParent !== null && rect.width > 0 && rect.height > 0;
    }) ?? null;
    
    // Sort by priority (lower = more important)
    if (validGuidance && validGuidance.length > 0) {
      validGuidance.sort((a, b) => a.priority - b.priority);
      setActiveGuidance(validGuidance);
    } else {
      setActiveGuidance(null);
    }
    
    // Sort steps by order
    if (steps && steps.length > 0) {
      const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
      setActiveSteps(sortedSteps);
    } else {
      setActiveSteps(null);
    }
    
    setActiveWarnings(warnings && warnings.length > 0 ? warnings : null);
  }, []);
  
  // Clear all guidance
  const clearGuidance = useCallback(() => {
    setActiveGuidance(null);
    setActiveSteps(null);
    setActiveWarnings(null);
  }, []);
  
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
    activeGuidance,
    activeSteps,
    activeWarnings,
    isGuiding,
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
  const { isGuiding } = useGuidance();
  const [Overlay, setOverlay] = useState<React.ComponentType | null>(null);
  
  useEffect(() => {
    if (isGuiding && !Overlay) {
      import("@/components/guidance/GuidanceOverlay").then((mod) => {
        setOverlay(() => mod.GuidanceOverlay);
      });
    }
  }, [isGuiding, Overlay]);
  
  if (!isGuiding || !Overlay) return null;
  return <Overlay />;
}

export function useGuidance() {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error("useGuidance must be used within a GuidanceProvider");
  }
  return context;
}
