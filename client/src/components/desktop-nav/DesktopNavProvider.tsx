/**
 * Desktop Navigation Provider
 * 
 * Context provider for desktop Tab Rail + Flyout navigation state.
 */

import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import type { DesktopNavContextValue, TabId, FlyoutState, FlyoutAnchor } from './types';
import { TAB_GROUPS, ALL_MODULES, TIMING } from './constants';

// Type helper for flyout-capable tabs
export type FlyoutTabId = 'office' | 'action' | 'tools';

const DesktopNavContext = createContext<DesktopNavContextValue | undefined>(undefined);

export function useDesktopNav() {
  const context = useContext(DesktopNavContext);
  if (!context) {
    throw new Error('useDesktopNav must be used within a DesktopNavProvider');
  }
  return context;
}

interface DesktopNavProviderProps {
  children: ReactNode;
}

export function DesktopNavProvider({ children }: DesktopNavProviderProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [flyoutState, setFlyoutState] = useState<FlyoutState>('closed');
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [flyoutAnchor, setFlyoutAnchor] = useState<FlyoutAnchor>('rail');
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const openFlyout = useCallback((tabId: 'office' | 'action' | 'tools', lock = false, anchor: FlyoutAnchor = 'rail') => {
    // Clear any pending hover timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    setActiveTab(tabId);
    setFlyoutState(lock ? 'locked' : 'hovering');
    setFlyoutAnchor(anchor);
    
    // Reset highlighted index to first item
    setHighlightedIndex(0);
  }, [hoverTimeout]);

  const closeFlyout = useCallback(() => {
    // Only close if not locked
    if (flyoutState === 'locked') return;
    
    setActiveTab(null);
    setFlyoutState('closed');
    setHighlightedIndex(null);
  }, [flyoutState]);

  const forceCloseFlyout = useCallback(() => {
    setActiveTab(null);
    setFlyoutState('closed');
    setHighlightedIndex(null);
    setFlyoutAnchor('rail'); // Reset to default
  }, []);

  const lockFlyout = useCallback(() => {
    if (activeTab) {
      setFlyoutState('locked');
    }
  }, [activeTab]);

  const navigateToModule = useCallback((path: string) => {
    setLocation(path);
    forceCloseFlyout();
  }, [setLocation, forceCloseFlyout]);

  // Keyboard navigation within flyout
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!activeTab || flyoutState === 'closed') return;
    
    // Only handle Office, Action, and Tools tabs (they have flyouts)
    if (activeTab !== 'office' && activeTab !== 'action' && activeTab !== 'tools') return;

    const modules = TAB_GROUPS[activeTab].modules;
    const currentIndex = highlightedIndex ?? 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(Math.min(currentIndex + 1, modules.length - 1));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(Math.max(currentIndex - 1, 0));
        break;
        
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex !== null && modules[highlightedIndex]) {
          navigateToModule(modules[highlightedIndex].path);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        forceCloseFlyout();
        break;
        
      case 'ArrowRight':
        // Move to next flyout tab (Office -> Action -> Tools -> Office)
        e.preventDefault();
        const nextTab = activeTab === 'office' ? 'action' : activeTab === 'action' ? 'tools' : 'office';
        openFlyout(nextTab, flyoutState === 'locked', flyoutAnchor);
        break;
        
      case 'ArrowLeft':
        // Move to previous flyout tab (Tools -> Action -> Office -> Tools)
        e.preventDefault();
        const prevTab = activeTab === 'tools' ? 'action' : activeTab === 'action' ? 'office' : 'tools';
        openFlyout(prevTab, flyoutState === 'locked', flyoutAnchor);
        break;
    }
  }, [activeTab, flyoutState, flyoutAnchor, highlightedIndex, navigateToModule, forceCloseFlyout, openFlyout]);

  // Global keyboard shortcuts for tab switching
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + number for module shortcuts
      if (e.metaKey || e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        const matchingModule = ALL_MODULES.find(m => m.shortcut === e.key);
        if (matchingModule) {
          e.preventDefault();
          setLocation(matchingModule.path);
          forceCloseFlyout();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setLocation, forceCloseFlyout]);

  // Click outside to close locked flyout
  useEffect(() => {
    if (flyoutState !== 'locked') return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-desktop-nav]')) {
        forceCloseFlyout();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [flyoutState, forceCloseFlyout]);

  const contextValue = useMemo<DesktopNavContextValue>(() => ({
    activeTab,
    flyoutState,
    highlightedIndex,
    flyoutAnchor,
    openFlyout,
    closeFlyout,
    lockFlyout,
    setHighlightedIndex,
    navigateToModule,
    handleKeyDown,
  }), [
    activeTab,
    flyoutState,
    highlightedIndex,
    flyoutAnchor,
    openFlyout,
    closeFlyout,
    lockFlyout,
    navigateToModule,
    handleKeyDown,
  ]);

  return (
    <DesktopNavContext.Provider value={contextValue}>
      {children}
    </DesktopNavContext.Provider>
  );
}
