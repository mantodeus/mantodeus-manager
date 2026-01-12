/**
 * Desktop Module Menu
 * 
 * Temporary menu that appears centered above the bottom tab bar
 * when hovering or clicking OFFICE or TOOLS tabs.
 * Replaces the old left-anchored flyout.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { TAB_GROUPS, DEPTH_OFFSET, VISUAL_HIERARCHY, TIMING } from './constants';
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

  return (
    <button
      data-desktop-nav="module-menu-item"
      data-module-index={index}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4",
        "rounded-lg transition-all duration-100 ease-out",
        "text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "border border-transparent",
        // Neutral hover (no accent colors)
        "hover:bg-foreground/5 hover:border-border/70 active:bg-foreground/8",
        "dark:hover:bg-foreground/7 dark:active:bg-foreground/10",
        // Active state (primary accent for active item only)
        isActive && "bg-primary/10 border-primary/20",
        // Current page state (muted, not active)
        isCurrentPage && !isActive && "bg-muted/50",
      )}
      style={{
        transform: `translateX(${offset}px)`,
        opacity,
      }}
      onClick={onNavigate}
      onMouseEnter={onHover}
    >
      <Icon
        className={cn(
          "h-6 w-6 shrink-0 transition-colors duration-100",
          isActive || isCurrentPage ? "text-primary" : "text-muted-foreground"
        )}
        strokeWidth={isActive ? 2 : 1.5}
      />
      
      <span
        className={cn(
          "flex-1 text-base uppercase tracking-[0.1em] transition-colors duration-100",
          // Font weight: 300 (inactive), 400 (active)
          isActive ? "text-primary font-normal" : "text-foreground font-light"
        )}
      >
        {module.label}
      </span>

      {/* Current page indicator */}
      {isCurrentPage && (
        <span className="w-2 h-2 rounded-full bg-primary" />
      )}
    </button>
  );
}

interface DesktopModuleMenuProps {
  activeTab: 'office' | 'action' | 'tools' | null;
  onClose: () => void;
}

export function DesktopModuleMenu({ activeTab, onClose }: DesktopModuleMenuProps) {
  const [location, setLocation] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(0);

  const tabGroup = activeTab ? TAB_GROUPS[activeTab] : null;
  const modules = tabGroup?.modules ?? [];

  // Close on ESC
  useEffect(() => {
    if (!activeTab) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeTab, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!activeTab) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // Don't close if clicking on the tab that opened it
        const clickedTab = target.closest('[data-desktop-nav="nav-tab"]');
        if (clickedTab && clickedTab.getAttribute('data-tab-id') === activeTab) {
          return;
        }
        // Close immediately on click outside
        onClose();
      }
    };

    // Attach immediately (no delay needed)
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeTab, onClose]);

  // Calculate position - centered above bottom bar
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number }>({
    left: 0,
    bottom: 0,
  });

  useEffect(() => {
    if (!activeTab || !menuRef.current) return;

    const updatePosition = () => {
      const tabElement = document.querySelector(
        `[data-desktop-nav="nav-tab"][data-tab-id="${activeTab}"]`
      ) as HTMLElement;
      
      if (tabElement && menuRef.current) {
        const tabRect = tabElement.getBoundingClientRect();
        const menuWidth = menuRef.current.offsetWidth || 320;
        const tabCenterX = tabRect.left + tabRect.width / 2;
        
        // Center menu on tab, but keep within viewport
        const left = Math.max(
          24, // Min margin from left
          Math.min(
            tabCenterX - menuWidth / 2,
            window.innerWidth - menuWidth - 24 // Min margin from right
          )
        );

        setMenuPosition({
          left,
          bottom: window.innerHeight - tabRect.top + 12, // 12px gap above tab bar
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [activeTab]);

  const navigateToModule = useCallback((path: string) => {
    setLocation(path);
    onClose();
  }, [setLocation, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!activeTab) return;

    const currentIndex = highlightedIndex ?? 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(Math.min(currentIndex + 1, modules.length - 1));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(Math.max(currentIndex - 1, 0));
        break;
        
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex !== null && modules[highlightedIndex]) {
          navigateToModule(modules[highlightedIndex].path);
        }
        break;
    }
  }, [activeTab, highlightedIndex, modules, navigateToModule]);

  if (!activeTab || !tabGroup) {
    return null;
  }

  return (
    <>
      {/* Backdrop - dimmed background with blur */}
      <div
        className="fixed inset-0 z-[48] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel - centered above bottom bar */}
      <div
        ref={menuRef}
        data-desktop-nav="module-menu"
        tabIndex={0}
        className={cn(
          "fixed z-[49]",
          "flex flex-col",
          // No max-height constraint - size to content
          // Glass effect
          "bg-background/95 backdrop-blur-2xl",
          "border border-border/50",
          "shadow-2xl shadow-black/20",
          "rounded-xl",
          // Animation
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        style={{
          left: menuPosition.left,
          bottom: menuPosition.bottom,
          width: '320px',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Module List - no header (tab label already in bottom bar), no scroll */}
        <div className="py-3 px-3">
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
        <div className="px-6 py-3 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            ↑↓ navigate • Enter select • Esc close
          </p>
        </div>
      </div>
    </>
  );
}
