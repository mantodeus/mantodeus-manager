/**
 * Scroller Overlay Component
 *
 * Backdrop overlay that dims the app background when scroller is active.
 * § 9.3: Background - App background dims subtly, feels paused not blocked
 * Phase 2: Adds device-gated backdrop blur
 */

import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { FEATURES } from './constants';

export function ScrollerOverlay() {
  const { 
    scrollerVisible,
    setGestureState,
    setGestureTab,
    setHighlightedIndex,
    gestureTab,
  } = useMobileNav();
  const capabilities = useDeviceCapabilities();
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  if (!scrollerVisible) {
    return null;
  }

  // Phase 2: Apply backdrop blur only if device is capable
  const hasBackdropBlur = FEATURES.PHASE_2_BLUR && capabilities.hasBlur;

  // Desktop: close scroller when mouse leaves overlay (but not when moving to scroller or tab bar)
  const handleMouseLeave = (e: React.MouseEvent) => {
    if (!isDesktop) return;
    
    // Check if mouse is moving to scroller or tab bar
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget) {
      const isMovingToScroller = relatedTarget.closest('[data-desktop-nav="module-scroller"]');
      const isMovingToTabBar = relatedTarget.closest('[data-desktop-nav="bottom-tab-bar"]');
      if (isMovingToScroller || isMovingToTabBar) {
        return; // Don't close if moving to scroller or tab bar
      }
    }
    
    // Only close if truly leaving to the page background
    setHighlightedIndex(null);
    setGestureState('idle');
    if (gestureTab !== null) {
      setGestureTab(null);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[999]',
        'bg-background/10', // § 9.3: Subtle dim (10-12%)
        'animate-overlay-fade-in',
        // Shared on mobile and desktop - same overlay
        // Phase 2: Device-gated backdrop blur
        hasBackdropBlur && 'backdrop-blur-sm'
      )}
      style={{
        // Fallback for browsers that don't support backdrop-filter class
        backdropFilter: hasBackdropBlur ? 'blur(8px)' : undefined,
        WebkitBackdropFilter: hasBackdropBlur ? 'blur(8px)' : undefined,
      }}
      onMouseLeave={isDesktop ? handleMouseLeave : undefined}
      aria-hidden="true"
    />
  );
}
