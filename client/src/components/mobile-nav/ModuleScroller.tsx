/**
 * Module Scroller Component
 *
 * Vertical module list with depth displacement for readability.
 * § 6: MODULE SCROLLER — BEHAVIOUR
 * § 7: FLICK-THROUGH INTERACTION
 * § 8: DEPTH DISPLACEMENT (READABILITY LAW)
 * § 9: VISUAL HIERARCHY
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { MODULE_REGISTRY, DEPTH_OFFSET, VISUAL_HIERARCHY } from './constants';
import { GestureState } from './types';
import type { Module } from './types';

/**
 * Calculate depth offset for a module item
 * § 8.2: Displacement Rules - strictly proportional to proximity
 */
function calculateOffset(
  itemIndex: number,
  activeIndex: number | null,
  scrollerSide: 'left' | 'right'
): number {
  if (activeIndex === null) return 0;

  const distance = Math.abs(itemIndex - activeIndex);

  let offset = 0;
  if (distance === 0) {
    offset = DEPTH_OFFSET.ACTIVE; // 28px
  } else if (distance === 1) {
    offset = DEPTH_OFFSET.NEIGHBOR_1; // 14px
  } else {
    offset = DEPTH_OFFSET.NEIGHBOR_2; // 0px
  }

  // § 8.2: Apply toward center (constitutional requirement)
  return scrollerSide === 'right' ? -offset : offset;
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
  onPointerMove,
}: {
  module: Module;
  index: number;
  isActive: boolean;
  isNeighbor: boolean;
  offset: number;
  onPointerMove: (index: number) => void;
}) {
  const Icon = module.icon;

  // § 9: Visual Hierarchy
  const opacity = isActive
    ? VISUAL_HIERARCHY.ACTIVE.opacity
    : isNeighbor
      ? VISUAL_HIERARCHY.NEIGHBOR.opacity
      : VISUAL_HIERARCHY.DISTANT.opacity;

  const scale = isActive ? VISUAL_HIERARCHY.ACTIVE.scale : 1.0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-6 py-4',
        'cursor-pointer select-none',
        'transition-all duration-150 ease-out', // § Phase 1: CSS only
        isActive && 'border-l-2 border-primary' // Accent colour emphasis
      )}
      style={{
        transform: `translateX(${offset}px) scale(${scale})`,
        opacity,
      }}
      onPointerMove={() => onPointerMove(index)}
    >
      <Icon
        className={cn('h-5 w-5', isActive && 'text-primary')}
        strokeWidth={isActive ? 2.5 : 2}
      />
      <span
        className={cn(
          'text-base font-medium',
          isActive && 'text-foreground font-semibold'
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
    flickDirection,
    gestureState,
    setGestureState,
  } = useMobileNav();

  const scrollerRef = useRef<HTMLDivElement>(null);

  // § 6.1: Scope - only show modules for active tab
  const modules = MODULE_REGISTRY[activeTab];

  // § 7.2: Motion Rules - finger pause → snap to nearest
  const handlePointerMove = useCallback(
    (index: number) => {
      if (gestureState === GestureState.FLICK_ACTIVE) {
        // § 7.1: Finger Authority - update highlight based on finger position
        setHighlightedIndex(index);
      }
    },
    [gestureState, setHighlightedIndex]
  );

  // § 6.2: State Safety - navigation occurs only on release
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

  if (!scrollerVisible || !flickDirection) {
    return null;
  }

  const scrollerSide = flickDirection;

  return (
    <div
      ref={scrollerRef}
      className={cn(
        'fixed top-0 bottom-0 z-[1000]',
        'w-64', // Fixed width
        'bg-background/95 backdrop-blur-sm',
        'border-border',
        'overflow-y-auto',
        'md:hidden', // § 1.1: Mobile only
        'animate-scroller-slide-in',
        // Position based on flick direction (§ 5: Ergonomic Law)
        scrollerSide === 'right'
          ? 'right-0 border-l'
          : 'left-0 border-r',
        // Safe area support
        'pb-[calc(56px+env(safe-area-inset-bottom))]' // Account for bottom tab bar
      )}
      aria-label={`Module selector for ${activeTab}`}
      role="menu"
    >
      {/* § 10.2: Prohibition - Tab labels must never appear inside scroller */}
      <div className="py-4">
        {modules.map((module, index) => {
          const isActive = index === highlightedIndex;
          const isNeighbor =
            highlightedIndex !== null &&
            Math.abs(index - highlightedIndex) === 1;

          const offset = calculateOffset(index, highlightedIndex, scrollerSide);

          return (
            <ModuleItem
              key={module.id}
              module={module}
              index={index}
              isActive={isActive}
              isNeighbor={isNeighbor}
              offset={offset}
              onPointerMove={handlePointerMove}
            />
          );
        })}
      </div>
    </div>
  );
}
