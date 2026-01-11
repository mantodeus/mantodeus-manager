/**
 * Desktop Navigation Provider
 * 
 * Context provider for desktop Tab Rail + Flyout navigation state.
 */

import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import type { DesktopNavContextValue, TabId, FlyoutState } from './types';
import { TAB_GROUPS, ALL_MODULES, TIMING } from './constants';

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
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const openFlyout = useCallback((tabId: TabId, lock = false) => {
    // Clear any pending hover timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    setActiveTab(tabId);
    setFlyoutState(lock ? 'locked' : 'hovering');
    
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
        // Move to next tab group
        e.preventDefault();
        const tabOrder: TabId[] = ['office', 'action', 'tools'];
        const currentTabIndex = tabOrder.indexOf(activeTab);
        const nextTab = tabOrder[(currentTabIndex + 1) % tabOrder.length];
        openFlyout(nextTab, flyoutState === 'locked');
        break;
        
      case 'ArrowLeft':
        // Move to previous tab group
        e.preventDefault();
        const tabOrderL: TabId[] = ['office', 'action', 'tools'];
        const currentTabIndexL = tabOrderL.indexOf(activeTab);
        const prevTab = tabOrderL[(currentTabIndexL - 1 + tabOrderL.length) % tabOrderL.length];
        openFlyout(prevTab, flyoutState === 'locked');
        break;
    }
  }, [activeTab, flyoutState, highlightedIndex, navigateToModule, forceCloseFlyout, openFlyout]);

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
