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
import { GestureState as GestureStateEnum } from './types';

const MobileNavContext = createContext<MobileNavContextValue | undefined>(
  undefined
);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  // § 2.2: Field is the default tab (not configurable)
  const [activeTab, setActiveTab] = useState<TabId>('field');

  const [gestureState, setGestureState] = useState<GestureState>(
    GestureStateEnum.IDLE
  );

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const [pointerPosition, setPointerPosition] = useState<Point | null>(null);

  const scrollerVisible =
    gestureState === GestureStateEnum.HOLD_ACTIVE ||
    gestureState === GestureStateEnum.DRAGGING ||
    gestureState === GestureStateEnum.MOMENTUM ||
    gestureState === GestureStateEnum.SNAPPING;

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
