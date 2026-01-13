/**
 * Desktop Module Flyout
 * 
 * Glass panel that appears when hovering/clicking a tab in the rail.
 * Shows modules with depth displacement effect matching mobile navigation.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
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

  // Remove scale animation for calmer desktop feel
  const scale = 1;

  return (
    <button
      data-desktop-nav="module"
      data-module-index={index}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5",
        "rounded-lg transition-all duration-100 ease-out",
        "text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "border border-transparent",
        // Surface changes only (no primary colors)
        isActive ? [
          "bg-foreground/5 dark:bg-foreground/7",
          "hover:bg-foreground/5 dark:hover:bg-foreground/7",
        ] : [
          "hover:bg-foreground/5 hover:border-border/70 active:bg-foreground/8",
          "dark:hover:bg-foreground/7 dark:active:bg-foreground/10",
        ],
        // Current page state (muted, not active)
        isCurrentPage && !isActive && "bg-muted/50",
      )}
      style={{
        transform: `translateX(${offset}px)`, // Remove scale for calmer feel
        opacity,
      }}
      onClick={onNavigate}
      onMouseEnter={onHover}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors duration-100",
          isActive || isCurrentPage ? "text-foreground" : "text-muted-foreground"
        )}
        strokeWidth={isActive ? 2 : 1.5}
      />
      
      <span
        className={cn(
          "flex-1 text-sm font-medium transition-colors duration-100",
          "text-foreground"
        )}
      >
        {module.label}
      </span>
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
    flyoutAnchor,
    setHighlightedIndex,
    navigateToModule,
    closeFlyout,
    handleKeyDown,
  } = useDesktopNav();

  // Get modules for active tab (Office, Action, and Tools all have flyouts)
  const tabGroup = (activeTab === 'office' || activeTab === 'action' || activeTab === 'tools') ? TAB_GROUPS[activeTab] : null;
  const modules = tabGroup?.modules ?? [];

  // Close flyout when mouse leaves (only for hovering state, not locked)
  const handleMouseLeave = useCallback(() => {
    if (flyoutState === 'hovering') {
      closeFlyout();
    }
  }, [flyoutState, closeFlyout]);

  // Calculate position based on anchor
  const [flyoutPosition, setFlyoutPosition] = useState<{ left: number; bottom?: number; top?: number }>({
    left: LAYOUT.RAIL_WIDTH,
  });

  // Update position when anchor or activeTab changes
  useEffect(() => {
    if (flyoutState === 'closed' || !activeTab) return;

    if (flyoutAnchor === 'bottom-bar') {
      // Position above the bottom tab bar, centered on the active tab
      const tabElement = document.querySelector(`[data-desktop-nav="bottom-tab"][data-tab-id="${activeTab}"]`) as HTMLElement;
      if (tabElement) {
        const tabRect = tabElement.getBoundingClientRect();
        const tabCenterX = tabRect.left + tabRect.width / 2;
        const flyoutLeft = Math.max(
          LAYOUT.RAIL_WIDTH,
          Math.min(
            tabCenterX - LAYOUT.FLYOUT_WIDTH / 2,
            window.innerWidth - LAYOUT.FLYOUT_WIDTH
          )
        );
        setFlyoutPosition({
          left: flyoutLeft,
          bottom: window.innerHeight - tabRect.top + 8, // 8px gap above tab bar
        });
      }
    } else {
      // Rail anchor: position at left edge, start from top with some padding
      setFlyoutPosition({
        left: LAYOUT.RAIL_WIDTH,
        top: 16, // Add some top padding instead of full height
      });
    }
  }, [flyoutAnchor, activeTab, flyoutState]);

  // Focus the flyout for keyboard navigation when it opens (but don't steal focus from inputs)
  useEffect(() => {
    if (flyoutState !== 'closed' && flyoutRef.current) {
      // Only focus if no input is currently focused
      const activeElement = document.activeElement;
      if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && !activeElement.isContentEditable)) {
        flyoutRef.current.focus();
      }
    }
  }, [flyoutState, activeTab]);

  if (flyoutState === 'closed' || !activeTab || !tabGroup) {
    return null;
  }

  return (
    <div
      ref={flyoutRef}
      data-desktop-nav="flyout"
      data-flyout-anchor={flyoutAnchor}
      tabIndex={-1} // Don't steal focus, but allow programmatic focus for keyboard nav
      className={cn(
        "fixed z-[49]",
        "flex flex-col",
        // Glass effect
        "bg-background/90 backdrop-blur-2xl",
        "shadow-xl shadow-black/10",
        "rounded-lg",
        // Animation - subtle fade only, no heavy motion
        "animate-in fade-in duration-150",
      )}
      style={{
        left: flyoutPosition.left,
        ...(flyoutAnchor === 'bottom-bar' 
          ? { bottom: flyoutPosition.bottom, width: LAYOUT.FLYOUT_WIDTH }
          : { top: flyoutPosition.top || 0, width: LAYOUT.FLYOUT_WIDTH }
        ),
      }}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      {/* Header - Section Title */}
      <div className="px-4 py-4 border-b border-border/20">
        <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">
          {tabGroup.label}
        </h2>
      </div>

      {/* Module List */}
      <div className="overflow-x-hidden py-2 pl-2 pr-3 space-y-1">
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

    </div>
  );
}
