/**
 * Bottom Tab Bar Component - Desktop Variant
 *
 * Desktop version with text labels (ALL-CAPS) instead of icons.
 * Uses the same MobileNavProvider and shares all behavior with mobile.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useLocation } from 'wouter';
import { TABS } from './constants';

const HOVER_DELAY = 150; // ms
import type { TabId } from './types';
import { useManto } from '@/contexts/MantoContext';

export function BottomTabBarDesktop() {
  const {
    activeTab,
    setActiveTab,
    scrollerVisible,
    lastUsedModuleByTab,
    setGestureState,
    setGestureTab,
    highlightedIndex,
    setHighlightedIndex,
  } = useMobileNav();
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [location, setLocation] = useLocation();
  const { isOpen: isChatOpen, toggleManto } = useManto();
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

    updateWidth();

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

  const handleTabHover = useCallback((tabId: TabId) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // If scroller is already visible for a different tab, switch instantly
    if (scrollerVisible) {
      setActiveTab(tabId);
      setGestureTab(tabId);
      setGestureState('hold_active');
      // Initialize highlighted index
      const { MODULE_REGISTRY } = require('./constants');
      const modules = MODULE_REGISTRY[tabId] || [];
      if (modules.length > 0) {
        setHighlightedIndex(modules.length - 1);
      }
      return;
    }

    // Otherwise, delay before showing (hover-intent pattern)
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveTab(tabId);
      setGestureTab(tabId);
      setGestureState('hold_active');
      // Initialize highlighted index
      const { MODULE_REGISTRY } = require('./constants');
      const modules = MODULE_REGISTRY[tabId] || [];
      if (modules.length > 0) {
        setHighlightedIndex(modules.length - 1);
      }
    }, HOVER_DELAY);
  }, [scrollerVisible, setActiveTab, setGestureTab, setGestureState, setHighlightedIndex]);

  const handleTabHoverLeave = useCallback(() => {
    // Clear pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Don't close scroller on mouse leave - let click outside handle it
  }, []);

  const handleTabClick = (tabId: TabId) => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // CHAT tab - toggle assistant panel only
    if (tabId === 'chat') {
      toggleManto();
      return;
    }
    
    // If scroller is open for this tab, close it
    if (scrollerVisible && activeTab === tabId) {
      setGestureState('idle');
      setGestureTab(null);
      setHighlightedIndex(null);
      return;
    }
    
    // Otherwise, open scroller for this tab
    setActiveTab(tabId);
    setGestureTab(tabId);
    setGestureState('hold_active');
    // Initialize highlighted index
    const { MODULE_REGISTRY } = require('./constants');
    const modules = MODULE_REGISTRY[tabId] || [];
    if (modules.length > 0) {
      setHighlightedIndex(modules.length - 1);
    }
  };

  // Determine if a nav tab is active based on current route
  const isNavTabActive = (tabId: TabId | 'chat'): boolean => {
    if (tabId === 'chat') {
      return isChatOpen;
    }
    
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
  const chatButtonWidth = 100; // CHAT button width + right padding
  const availableWidth = isChatOpen && contentColumnWidth
    ? contentColumnWidth
    : typeof window !== 'undefined'
      ? window.innerWidth - chatButtonWidth - 48
      : null;

  // Desktop tabs: Office, Action, Tools, Chat
  const desktopTabs = [
    ...TABS,
    { id: 'chat' as const, label: 'Chat' },
  ];

  return (
    <div
      data-desktop-nav="bottom-tab-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[9999]',
        'bg-background',
        'border-t border-border',
        'hidden md:flex', // Desktop only
        'select-none',
        'pointer-events-auto',
        'isolate'
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: '56px',
        backgroundColor: 'hsl(var(--background)) !important',
        backdropFilter: 'none !important',
        WebkitBackdropFilter: 'none !important',
        ...(scrollerVisible && {
          boxShadow: '0 -2px 24px rgba(0, 0, 0, 0.3)',
        }),
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
          {TABS.map((tab) => {
            const isActive = isNavTabActive(tab.id);
            const isMenuOpen = scrollerVisible && activeTab === tab.id;

            return (
              <button
                key={tab.id}
                data-tab-trigger={tab.id}
                className={cn(
                  'relative flex items-center justify-center',
                  'px-5 py-2.5 rounded-full',
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'select-none',
                  'text-sm uppercase tracking-[0.15em] font-light',
                  isActive
                    ? 'text-foreground bg-primary/10 backdrop-blur-sm border border-primary/20'
                    : 'text-foreground',
                  !isActive && 'hover:bg-foreground/5',
                  isMenuOpen && 'opacity-100',
                )}
                style={isActive ? {
                  boxShadow: '0 0 16px hsl(var(--primary) / 0.15)',
                } : undefined}
                onClick={() => handleTabClick(tab.id)}
                onMouseEnter={() => handleTabHover(tab.id)}
                onMouseLeave={handleTabHoverLeave}
                aria-label={`${tab.label} tab`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{tab.label.toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Chat Button - pill style */}
        <div className="flex items-center justify-end flex-shrink-0 absolute right-6">
          <button
            data-tab-trigger="chat"
            className={cn(
              'relative flex items-center justify-center',
              'px-5 py-2.5 rounded-full',
              'transition-all duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'select-none',
              'text-sm uppercase tracking-[0.15em] font-light',
              isChatOpen
                ? 'text-foreground bg-primary/10 backdrop-blur-sm border border-primary/20'
                : 'text-foreground hover:bg-foreground/5',
            )}
            style={isChatOpen ? {
              boxShadow: '0 0 16px hsl(var(--primary) / 0.15)',
            } : undefined}
            onClick={() => handleTabClick('chat')}
            aria-label="Chat"
            aria-pressed={isChatOpen}
          >
            <span>CHAT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
