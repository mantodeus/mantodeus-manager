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
    setGestureTab,
  } = useMobileNav();

  const holdTimerRef = useRef<number | undefined>(undefined);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });
  const lastPosRef = useRef<Point>({ x: 0, y: 0 });
  const startTimeRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(0);
  const activePointerIdRef = useRef<number | null>(null);
  // Store the tab that initiated the gesture (since activeTab state update is async)
  const gestureTabRef = useRef<TabId | null>(null);
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
    setGestureTab(null); // Clear gesture tab in context
    gestureTabRef.current = null; // Clear gesture tab ref
  }, [isMobile, removeWindowListeners, setGestureState, setPointerPosition, setGestureTab]);

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
      lastPosRef.current = currentPos;

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

        // If movement is detected, check if it's primarily vertical
        if (distance > GESTURE_CONFIG.MOVEMENT_CANCEL_THRESHOLD) {
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          
          // If vertical movement is greater than horizontal, activate scroller immediately
          if (absDy > absDx && absDy > 5) {
            // Clear the hold timer since we're activating immediately
            if (holdTimerRef.current) {
              clearTimeout(holdTimerRef.current);
              holdTimerRef.current = undefined;
            }
            triggerHaptic(HapticIntent.HOLD_RECOGNIZED);
            setGestureState('hold_active');
            setPointerPosition(currentPos);
            return;
          } else {
            // Horizontal movement or too small - cancel gesture
            cancelGesture();
            return;
          }
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

      // Check if this was just a tap (no significant movement)
      const distance = lastPosRef.current ? 
        Math.sqrt(
          Math.pow(lastPosRef.current.x - startPosRef.current.x, 2) + 
          Math.pow(lastPosRef.current.y - startPosRef.current.y, 2)
        ) : 0;
      const wasJustTap = gestureState === 'hold_pending' && distance < 5;

      activePointerIdRef.current = null;
      removeWindowListeners();
      setPointerPosition(null);

      if (gestureState === 'dragging') {
        setGestureState('snapping');
      } else if (gestureState === 'hold_active') {
        // Use the tab that initiated the gesture (from ref) instead of activeTab state
        // This ensures we use the correct tab even if state hasn't updated yet
        const gestureTab = gestureTabRef.current ?? activeTab;
        const lastIndex = Math.max(0, MODULE_REGISTRY[gestureTab].length - 1);
        setHighlightedIndex(prev => prev ?? lastIndex);
        setGestureState('snapping');
        // Don't clear gestureTab yet - let ModuleScroller use it for navigation
        // It will be cleared when gesture completes (in ModuleScroller or on next gesture start)
      } else if (wasJustTap) {
        // Just a tap - cancel gesture and let the click handler fire
        cancelGesture();
      } else {
        cancelGesture();
      }
    },
    [
      isMobile,
      gestureState,
      activeTab,
      cancelGesture,
      removeWindowListeners,
      setGestureState,
      setPointerPosition,
      setHighlightedIndex,
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
      if (!tabId) {
        return;
      }
      
      // CRITICAL: Set the active tab to the one being touched FIRST
      // This allows gestures to work on any tab, not just the currently active one
      setActiveTab(tabId);
      // Also set gestureTab in context for immediate use (before activeTab state updates)
      setGestureTab(tabId);
      // Also store it in a ref for immediate use (React state updates are async)
      gestureTabRef.current = tabId;
      
      // Don't apply safe zone or edge dead zone checks for tab bar touches
      // The tab bar IS at the bottom, so we need to allow gestures to start there
      // The safe zone check is meant to prevent accidental gestures from system swipe areas,
      // but we explicitly want gestures to work on the tab bar itself
      
      // Tab bar is approximately 56px + safe area (roughly 80-100px total from bottom)
      // If touch is in the tab bar area, skip safe zone checks
      const tabBarHeight = 100; // Approximate tab bar height including safe area
      const isOnTabBar = e.clientY > window.innerHeight - tabBarHeight;
      
      if (!isOnTabBar) {
        // For touches outside tab bar, apply safe zone and edge checks
        if (e.clientY > window.innerHeight - GESTURE_CONFIG.SAFE_ZONE_BOTTOM) {
          return;
        }

        if (
          e.clientX < GESTURE_CONFIG.EDGE_DEAD_ZONE ||
          e.clientX > window.innerWidth - GESTURE_CONFIG.EDGE_DEAD_ZONE
        ) {
          return;
        }
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
      lastPosRef.current = { x: e.clientX, y: e.clientY };
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
      setActiveTab,
      setGestureTab,
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

