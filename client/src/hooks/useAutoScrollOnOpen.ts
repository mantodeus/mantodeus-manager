/**
 * useAutoScrollOnOpen Hook
 * 
 * Automatically scrolls the page/container when a dropdown menu opens near the bottom
 * to ensure the menu is fully visible. On mobile, accounts for bottom tab bar and safe area.
 * On desktop, ensures menu is not cropped at the viewport bottom.
 * 
 * This hook measures the menu position and height, calculates if it would be clipped,
 * and smoothly scrolls just enough to reveal the full menu.
 */

import { useLayoutEffect, RefObject } from 'react';

interface UseAutoScrollOnOpenOptions {
  /** Whether the menu is currently open */
  isOpen: boolean;
  /** Ref to the menu content element */
  menuRef: RefObject<HTMLElement>;
  /** Optional ref to the trigger element (for better positioning calculations) */
  triggerRef?: RefObject<HTMLElement>;
  /** Scroll buffer in pixels (default: 12px) */
  scrollBuffer?: number;
  /** Whether to enable auto-scroll (default: true, can be disabled for desktop) */
  enabled?: boolean;
}

/**
 * Calculates the bottom obstruction height (tab bar + safe area)
 */
function getBottomObstructionHeight(): number {
  // Bottom tab bar height: calc(56px + env(safe-area-inset-bottom) + 12px)
  // We need to account for the actual rendered height
  const tabBar = document.querySelector('.bottom-tab-bar') as HTMLElement;
  if (tabBar) {
    const rect = tabBar.getBoundingClientRect();
    return window.innerHeight - rect.top;
  }
  
  // Fallback: calculate from CSS if tab bar not found
  // On mobile, tab bar is visible (md:hidden means hidden on desktop)
  const isMobile = window.innerWidth < 768; // Tailwind md breakpoint
  if (isMobile) {
    // Base height: 56px (h-14) + 12px padding + safe area
    const safeArea = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue('env(safe-area-inset-bottom)') || '0'
    );
    return 56 + 12 + safeArea;
  }
  
  return 0;
}

/**
 * Finds the nearest scrollable container for an element
 * For portal-rendered elements (direct children of body), always returns window
 */
function findScrollContainer(element: HTMLElement): HTMLElement | Window {
  // If element is in a portal (direct child of body or in a portal container),
  // always scroll the window
  if (element.parentElement === document.body) {
    return window;
  }
  
  // Check if element is in a Radix portal container
  const portalContainer = element.closest('[data-radix-portal]');
  if (portalContainer) {
    return window;
  }
  
  // Otherwise, find the nearest scrollable parent
  let parent = element.parentElement;
  
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent);
    const overflowY = style.overflowY;
    
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'
    ) {
      return parent;
    }
    
    parent = parent.parentElement;
  }
  
  return window;
}

/**
 * Scrolls the container to reveal the menu
 */
function scrollToRevealMenu(
  container: HTMLElement | Window,
  menuBottom: number,
  viewportBottom: number,
  scrollBuffer: number
): void {
  const scrollAmount = menuBottom - viewportBottom + scrollBuffer;
  
  if (scrollAmount > 0) {
    if (container === window) {
      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth',
      });
    } else {
      const element = container as HTMLElement;
      element.scrollBy({
        top: scrollAmount,
        behavior: 'smooth',
      });
    }
  }
}

export function useAutoScrollOnOpen({
  isOpen,
  menuRef,
  triggerRef,
  scrollBuffer = 12,
  enabled = true,
}: UseAutoScrollOnOpenOptions): void {
  useLayoutEffect(() => {
    if (!isOpen || !enabled || !menuRef.current) {
      return;
    }

    // Use requestAnimationFrame to ensure menu is fully rendered and positioned
    // Radix UI positioning happens after render, so we need to wait for layout
    let rafId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const performScroll = () => {
      const menuElement = menuRef.current;
      if (!menuElement) return;

      // Measure menu position and dimensions
      const menuRect = menuElement.getBoundingClientRect();
      const menuBottom = menuRect.bottom;

      // Get viewport dimensions
      const viewportHeight = window.innerHeight;

      // Calculate bottom obstruction (tab bar + safe area)
      const bottomObstruction = getBottomObstructionHeight();
      const availableBottomSpace = viewportHeight - bottomObstruction;

      // Check if menu would be clipped
      const wouldBeClipped = menuBottom > availableBottomSpace;

      if (wouldBeClipped) {
        // Find the scroll container
        // For portal-rendered menus, we typically scroll the window
        const scrollContainer = findScrollContainer(menuElement);
        
        // Perform smooth scroll
        scrollToRevealMenu(scrollContainer, menuBottom, availableBottomSpace, scrollBuffer);
      }
    };

    // Double RAF to ensure Radix positioning is complete
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        // Small additional delay to ensure positioning is stable
        timeoutId = setTimeout(performScroll, 10);
      });
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, enabled, scrollBuffer, menuRef, triggerRef]);
}

