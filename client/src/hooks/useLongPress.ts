import { useCallback, useRef, useState } from "react";

interface UseLongPressOptions {
  /** Duration in ms before long press triggers (default: 350ms) */
  duration?: number;
  /** Called when long press is triggered */
  onLongPress: () => void;
  /** Called on regular click/tap (not long press) */
  onClick?: () => void;
  /** Whether long press is disabled */
  disabled?: boolean;
}

interface UseLongPressResult {
  /** Event handlers to spread on the element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
  };
  /** Whether a long press is currently active */
  isLongPressing: boolean;
}

/**
 * Hook for detecting long-press gestures on both touch and mouse devices.
 * Prevents click from firing after a long press.
 * Includes haptic feedback on supported mobile devices.
 */
export function useLongPress({
  duration = 350,
  onLongPress,
  onClick,
  disabled = false,
}: UseLongPressOptions): UseLongPressResult {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTriggered = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const triggerLongPress = useCallback(() => {
    if (disabled) return;
    
    longPressTriggered.current = true;
    setIsLongPressing(true);
    
    // Haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    onLongPress();
  }, [disabled, onLongPress]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      
      const touch = e.touches[0];
      if (!touch) return;

      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTriggered.current = false;
      setIsLongPressing(false);

      longPressTimer.current = setTimeout(() => {
        triggerLongPress();
      }, duration);
    },
    [disabled, duration, triggerLongPress]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !touchStartPos.current) return;

      // Cancel long press if finger moves too much (more than 10px)
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

      if (deltaX > 10 || deltaY > 10) {
        clearTimer();
        setIsLongPressing(false);
      }
    },
    [clearTimer]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clearTimer();
      touchStartPos.current = null;
      
      // If long press was triggered, prevent any further actions
      if (longPressTriggered.current) {
        e.preventDefault();
        e.stopPropagation();
        // Reset after a short delay to prevent any immediate clicks
        setTimeout(() => {
          longPressTriggered.current = false;
          setIsLongPressing(false);
        }, 100);
      }
    },
    [clearTimer]
  );

  // Mouse events for desktop long-press support
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || e.button !== 0) return; // Only left click

      longPressTriggered.current = false;
      setIsLongPressing(false);

      longPressTimer.current = setTimeout(() => {
        triggerLongPress();
      }, duration);
    },
    [disabled, duration, triggerLongPress]
  );

  const handleMouseUp = useCallback(() => {
    clearTimer();
    setTimeout(() => {
      setIsLongPressing(false);
    }, 100);
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    setIsLongPressing(false);
  }, [clearTimer]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If long press was triggered, prevent the click
      if (longPressTriggered.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressTriggered.current = false;
        return;
      }

      // Otherwise, call the onClick handler if provided
      if (!disabled && onClick) {
        onClick();
      }
    },
    [disabled, onClick]
  );

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
    },
    isLongPressing,
  };
}
