/**
 * Bottom Tab Bar Component
 *
 * Fixed 3-tab navigation bar for mobile + Bug assistant button.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMobileNav } from './MobileNavProvider';
import { useGestureRecognition } from './useGestureRecognition';
import { MODULE_REGISTRY, TABS } from './constants';
import { useLocation } from 'wouter';
import type { TabId } from './types';
import { BugAnt } from '@/components/ui/Icon';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';

export function BottomTabBar() {
  const {
    activeTab,
    gestureTab,
    setActiveTab,
    gestureState,
    scrollerVisible,
    lastUsedModuleByTab,
  } = useMobileNav();

  const gesture = useGestureRecognition();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [bugOpen, setBugOpen] = useState(false);

  // Detect page context for Bug assistant
  const getPageContext = () => {
    const invoiceMatch = location.match(/^\/invoices\/(\d+)(?:\?|#|$)/);
    if (invoiceMatch) {
      return { scope: "invoice_detail" as const, scopeId: parseInt(invoiceMatch[1], 10), pageName: "Invoice" };
    }
    const pageNames: Record<string, string> = {
      "/projects": "Projects", "/invoices": "Invoices", "/contacts": "Contacts",
      "/notes": "Notes", "/calendar": "Calendar", "/gallery": "Gallery",
      "/maps": "Maps", "/settings": "Settings", "/expenses": "Expenses", "/reports": "Reports",
    };
    const pageName = Object.entries(pageNames).find(([path]) => location.startsWith(path))?.[1] || "Mantodeus";
    return { scope: "general" as const, pageName };
  };
  const pageContext = getPageContext();

  const handleTabClick = (tabId: TabId) => {
    // Always navigate when tab is clicked, even if it's already active
    // This allows users to return to the last page in that tab
    setActiveTab(tabId);
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

        <div className="flex h-14 items-center justify-between px-4">
          {/* Main Tabs */}
          <div className="flex items-center justify-center gap-10 flex-1">
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

          {/* Separator */}
          <div className="h-8 w-px bg-border/60 mx-2" />

          {/* Bug Assistant Button */}
          <button
            onClick={() => setBugOpen(true)}
            className={cn(
              'relative flex items-center justify-center',
              'w-10 h-10 rounded-xl',
              'bg-primary/10 hover:bg-primary/20',
              'transition-all duration-150',
              'active:scale-95',
              'select-none'
            )}
            style={{
              touchAction: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            aria-label="Open Bug assistant"
          >
            <BugAnt className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </button>
        </div>

        {/* Bug Assistant Panel */}
        <AssistantPanel
          open={bugOpen}
          onOpenChange={setBugOpen}
          scope={pageContext.scope}
          scopeId={pageContext.scope === "invoice_detail" ? pageContext.scopeId : undefined}
          pageName={pageContext.pageName}
        />
      </div>
    </div>
  );
}
