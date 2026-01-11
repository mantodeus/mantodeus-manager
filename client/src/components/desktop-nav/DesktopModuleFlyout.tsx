/**
 * Desktop Module Flyout
 * 
 * Glass panel that appears when hovering/clicking a tab in the rail.
 * Shows modules with depth displacement effect matching mobile navigation.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useDesktopNav } from './DesktopNavProvider';
import { TAB_GROUPS, DEPTH_OFFSET, VISUAL_HIERARCHY, LAYOUT, TIMING } from './constants';
import type { Module } from './types';

/**
 * Calculate depth offset for module item
 */
function calculateOffset(
  itemIndex: number,
  highlightedIndex: number | null
): number {
  if (highlightedIndex === null) return 0;

  const distance = Math.abs(itemIndex - highlightedIndex);

  if (distance === 0) return DEPTH_OFFSET.ACTIVE;
  if (distance === 1) return DEPTH_OFFSET.NEIGHBOR_1;
  return DEPTH_OFFSET.NEIGHBOR_2;
}

/**
 * Individual module item
 */
function ModuleItem({
  module,
  index,
  isActive,
  isCurrentPage,
  isNeighbor,
  offset,
  onNavigate,
  onHover,
}: {
  module: Module;
  index: number;
  isActive: boolean;
  isCurrentPage: boolean;
  isNeighbor: boolean;
  offset: number;
  onNavigate: () => void;
  onHover: () => void;
}) {
  const Icon = module.icon;

  const opacity = isActive
    ? VISUAL_HIERARCHY.ACTIVE.opacity
    : isNeighbor
      ? VISUAL_HIERARCHY.NEIGHBOR.opacity
      : VISUAL_HIERARCHY.DISTANT.opacity;

  const scale = isActive ? VISUAL_HIERARCHY.ACTIVE.scale : 1;

  return (
    <button
      data-desktop-nav="module"
      data-module-index={index}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5",
        "rounded-lg transition-all duration-100 ease-out",
        "text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isActive && "bg-primary/10",
        isCurrentPage && !isActive && "bg-muted/50",
      )}
      style={{
        transform: `translateX(${offset}px) scale(${scale})`,
        opacity,
      }}
      onClick={onNavigate}
      onMouseEnter={onHover}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors duration-100",
          isActive || isCurrentPage ? "text-primary" : "text-muted-foreground"
        )}
        strokeWidth={isActive ? 2 : 1.5}
      />
      
      <span
        className={cn(
          "flex-1 text-sm transition-colors duration-100",
          isActive ? "text-primary font-medium" : "text-foreground"
        )}
      >
        {module.label}
      </span>

      {/* Keyboard shortcut hint */}
      {module.shortcut && (
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          ⌘{module.shortcut}
        </span>
      )}

      {/* Current page indicator */}
      {isCurrentPage && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </button>
  );
}

export function DesktopModuleFlyout() {
  const [location] = useLocation();
  const flyoutRef = useRef<HTMLDivElement>(null);
  
  const {
    activeTab,
    flyoutState,
    highlightedIndex,
    setHighlightedIndex,
    navigateToModule,
    closeFlyout,
    handleKeyDown,
  } = useDesktopNav();

  // Get modules for active tab
  const tabGroup = activeTab ? TAB_GROUPS[activeTab] : null;
  const modules = tabGroup?.modules ?? [];

  // Close flyout when mouse leaves the entire nav area
  const handleMouseLeave = useCallback(() => {
    if (flyoutState === 'hovering') {
      closeFlyout();
    }
  }, [flyoutState, closeFlyout]);

  // Focus the flyout for keyboard navigation when it opens
  useEffect(() => {
    if (flyoutState !== 'closed' && flyoutRef.current) {
      flyoutRef.current.focus();
    }
  }, [flyoutState, activeTab]);

  if (flyoutState === 'closed' || !activeTab || !tabGroup) {
    return null;
  }

  return (
    <div
      ref={flyoutRef}
      data-desktop-nav="flyout"
      tabIndex={0}
      className={cn(
        "fixed top-0 bottom-0 z-[49]",
        "flex flex-col",
        // Glass effect
        "bg-background/90 backdrop-blur-2xl",
        "border-r border-border/50",
        "shadow-xl shadow-black/10",
        // Animation
        "animate-in slide-in-from-left-4 fade-in duration-200",
      )}
      style={{
        left: LAYOUT.RAIL_WIDTH,
        width: LAYOUT.FLYOUT_WIDTH,
      }}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/30">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {tabGroup.label}
        </h2>
      </div>

      {/* Module List */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {modules.map((module, index) => {
          const isActive = index === highlightedIndex;
          const isCurrentPage = location === module.path || location.startsWith(module.path + '/');
          const isNeighbor = highlightedIndex !== null && Math.abs(index - highlightedIndex) === 1;
          const offset = calculateOffset(index, highlightedIndex);

          return (
            <ModuleItem
              key={module.id}
              module={module}
              index={index}
              isActive={isActive}
              isCurrentPage={isCurrentPage}
              isNeighbor={isNeighbor}
              offset={offset}
              onNavigate={() => navigateToModule(module.path)}
              onHover={() => setHighlightedIndex(index)}
            />
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground/60 text-center">
          ↑↓ navigate • Enter select • Esc close
        </p>
      </div>
    </div>
  );
}
