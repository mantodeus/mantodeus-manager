/**
 * Mobile Navigation Constitution - Constants
 *
 * This file contains all constitutional values for the mobile navigation system.
 * These values are legally binding and may only be changed through constitutional amendment.
 *
 * See: Mobile Navigation Constitution (Â§ 4, Â§ 8, Â§ 11)
 */

import {
  FolderOpen,
  FileCheck,
  Receipt,
  FileText,
  File,
  Users,
  ClipboardCheck,
  Image,
  MapPin,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  CloudSun,
  FileSpreadsheet,
  PencilRuler,
  HardHat,
  Wrench,
} from '@/components/ui/Icon';

/**
 * Mobile breakpoint (matches existing useMobile.tsx)
 * Â§ 1.1: Platform Sovereignty
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * Gesture configuration (Â§ 4.1: Activation Rule)
 * Hold duration: 250ms Â± 30ms
 */
export const GESTURE_CONFIG = {
  HOLD_DURATION: 250, // ms (constitutional)
  HOLD_TOLERANCE: 30, // Â± tolerance
  MOVEMENT_CANCEL_THRESHOLD: 10, // px (cancel if moved during hold)
  EDGE_DEAD_ZONE: 16, // px from screen edges (Â§ 14: Prohibitions)
  SCROLL_VELOCITY_CANCEL: 150, // px/s (cancel if scrolling)
  SAFE_ZONE_BOTTOM: 16, // px from bottom system swipe area
} as const;

/**
 * Depth displacement offsets (Â§ 8: Readability Law)
 * Offsets applied laterally toward screen center
 */
export const DEPTH_OFFSET = {
  ACTIVE: 28, // px (maximum displacement)
  NEIGHBOR_1: 14, // px (Â±1 from active)
  NEIGHBOR_2: 0, // px (Â±2+ from active)
} as const;

/**
 * Visual hierarchy values (Â§ 9: Visual Hierarchy)
 */
export const VISUAL_HIERARCHY = {
  ACTIVE: {
    scale: 1.08,
    opacity: 1.0,
  },
  NEIGHBOR: {
    scale: 1.0,
    opacity: 0.75,
  },
  DISTANT: {
    scale: 1.0,
    opacity: 0.35,
  },
} as const;

/**
 * Performance budgets (Â§ 11.1: Performance Law)
 * All values are testable requirements
 */
export const PERF_BUDGET = {
  gestureResponseTime: 16, // ms (< 1 frame at 60fps)
  scrollerRender: 150, // ms
  navigationTotal: 300, // ms (tap â†’ new screen)
  maxJankFrames: 2, // Maximum dropped frames per gesture
} as const;

/**
 * Tab definitions (Â§ 2.1: Bottom Tab Bar)
 * Exactly three tabs: Office, Field, Tools
 */
export const TABS = [
  { id: 'office' as const, icon: PencilRuler, label: 'Office' },
  { id: 'field' as const, icon: HardHat, label: 'Field' },
  { id: 'tools' as const, icon: Wrench, label: 'Tools' },
] as const;

// Compile-time assertion: exactly 3 tabs
type _AssertThreeTabs = typeof TABS extends readonly [any, any, any]
  ? true
  : never;

/**
 * Module registry (Â§ 3: Module Ownership)
 * Each module belongs to one and only one tab
 */
export const MODULE_REGISTRY = {
  office: [
    {
      id: 'invoices',
      label: 'Invoices',
      path: '/invoices',
      icon: FileCheck,
    },
    {
      id: 'expenses',
      label: 'Expenses',
      path: '/expenses',
      icon: Receipt,
    },
    {
      id: 'statements',
      label: 'Statements',
      path: '/statements',
      icon: FileSpreadsheet,
    },
    { id: 'reports', label: 'Reports', path: '/reports', icon: FileText },
  ],
  field: [
    {
      id: 'projects',
      label: 'Projects',
      path: '/projects',
      icon: FolderOpen,
    },
    {
      id: 'inspections',
      label: 'Inspections',
      path: '/inspections',
      icon: ClipboardCheck,
    },
    { id: 'gallery', label: 'Gallery', path: '/gallery', icon: Image },
    { id: 'notes', label: 'Notes', path: '/notes', icon: File },
  ],
  tools: [
    { id: 'map', label: 'Map', path: '/maps', icon: MapPin },
    {
      id: 'weather',
      label: 'Weather',
      path: '/weather',
      icon: CloudSun,
    },
    {
      id: 'contacts-tools',
      label: 'Contacts',
      path: '/contacts',
      icon: Users,
    },
    { id: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarIcon },
    {
      id: 'settings',
      label: 'Settings',
      path: '/settings',
      icon: SettingsIcon,
    }, // Always last
  ],
} as const;

/**
 * Haptic intent semantic contract (Â§ 13.2: Haptics)
 * Documents intent for future native implementation
 * Web implementation is logging-only (not implemented as vibration)
 */
export enum HapticIntent {
  HOLD_RECOGNIZED = 'light', // Gesture recognized
  MODULE_SNAP = 'medium', // Item locked in
  MODULE_SELECT = 'success', // Action confirmed
  EDGE_BOUNCE = 'warning', // Boundary reached
  TAB_SWITCH = 'selection', // Context changed
}

/**
 * Feature flags for phase control (Â§ 13.1: Phase Authority)
 */
export const FEATURES = {
  PHASE_1_CORE: true, // Always enabled
  PHASE_2_MOMENTUM: true, // âœ… Phase 2 enabled
  PHASE_2_BLUR: true, // âœ… Phase 2 enabled (device-gated)
  PHASE_2_SPRINGS: true, // âœ… Phase 2 enabled (device-gated)
  PHASE_3_DEEP_LINKING: false,
  PHASE_3_HAPTICS: false,
} as const;

/**
 * Dev-only features (Â§ 14: Easter Eggs)
 * NEVER ship to production
 */
export const DEV_FEATURES = {
  confetti: false, // Keep commented out
  particleTrails: false, // Fun for morale, not for users
  bounceCascade: false, // Premium = calm, not playful
} as const;

