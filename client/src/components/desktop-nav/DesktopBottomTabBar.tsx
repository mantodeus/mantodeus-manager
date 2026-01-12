/**
 * Desktop Bottom Tab Bar Component
 *
 * Fixed navigation bar for desktop with:
 * - Left: Office, Action, Tools (navigation tabs)
 * - Right: Chat (assistant toggle)
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useManto } from '@/contexts/MantoContext';
import { BugAnt, PencilSquareIcon, WrenchScrewdriver } from '@/components/ui/Icon';
import { DesktopModuleMenu } from './DesktopModuleMenu';
import { TIMING } from './constants';

/**
 * Navigation tabs (left side)
 */
const NAV_TABS = [
  { id: 'office' as const, icon: PencilSquareIcon, label: 'Office' },
  { id: 'action' as const, icon: BugAnt, label: 'Action' },
  { id: 'tools' as const, icon: WrenchScrewdriver, label: 'Tools' },
] as const;

export function DesktopBottomTabBar() {
  const [location, setLocation] = useLocation();
  const { isOpen: isChatOpen, toggleManto } = useManto();
  const [menuTab, setMenuTab] = useState<'office' | 'action' | 'tools' | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contentColumnWidth, setContentColumnWidth] = useState<number | null>(null);
  const contentColumnRef = useRef<HTMLDivElement | null>(null);

  // Measure content column width for centering
  useEffect(() => {
    const contentColumn = document.querySelector('[data-layout="content-column"]') as HTMLElement;
    if (!contentColumn) return;

    contentColumnRef.current = contentColumn;

    const updateWidth = () => {
      const rect = contentColumn.getBoundingClientRect();
      setContentColumnWidth(rect.width);
    };

    // Initial measurement
    updateWidth();

    // Observe resize
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(contentColumn);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleNavTabMouseEnter = useCallback((tabId: 'office' | 'action' | 'tools') => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // If menu is already open for a different tab, switch immediately
    if (menuTab && menuTab !== tabId) {
      setMenuTab(tabId);
      return;
    }

    // Otherwise, delay before showing (hover-intent pattern)
    hoverTimeoutRef.current = setTimeout(() => {
      setMenuTab(tabId);
    }, TIMING.HOVER_DELAY);
  }, [menuTab]);

  const handleNavTabMouseLeave = useCallback(() => {
    // Clear pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Don't close menu on mouse leave - let click outside handle it
  }, []);

  const handleNavTabClick = (tabId: typeof NAV_TABS[number]['id']) => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (tabId === 'office' || tabId === 'action' || tabId === 'tools') {
      // If clicking the same tab while menu is open, close it
      if (menuTab === tabId) {
        setMenuTab(null);
      } else {
        // Otherwise, open menu for this tab (switches instantly if different tab)
        setMenuTab(tabId);
      }
    }
  };

  // Determine if a nav tab is active based on current route
  const isNavTabActive = (tabId: typeof NAV_TABS[number]['id']): boolean => {
    // Office tab active for: /projects, /invoices, /expenses, /reports, /notes, /inspections
    if (tabId === 'office') {
      return location.startsWith('/projects') ||
             location.startsWith('/invoices') ||
             location.startsWith('/expenses') ||
             location.startsWith('/reports') ||
             location.startsWith('/notes') ||
             location.startsWith('/inspections');
    }
    
    // Action tab active for: /action/capto, /action/voco
    if (tabId === 'action') {
      return location.startsWith('/action/capto') ||
             location.startsWith('/action/voco');
    }
    
    // Tools tab active for: /calendar, /contacts, /gallery, /maps, /settings, /weather
    if (tabId === 'tools') {
      return location.startsWith('/calendar') ||
             location.startsWith('/contacts') ||
             location.startsWith('/gallery') ||
             location.startsWith('/maps') ||
             location.startsWith('/settings') ||
             location.startsWith('/weather');
    }
    
    return false;
  };

  return (
    <div
      data-desktop-nav="bottom-tab-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[50]', // Above content
        'bg-background/95 backdrop-blur-md', // Glass effect matching Mantodeus style
        'border-t border-border',
        'hidden md:flex', // Desktop only (opposite of mobile)
        'select-none', // Prevent text selection
        'pointer-events-auto' // Ensure tab bar always receives pointer events
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', // Safe area for notched devices
        height: '44px', // Reduced height for dock-like feel
      }}
    >
      <div className="flex h-11 items-center px-6 py-2 w-full relative">
        {/* Left: Navigation Tabs (Office, Action, Tools) - centered relative to content column */}
        <div 
          className="flex items-center justify-center gap-16 flex-1"
          style={contentColumnWidth ? {
            maxWidth: `${contentColumnWidth}px`,
            marginLeft: 'auto',
            marginRight: 'auto',
          } : undefined}
        >
          {NAV_TABS.map((tab) => {
            const isActive = isNavTabActive(tab.id);
            const isAction = tab.id === 'action';

            return (
              <button
                key={tab.id}
                data-desktop-nav="nav-tab"
                data-tab-id={tab.id}
                className={cn(
                  'relative flex items-center justify-center',
                  'px-4 py-2',
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'select-none',
                  // Text styling - larger size, better contrast, uppercase, tracking
                  'text-sm uppercase tracking-[0.15em]',
                  // Font weight: 300 (inactive), 400 (active)
                  isActive ? 'font-normal' : 'font-light',
                  // Hover state - subtle background bloom, opacity shift
                  'hover:bg-foreground/3 hover:opacity-100',
                  // Active state - clearer accent
                  isActive
                    ? 'text-foreground opacity-100'
                    : 'text-muted-foreground opacity-70',
                  // Action tab - slightly stronger presence when not active
                  isAction && !isActive && 'opacity-80',
                )}
                onClick={() => handleNavTabClick(tab.id)}
                onMouseEnter={() => {
                  // Office, Action, and Tools all support hover menu
                  if (tab.id === 'office' || tab.id === 'action' || tab.id === 'tools') {
                    handleNavTabMouseEnter(tab.id);
                  }
                }}
                onMouseLeave={() => {
                  // Office, Action, and Tools all support hover menu
                  if (tab.id === 'office' || tab.id === 'action' || tab.id === 'tools') {
                    handleNavTabMouseLeave();
                  }
                }}
                aria-label={`${tab.label} tab`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Text label - text-only on desktop, no icons */}
                <span>{tab.label}</span>
                
                {/* Active indicator - clearer underline with glow */}
                {isActive && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary/50"
                    style={{
                      boxShadow: '0 0 12px hsl(var(--primary) / 0.4)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Chat Button - anchored to right */}
        <div className="flex items-center justify-end flex-shrink-0 absolute right-6">
          <button
            data-desktop-nav="chat-button"
            className={cn(
              'relative flex items-center justify-center',
              'px-4 py-2',
              'transition-all duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'select-none',
              // Text styling - matching nav tabs (larger, better contrast)
              'text-sm uppercase tracking-[0.15em]',
              // Font weight: 300 (inactive), 400 (active)
              isChatOpen ? 'font-normal' : 'font-light',
              // Hover state - subtle background bloom, opacity shift
              'hover:bg-foreground/3 hover:opacity-100',
              // Active state - clearer accent when chat is open
              isChatOpen
                ? 'text-foreground opacity-100'
                : 'text-muted-foreground opacity-70',
            )}
            onClick={toggleManto}
            aria-label="Chat"
            aria-pressed={isChatOpen}
          >
            {/* Text label */}
            <span>CHAT</span>
            
            {/* Active indicator - clearer underline with glow when chat is open */}
            {isChatOpen && (
              <span 
                className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary/50"
                style={{
                  boxShadow: '0 0 12px hsl(var(--primary) / 0.4)',
                }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Module Menu - appears on hover/click of Office, Action, or Tools */}
      <DesktopModuleMenu
        activeTab={menuTab}
        onClose={() => setMenuTab(null)}
      />
    </div>
  );
}
