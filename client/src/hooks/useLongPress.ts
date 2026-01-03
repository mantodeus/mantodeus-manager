/**
 * useLongPress Hook
 * 
 * Detects long-press gestures (400-500ms) with scroll cancellation.
 * Designed for Apple Maps/Files-style context menu activation.
 * 
 * Cancels on:
 * - Scroll movement > 10px
 * - Touch move > 10px
 * - Early release
 */

import { useCallback, useRef, useState, useEffect } from "react";

interface UseLongPressOptions {
  /** Callback when long-press is detected */
  onLongPress: (event: TouchEvent | MouseEvent) => void;
  /** Duration in milliseconds (default: 450ms) */
  duration?: number;
  /** Movement threshold in pixels to cancel (default: 10px) */
  threshold?: number;
  /** Whether to enable haptic feedback on supported devices */
  hapticFeedback?: boolean;
}

export function useLongPress({
  onLongPress,
  duration = 450,
  threshold = 10,
  hapticFeedback = false,
}: UseLongPressOptions) {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const startScrollPos = useRef<{ x: number; y: number } | null>(null);
  const hasScrolled = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
    startPos.current = null;
    startScrollPos.current = null;
    hasScrolled.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      const x = touch.clientX;
      const y = touch.clientY;

      startPos.current = { x, y };
      startScrollPos.current = {
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset,
      };
      hasScrolled.current = false;
      setIsLongPressing(false);

      longPressTimer.current = setTimeout(() => {
        // Check if we've scrolled too much
        if (hasScrolled.current) {
          cancelLongPress();
          return;
        }

        setIsLongPressing(true);
        
        // Create a synthetic event for consistency
        const syntheticEvent = new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: e.touches,
        });

        onLongPress(syntheticEvent as any);

        // Haptic feedback on supported devices
        if (hapticFeedback && navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, duration);
    },
    [onLongPress, duration, hapticFeedback, cancelLongPress]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
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

      // Check touch movement
      const deltaX = Math.abs(touch.clientX - startPos.current.x);
      const deltaY = Math.abs(touch.clientY - startPos.current.y);

      if (deltaX > threshold || deltaY > threshold) {
        cancelLongPress();
      }
    },
    [threshold, cancelLongPress]
  );

  const handleTouchEnd = useCallback(() => {
    // Only cancel if we haven't triggered the long press yet
    if (!isLongPressing) {
      cancelLongPress();
    }
  }, [isLongPressing, cancelLongPress]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle right-click for long press on mouse
      if (e.button !== 2) return;

      const x = e.clientX;
      const y = e.clientY;

      startPos.current = { x, y };
      startScrollPos.current = {
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset,
      };
      hasScrolled.current = false;
      setIsLongPressing(false);

      longPressTimer.current = setTimeout(() => {
        if (hasScrolled.current) {
          cancelLongPress();
          return;
        }

        setIsLongPressing(true);
        onLongPress(e.nativeEvent);
      }, duration);
    },
    [onLongPress, duration, cancelLongPress]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
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

      // Check mouse movement
      const deltaX = Math.abs(e.clientX - startPos.current.x);
      const deltaY = Math.abs(e.clientY - startPos.current.y);

      if (deltaX > threshold || deltaY > threshold) {
        cancelLongPress();
      }
    },
    [threshold, cancelLongPress]
  );

  const handleMouseUp = useCallback(() => {
    if (!isLongPressing) {
      cancelLongPress();
    }
  }, [isLongPressing, cancelLongPress]);

  // Track scroll events globally
  useEffect(() => {
    const handleScroll = () => {
      if (startScrollPos.current) {
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
  }, [threshold, cancelLongPress]);

  return {
    longPressHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
    },
    isLongPressing,
    cancelLongPress,
  };
}

