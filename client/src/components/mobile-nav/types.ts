/**
 * Mobile Navigation Constitution - Types
 *
 * TypeScript interfaces and types for the mobile navigation system.
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Tab ID type (Constitution: Bottom Tab Bar)
 */
export type TabId = 'office' | 'field' | 'tools';

/**
 * Gesture state machine
 */
export enum GestureState {
  IDLE = 'idle',
  HOLD_PENDING = 'hold_pending',
  HOLD_ACTIVE = 'hold_active',
  DRAGGING = 'dragging',
  MOMENTUM = 'momentum',
  SNAPPING = 'snapping',
  DISABLED = 'disabled', // Desktop mode
}

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
  icon: LucideIcon;
}

/**
 * Tab definition
 */
export interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
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
