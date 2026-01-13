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
      hoverTimeoutRef.current = null;
    }

    // If menu is already open (for any tab), switch instantly
    if (menuTab !== null) {
      setMenuTab(tabId);
      return;
    }

    // If menu is closed, delay before showing (hover-intent pattern)
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

  // Calculate available width for centering tabs
  // When chat is open: center relative to content column (which shrinks)
  // When chat is closed: center in full width minus CHAT button area
  const chatButtonWidth = 100; // CHAT button width + right padding (6*2 + button ~88px)
  const availableWidth = isChatOpen && contentColumnWidth
    ? contentColumnWidth // When chat is open, center relative to content column
    : typeof window !== 'undefined'
      ? window.innerWidth - chatButtonWidth - 48 // When closed, full width minus CHAT area and padding
      : null;

  return (
    <div
      data-desktop-nav="bottom-tab-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[50]', // Above content and scrim
        'bg-background', // Solid opaque background - no transparency
        'border-t transition-colors duration-200',
        menuTab ? 'border-border/40' : 'border-border', // Lighter border when menu active
        'hidden md:flex', // Desktop only (opposite of mobile)
        'select-none', // Prevent text selection
        'pointer-events-auto', // Ensure tab bar always receives pointer events
        'isolate' // Create own stacking context, isolate from backdrop-filter
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', // Safe area for notched devices
        height: '56px', // Premium height
        // Ensure solid background, not affected by any backdrop-filter
        backgroundColor: 'hsl(var(--background))',
        // Add stronger top shadow when menu is active for visual separation
        ...(menuTab && {
          boxShadow: '0 -2px 24px rgba(0, 0, 0, 0.3)'
        })
      }}
    >
      <div className="flex h-14 items-center px-6 w-full relative">
        {/* Left: Navigation Tabs (Office, Action, Tools) - centered in available space */}
        <div 
          className="flex items-center justify-center gap-3 flex-1"
          style={availableWidth ? {
            maxWidth: `${availableWidth}px`,
            marginLeft: 'auto',
            marginRight: 'auto',
          } : undefined}
        >
          {NAV_TABS.map((tab) => {
            const isActive = isNavTabActive(tab.id);
            const isMenuOpen = menuTab === tab.id;

            return (
              <button
                key={tab.id}
                data-desktop-nav="nav-tab"
                data-tab-id={tab.id}
                className={cn(
                  'relative flex items-center justify-center',
                  'px-5 py-2.5 rounded-full', // Pill shape
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'select-none',
                  // Text styling - uppercase, wide tracking, font-weight 300, fully readable
                  'text-sm uppercase tracking-[0.15em] font-light',
                  // Active state - subtle glass pill background + glow (only active tab)
                  isActive
                    ? 'text-foreground bg-primary/10 backdrop-blur-sm border border-primary/20'
                    : 'text-foreground', // Fully readable, no transparency
                  // Hover state - subtle background
                  !isActive && 'hover:bg-foreground/5',
                  // Menu open state - keep visible
                  isMenuOpen && 'opacity-100',
                )}
                style={isActive ? {
                  boxShadow: '0 0 16px hsl(var(--primary) / 0.15)',
                } : undefined}
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
              </button>
            );
          })}
        </div>

        {/* Right: Chat Button - anchored to right, pill style */}
        <div className="flex items-center justify-end flex-shrink-0 absolute right-6">
          <button
            data-desktop-nav="chat-button"
            className={cn(
              'relative flex items-center justify-center',
              'px-5 py-2.5 rounded-full', // Pill shape
              'transition-all duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'select-none',
              // Text styling - uppercase, wide tracking, font-weight 300
              'text-sm uppercase tracking-[0.15em] font-light',
              // Active state - subtle glass pill background + glow (only when active)
              isChatOpen
                ? 'text-foreground bg-primary/10 backdrop-blur-sm border border-primary/20'
                : 'text-foreground hover:bg-foreground/5', // Fully readable, no transparency
            )}
            style={isChatOpen ? {
              boxShadow: '0 0 16px hsl(var(--primary) / 0.15)',
            } : undefined}
            onClick={toggleManto}
            aria-label="Chat"
            aria-pressed={isChatOpen}
          >
            {/* Text label */}
            <span>CHAT</span>
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
