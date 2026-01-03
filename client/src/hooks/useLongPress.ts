/**
 * useLongPress Hook
 * 
 * Reliable long-press detection with gesture state machine.
 * Prevents tap/click events once long-press threshold is crossed.
 * 
 * Gesture States: idle → pressing → long-press → menu-open
 * 
 * Uses pointer events for cross-platform support.
 */

import { useCallback, useRef, useState, useEffect } from "react";

interface UseLongPressOptions {
  /** Callback when long-press is detected */
  onLongPress: (event: PointerEvent) => void;
  /** Duration in milliseconds (default: 550ms) */
  duration?: number;
  /** Movement threshold in pixels to cancel (default: 8px) */
  threshold?: number;
  /** Whether to enable haptic feedback on supported devices */
  hapticFeedback?: boolean;
  /** Callback when press starts (for visual feedback) */
  onPressStart?: () => void;
}

type GestureState = "idle" | "pressing" | "long-press" | "menu-open";

export function useLongPress({
  onLongPress,
  duration = 550,
  threshold = 8,
  hapticFeedback = false,
  onPressStart,
}: UseLongPressOptions) {
  const [gestureState, setGestureState] = useState<GestureState>("idle");
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const startScrollPos = useRef<{ x: number; y: number } | null>(null);
  const hasScrolled = useRef(false);
  const pointerId = useRef<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (gestureState !== "idle") {
      setGestureState("idle");
    }
    startPos.current = null;
    startScrollPos.current = null;
    hasScrolled.current = false;
    pointerId.current = null;
  }, [gestureState]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only handle primary pointer (left mouse button or touch)
      if (e.button !== 0 && e.button !== undefined) return;
      
      // Don't interfere with inputs, buttons, links, or other interactive elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.isContentEditable ||
        target.closest('input, textarea, select, button, a, [contenteditable]')
      ) {
        return; // Let these elements work normally
      }
      
      // Prevent default to avoid text selection and other browser behaviors
      e.preventDefault();
      e.stopPropagation();

      // Prevent text selection
      if (document.getSelection) {
        const selection = document.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }

      const x = e.clientX;
      const y = e.clientY;

      startPos.current = { x, y };
      startScrollPos.current = {
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset,
      };
      hasScrolled.current = false;
      pointerId.current = e.pointerId;
      elementRef.current = e.currentTarget as HTMLElement;
      
      setGestureState("pressing");
      onPressStart?.();

      longPressTimer.current = setTimeout(() => {
        // Check if we've scrolled too much
        if (hasScrolled.current) {
          cancelLongPress();
          return;
        }

        // Long-press detected - prevent tap/click
        setGestureState("long-press");
        
        // Create native PointerEvent for callback
        const nativeEvent = new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: e.pointerId,
          clientX: x,
          clientY: y,
          button: 0,
        });

        onLongPress(nativeEvent);

        // Haptic feedback on supported devices
        if (hapticFeedback && navigator.vibrate) {
          navigator.vibrate(50);
        }

        setGestureState("menu-open");
      }, duration);
    },
    [onLongPress, duration, hapticFeedback, cancelLongPress, onPressStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Only handle the pointer we're tracking
      if (pointerId.current !== null && e.pointerId !== pointerId.current) return;
      if (!startPos.current || !startScrollPos.current) return;

      // Check scroll movement
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollDeltaX = Math.abs(scrollX - startScrollPos.current.x);
      const scrollDeltaY = Math.abs(scrollY - startScrollPos.current.y);

      if (scrollDeltaX > threshold || scrollDeltaY > threshold) {
        hasScrolled.current = true;
        cancelLongPress();
        return;
      }

      // Check pointer movement
      const deltaX = Math.abs(e.clientX - startPos.current.x);
      const deltaY = Math.abs(e.clientY - startPos.current.y);

      if (deltaX > threshold || deltaY > threshold) {
        cancelLongPress();
      }
    },
    [threshold, cancelLongPress]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Only handle the pointer we're tracking
      if (pointerId.current !== null && e.pointerId !== pointerId.current) return;

      // If we reached long-press state, prevent click/tap
      if (gestureState === "long-press" || gestureState === "menu-open") {
        e.preventDefault();
        e.stopPropagation();
        // Don't cancel - menu is open
        return;
      }

      // Otherwise, cancel and allow normal tap
      cancelLongPress();
      
      // Clear any text selection that might have started
      if (document.getSelection) {
        const selection = document.getSelection();
        if (selection && selection.toString().length > 0) {
          selection.removeAllRanges();
        }
      }
    },
    [gestureState, cancelLongPress]
  );

  const handlePointerCancel = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Track scroll events globally to cancel long-press
  useEffect(() => {
    const handleScroll = () => {
      if (startScrollPos.current && gestureState === "pressing") {
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollDeltaX = Math.abs(scrollX - startScrollPos.current.x);
        const scrollDeltaY = Math.abs(scrollY - startScrollPos.current.y);

        if (scrollDeltaX > threshold || scrollDeltaY > threshold) {
          hasScrolled.current = true;
          cancelLongPress();
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold, cancelLongPress, gestureState]);

  // Prevent click/tap if long-press was activated
  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (gestureState === "long-press" || gestureState === "menu-open" || gestureState === "pressing") {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [gestureState]
  );

  // Prevent text selection events
  const handleSelectStart = useCallback(
    (e: React.SyntheticEvent) => {
      // Don't interfere with inputs, textareas, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('input, textarea, select, [contenteditable]')
      ) {
        return; // Allow selection in these elements
      }
      
      if (gestureState !== "idle") {
        e.preventDefault();
      }
    },
    [gestureState]
  );

  return {
    longPressHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onClick: handleClick,
      onTouchStart: handleClick, // Also prevent touch events
      onSelectStart: handleSelectStart,
      onDragStart: (e: React.DragEvent) => {
        if (gestureState !== "idle") {
          e.preventDefault();
        }
      },
    },
    gestureState,
    cancelLongPress,
    isPressing: gestureState === "pressing",
  };
}
