/**
 * Module Scroller Component
 *
 * Vertical module list with depth displacement for readability.
 * Section 6: Module scroller behavior
 * Section 7: Swipe interaction
 * Section 8: Depth displacement (readability law)
 * Section 9: Visual hierarchy
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { MODULE_REGISTRY, DEPTH_OFFSET, VISUAL_HIERARCHY, FEATURES } from './constants';
import { GestureState } from './types';
import type { Module } from './types';
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
}: {
  module: Module;
  index: number;
  isActive: boolean;
  isNeighbor: boolean;
  offset: number;
  blur: number;
}) {
  const Icon = module.icon;

  // Section 9: Visual Hierarchy
  const opacity = isActive
    ? VISUAL_HIERARCHY.ACTIVE.opacity
    : isNeighbor
      ? VISUAL_HIERARCHY.NEIGHBOR.opacity
      : VISUAL_HIERARCHY.DISTANT.opacity;

  const scale = isActive ? VISUAL_HIERARCHY.ACTIVE.scale : 1.0;

  return (
    <div
      data-module-item
      className={cn(
        'module-item flex items-center gap-2.5 px-5 py-3',
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
    >
      <Icon
        className={cn(
          'h-5 w-5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)]',
          isActive && 'text-primary'
        )}
        strokeWidth={isActive ? 2.5 : 2}
      />
      <span
        className={cn(
          'text-sm font-medium drop-shadow-[0_1px_6px_rgba(0,0,0,0.18)]'
        )}
      >
        {module.label}
      </span>
    </div>
  );
}

export function ModuleScroller() {
  const [, setLocation] = useLocation();
  const {
    activeTab,
    scrollerVisible,
    highlightedIndex,
    setHighlightedIndex,
    gestureState,
    setGestureState,
    pointerPosition,
  } = useMobileNav();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const capabilities = useDeviceCapabilities(); // Phase 2: Device capability detection

  // Â§ 6.1: Scope - only show modules for active tab
  const modules = MODULE_REGISTRY[activeTab];
  useEffect(() => {
    if (
      !scrollerVisible ||
      !pointerPosition ||
      !listRef.current ||
      (gestureState !== GestureState.HOLD_ACTIVE &&
        gestureState !== GestureState.DRAGGING)
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
    const rawIndex = Math.floor(relativeY / itemHeight);
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
  ]);
  // Â§ 6.2: State Safety - navigation occurs only on release
  useEffect(() => {
    if (gestureState === GestureState.SNAPPING && highlightedIndex !== null) {
      const module = modules[highlightedIndex];

      if (module) {
        // Navigate to selected module
        setLocation(module.path);
      }

      // Reset state
      setHighlightedIndex(null);
      setGestureState(GestureState.IDLE);
    }
  }, [
    gestureState,
    highlightedIndex,
    modules,
    setLocation,
    setHighlightedIndex,
    setGestureState,
  ]);

  // Initialize highlighted index to first item when scroller appears
  useEffect(() => {
    if (scrollerVisible && highlightedIndex === null) {
      setHighlightedIndex(0);
    }
  }, [scrollerVisible, highlightedIndex, setHighlightedIndex]);

  if (!scrollerVisible) {
    return null;
  }

  const scrollerSide =
    activeTab === 'office' ? 'left' : activeTab === 'tools' ? 'right' : 'center';

  return (
    <div
      ref={scrollerRef}
      className={cn(
        'fixed top-1/2 -translate-y-1/2 z-[1000]',
        'w-64', // Fixed width
        'md:hidden', // Â§ 1.1: Mobile only
        'module-scroller',
        'gesture-surface',
        'animate-scroller-slide-in',
        scrollerSide === 'right'
          ? 'scroller--right'
          : scrollerSide === 'left'
            ? 'scroller--left'
            : 'scroller--center',
        // Position based on active tab (Ergonomic Law)
        scrollerSide === 'right'
          ? 'right-0'
          : scrollerSide === 'left'
            ? 'left-0'
            : 'left-1/2 -translate-x-1/2',
      )}
      aria-label={`Module selector for ${activeTab}`}
      role="menu"
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

          return (
            <ModuleItem
              key={module.id}
              module={module}
              index={index}
              isActive={isActive}
              isNeighbor={isNeighbor}
              offset={offset}
              blur={blur}
            />
          );
        })}
      </div>
    </div>
  );
}





















