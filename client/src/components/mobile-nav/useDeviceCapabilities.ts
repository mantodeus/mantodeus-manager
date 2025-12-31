/**
 * Device Capability Detection Hook
 *
 * Detects device capabilities for graceful degradation.
 * § Safety Constraints: Performance Gating for Low-End Devices
 */

import { useMemo } from 'react';
import type { DeviceCapabilities } from './types';

/**
 * Detect if device supports blur effects
 * Checks:
 * - Device memory (< 4GB = disabled)
 * - User preference (prefers-reduced-transparency)
 * - CSS support for backdrop-filter
 */
function detectBlurSupport(): boolean {
  // Check device memory (Android typically reports this)
  const memory = (navigator as any).deviceMemory;
  if (memory && memory < 4) {
    console.log('[Device Capabilities] Blur disabled: Low memory', memory);
    return false;
  }

  // Check for user preference
  if (
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  ) {
    console.log('[Device Capabilities] Blur disabled: User preference');
    return false;
  }

  // Feature detection fallback
  const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(1px)');
  const supportsWebkitBackdropFilter = CSS.supports(
    '-webkit-backdrop-filter',
    'blur(1px)'
  );

  const hasBlur = supportsBackdropFilter || supportsWebkitBackdropFilter;

  if (!hasBlur) {
    console.log('[Device Capabilities] Blur disabled: CSS not supported');
  }

  return hasBlur;
}

/**
 * Detect if device supports haptics
 */
function detectHapticsSupport(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Detect if device can handle spring physics
 * Only enable on devices that can maintain 60fps
 */
function detectSpringPhysicsSupport(): boolean {
  const memory = (navigator as any).deviceMemory;

  // If memory API not available, assume capable device
  if (!memory) {
    return true;
  }

  // Require 4GB+ for spring physics
  return memory >= 4;
}

/**
 * Hook to detect device capabilities
 * Memoized to avoid re-computing on every render
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const capabilities = useMemo(() => {
    const caps = {
      hasBlur: detectBlurSupport(),
      hasHaptics: detectHapticsSupport(),
      hasSpringPhysics: detectSpringPhysicsSupport(),
    };

    console.log('[Device Capabilities] Detected:', caps);

    return caps;
  }, []); // Empty deps - compute once on mount

  return capabilities;
}
