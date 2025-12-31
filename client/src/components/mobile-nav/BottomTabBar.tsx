/**
 * Bottom Tab Bar Component
 *
 * Fixed 3-tab navigation bar for mobile.
 * § 2.1: Bottom Tab Bar - Exactly three tabs: Office, Field, Tools
 * § 10: Context Anchoring - Tab label reveals above icon when scroller active
 */

import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useGestureRecognition } from './useGestureRecognition';
import { TABS } from './constants';
import { GestureState } from './types';
import type { TabId } from './types';

export function BottomTabBar() {
  const {
    activeTab,
    setActiveTab,
    gestureState,
    scrollerVisible,
  } = useMobileNav();

  const gesture = useGestureRecognition();

  const handleTabClick = (tabId: TabId) => {
    // Simple tap switches tabs (§ 4.1: tap alone doesn't activate scroller)
    if (gestureState === GestureState.IDLE) {
      setActiveTab(tabId);
    }
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[1000]',
        'bg-background/95 backdrop-blur-md',
        'border-t border-border',
        'md:hidden', // § 1.1: Mobile only
        // Safe area support for notched devices
        'pb-[env(safe-area-inset-bottom)]'
      )}
      style={{
        height: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex h-14 items-center justify-around px-4">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              data-tab-trigger={tab.id} // § 4.2: Valid touch origin marker
              className={cn(
                'relative flex flex-col items-center justify-center',
                'min-w-[64px] h-12',
                'transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'active:scale-95', // Tactile feedback
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
              {/*
                § 10.1: Context Label Reveal
                Label appears ONLY when scroller is active AND this tab is active
              */}
              {scrollerVisible && isActive && (
                <span
                  className={cn(
                    'absolute -top-4 left-1/2 -translate-x-1/2',
                    'text-xs font-medium tracking-wide',
                    'animate-context-label-reveal',
                    'whitespace-nowrap'
                  )}
                >
                  {tab.label}
                </span>
              )}

              {/* Tab icon */}
              <Icon
                className={cn(
                  'h-6 w-6',
                  isActive && 'text-primary'
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
