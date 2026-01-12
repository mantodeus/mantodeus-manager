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
  CloudSun,
} from '@/components/ui/Icon';

import type { TabGroup, TabId } from './types';

/**
 * Tab definitions with icons
 * Desktop: Office, Action, Tools (matching mobile mental model)
 */
export const TABS: { 
  id: TabId; 
  icon: typeof PencilSquareIcon; 
  label: string;
  type: 'flyout' | 'direct'; // flyout shows modules, direct navigates immediately
  path?: string; // for direct navigation
}[] = [
  { id: 'office', icon: PencilSquareIcon, label: 'Office', type: 'flyout' },
  { id: 'action', icon: BugAnt, label: 'Action', type: 'flyout' },
  { id: 'tools', icon: WrenchScrewdriver, label: 'Tools', type: 'flyout' },
];

/**
 * Module registry - Office, Action, and Tools all have flyouts on desktop
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
      { id: 'capto', label: 'Capture', path: '/action/capto', icon: Camera },
      { id: 'voco', label: 'Record', path: '/action/voco', icon: Microphone },
    ],
  },
  tools: {
    id: 'tools',
    label: 'Tools',
    icon: WrenchScrewdriver,
    modules: [
      { id: 'calendar', label: 'Calendar', path: '/calendar', icon: Calendar, shortcut: '7' },
      { id: 'contacts', label: 'Contacts', path: '/contacts', icon: Users, shortcut: '8' },
      { id: 'gallery', label: 'Gallery', path: '/gallery', icon: Image, shortcut: '9' },
      { id: 'map', label: 'Maps', path: '/maps', icon: MapPin, shortcut: '0' },
      { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
      { id: 'weather', label: 'Weather', path: '/weather', icon: CloudSun },
    ],
  },
  // Legacy tabs kept for type compatibility (not used in TABS array)
  capto: {
    id: 'capto',
    label: 'Capture',
    icon: Camera,
    modules: [],
  },
  voco: {
    id: 'voco',
    label: 'Record',
    icon: Microphone,
    modules: [],
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    modules: [],
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
