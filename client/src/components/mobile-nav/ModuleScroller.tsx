/**
 * Module Scroller Component
 *
 * Vertical module list with depth displacement for readability.
 * Section 6: Module scroller behavior
 * Section 7: Swipe interaction
 * Section 8: Depth displacement (readability law)
 * Section 9: Visual hierarchy
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { MODULE_REGISTRY, DEPTH_OFFSET, VISUAL_HIERARCHY, FEATURES } from './constants';
import type { GestureState, Module } from './types';
import { useDeviceCapabilities } from './useDeviceCapabilities';

/**
 * Calculate depth offset for a module item
 * Â§ 8.2: Displacement Rules - strictly proportional to proximity
 */
function calculateOffset(
  itemIndex: number,
  activeIndex: number | null,
  scrollerSide: 'left' | 'right' | 'center'
): number {
  if (activeIndex === null) return 0;

  const distance = Math.abs(itemIndex - activeIndex);

  if (scrollerSide === 'center') return 0;

  let offset = 0;
  if (distance === 0) {
    offset = DEPTH_OFFSET.ACTIVE; // 28px
  } else if (distance === 1) {
    offset = DEPTH_OFFSET.NEIGHBOR_1; // 14px
  } else {
    offset = DEPTH_OFFSET.NEIGHBOR_2; // 0px
  }

  // Â§ 8.2: Apply toward center (constitutional requirement)
  return scrollerSide === 'right' ? -offset : offset;
}

/**
 * Calculate depth-of-field blur for Phase 2
 * Â§ 8.3: Blur is additive, not essential
 */
function calculateBlur(
  itemIndex: number,
  activeIndex: number | null,
  hasBlur: boolean,
  scrollerSide: 'left' | 'right' | 'center'
): number {
  if (!FEATURES.PHASE_2_BLUR || !hasBlur || activeIndex === null) return 0;

  const distance = Math.abs(itemIndex - activeIndex);

  if (scrollerSide === 'center') return 0;

  if (distance === 0) return 0; // Active: crisp
  if (distance === 1) return 0.5; // Neighbors: slight blur
  if (distance === 2) return 1; // Secondary: medium blur
  return 2; // Distant: full blur
}

/**
 * Module item component
 */
