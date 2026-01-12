/**
 * Desktop Navigation Types
 * 
 * Type definitions for the desktop Tab Rail + Flyout navigation system.
 */

import type { IconComponent } from '@/components/ui/Icon';

/**
 * Tab group IDs
 * Desktop: office, tools, capto, voco, settings (action only exists for mobile)
 * Mobile: office, action, tools
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
 * Desktop nav context value
 */
export interface DesktopNavContextValue {
  // Current state
  activeTab: TabId | null;
  flyoutState: FlyoutState;
  highlightedIndex: number | null;
  
  // Actions
  openFlyout: (tabId: TabId, lock?: boolean) => void;
  closeFlyout: () => void;
  lockFlyout: () => void;
  setHighlightedIndex: (index: number | null) => void;
  navigateToModule: (path: string) => void;
  
  // Keyboard navigation
  handleKeyDown: (e: React.KeyboardEvent) => void;
}
