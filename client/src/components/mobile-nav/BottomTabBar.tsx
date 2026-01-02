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

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[1000]',
        'bg-background/95 backdrop-blur-md',
        'border-t border-border',
        'md:hidden', // Mobile only
        'bottom-tab-bar'
      )}
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
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
                onClick={() => handleTabClick(tab.id)}
                onPointerDown={gesture.handlePointerDown}
                onPointerMove={gesture.handlePointerMove}
                onPointerUp={gesture.handlePointerUp}
                onPointerCancel={gesture.handlePointerCancel}
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
