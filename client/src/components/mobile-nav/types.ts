/**
 * Mobile Navigation Constitution - Types
 *
 * TypeScript interfaces and types for the mobile navigation system.
 * See: Mobile Navigation Constitution
 */

import type { LucideIcon } from 'lucide-react';

/**
 * Tab ID type (§ 2.1: Bottom Tab Bar)
 * Literal union ensures only valid tab IDs
 */
export type TabId = 'office' | 'field' | 'tools';

/**
 * Gesture state machine (§ 14: Component Structure)
 */
export enum GestureState {
  IDLE = 'idle',
  HOLD_PENDING = 'hold_pending',
  HOLD_ACTIVE = 'hold_active',
  FLICK_ACTIVE = 'flick_active',
  MOMENTUM = 'momentum',
  SNAPPING = 'snapping',
  DISABLED = 'disabled', // Desktop mode
}

/**
 * Flick direction (§ 5: Ergonomic Law)
 * Right flick = right scroller (thumb arc)
 * Left flick = left scroller (thumb arc)
 */
export type FlickDirection = 'left' | 'right' | null;

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
 * Mobile navigation context (§ 14: Component Structure)
 */
export interface MobileNavContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  gestureState: GestureState;
  setGestureState: (state: GestureState) => void;
  scrollerVisible: boolean;
  highlightedIndex: number | null;
  setHighlightedIndex: (index: number | null) => void;
  flickDirection: FlickDirection;
  setFlickDirection: (direction: FlickDirection) => void;
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
 * Device capabilities (§ 13.2: Performance Gating)
 */
export interface DeviceCapabilities {
  hasBlur: boolean;
  hasHaptics: boolean;
  hasSpringPhysics: boolean;
}
