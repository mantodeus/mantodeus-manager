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
  // Get the actual rendered tab bar height from the DOM
  const tabBar = document.querySelector('.bottom-tab-bar') as HTMLElement;
  if (tabBar) {
    const rect = tabBar.getBoundingClientRect();
    const height = window.innerHeight - rect.top;
    // Return the actual height, ensuring it's at least the tab bar height
    return Math.max(height, rect.height || 0);
  }
  
  // Fallback: calculate from CSS if tab bar not found
  // On mobile, tab bar is visible (md:hidden means hidden on desktop)
  const isMobile = window.innerWidth < 768; // Tailwind md breakpoint
  if (isMobile) {
    // Base height: 56px (h-14) + padding (8px browser, 20px PWA) + safe area
    // Check if PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;
    const padding = isPWA ? 20 : 8;
    const safeArea = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue('env(safe-area-inset-bottom)') || '0'
    );
    return 56 + padding + safeArea;
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
      const menuTop = menuRect.top;
      const menuBottom = menuRect.bottom;
      const menuHeight = menuRect.height;

      // Get viewport dimensions
      const viewportHeight = window.innerHeight;
      const viewportTop = 0;

      // Calculate bottom obstruction (tab bar + safe area)
      const bottomObstruction = getBottomObstructionHeight();
      const availableBottomSpace = viewportHeight - bottomObstruction;

      // Check if menu bottom would be clipped by tab bar or viewport
      const bottomClipped = menuBottom > availableBottomSpace;
      
      // Also check if menu top would be clipped (shouldn't happen, but safety check)
      const topClipped = menuTop < viewportTop;

      // Find the scroll container
      // For portal-rendered menus, we typically scroll the window
      const scrollContainer = findScrollContainer(menuElement);

      if (bottomClipped) {
        // Menu bottom is hidden - scroll down to reveal it
        // Calculate how much we need to scroll to show the bottom of the menu
        const scrollAmount = menuBottom - availableBottomSpace + scrollBuffer;
        
        // Use instant scroll for immediate visibility
        if (scrollContainer === window) {
          const currentScroll = window.scrollY || window.pageYOffset || 0;
          const targetScroll = currentScroll + scrollAmount;
          // Scroll instantly to ensure menu bottom is visible immediately
          window.scrollTo({
            top: targetScroll,
            behavior: 'auto',
          });
        } else {
          const element = scrollContainer as HTMLElement;
          const currentScroll = element.scrollTop;
          const targetScroll = currentScroll + scrollAmount;
          element.scrollTo({
            top: targetScroll,
            behavior: 'auto',
          });
        }
        
        // Also try scrollIntoView as a fallback to ensure menu is fully visible
        try {
          menuElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        } catch (e) {
          // Ignore errors
        }
      } else if (topClipped) {
        // Menu top is hidden - scroll up to reveal it
        const scrollAmount = menuTop - viewportTop - scrollBuffer;
        
        if (scrollContainer === window) {
          window.scrollBy({
            top: scrollAmount,
            behavior: 'smooth',
          });
        } else {
          const element = scrollContainer as HTMLElement;
          element.scrollBy({
            top: scrollAmount,
            behavior: 'smooth',
          });
        }
      }
    };

    // Multiple attempts to ensure menu is positioned and scrolled correctly
    // Radix UI positioning happens after render, so we need to wait for layout
    let attemptCount = 0;
    const maxAttempts = 5;
    
    const attemptScroll = () => {
      if (attemptCount >= maxAttempts) return;
      attemptCount++;
      
      performScroll();
      
      // Schedule next attempt with increasing delays
      if (attemptCount < maxAttempts) {
        const delay = attemptCount === 1 ? 50 : attemptCount === 2 ? 100 : 150;
        timeoutId = setTimeout(attemptScroll, delay);
      }
    };

    // Start immediately with multiple attempts
    // First attempt: immediate (after RAF)
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        // First attempt after positioning
        timeoutId = setTimeout(() => {
          attemptScroll();
        }, 10);
      });
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, enabled, scrollBuffer, menuRef, triggerRef]);
}

