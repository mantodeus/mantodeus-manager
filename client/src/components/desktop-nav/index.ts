/**
 * Desktop Navigation System
 * 
 * Tab Rail + Flyout Scroller for desktop navigation.
 * Mirrors mobile navigation mental model with premium glass aesthetics.
 */

export { DesktopNavProvider, useDesktopNav } from './DesktopNavProvider';
export { DesktopNavRail } from './DesktopNavRail';
export { DesktopModuleFlyout } from './DesktopModuleFlyout';
export { DesktopBottomTabBar } from './DesktopBottomTabBar';
export { TAB_GROUPS, ALL_MODULES, TABS, LAYOUT } from './constants';
export type { TabId, Module, TabGroup, FlyoutState } from './types';
