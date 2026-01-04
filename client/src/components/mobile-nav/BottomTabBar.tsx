/**
 * Bottom Tab Bar Component
 *
 * Fixed 3-tab navigation bar for mobile.
 */

import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useGestureRecognition } from './useGestureRecognition';
import { MODULE_REGISTRY, TABS } from './constants';
import { useLocation } from 'wouter';
import type { GestureState, TabId } from './types';

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
    // Allow clicks when idle or hold_pending (quick tap before gesture activates)
    if (gestureState === 'idle' || gestureState === 'hold_pending') {
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


  // Global handler to prevent text selection and ensure tab bar always receives events
  const handleTabBarInteraction = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    // Immediately clear any text selection
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
    if (document.getSelection) {
      document.getSelection()?.removeAllRanges();
    }
    
    // Prevent default to stop text selection and other default behaviors
    // But don't prevent on the tab bar container itself - let it bubble to buttons
    if ((e.target as HTMLElement).closest('[data-tab-trigger]')) {
      // Only prevent default on actual tab buttons
      e.preventDefault();
    }
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[9999]', // Maximum z-index to ensure it's always on top
        'bg-background/95 backdrop-blur-md',
        'border-t border-border',
        'md:hidden', // Mobile only
        'bottom-tab-bar',
        'select-none', // Prevent text selection on entire tab bar
        'pointer-events-auto' // Ensure tab bar always receives pointer events
      )}
      onPointerDown={handleTabBarInteraction}
      onTouchStart={handleTabBarInteraction}
      onMouseDown={handleTabBarInteraction}
      style={{
        touchAction: 'none', // Prevent default touch behaviors (scrolling, zooming, etc.)
        WebkitUserSelect: 'none',
        userSelect: 'none',
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

        <div className="flex h-14 items-center justify-center gap-12 px-4">
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
                onTouchStart={(e) => {
                  // Prevent text selection and default touch behaviors
                  e.preventDefault();
                  e.stopPropagation();
                  if (window.getSelection) {
                    window.getSelection()?.removeAllRanges();
                  }
                  if (document.getSelection) {
                    document.getSelection()?.removeAllRanges();
                  }
                  // Touch events will be automatically converted to pointer events by the browser
                  // The pointer handlers will handle the gesture recognition
                }}
                onTouchMove={(e) => {
                  // Prevent default scrolling/zooming
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  // Prevent default behaviors
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchCancel={(e) => {
                  // Prevent default behaviors
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  // Also prevent text selection on mouse down (for desktop testing)
                  e.preventDefault();
                  e.stopPropagation();
                  if (window.getSelection) {
                    window.getSelection()?.removeAllRanges();
                  }
                }}
                style={{
                  touchAction: 'none', // Prevent default touch behaviors (scrolling, zooming, etc.)
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  pointerEvents: 'auto', // Ensure button always receives pointer events
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
