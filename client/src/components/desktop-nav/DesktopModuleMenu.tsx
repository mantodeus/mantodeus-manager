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
import { TAB_GROUPS, TIMING } from './constants';
import type { Module } from './types';

/**
 * Individual module item
 */
function ModuleItem({
  module,
  index,
  isActive,
  isCurrentPage,
  onNavigate,
  onHover,
}: {
  module: Module;
  index: number;
  isActive: boolean;
  isCurrentPage: boolean;
  onNavigate: () => void;
  onHover: () => void;
}) {
  const Icon = module.icon;

  return (
    <button
      data-desktop-nav="module-menu-item"
      data-module-index={index}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5",
        "rounded-lg transition-all duration-200 ease-out",
        "text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // Active/selected state - subtle highlighted glass pill
        isActive && "bg-primary/10 backdrop-blur-sm border border-primary/20 scale-[1.03]",
        // Current page state (muted, not active)
        isCurrentPage && !isActive && "bg-muted/30",
        // Hover state - scale and increase opacity
        !isActive && "hover:scale-[1.03] hover:opacity-100 hover:bg-foreground/5",
      )}
      onClick={onNavigate}
      onMouseEnter={onHover}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-200",
          isActive || isCurrentPage ? "text-primary" : "text-muted-foreground"
        )}
        strokeWidth={isActive ? 2 : 1.5}
      />
      
      <span
        className={cn(
          "flex-1 text-xs uppercase tracking-[0.15em] font-light transition-colors duration-200",
          isActive || isCurrentPage ? "text-primary" : "text-foreground/80"
        )}
      >
        {module.label}
      </span>

      {/* Current page indicator */}
      {isCurrentPage && !isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
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
  const [isVisible, setIsVisible] = useState(false);

  const tabGroup = activeTab ? TAB_GROUPS[activeTab] : null;
  const modules = tabGroup?.modules ?? [];

  // Fade + slide up animation
  useEffect(() => {
    if (activeTab) {
      // Trigger animation on mount
      setIsVisible(false);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [activeTab]);

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

      {/* Menu Panel - centered above bottom bar, fade + slide up animation */}
      <div
        ref={menuRef}
        data-desktop-nav="module-menu"
        tabIndex={0}
        className={cn(
          "fixed z-[49]",
          "flex flex-col",
          // Subtle glass surface or none - items are primary visual
          "bg-background/80 backdrop-blur-xl",
          "border border-border/30",
          "shadow-lg shadow-black/10",
          "rounded-2xl",
          // Fade + slide up animation
          "transition-all duration-200 ease-out",
          // Hide scrollbar
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        )}
        style={{
          left: menuPosition.left,
          bottom: menuPosition.bottom,
          width: '280px',
          maxHeight: '400px',
          overflowY: 'auto',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        }}
        onKeyDown={handleKeyDown}
      >

        {/* Module List - no header, no footer */}
        <div className="py-2 px-2">
          {modules.map((module, index) => {
            const isActive = index === highlightedIndex;
            const isCurrentPage = location === module.path || location.startsWith(module.path + '/');

            return (
              <ModuleItem
                key={module.id}
                module={module}
                index={index}
                isActive={isActive}
                isCurrentPage={isCurrentPage}
                onNavigate={() => navigateToModule(module.path)}
                onHover={() => setHighlightedIndex(index)}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
