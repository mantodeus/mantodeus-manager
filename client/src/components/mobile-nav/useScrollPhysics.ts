/**
 * Scroll Physics Hook
 *
 * Implements momentum scrolling and snap physics for Phase 2.
 * § 7.2: Motion Rules
 * § 11: Swipe Momentum Physics
 */

import { useRef, useCallback } from 'react';
import { FEATURES } from './constants';

/**
 * Velocity tracker for momentum scrolling
 * Samples last 100ms of movement
 */
class VelocityTracker {
  private samples: Array<{ time: number; position: number }> = [];

  add(position: number) {
    const now = Date.now();
    this.samples.push({ time: now, position });

    // Keep only samples from last 100ms
    this.samples = this.samples.filter((s) => now - s.time < 100);
  }

  getVelocity(): number {
    if (this.samples.length < 2) return 0;

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const timeDiff = last.time - first.time;

    if (timeDiff === 0) return 0;

    return (last.position - first.position) / timeDiff; // px/ms
  }

  reset() {
    this.samples = [];
  }
}

/**
 * Momentum scroll animation
 * § 11: Realistic deceleration curve (velocity × 0.95 per frame)
 */
function momentumScroll(
  initialVelocity: number,
  friction: number,
  onUpdate: (position: number) => void,
  onComplete: () => void
) {
  let currentVelocity = initialVelocity;
  let position = 0;
  let animationId: number;

  function frame() {
    if (Math.abs(currentVelocity) < 0.5) {
      // Velocity too low, stop
      onComplete();
      return;
    }

    currentVelocity *= friction;
    position += currentVelocity;
    onUpdate(position);

    animationId = requestAnimationFrame(frame);
  }

  animationId = requestAnimationFrame(frame);

  // Return cleanup function
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };
}

/**
 * Hook for scroll physics
 */
export function useScrollPhysics() {
  const velocityTrackerRef = useRef(new VelocityTracker());
  const cleanupRef = useRef<(() => void) | null>(null);

  /**
   * Start tracking velocity
   */
  const startTracking = useCallback(() => {
    velocityTrackerRef.current.reset();
  }, []);

  /**
   * Update position for velocity calculation
   */
  const updatePosition = useCallback((position: number) => {
    if (FEATURES.PHASE_2_MOMENTUM) {
      velocityTrackerRef.current.add(position);
    }
  }, []);

  /**
   * Get current velocity
   */
  const getVelocity = useCallback((): number => {
    if (!FEATURES.PHASE_2_MOMENTUM) return 0;
    return velocityTrackerRef.current.getVelocity() * 1000; // Convert to px/s
  }, []);

  /**
   * Start momentum animation
   */
  const startMomentum = useCallback(
    (
      onUpdate: (position: number) => void,
      onComplete: () => void
    ): void => {
      if (!FEATURES.PHASE_2_MOMENTUM) {
        onComplete();
        return;
      }

      const velocity = getVelocity();

      // Only apply momentum if velocity is significant
      if (Math.abs(velocity) < 50) {
        onComplete();
        return;
      }

      // Cleanup previous animation if exists
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      // Start momentum scroll
      cleanupRef.current = momentumScroll(
        velocity / 1000, // Convert back to px/ms
        0.95, // Friction (constitutional value)
        onUpdate,
        () => {
          cleanupRef.current = null;
          onComplete();
        }
      );
    },
    [getVelocity]
  );

  /**
   * Stop momentum animation
   */
  const stopMomentum = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  return {
    startTracking,
    updatePosition,
    getVelocity,
    startMomentum,
    stopMomentum,
  };
}
