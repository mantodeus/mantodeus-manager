/**
 * Desktop Navigation Constants
 * 
 * Module registry and visual constants for desktop Tab Rail + Flyout.
 * Mirrors mobile navigation structure for consistent mental model.
 */

import {
  FolderOpen,
  ClipboardCheck,
  DocumentCurrencyEuro,
  Receipt,
  FileText,
  File,
  Camera,
  Microphone,
  Calendar,
  Users,
  Image,
  MapPin,
  SettingsIcon,
  PencilSquareIcon,
  BugAnt,
  WrenchScrewdriver,
} from '@/components/ui/Icon';

import type { TabGroup, TabId } from './types';

/**
 * Tab definitions with icons
 */
export const TABS: { id: TabId; icon: typeof PencilSquareIcon; label: string }[] = [
  { id: 'office', icon: PencilSquareIcon, label: 'Office' },
  { id: 'action', icon: BugAnt, label: 'Action' },
  { id: 'tools', icon: WrenchScrewdriver, label: 'Tools' },
];

/**
 * Module registry - each module belongs to one tab group
 */
export const TAB_GROUPS: Record<TabId, TabGroup> = {
  office: {
    id: 'office',
    label: 'Office',
    icon: PencilSquareIcon,
    modules: [
      { id: 'projects', label: 'Projects', path: '/projects', icon: FolderOpen, shortcut: '1' },
      { id: 'inspections', label: 'Inspections', path: '/inspections', icon: ClipboardCheck, shortcut: '2' },
      { id: 'invoices', label: 'Invoices', path: '/invoices', icon: DocumentCurrencyEuro, shortcut: '3' },
      { id: 'expenses', label: 'Expenses', path: '/expenses', icon: Receipt, shortcut: '4' },
      { id: 'reports', label: 'Reports', path: '/reports', icon: FileText, shortcut: '5' },
      { id: 'notes', label: 'Notes', path: '/notes', icon: File, shortcut: '6' },
    ],
  },
  action: {
    id: 'action',
    label: 'Action',
    icon: BugAnt,
    modules: [
      { id: 'capto', label: 'Capture', path: '/action/capto', icon: Camera, shortcut: '7' },
      { id: 'voco', label: 'Record', path: '/action/voco', icon: Microphone, shortcut: '8' },
    ],
  },
  tools: {
    id: 'tools',
    label: 'Tools',
    icon: WrenchScrewdriver,
    modules: [
      { id: 'calendar', label: 'Calendar', path: '/calendar', icon: Calendar, shortcut: '9' },
      { id: 'contacts', label: 'Contacts', path: '/contacts', icon: Users, shortcut: '0' },
      { id: 'gallery', label: 'Gallery', path: '/gallery', icon: Image },
      { id: 'map', label: 'Maps', path: '/maps', icon: MapPin },
      { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
    ],
  },
};

/**
 * Flat list of all modules for keyboard shortcuts
 */
export const ALL_MODULES = [
  ...TAB_GROUPS.office.modules,
  ...TAB_GROUPS.action.modules,
  ...TAB_GROUPS.tools.modules,
];

/**
 * Visual constants for depth displacement (matching mobile)
 */
export const DEPTH_OFFSET = {
  ACTIVE: 12,      // Active module moves toward center
  NEIGHBOR_1: 6,   // First neighbors
  NEIGHBOR_2: 0,   // Distant items stay in place
} as const;

/**
 * Visual hierarchy (matching mobile)
 */
export const VISUAL_HIERARCHY = {
  ACTIVE: {
    opacity: 1,
    scale: 1.02,
  },
  NEIGHBOR: {
    opacity: 0.85,
  },
  DISTANT: {
    opacity: 0.6,
  },
} as const;

/**
 * Timing constants
 */
export const TIMING = {
  HOVER_DELAY: 150,        // Delay before flyout appears on hover
  FLYOUT_TRANSITION: 200,  // Flyout open/close animation
  ITEM_TRANSITION: 100,    // Individual item hover transition
} as const;

/**
 * Layout constants
 */
export const LAYOUT = {
  RAIL_WIDTH: 60,
  FLYOUT_WIDTH: 240,
} as const;
