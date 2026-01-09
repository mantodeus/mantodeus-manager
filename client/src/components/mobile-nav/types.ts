/**
 * Mobile Navigation Constitution - Types
 *
 * TypeScript interfaces and types for the mobile navigation system.
 */

import type { IconComponent } from '@/components/ui/Icon';

/**
 * Tab ID type (Constitution: Bottom Tab Bar)
 */
export type TabId = 'office' | 'site' | 'tools';

/**
 * Gesture state machine
 * Using union type instead of enum to avoid initialization issues
 */
export type GestureState =
  | 'idle'
  | 'hold_pending'
  | 'hold_active'
  | 'dragging'
  | 'momentum'
  | 'snapping'
  | 'disabled'; // Desktop mode

/**
 * Point coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Module definition
 */
export interface Module {
  id: string;
  label: string;
  path: string;
  icon: IconComponent;
}

/**
 * Tab definition
 */
export interface Tab {
  id: TabId;
  label: string;
  icon: IconComponent;
}

/**
 * Mobile navigation context
 */
export interface MobileNavContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  gestureState: GestureState;
  setGestureState: (state: GestureState) => void;
  scrollerVisible: boolean;
  highlightedIndex: number | null;
  setHighlightedIndex: (index: number | null) => void;
  pointerPosition: Point | null;
  setPointerPosition: (point: Point | null) => void;
  lastUsedModuleByTab: Record<TabId, string | null>;
  setLastUsedModule: (tab: TabId, path: string) => void;
  gestureTab: TabId | null;
  setGestureTab: (tab: TabId | null) => void;
}

/**
 * Gesture configuration
 */
export interface GestureConfig {
  holdDuration: number;
  holdTolerance: number;
  movementThreshold: number;
  edgeDeadZone: number;
  scrollVelocityCancel: number;
}

/**
 * Device capabilities
 */
export interface DeviceCapabilities {
  hasBlur: boolean;
  hasHaptics: boolean;
  hasSpringPhysics: boolean;
}
