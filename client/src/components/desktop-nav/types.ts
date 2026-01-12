/**
 * Desktop Navigation Types
 * 
 * Type definitions for the desktop Tab Rail + Flyout navigation system.
 */

import type { IconComponent } from '@/components/ui/Icon';

/**
 * Tab group IDs
 * Desktop: office, action, tools (matching mobile mental model)
 * Legacy: capto, voco, settings (kept for type compatibility, not used in TABS array)
 */
export type TabId = 'office' | 'action' | 'tools' | 'capto' | 'voco' | 'settings';

/**
 * Module definition
 */
export interface Module {
  id: string;
  label: string;
  path: string;
  icon: IconComponent;
  shortcut?: string;
}

/**
 * Tab group definition
 */
export interface TabGroup {
  id: TabId;
  label: string;
  icon: IconComponent;
  modules: Module[];
}

/**
 * Flyout state
 */
export type FlyoutState = 'closed' | 'hovering' | 'locked';

/**
 * Flyout anchor position
 */
export type FlyoutAnchor = 'rail' | 'bottom-bar';

/**
 * Desktop nav context value
 */
export interface DesktopNavContextValue {
  // Current state
  activeTab: TabId | null;
  flyoutState: FlyoutState;
  highlightedIndex: number | null;
  flyoutAnchor: FlyoutAnchor;
  
  // Actions
  openFlyout: (tabId: TabId, lock?: boolean, anchor?: FlyoutAnchor) => void;
  closeFlyout: () => void;
  lockFlyout: () => void;
  setHighlightedIndex: (index: number | null) => void;
  navigateToModule: (path: string) => void;
  
  // Keyboard navigation
  handleKeyDown: (e: React.KeyboardEvent) => void;
}
