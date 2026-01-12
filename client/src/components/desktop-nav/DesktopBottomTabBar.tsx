/**
 * Desktop Bottom Tab Bar Component
 *
 * Fixed 3-tab navigation bar for desktop, mirroring mobile BottomTabBar UI.
 * Shows: Office, Action, Tools
 */

import { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDesktopNav } from './DesktopNavProvider';
import { useManto } from '@/contexts/MantoContext';
import { BugAnt, PencilSquareIcon, WrenchScrewdriver } from '@/components/ui/Icon';
import { TIMING } from './constants';

/**
 * Bottom tab bar tabs (matching mobile: Office, Action, Tools)
 */
const BOTTOM_TABS = [
  { id: 'office' as const, icon: PencilSquareIcon, label: 'Office' },
  { id: 'action' as const, icon: BugAnt, label: 'Action' },
  { id: 'tools' as const, icon: WrenchScrewdriver, label: 'Tools' },
] as const;

export function DesktopBottomTabBar() {
  const { activeTab, flyoutState, openFlyout, closeFlyout } = useDesktopNav();
  const { toggleManto } = useManto();
  const hoverTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      hoverTimeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      hoverTimeoutRefs.current.clear();
    };
  }, []);

  const handleTabMouseEnter = useCallback((tabId: 'office' | 'tools') => {
    // Only Office and Tools support hover (Action is click-only for Manto)
    
    // Clear any existing timeout for this tab
    const existingTimeout = hoverTimeoutRefs.current.get(tabId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      hoverTimeoutRefs.current.delete(tabId);
    }

    // If already showing a flyout (locked or hovering), switch immediately
    if (flyoutState !== 'closed') {
      openFlyout(tabId, flyoutState === 'locked', 'bottom-bar');
      return;
    }

    // Otherwise, delay before showing (hover-intent pattern)
    const timeout = setTimeout(() => {
      openFlyout(tabId, false, 'bottom-bar');
      hoverTimeoutRefs.current.delete(tabId);
    }, TIMING.HOVER_DELAY);
    
    hoverTimeoutRefs.current.set(tabId, timeout);
  }, [flyoutState, openFlyout]);

  const handleTabMouseLeave = useCallback((tabId: 'office' | 'tools') => {
    // Clear pending hover timeout
    const timeout = hoverTimeoutRefs.current.get(tabId);
    if (timeout) {
      clearTimeout(timeout);
      hoverTimeoutRefs.current.delete(tabId);
    }
  }, []);

  const handleTabClick = (tabId: typeof BOTTOM_TABS[number]['id']) => {
    // Clear any pending hover timeout
    const timeout = hoverTimeoutRefs.current.get(tabId);
    if (timeout) {
      clearTimeout(timeout);
      hoverTimeoutRefs.current.delete(tabId);
    }

    if (tabId === 'action') {
      // Action tab - toggle Mantodeus assistant (matching mobile behavior)
      toggleManto();
      return;
    }

    if (tabId === 'office' || tabId === 'tools') {
      // Flyout tabs - open/lock flyout
      if (activeTab === tabId && flyoutState === 'locked') {
        // Clicking same locked tab closes it
        closeFlyout();
      } else {
        // Lock the flyout open, anchored to bottom bar
        openFlyout(tabId, true, 'bottom-bar');
      }
    }
  };

  // Determine if a tab is active
  const isTabActive = (tabId: typeof BOTTOM_TABS[number]['id']): boolean => {
    // All tabs (Office, Action, Tools) are flyout tabs - active when their flyout is open
    if (tabId === 'office' || tabId === 'action' || tabId === 'tools') {
      return activeTab === tabId && flyoutState !== 'closed';
    }
    
    return false;
  };

  return (
    <div
      data-desktop-nav="bottom-tab-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[50]', // Below rail (z-[50]) but above content
        'bg-background/95 backdrop-blur-md', // Glass effect matching Mantodeus style
        'border-t border-border',
        'hidden md:flex', // Desktop only (opposite of mobile)
        'select-none', // Prevent text selection
        'pointer-events-auto' // Ensure tab bar always receives pointer events
      )}
      style={{
        paddingLeft: '60px', // Account for rail width
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', // Safe area for notched devices
        height: '44px', // Reduced height for dock-like feel
      }}
    >
      <div className="flex h-11 items-center justify-center px-6 py-2 w-full">
        {/* Main Tabs */}
        <div className="flex items-center justify-around gap-16 flex-1 max-w-2xl mx-auto">
          {BOTTOM_TABS.map((tab) => {
            const isActive = isTabActive(tab.id);
            const isAction = tab.id === 'action';

            return (
              <button
                key={tab.id}
                data-desktop-nav="bottom-tab"
                data-tab-id={tab.id}
                className={cn(
                  'relative flex items-center justify-center',
                  'px-4 py-2',
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'select-none',
                  // Remove scale animations for calm feel
                  // Text styling - uppercase, light weight, tracking
                  'text-xs uppercase tracking-[0.15em] font-extralight',
                  // Hover state - subtle background bloom, opacity shift
                  'hover:bg-foreground/3 hover:opacity-100',
                  // Active state
                  isActive
                    ? 'text-foreground opacity-100'
                    : 'text-muted-foreground opacity-60',
                  // Action tab - slightly stronger presence
                  isAction && !isActive && 'opacity-75',
                )}
                onClick={() => handleTabClick(tab.id)}
                onMouseEnter={() => {
                  // Only Office and Tools support hover
                  if (tab.id === 'office' || tab.id === 'tools') {
                    handleTabMouseEnter(tab.id);
                  }
                }}
                onMouseLeave={() => {
                  // Only Office and Tools support hover
                  if (tab.id === 'office' || tab.id === 'tools') {
                    handleTabMouseLeave(tab.id);
                  }
                }}
                aria-label={`${tab.label} tab`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Text label - text-only on desktop, no icons */}
                <span>{tab.label}</span>
                
                {/* Active indicator - subtle underline with glow */}
                {isActive && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-px bg-primary/40"
                    style={{
                      boxShadow: '0 0 8px hsl(var(--primary) / 0.3)',
                    }}
                  />
                )}
                
                {/* Action tab subtle glow when not active */}
                {isAction && !isActive && (
                  <span 
                    className="absolute inset-0 rounded-md opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
