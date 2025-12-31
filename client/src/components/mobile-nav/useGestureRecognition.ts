/**
 * Gesture Recognition Hook
 *
 * Implements hold + flick gesture detection according to Mobile Navigation Constitution.
 * Â§ 4: PRIMARY GESTURE â€” HOLD â†’ FLICK
 * Â§ 5: ERGONOMIC LAW
 * Â§ 10: EDGE CASE: Accidental Activation Prevention
 */

import { useRef, useCallback, useEffect } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import { useMobileNav } from './MobileNavProvider';
import { GestureState } from './types';
import type { Point, FlickDirection } from './types';
import { GESTURE_CONFIG, HapticIntent } from './constants';

/**
 * Haptic feedback stub (Â§ 13.2: Semantic Contract Only)
 * Logs intent for future native implementation
 */
function triggerHaptic(intent: HapticIntent) {
  console.log(`[Haptic Intent] ${intent}`);
  // Future native app will wire this to platform haptics
  // Web implementation blocked until user research validates need
}

/**
 * Detect flick direction based on start and current position
 * Â§ 5.2: Direction Mapping (DO NOT INVERT)
 * Up + Right â†’ Right scroller
 * Up + Left â†’ Left scroller
 */
function detectFlickDirection(
  startPos: Point,
  currentPos: Point
): FlickDirection {
  const dx = currentPos.x - startPos.x;
  const dy = currentPos.y - startPos.y;

  // Require upward movement (dy < 0 means upward)
  if (dy >= 0 || Math.abs(dy) < 20) {
    return null; // Not a valid upward flick
  }

  // Constitutional mapping (DO NOT INVERT)
  if (dx > 0) {
    return 'right'; // Up + Right â†’ Right scroller
  } else if (dx < 0) {
    return 'left'; // Up + Left â†’ Left scroller
  }

  return null; // Pure vertical (no lateral component)
}

export function useGestureRecognition() {
  const isMobile = useIsMobile();
  const {
    setGestureState,
    setFlickDirection,
    gestureState,
  } = useMobileNav();
  const holdTimerRef = useRef<number | undefined>(undefined);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });
  const startTimeRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(0);

  /**
   * Cancel gesture and cleanup
   */
  const cancelGesture = useCallback(() => {
    if (!isMobile) return; // Guard inside callback

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }
    setGestureState(GestureState.IDLE);
    setFlickDirection(null);
  }, [isMobile, setGestureState, setFlickDirection]);

  /**
   * Pointer down handler
   * Â§ 4.1: Activation Rule
   * Â§ 4.2: Valid Touch Origin
   */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile) return; // Â§ 1.2: Mobile only guard

      // Validate touch origin (must be on tab trigger)
      const target = e.target as HTMLElement;
      const tabTrigger = target.closest('[data-tab-trigger]');

      if (!tabTrigger) {
        return; // Invalid origin, ignore
      }

      if (e.clientY > window.innerHeight - GESTURE_CONFIG.SAFE_ZONE_BOTTOM) {
        return; // Ignore system swipe zone
      }

      // Edge case prevention - check for edge activation
      if (
        e.clientX < GESTURE_CONFIG.EDGE_DEAD_ZONE ||
        e.clientX > window.innerWidth - GESTURE_CONFIG.EDGE_DEAD_ZONE
      ) {
        return; // Too close to edge, ignore
      }

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      // Record start position and time
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startTimeRef.current = Date.now();
      setGestureState(GestureState.HOLD_PENDING);

      // Start hold timer (250ms Â± 30ms window)
      holdTimerRef.current = window.setTimeout(() => {
        const elapsed = Date.now() - startTimeRef.current;

        // Constitutional check: 220-280ms window
        if (
          elapsed >=
            GESTURE_CONFIG.HOLD_DURATION - GESTURE_CONFIG.HOLD_TOLERANCE &&
          elapsed <=
            GESTURE_CONFIG.HOLD_DURATION + GESTURE_CONFIG.HOLD_TOLERANCE
        ) {
          triggerHaptic(HapticIntent.HOLD_RECOGNIZED);
          setGestureState(GestureState.HOLD_ACTIVE);
        }
      }, GESTURE_CONFIG.HOLD_DURATION);
    },
    [isMobile, setGestureState]
  );

  /**
   * Pointer move handler
   * Â§ 7.1: Finger Authority - finger position is source of truth
   */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile) return; // Â§ 1.2: Mobile only guard
      if (gestureState === GestureState.IDLE) return;

      const currentPos = { x: e.clientX, y: e.clientY };

      // Check if moved too much during hold (cancel gesture)
      if (gestureState === GestureState.HOLD_PENDING) {
        const dx = currentPos.x - startPosRef.current.x;
        const dy = currentPos.y - startPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 5) {
          window.getSelection?.()?.removeAllRanges?.();
        }

if (distance > GESTURE_CONFIG.MOVEMENT_CANCEL_THRESHOLD) {
          cancelGesture();
          return;
        }
      }

      // If hold is active, detect flick direction
      if (gestureState === GestureState.HOLD_ACTIVE) {
        const direction = detectFlickDirection(startPosRef.current, currentPos);

        if (direction !== null) {
          setFlickDirection(direction);
          setGestureState(GestureState.FLICK_ACTIVE);
          // Module scroller will appear now
        }
      }
    },
    [isMobile, gestureState, cancelGesture, setFlickDirection, setGestureState]
  );

  /**
   * Pointer up handler
   * Â§ 6.2: State Safety - navigation occurs only on release
   */
  const handlePointerUp = useCallback(() => {
    if (!isMobile) return; // Â§ 1.2: Mobile only guard

    if (gestureState === GestureState.FLICK_ACTIVE) {
      // Navigation will be handled by ModuleScroller
      // Just transition to snapping state
      setGestureState(GestureState.SNAPPING);
    } else {
      cancelGesture();
    }
  }, [isMobile, gestureState, cancelGesture, setGestureState]);

  /**
   * Pointer cancel handler
   */
  const handlePointerCancel = useCallback(() => {
    if (!isMobile) return; // Â§ 1.2: Mobile only guard
    cancelGesture();
  }, [isMobile, cancelGesture]);

  /**
   * Monitor scroll velocity to cancel gesture if user is actively scrolling
   * Â§ 10: Edge Case Prevention
   */
  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      const currentScrollY = window.scrollY;

      if (lastScrollTimeRef.current > 0) {
        const timeDiff = now - lastScrollTimeRef.current;
        const scrollDiff = Math.abs(currentScrollY - lastScrollYRef.current);
        const velocity = scrollDiff / timeDiff; // px/ms

        if (velocity * 1000 > GESTURE_CONFIG.SCROLL_VELOCITY_CANCEL) {
          // User is actively scrolling, cancel gesture
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

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}










