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
        "w-full flex items-center gap-3 px-4 py-3.5",
        "rounded-lg",
        // Transitions: opacity and background-color only (no scale/transform, no jitter)
        "transition-[opacity,background-color] duration-120 ease-out",
        "text-left",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // Active/selected state - subtle highlighted glass pill (no scale, no dramatic glow)
        isActive && "bg-primary/15 backdrop-blur-sm border border-primary/30 ring-1 ring-primary/10 opacity-100",
        // Current page state (muted, not active)
        isCurrentPage && !isActive && "bg-muted/30 opacity-100",
        // Hover state - opacity increase + soft background highlight (no scale, no transform, no jitter)
        !isActive && "opacity-80 hover:opacity-100 hover:bg-foreground/5",
      )}
      style={{
        cursor: "pointer",
      }}
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
          "leading-loose", // Increased line-height for better vertical breathing room
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
      {/* Click-outside handler - invisible, no page darkening */}
      <div
        className="fixed inset-0 z-[48]"
        onClick={onClose}
        aria-hidden="true"
        style={{
          backgroundColor: 'transparent',
          pointerEvents: 'auto',
        }}
      />

      {/* Menu Panel - pure elevation, calm and restrained */}
      <div
        ref={menuRef}
        data-desktop-nav="module-menu"
        tabIndex={0}
        className={cn(
          "fixed z-[49]",
          "flex flex-col",
          "rounded-2xl",
          "border border-border/40",
          "bg-background",
          // Hide scrollbar
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        )}
        style={{
          left: menuPosition.left,
          bottom: menuPosition.bottom,
          width: '280px',
          maxHeight: '400px',
          overflowY: 'auto',
          // Motion: calm, vertical only
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 220ms cubic-bezier(0.4, 0, 0.2, 1), transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          // Elevation: restrained, wide, soft
          boxShadow: `
            0 1px 0 rgba(0,0,0,0.06),
            0 8px 24px rgba(0,0,0,0.18),
            0 16px 40px rgba(0,0,0,0.16)
          `,
        }}
        onKeyDown={handleKeyDown}
      >

        {/* Module List - increased vertical spacing for calm, floating feel */}
        <div className="py-5 px-3 space-y-3">
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
