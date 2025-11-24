import { useCallback, useRef, useState } from "react";

interface UseContextMenuOptions {
  onContextMenu: (x: number, y: number) => void;
  longPressDuration?: number;
}

export function useContextMenu({ onContextMenu, longPressDuration = 500 }: UseContextMenuOptions) {
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e.clientX, e.clientY);
    },
    [onContextMenu]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      setIsLongPress(false);

      longPressTimer.current = setTimeout(() => {
        setIsLongPress(true);
        if (touchStartPos.current) {
          onContextMenu(touchStartPos.current.x, touchStartPos.current.y);
          // Haptic feedback on supported devices
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }, longPressDuration);
    },
    [onContextMenu, longPressDuration]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch || !touchStartPos.current) return;

    // Cancel long press if finger moves too much (more than 10px)
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent click if it was a long press
      if (isLongPress) {
        e.preventDefault();
        e.stopPropagation();
        setIsLongPress(false);
      }
    },
    [isLongPress]
  );

  return {
    contextMenuHandlers: {
      onContextMenu: handleContextMenu,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onClick: handleClick,
    },
  };
}
