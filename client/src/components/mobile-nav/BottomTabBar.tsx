/**
 * Bottom Tab Bar Component
 *
 * Fixed 3-tab navigation bar for mobile.
 */

import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useGestureRecognition } from './useGestureRecognition';
import { MODULE_REGISTRY, TABS } from './constants';
import { GestureState } from './types';
import { useLocation } from 'wouter';
import type { TabId } from './types';

export function BottomTabBar() {
  const {
    activeTab,
    setActiveTab,
    gestureState,
    scrollerVisible,
    lastUsedModuleByTab,
  } = useMobileNav();

  const gesture = useGestureRecognition();
  const [, setLocation] = useLocation();

  const handleTabClick = (tabId: TabId) => {
    // Simple tap switches tabs (tap alone doesn't activate scroller)
    if (gestureState === GestureState.IDLE) {
      setActiveTab(tabId);
      const lastUsedPath = lastUsedModuleByTab[tabId];
      const fallbackPath = MODULE_REGISTRY[tabId]?.[0]?.path;
      const targetPath = lastUsedPath ?? fallbackPath;
      if (targetPath) {
        setLocation(targetPath);
      }
    }
  };

  // Immediately prevent text selection when interacting with tab buttons
  const handleTabPointerDown = (e: React.PointerEvent) => {
    // Clear any existing text selection immediately
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
    if (document.getSelection) {
      document.getSelection()?.removeAllRanges();
    }
    
    // Prevent default to stop any text selection behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Then call the gesture handler
    gesture.handlePointerDown(e);
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[1000]',
        'bg-background/95 backdrop-blur-md',
        'border-t border-border',
        'md:hidden', // Mobile only
        'bottom-tab-bar',
        'select-none' // Prevent text selection on entire tab bar
      )}
      onPointerDown={(e) => {
        // If clicking anywhere on the tab bar, clear text selection
        if (window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        if (document.getSelection) {
          document.getSelection()?.removeAllRanges();
        }
      }}
    >
      <div className="relative">
        {scrollerVisible && (
          <div className="pointer-events-none absolute bottom-full left-0 right-0 mb-1 flex items-center justify-around px-4">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <span
                  key={tab.id}
                  className={cn(
                    'tab-label whitespace-nowrap',
                    isActive ? 'opacity-100 is-active' : 'opacity-0'
                  )}
                >
                  {tab.label.toUpperCase()}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex h-14 items-center justify-around px-4">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                data-tab-trigger={tab.id}
                className={cn(
                  'gesture-surface',
                  'relative flex flex-col items-center justify-center',
                  'min-w-[64px] h-12',
                  'transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'active:scale-95',
                  'select-none', // Explicitly prevent text selection
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
                onClick={() => handleTabClick(tab.id)}
                onPointerDown={handleTabPointerDown}
                onPointerMove={gesture.handlePointerMove}
                onPointerUp={gesture.handlePointerUp}
                onPointerCancel={gesture.handlePointerCancel}
                onMouseDown={(e) => {
                  // Also prevent text selection on mouse down (for desktop testing)
                  e.preventDefault();
                  if (window.getSelection) {
                    window.getSelection()?.removeAllRanges();
                  }
                }}
                onTouchStart={(e) => {
                  // Prevent text selection on touch start
                  e.preventDefault();
                  if (window.getSelection) {
                    window.getSelection()?.removeAllRanges();
                  }
                }}
                aria-label={`${tab.label} tab`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'h-6 w-6',
                    isActive && 'text-primary'
                  )}
                  strokeWidth={isActive ? 1.5 : 1.2}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
