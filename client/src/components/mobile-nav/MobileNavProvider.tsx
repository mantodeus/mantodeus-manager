/**
 * Mobile Navigation Provider
 *
 * Context provider for mobile navigation state.
 * § 2.2: Default State - App opens into Field tab
 * § 14: Component Structure
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import type {
  MobileNavContextValue,
  TabId,
  GestureState,
  Point,
} from './types';

const MobileNavContext = createContext<MobileNavContextValue | undefined>(
  undefined
);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  // § 2.2: Field is the default tab (not configurable)
  const [activeTab, setActiveTab] = useState<TabId>('field');

  // Use string literal to avoid potential enum initialization issues
  const [gestureState, setGestureState] = useState<GestureState>(
    'idle' as GestureState
  );

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const [pointerPosition, setPointerPosition] = useState<Point | null>(null);

  const [lastUsedModuleByTab, setLastUsedModuleByTab] = useState<
    Record<TabId, string | null>
  >({
    office: null,
    field: null,
    tools: null,
  });

  const setLastUsedModule = (tab: TabId, path: string) => {
    setLastUsedModuleByTab(prev => ({
      ...prev,
      [tab]: path,
    }));
  };

  // Use string literals to avoid potential enum initialization issues during module evaluation
  const scrollerVisible =
    gestureState === 'hold_active' ||
    gestureState === 'dragging' ||
    gestureState === 'momentum' ||
    gestureState === 'snapping';

  const value: MobileNavContextValue = {
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
  };

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
