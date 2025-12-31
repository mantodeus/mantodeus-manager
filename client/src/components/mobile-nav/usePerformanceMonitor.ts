/**
 * Performance Monitoring Hook
 *
 * Tracks gesture performance metrics for Phase 2.
 * § 11.1: Performance Budgets
 */

import { useEffect, useRef } from 'react';
import { PERF_BUDGET, FEATURES } from './constants';

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  gestureResponseTime: number;
  scrollerRenderTime: number;
  navigationTotalTime: number;
  droppedFrames: number;
}

/**
 * Hook to monitor performance during gestures
 */
export function usePerformanceMonitor() {
  const metricsRef = useRef<Partial<PerformanceMetrics>>({});
  const startTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!FEATURES.PHASE_2_MOMENTUM) return;

    // Setup Performance Observer
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'gesture-response' && entry.duration > PERF_BUDGET.gestureResponseTime) {
          console.warn(
            `[Performance] Gesture lag: ${entry.duration.toFixed(2)}ms (budget: ${PERF_BUDGET.gestureResponseTime}ms)`
          );
        }

        if (entry.name === 'scroller-render' && entry.duration > PERF_BUDGET.scrollerRender) {
          console.warn(
            `[Performance] Scroller slow: ${entry.duration.toFixed(2)}ms (budget: ${PERF_BUDGET.scrollerRender}ms)`
          );
        }

        if (entry.name === 'navigation-total' && entry.duration > PERF_BUDGET.navigationTotal) {
          console.warn(
            `[Performance] Navigation slow: ${entry.duration.toFixed(2)}ms (budget: ${PERF_BUDGET.navigationTotal}ms)`
          );
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  /**
   * Start tracking a gesture
   */
  const startGesture = () => {
    startTimeRef.current = performance.now();
    frameCountRef.current = 0;
    lastFrameTimeRef.current = startTimeRef.current;
    metricsRef.current = {};
  };

  /**
   * Mark gesture response complete
   */
  const markGestureResponse = () => {
    const now = performance.now();
    const duration = now - startTimeRef.current;

    performance.measure('gesture-response', {
      start: startTimeRef.current,
      end: now,
    });

    metricsRef.current.gestureResponseTime = duration;
  };

  /**
   * Mark scroller render complete
   */
  const markScrollerRender = () => {
    const now = performance.now();
    const duration = now - startTimeRef.current;

    performance.measure('scroller-render', {
      start: startTimeRef.current,
      end: now,
    });

    metricsRef.current.scrollerRenderTime = duration;
  };

  /**
   * Mark navigation complete
   */
  const markNavigationComplete = () => {
    const now = performance.now();
    const duration = now - startTimeRef.current;

    performance.measure('navigation-total', {
      start: startTimeRef.current,
      end: now,
    });

    metricsRef.current.navigationTotalTime = duration;

    // Log summary
    if (FEATURES.PHASE_2_MOMENTUM) {
      console.log('[Performance] Gesture complete:', {
        gestureResponse: `${metricsRef.current.gestureResponseTime?.toFixed(2)}ms`,
        scrollerRender: `${metricsRef.current.scrollerRenderTime?.toFixed(2)}ms`,
        navigationTotal: `${duration.toFixed(2)}ms`,
        droppedFrames: metricsRef.current.droppedFrames || 0,
      });
    }
  };

  /**
   * Track frame for dropped frame detection
   */
  const trackFrame = () => {
    const now = performance.now();
    const frameDuration = now - lastFrameTimeRef.current;

    // Detect dropped frames (>16.67ms = missed 60fps target)
    if (frameDuration > 16.67 && lastFrameTimeRef.current > 0) {
      const dropped = Math.floor(frameDuration / 16.67) - 1;
      metricsRef.current.droppedFrames =
        (metricsRef.current.droppedFrames || 0) + dropped;

      if (dropped > 0) {
        console.warn(
          `[Performance] Dropped ${dropped} frame(s) (${frameDuration.toFixed(2)}ms)`
        );
      }
    }

    lastFrameTimeRef.current = now;
    frameCountRef.current++;
  };

  return {
    startGesture,
    markGestureResponse,
    markScrollerRender,
    markNavigationComplete,
    trackFrame,
  };
}