function ModuleItem({
  module,
  index,
  isActive,
  isNeighbor,
  offset,
  blur,
  scrollerSide,
  showLabel,
  onModuleClick,
}: {
  module: Module;
  index: number;
  isActive: boolean;
  isNeighbor: boolean;
  offset: number;
  blur: number;
  scrollerSide: 'left' | 'right' | 'center';
  showLabel: boolean;
  onModuleClick?: (module: Module) => void;
}) {
  const Icon = module.icon;

  // Section 9: Visual Hierarchy
  const opacity = isActive
    ? VISUAL_HIERARCHY.ACTIVE.opacity
    : isNeighbor
      ? VISUAL_HIERARCHY.NEIGHBOR.opacity
      : VISUAL_HIERARCHY.DISTANT.opacity;

  const scale = isActive ? VISUAL_HIERARCHY.ACTIVE.scale : 1.0;

  // Smaller gap for center tab (site)
  const iconTextGap = showLabel
    ? scrollerSide === 'center'
      ? 'gap-1.5'
      : 'gap-2.5'
    : 'gap-0 justify-center';

  return (
    <div
      data-module-item
      className={cn(
        'module-item flex items-center px-5 py-3',
        iconTextGap,
        showLabel ? 'justify-start' : 'justify-center',
        'gesture-surface',
        'cursor-pointer select-none',
        'transition-all duration-150 ease-out',
        isActive && 'is-active'
      )}
      style={{
        transform: `translateX(${offset}px) scale(${scale})`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
      onClick={(e) => {
        // Desktop: handle click to navigate
        if (typeof window !== 'undefined' && window.innerWidth >= 768 && onModuleClick) {
          e.preventDefault();
          e.stopPropagation();
          onModuleClick(module);
        }
      }}
    >
      <Icon
        className={cn(
          showLabel ? 'h-6 w-6' : 'h-7 w-7',
          'drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)]',
          isActive && 'text-primary'
        )}
        strokeWidth={isActive ? 1.5 : 1.2}
      />
      {showLabel && (
        <span className="text-sm drop-shadow-[0_1px_6px_rgba(0,0,0,0.18)]">
          {module.label}
        </span>
      )}
    </div>
  );
}

export function ModuleScroller() {
  const [, setLocation] = useLocation();
  const {
    activeTab,
    gestureTab,
    scrollerVisible,
    highlightedIndex,
    setHighlightedIndex,
    gestureState,
    setGestureState,
    pointerPosition,
    setLastUsedModule,
    setGestureTab,
  } = useMobileNav();
  // Section 6.1: Scope - use gestureTab if set (the tab being gestured), otherwise activeTab.
  // This allows gestures to work on any tab, not just the currently active one.
  const currentTab = gestureTab ?? activeTab;
  const modules = MODULE_REGISTRY[currentTab] || [];

  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const capabilities = useDeviceCapabilities(); // Phase 2: Device capability detection
  const [desktopPosition, setDesktopPosition] = useState<{ left: number; bottom: number } | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const CLOSE_DELAY = 150; // ms

  const closeScroller = useCallback(() => {
    setHighlightedIndex(null);
    setGestureState('idle');
    if (gestureTab !== null) {
      setGestureTab(null);
    }
  }, [gestureTab, setGestureTab, setGestureState, setHighlightedIndex]);

  // Desktop: Update position above the active tab button with viewport clamping
  useEffect(() => {
    if (!isDesktop || !scrollerVisible) {
      setDesktopPosition(null);
      return;
    }

    const updatePosition = () => {
      // Find the active tab button
      const activeTabButton = document.querySelector(`[data-tab-id="${currentTab}"]`) as HTMLElement;
      if (activeTabButton) {
        const rect = activeTabButton.getBoundingClientRect();
        const scrollerWidth = 256; // w-64 = 256px
        const padding = 24; // Viewport edge padding
        
        // Calculate center position of tab button
        let left = rect.left + rect.width / 2;
        
        // Clamp to viewport edges
        const minLeft = padding + scrollerWidth / 2;
        const maxLeft = window.innerWidth - padding - scrollerWidth / 2;
        left = Math.max(minLeft, Math.min(maxLeft, left));
        
        // Position above the tab button (8-12px gap)
        const bottom = window.innerHeight - rect.top + 10; // 10px gap above tab
        
        setDesktopPosition({ left, bottom });
      } else {
        // Fallback: center relative to content column
        const contentColumn = document.querySelector('[data-layout="content-column"]') as HTMLElement;
        if (contentColumn) {
          const rect = contentColumn.getBoundingClientRect();
          setDesktopPosition({ 
            left: rect.left + rect.width / 2,
            bottom: 76, // Above 56px tab bar + 20px gap
          });
        }
      }
    };

    updatePosition();

    // Update on window resize and scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Also observe tab button position changes
    const activeTabButton = document.querySelector(`[data-tab-id="${currentTab}"]`) as HTMLElement;
    if (activeTabButton) {
      const resizeObserver = new ResizeObserver(updatePosition);
      resizeObserver.observe(activeTabButton);
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [scrollerVisible, currentTab, isDesktop]);

  const handleDesktopScrollerMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleDesktopScrollerMouseLeave = useCallback(() => {
    if (!scrollerVisible) return;

    closeTimeoutRef.current = setTimeout(() => {
      const tabBarHovered = document
        .querySelector('[data-desktop-nav="bottom-tab-bar"]')
        ?.matches(':hover');
      const scrollerHovered = document
        .querySelector('[data-desktop-nav="module-scroller"]')
        ?.matches(':hover');
      if (tabBarHovered || scrollerHovered) {
        closeTimeoutRef.current = null;
        return;
      }
      closeScroller();
      closeTimeoutRef.current = null;
    }, CLOSE_DELAY);
  }, [closeScroller, scrollerVisible]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Desktop: handle click on module items
  const handleModuleClick = useCallback((module: Module) => {
    setLastUsedModule(currentTab, module.path);
    setLocation(module.path);
    // Close scroller
    closeScroller();
  }, [closeScroller, currentTab, setLastUsedModule, setLocation]);

  // Desktop: close on click outside or ESC
  useEffect(() => {
    if (!scrollerVisible || typeof window === 'undefined' || window.innerWidth < 768) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (scrollerRef.current && !scrollerRef.current.contains(target)) {
        // Don't close if clicking on a tab
        const clickedTab = target.closest('[data-tab-trigger]');
        if (clickedTab) {
          return;
        }
        // Close scroller
        closeScroller();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeScroller();
      }
    };

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeScroller, scrollerVisible]);

  useEffect(() => {
    if (
      !scrollerVisible ||
      !pointerPosition ||
      !listRef.current ||
      (gestureState !== 'hold_active' &&
        gestureState !== 'dragging')
    ) {
      return;
    }

    const listRect = listRef.current.getBoundingClientRect();
    const firstItem = listRef.current.querySelector<HTMLElement>(
      '[data-module-item]'
    );

    if (!firstItem) return;

    const itemHeight = firstItem.getBoundingClientRect().height;
    const virtualTop = Math.max(0, window.innerHeight - listRect.height);
    const relativeY = pointerPosition.y - virtualTop;
    // Tab-specific sensitivity: faster for action (center), slower for office/tools (sides)
    const sensitivityMultiplier = currentTab === 'action' ? 2.0 : 1.2;
    const rawIndex = Math.floor((relativeY * sensitivityMultiplier) / itemHeight);
    const clampedIndex = Math.max(0, Math.min(modules.length - 1, rawIndex));

    if (clampedIndex !== highlightedIndex) {
      setHighlightedIndex(clampedIndex);
    }
  }, [
    scrollerVisible,
    pointerPosition,
    gestureState,
    modules.length,
    highlightedIndex,
    setHighlightedIndex,
    currentTab,
  ]);
  // Â§ 6.2: State Safety - navigation occurs only on release
  useEffect(() => {
    if (gestureState === 'snapping' && highlightedIndex !== null) {
      const module = modules[highlightedIndex];

      if (module) {
        // Navigate to selected module - use currentTab (gestureTab or activeTab)
        setLastUsedModule(currentTab, module.path);
        setLocation(module.path);
      }

      // Reset state
      setHighlightedIndex(null);
      setGestureState('idle');
      // Clear gestureTab now that navigation is complete
      // This ensures next gesture uses the correct tab
      if (gestureTab !== null) {
        setGestureTab(null);
      }
    }
  }, [
    gestureState,
    highlightedIndex,
    modules,
    setLocation,
    setHighlightedIndex,
    setGestureState,
    currentTab,
    setLastUsedModule,
    gestureTab,
  ]);

  // Initialize highlighted index when scroller appears
  useEffect(() => {
    if (scrollerVisible && highlightedIndex === null && modules.length > 0) {
      // Always highlight the last item in array (first visual item)
      setHighlightedIndex(modules.length - 1);
    }
  }, [scrollerVisible, highlightedIndex, modules.length, setHighlightedIndex]);

  if (!scrollerVisible) {
    return null;
  }

  const scrollerSide =
    currentTab === 'office' ? 'left' : currentTab === 'tools' ? 'right' : 'center';

  // Get the currently highlighted module for the action tab title
  const highlightedModule = highlightedIndex !== null ? modules[highlightedIndex] : null;
  const isActionTab = currentTab === 'action';

  return (
    <>
      {/* Centered title for Action tab - appears above all icons */}
      {isActionTab && highlightedModule && (
        <div
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-[1001]',
            'text-center',
            'animate-in fade-in duration-150',
            'md:hidden'
          )}
          style={{
            top: 'calc(50% - 160px)', // Higher up - 160px above center
          }}
        >
          <span
            className={cn(
              'text-xl font-semibold uppercase', // Larger font + all caps
              'text-foreground',
              'drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
              'tracking-wider'
            )}
          >
            {highlightedModule.label}
          </span>
        </div>
      )}

      <div
        ref={scrollerRef}
        data-desktop-nav="module-scroller"
        className={cn(
          'fixed z-[1000]',
          'w-64', // Fixed width
          'module-scroller',
          'gesture-surface',
          'animate-scroller-slide-in',
          scrollerSide === 'right'
            ? 'scroller--right'
            : scrollerSide === 'left'
              ? 'scroller--left'
              : 'scroller--center',
          // Mobile: center vertically, position by side (desktop positioning handled via style)
          'top-1/2 -translate-y-1/2 md:top-auto',
          scrollerSide === 'right'
            ? 'right-0 md:right-auto'
            : scrollerSide === 'left'
              ? 'left-0 md:left-auto'
              : 'left-1/2 -translate-x-1/2 md:left-auto',
        )}
        style={{
          // Desktop positioning: above the active tab button
          ...(typeof window !== 'undefined' && window.innerWidth >= 768 && desktopPosition ? {
            left: `${desktopPosition.left}px`,
            bottom: `${desktopPosition.bottom}px`,
            transform: 'translateX(-50%)',
            top: 'auto',
          } : typeof window !== 'undefined' && window.innerWidth >= 768 ? {
            bottom: '76px', // Fallback: above 56px tab bar + 20px gap
            top: 'auto',
          } : {}),
        }}
        aria-label={`Module selector for ${activeTab}`}
        role="menu"
        onMouseEnter={isDesktop ? handleDesktopScrollerMouseEnter : undefined}
        onMouseLeave={isDesktop ? handleDesktopScrollerMouseLeave : undefined}
      >
        {/* Â§ 10.2: Prohibition - Tab labels must never appear inside scroller */}
        <div className="py-4" data-module-list ref={listRef}>
          {modules.map((module, index) => {
            const isActive = index === highlightedIndex;
            const isNeighbor =
              highlightedIndex !== null &&
              Math.abs(index - highlightedIndex) === 1;

            const offset = calculateOffset(index, highlightedIndex, scrollerSide);
            const blur = calculateBlur(
              index,
              highlightedIndex,
              capabilities.hasBlur,
              scrollerSide
            );
            const showLabel = currentTab !== 'action';

            return (
              <ModuleItem
                key={module.id}
                module={module}
                index={index}
                isActive={isActive}
                isNeighbor={isNeighbor}
                offset={offset}
                blur={blur}
                scrollerSide={scrollerSide}
                showLabel={showLabel}
                onModuleClick={handleModuleClick}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

















