/**
 * Gesture Recognition Hook
 *
 * Implements hold + swipe gesture detection according to Mobile Navigation Constitution.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import { useMobileNav } from './MobileNavProvider';
import type { GestureState, Point, TabId } from './types';
import { GESTURE_CONFIG, HapticIntent, MODULE_REGISTRY } from './constants';

/**
 * Haptic feedback stub (semantic contract only).
 */
function triggerHaptic(intent: HapticIntent) {
  console.log(`[Haptic Intent] ${intent}`);
  // Future native app will wire this to platform haptics.
}

export function useGestureRecognition() {
  const isMobile = useIsMobile();
  const {
    setGestureState,
    gestureState,
    setPointerPosition,
    setActiveTab,
    setHighlightedIndex,
    activeTab,
  } = useMobileNav();

  const holdTimerRef = useRef<number | undefined>(undefined);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });
  const startTimeRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(0);
  const activePointerIdRef = useRef<number | null>(null);
  const windowMoveHandlerRef = useRef<((event: PointerEvent) => void) | null>(
    null
  );
  const windowUpHandlerRef = useRef<((event: PointerEvent) => void) | null>(
    null
  );
  const windowCancelHandlerRef = useRef<((event: PointerEvent) => void) | null>(
    null
  );

  const removeWindowListeners = useCallback(() => {
    if (windowMoveHandlerRef.current) {
      window.removeEventListener('pointermove', windowMoveHandlerRef.current);
      windowMoveHandlerRef.current = null;
    }
    if (windowUpHandlerRef.current) {
      window.removeEventListener('pointerup', windowUpHandlerRef.current);
      windowUpHandlerRef.current = null;
    }
    if (windowCancelHandlerRef.current) {
      window.removeEventListener(
        'pointercancel',
        windowCancelHandlerRef.current
      );
      windowCancelHandlerRef.current = null;
    }
  }, []);

  const cancelGesture = useCallback(() => {
    if (!isMobile) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }

    removeWindowListeners();
    activePointerIdRef.current = null;
    setPointerPosition(null);
    setGestureState('idle');
  }, [isMobile, removeWindowListeners, setGestureState, setPointerPosition]);

  const processPointerMove = useCallback(
    (clientX: number, clientY: number, pointerId: number) => {
      if (!isMobile) return;
      if (gestureState === 'idle') return;
      if (
        activePointerIdRef.current !== null &&
        pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      const currentPos = { x: clientX, y: clientY };

      if (gestureState === 'hold_pending') {
        const dx = currentPos.x - startPosRef.current.x;
        const dy = currentPos.y - startPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        setPointerPosition(currentPos);

        // Always clear text selection during gesture
        if (window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        if (document.getSelection) {
          document.getSelection()?.removeAllRanges();
        }

        if (distance > GESTURE_CONFIG.MOVEMENT_CANCEL_THRESHOLD) {
          cancelGesture();
          return;
        }
      }

      if (
        gestureState === 'hold_active' ||
        gestureState === 'dragging'
      ) {
        setGestureState('dragging');
        setPointerPosition(currentPos);
      }
    },
    [
      isMobile,
      gestureState,
      cancelGesture,
      setGestureState,
      setPointerPosition,
    ]
  );

  const processPointerUp = useCallback(
    (pointerId: number) => {
      if (!isMobile) return;
      if (
        activePointerIdRef.current !== null &&
        pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      activePointerIdRef.current = null;
      removeWindowListeners();
      setPointerPosition(null);

      if (gestureState === 'dragging') {
        setGestureState('snapping');
      } else if (gestureState === 'hold_active') {
        const lastIndex = Math.max(0, MODULE_REGISTRY[activeTab].length - 1);
        setHighlightedIndex(prev => prev ?? lastIndex);
        setGestureState('snapping');
      } else {
        cancelGesture();
      }
    },
    [
      isMobile,
      gestureState,
      cancelGesture,
      removeWindowListeners,
      setGestureState,
      setPointerPosition,
    ]
  );

  const processPointerCancel = useCallback(
    (pointerId: number) => {
      if (
        activePointerIdRef.current !== null &&
        pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      cancelGesture();
    },
    [cancelGesture]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile) return;

      const target = e.target as HTMLElement;
      const tabTrigger = target.closest('[data-tab-trigger]');

      if (!tabTrigger) {
        return;
      }

      // Immediately clear any text selection when touching tab buttons
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
      if (document.getSelection) {
        document.getSelection()?.removeAllRanges();
      }

      const tabId = tabTrigger.getAttribute('data-tab-trigger') as TabId | null;
      if (tabId) {
        setActiveTab(tabId);
      }
      if (e.clientY > window.innerHeight - GESTURE_CONFIG.SAFE_ZONE_BOTTOM) {
        return;
      }

      if (
        e.clientX < GESTURE_CONFIG.EDGE_DEAD_ZONE ||
        e.clientX > window.innerWidth - GESTURE_CONFIG.EDGE_DEAD_ZONE
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      activePointerIdRef.current = e.pointerId;
      removeWindowListeners();
      setPointerPosition(null);

      windowMoveHandlerRef.current = (event: PointerEvent) => {
        processPointerMove(event.clientX, event.clientY, event.pointerId);
      };
      windowUpHandlerRef.current = (event: PointerEvent) => {
        processPointerUp(event.pointerId);
      };
      windowCancelHandlerRef.current = (event: PointerEvent) => {
        processPointerCancel(event.pointerId);
      };

      window.addEventListener('pointermove', windowMoveHandlerRef.current);
      window.addEventListener('pointerup', windowUpHandlerRef.current);
      window.addEventListener('pointercancel', windowCancelHandlerRef.current);

      startPosRef.current = { x: e.clientX, y: e.clientY };
      startTimeRef.current = Date.now();
      setPointerPosition(startPosRef.current);
      setGestureState('hold_pending');

      holdTimerRef.current = window.setTimeout(() => {
        const elapsed = Date.now() - startTimeRef.current;

        if (
          elapsed >=
            GESTURE_CONFIG.HOLD_DURATION - GESTURE_CONFIG.HOLD_TOLERANCE &&
          elapsed <=
            GESTURE_CONFIG.HOLD_DURATION + GESTURE_CONFIG.HOLD_TOLERANCE
        ) {
          triggerHaptic(HapticIntent.HOLD_RECOGNIZED);
          setGestureState('hold_active');
          setPointerPosition(startPosRef.current);
        }
      }, GESTURE_CONFIG.HOLD_DURATION);
    },
    [
      isMobile,
      processPointerMove,
      processPointerUp,
      processPointerCancel,
      removeWindowListeners,
      setGestureState,
      setPointerPosition,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      processPointerMove(e.clientX, e.clientY, e.pointerId);
    },
    [processPointerMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      processPointerUp(e.pointerId);
    },
    [processPointerUp]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      processPointerCancel(e.pointerId);
    },
    [processPointerCancel]
  );

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      const currentScrollY = window.scrollY;

      if (lastScrollTimeRef.current > 0) {
        const timeDiff = now - lastScrollTimeRef.current;
        const scrollDiff = Math.abs(currentScrollY - lastScrollYRef.current);
        const velocity = scrollDiff / timeDiff;

        if (velocity * 1000 > GESTURE_CONFIG.SCROLL_VELOCITY_CANCEL) {
          cancelGesture();
        }
      }

      lastScrollTimeRef.current = now;
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [cancelGesture]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      removeWindowListeners();
    };
  }, [removeWindowListeners]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}

