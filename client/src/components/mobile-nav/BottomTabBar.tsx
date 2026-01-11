/**
 * Bottom Tab Bar Component
 *
 * Fixed 3-tab navigation bar for mobile.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useGestureRecognition } from './useGestureRecognition';
import { MODULE_REGISTRY, TABS } from './constants';
import { useLocation } from 'wouter';
import type { TabId } from './types';
import { useManto } from '@/contexts/MantoContext';

export function BottomTabBar() {
  const [hideBecauseKeyboard, setHideBecauseKeyboard] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;

    // Capture initial viewport height BEFORE keyboard opens.
    // In iOS PWA, window.innerHeight shrinks WITH the viewport, so we can't use it as reference.
    const initialVvHeight = vv?.height ?? window.innerHeight;

    const isKeyboardOpen = () => {
      if (!vv) return false;
      // Compare current height to INITIAL height (not window.innerHeight).
      // iOS PWA: both shrink together, but initial captures pre-keyboard state.
      const currentHeight = vv.height;
      const delta = initialVvHeight - currentHeight;
      return delta > 100; // Keyboard typically > 250px, use 100 threshold
    };

    const activeElementWantsHide = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;

      // Explicit opt-in via data attribute (used by chat input)
      if (el.getAttribute('data-hide-tabbar-when-keyboard') === 'true') return true;

      // Automatic for search inputs
      if (el instanceof HTMLInputElement) {
        if (el.type === 'search') return true;
        if (el.getAttribute('role') === 'searchbox') return true;
        const inputMode = (el as any).inputMode as string | undefined;
        if (inputMode === 'search') return true;
      }

      return false;
    };

    const update = () => {
      const kbOpen = isKeyboardOpen();
      const wantsHide = activeElementWantsHide();
      const shouldHide = kbOpen && wantsHide;
      setHideBecauseKeyboard(shouldHide);
      document.body.classList.toggle('tabbar-hidden', shouldHide);
    };

    update();

    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
      document.body.classList.remove('tabbar-hidden');
    };
  }, []);

  const {
    activeTab,
    gestureTab,
    setActiveTab,
    gestureState,
    scrollerVisible,
    lastUsedModuleByTab,
  } = useMobileNav();

  const gesture = useGestureRecognition();
  const [location, setLocation] = useLocation();
  const { openManto } = useManto();

  const handleTabClick = (tabId: TabId) => {
    // Always navigate when tab is clicked, even if it's already active
    // This allows users to return to the last page in that tab
    setActiveTab(tabId);
    
    // Special handling for action tab - always open Mantodeus chat overlay
    // Do NOT navigate - chat is an overlay that appears over current page
    if (tabId === 'action') {
      openManto();
      return;
    }
    
    const lastUsedPath = lastUsedModuleByTab[tabId];
    const fallbackPath = MODULE_REGISTRY[tabId]?.[0]?.path;
    const targetPath = lastUsedPath ?? fallbackPath;
    if (targetPath) {
      setLocation(targetPath);
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

  if (hideBecauseKeyboard) return null;

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
              // Show the title of the tab being gestured, not just the active tab
              // This ensures the correct title is shown when gesturing on any tab
              const isActive = tab.id === (gestureTab ?? activeTab);

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

        <div className="flex h-14 items-end justify-center px-4 pb-1">
          {/* Main Tabs */}
          <div className="flex items-center justify-around gap-10 flex-1">
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
                    'min-w-[56px] h-12',
                    'transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'active:scale-95',
                    'select-none',
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
                    e.preventDefault();
                    e.stopPropagation();
                    window.getSelection?.()?.removeAllRanges();
                    document.getSelection?.()?.removeAllRanges();
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    if (gestureState !== 'idle' && gestureState !== 'hold_pending') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.getSelection?.()?.removeAllRanges();
                  }}
                  style={{
                    touchAction: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                    pointerEvents: 'auto',
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
    </div>
  );
}
