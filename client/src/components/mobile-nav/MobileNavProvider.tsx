/**
 * Mobile Navigation Provider
 *
 * Context provider for mobile navigation state.
 * § 2.2: Default State - App opens into Site tab
 * § 14: Component Structure
 */

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import type {
  MobileNavContextValue,
  TabId,
  GestureState,
  Point,
} from './types';

const MobileNavContext = createContext<MobileNavContextValue | undefined>(
  undefined
);

const ACTIVE_TAB_KEY = 'mantodeus-active-tab';
const LAST_USED_MODULE_KEY = 'mantodeus-last-used-module-by-tab';

// Load persisted state from localStorage
function loadPersistedState(): {
  activeTab: TabId;
  lastUsedModuleByTab: Record<TabId, string | null>;
} {
  try {
    const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    const savedModules = localStorage.getItem(LAST_USED_MODULE_KEY);
    
    const activeTab = (savedTab === 'office' || savedTab === 'site' || savedTab === 'tools')
      ? savedTab
      : 'site'; // Default to site
    
    const parsedModules = savedModules
      ? JSON.parse(savedModules)
      : {
          office: null,
          site: null,
          tools: null,
        };
    
    // Migrate 'field' key to 'site' if it exists (for backward compatibility)
    const lastUsedModuleByTab: Record<TabId, string | null> = {
      office: parsedModules.office ?? null,
      site: parsedModules.site ?? parsedModules.field ?? null,
      tools: parsedModules.tools ?? null,
    };
    
    return { activeTab, lastUsedModuleByTab };
  } catch (error) {
    console.warn('[MobileNav] Failed to load persisted state:', error);
    return {
      activeTab: 'site',
      lastUsedModuleByTab: {
        office: null,
        site: null,
        tools: null,
      },
    };
  }
}

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const persistedState = loadPersistedState();
  
  // § 2.2: Site is the default tab (not configurable), but restore from localStorage
  const [activeTab, setActiveTab] = useState<TabId>(persistedState.activeTab);

  // Use string literal to avoid potential enum initialization issues
  const [gestureState, setGestureState] = useState<GestureState>(
    'idle' as GestureState
  );

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const [pointerPosition, setPointerPosition] = useState<Point | null>(null);

  // Store the tab that initiated the current gesture (for immediate use before state updates)
  const [gestureTab, setGestureTab] = useState<TabId | null>(null);

  const [lastUsedModuleByTab, setLastUsedModuleByTab] = useState<
    Record<TabId, string | null>
  >(persistedState.lastUsedModuleByTab);

  // Persist activeTab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch (error) {
      console.warn('[MobileNav] Failed to save active tab:', error);
    }
  }, [activeTab]);

  // Persist lastUsedModuleByTab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LAST_USED_MODULE_KEY, JSON.stringify(lastUsedModuleByTab));
    } catch (error) {
      console.warn('[MobileNav] Failed to save last used modules:', error);
    }
  }, [lastUsedModuleByTab]);

  const setLastUsedModule = useCallback((tab: TabId, path: string) => {
    setLastUsedModuleByTab(prev => {
      if (prev[tab] === path) return prev;
      return {
        ...prev,
        [tab]: path,
      };
    });
  }, []);

  // Use string literals to avoid potential enum initialization issues during module evaluation
  const scrollerVisible =
    gestureState === 'hold_active' ||
    gestureState === 'dragging' ||
    gestureState === 'momentum' ||
    gestureState === 'snapping';

  const value: MobileNavContextValue = useMemo(() => ({
    activeTab,
    setActiveTab,
    gestureState,
    setGestureState,
    scrollerVisible,
    highlightedIndex,
    setHighlightedIndex,
    pointerPosition,
    setPointerPosition,
    lastUsedModuleByTab,
    setLastUsedModule,
    gestureTab,
    setGestureTab,
  }), [
    activeTab,
    gestureState,
    scrollerVisible,
    highlightedIndex,
    pointerPosition,
    lastUsedModuleByTab,
    setLastUsedModule,
    gestureTab,
  ]);

  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const context = useContext(MobileNavContext);
  if (context === undefined) {
    throw new Error('useMobileNav must be used within MobileNavProvider');
  }
  return context;
}
