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
  onLongPress: (event: PointerEvent | TouchEvent) => void;
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
type LongPressEvent = PointerEvent | TouchEvent;
type PointerHandlerEvent = React.PointerEvent | PointerEvent;
type TouchHandlerEvent = React.TouchEvent | TouchEvent;

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
  const latestEvent = useRef<LongPressEvent | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setGestureState("idle");
    startPos.current = null;
    startScrollPos.current = null;
    hasScrolled.current = false;
    pointerId.current = null;
  }, [gestureState]);

  const isInteractiveTarget = (target: HTMLElement | null) => {
    if (!target) return false;
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.isContentEditable ||
      Boolean(target.closest("input, textarea, select, button, a, [contenteditable]"))
    );
  };

  const startPress = useCallback(
    ({
      clientX,
      clientY,
      eventTarget,
      currentTarget,
      id,
      nativeEvent,
      preventDefault,
      stopPropagation,
    }: {
      clientX: number;
      clientY: number;
      eventTarget: EventTarget | null;
      currentTarget: EventTarget | null;
      id: number;
      nativeEvent: LongPressEvent;
      preventDefault?: () => void;
      stopPropagation?: () => void;
    }) => {
      if (pointerId.current !== null || gestureState !== "idle") return;

      const target = eventTarget instanceof HTMLElement ? eventTarget : null;
      if (isInteractiveTarget(target)) return;

      // Prevent default to avoid text selection and other browser behaviors
      preventDefault?.();
      stopPropagation?.();

      // Prevent text selection
      if (document.getSelection) {
        const selection = document.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }

      startPos.current = { x: clientX, y: clientY };
      startScrollPos.current = {
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset,
      };
      hasScrolled.current = false;
      pointerId.current = id;
      elementRef.current = (currentTarget as HTMLElement) || target;
      latestEvent.current = nativeEvent;

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

        if (latestEvent.current) {
          onLongPress(latestEvent.current);
        }

        // Haptic feedback on supported devices
        if (hapticFeedback && navigator.vibrate) {
          navigator.vibrate(50);
        }

        setGestureState("menu-open");
      }, duration);
    },
    [cancelLongPress, duration, gestureState, hapticFeedback, onLongPress, onPressStart]
  );

  const handlePointerDown = useCallback(
    (e: PointerHandlerEvent) => {
      // Only handle primary pointer (left mouse button or touch)
      if (e.button !== 0 && e.button !== undefined) return;
      const nativeEvent =
        "nativeEvent" in e
          ? ((e as React.PointerEvent).nativeEvent as PointerEvent)
          : (e as PointerEvent);

      startPress({
        clientX: e.clientX,
        clientY: e.clientY,
        eventTarget: e.target,
        currentTarget: e.currentTarget,
        id: (e as PointerEvent).pointerId ?? 0,
        nativeEvent,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
      });
    },
    [startPress]
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

  const getTouchById = (touches: TouchList, id: number | null) => {
    if (touches.length === 0) return null;
    if (id === null) return touches[0];
    for (let i = 0; i < touches.length; i += 1) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  };

  const handleTouchStart = useCallback(
    (e: TouchHandlerEvent) => {
      if (!("touches" in e) || e.touches.length === 0) return;
      const touch = e.touches[0];
      const nativeEvent =
        "nativeEvent" in e
          ? ((e as React.TouchEvent).nativeEvent as TouchEvent)
          : (e as TouchEvent);

      startPress({
        clientX: touch.clientX,
        clientY: touch.clientY,
        eventTarget: e.target,
        currentTarget: e.currentTarget,
        id: touch.identifier,
        nativeEvent,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
      });
    },
    [startPress]
  );

  const handleTouchMove = useCallback(
    (e: TouchHandlerEvent) => {
      if (pointerId.current === null || !("touches" in e)) return;
      const touch = getTouchById(e.touches, pointerId.current);
      if (!touch || !startPos.current || !startScrollPos.current) return;

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
      const deltaX = Math.abs(touch.clientX - startPos.current.x);
      const deltaY = Math.abs(touch.clientY - startPos.current.y);

      if (deltaX > threshold || deltaY > threshold) {
        cancelLongPress();
      }
    },
    [threshold, cancelLongPress]
  );

  const handleTouchEnd = useCallback(
    (e: TouchHandlerEvent) => {
      if (pointerId.current === null || !("changedTouches" in e)) return;
      const touch = getTouchById(e.changedTouches, pointerId.current);
      if (!touch) return;

      if (gestureState === "long-press" || gestureState === "menu-open") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

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

  const handleTouchCancel = useCallback(() => {
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

  // Reset function to explicitly reset gesture state (called when menu closes)
  const reset = useCallback(() => {
    cancelLongPress();
    setGestureState("idle");
  }, [cancelLongPress]);

  return {
    longPressHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
      onClick: handleClick,
      onSelectStart: handleSelectStart,
      onDragStart: (e: React.DragEvent) => {
        if (gestureState !== "idle") {
          e.preventDefault();
        }
      },
    },
    gestureState,
    cancelLongPress,
    reset, // Expose reset method
    isPressing: gestureState === "pressing",
  };
}
