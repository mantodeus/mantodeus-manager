/**
 * useGuidanceElement Hook
 * 
 * Registers a UI element with the guidance system.
 * Returns a ref callback to attach to the element.
 * 
 * Usage:
 * ```tsx
 * const sendRef = useGuidanceElement("invoices.send", "button", "Send Invoice");
 * return <Button ref={sendRef}>Send</Button>;
 * ```
 */

import { useEffect, useCallback, useRef } from "react";
import { useGuidance, type GuidanceElementType } from "@/contexts/GuidanceContext";

export function useGuidanceElement(
  id: string,
  type: GuidanceElementType,
  label: string
): React.RefCallback<HTMLElement> {
  const { registerElement, unregisterElement } = useGuidance();
  const elementRef = useRef<HTMLElement | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    // Register with getter function that resolves at render time
    registerElement(id, type, label, () => elementRef.current);
    registeredRef.current = true;
    
    return () => {
      unregisterElement(id);
      registeredRef.current = false;
    };
  }, [id, type, label, registerElement, unregisterElement]);

  // Return ref callback that stores the element
  const refCallback = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  return refCallback;
}

/**
 * Data attribute helper for elements that can't use the hook
 * 
 * Usage:
 * ```tsx
 * <button {...guideDataAttrs("invoices.send", "button", "Send Invoice")}>
 *   Send
 * </button>
 * ```
 */
export function guideDataAttrs(
  id: string,
  type: GuidanceElementType,
  label: string
): Record<string, string> {
  return {
    "data-guide-id": id,
    "data-guide-type": type,
    "data-guide-label": label,
  };
}
