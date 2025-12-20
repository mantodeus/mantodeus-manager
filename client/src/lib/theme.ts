/**
 * Theme System for Mantodeus Manager
 * 
 * A production-ready theme system with two named themes:
 * - Green Mantis (Dark Mode): Inspired by Exodus wallet, night operations
 * - Orchid Mantis (Light Mode): Inspired by orchid mantis, daylight clarity
 * 
 * All tokens use CSS variables for runtime theme switching.
 * Designed with professional depth, elevation, and premium polish.
 */

export type ThemeName = 'green-mantis' | 'orchid-mantis';

export interface ThemeConfig {
  name: ThemeName;
  displayName: string;
  description: string;
  tokens: ThemeTokens;
}

export interface ThemeTokens {
  // Background layers with proper depth
  bgApp: string;
  bgPage: string;
  bgSurface: string;
  bgElevated: string;
  bgSidebar: string;
  bgSidebarHover: string;
  
  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  textSidebar: string;
  textSidebarActive: string;
  
  // Accent system (gradients)
  accentStart: string;
  accentMid: string;
  accentEnd: string;
  accentGradient: string;
  accentForeground: string;
  accentSubtle: string;
  
  // Borders & dividers with proper contrast
  borderSubtle: string;
  borderStrong: string;
  borderSidebar: string;
  
  // Shadows for depth and elevation
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowSidebar: string;
  
  // States
  stateInfo: string;
  stateWarning: string;
  stateDanger: string;
  stateSuccess: string;
  
  // Additional UI tokens
  input: string;
  ring: string;
  radius: string;
}

/**
 * Green Mantis Theme (Dark Mode)
 * Inspiration: Exodus crypto wallet, night operations, precision, focus
 * Mood: Dark, engineered, calm, powerful with proper depth
 */
export const greenMantisTheme: ThemeConfig = {
  name: 'green-mantis',
  displayName: 'Green Mantis',
  description: 'Optimised for focus and low-light work',
  tokens: {
    // Background layers - near-black with blue tint and proper elevation
    bgApp: 'linear-gradient(180deg, oklch(0.08 0.01 240) 0%, oklch(0.09 0 0) 100%)',
    bgPage: 'oklch(0.09 0 0)',
    bgSurface: 'oklch(0.12 0 0)',
    bgElevated: 'oklch(0.14 0 0)',
    bgSidebar: 'oklch(0.07 0.005 240)',
    bgSidebarHover: 'oklch(0.10 0.005 240)',
    
    // Typography - no pure white, optimized hierarchy
    textPrimary: 'oklch(0.92 0 0)',
    textSecondary: 'oklch(0.70 0 0)',
    textMuted: 'oklch(0.52 0 0)',
    textDisabled: 'oklch(0.35 0 0)',
    textSidebar: 'oklch(0.75 0 0)',
    textSidebarActive: 'oklch(0.95 0 0)',
    
    // Accent - Mantis green gradient with subtle variant
    accentStart: '#0CF57E',
    accentMid: '#2BFFA0',
    accentEnd: '#07C964',
    accentGradient: 'linear-gradient(135deg, #0CF57E 0%, #2BFFA0 50%, #07C964 100%)',
    accentForeground: 'oklch(0.08 0 0)',
    accentSubtle: 'oklch(0.12 0.08 155)',
    
    // Borders with proper contrast
    borderSubtle: 'oklch(0.18 0 0)',
    borderStrong: 'oklch(0.28 0 0)',
    borderSidebar: 'oklch(0.12 0.005 240)',
    
    // Shadows for depth and premium feel
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
    shadowSidebar: '2px 0 8px 0 rgb(0 0 0 / 0.3)',
    
    // States
    stateInfo: 'oklch(0.65 0.20 240)',
    stateWarning: 'oklch(0.70 0.20 60)',
    stateDanger: 'oklch(0.60 0.25 25)',
    stateSuccess: 'oklch(0.65 0.20 155)',
    
    // Additional
    input: 'oklch(0.14 0 0)',
    ring: '#2BFFA0',
    radius: '0.5rem',
  },
};

/**
 * Orchid Mantis Theme (Light Mode)
 * Inspiration: Orchid mantis, daylight, clarity, craft
 * Mood: Light, warm, elegant, professional with proper depth
 */
export const orchidMantisTheme: ThemeConfig = {
  name: 'orchid-mantis',
  displayName: 'Orchid Mantis',
  description: 'Designed for clarity and daylight use',
  tokens: {
    // Background layers - warm off-whites and beige with proper elevation
    bgApp: 'linear-gradient(180deg, oklch(0.97 0.008 60) 0%, oklch(0.98 0.005 50) 100%)',
    bgPage: 'oklch(0.98 0.005 50)',
    bgSurface: 'oklch(1.0 0 0)',
    bgElevated: 'oklch(0.99 0.005 50)',
    bgSidebar: 'oklch(0.96 0.01 50)',
    bgSidebarHover: 'oklch(0.94 0.012 50)',
    
    // Typography - no pure black, optimized hierarchy
    textPrimary: 'oklch(0.18 0 0)',
    textSecondary: 'oklch(0.38 0 0)',
    textMuted: 'oklch(0.52 0 0)',
    textDisabled: 'oklch(0.65 0 0)',
    textSidebar: 'oklch(0.35 0 0)',
    textSidebarActive: 'oklch(0.15 0 0)',
    
    // Accent - Orchid pink gradient with subtle variant
    accentStart: '#FF4FA3',
    accentMid: '#FF78C7',
    accentEnd: '#E83D8C',
    accentGradient: 'linear-gradient(135deg, #FF4FA3 0%, #FF78C7 50%, #E83D8C 100%)',
    accentForeground: 'oklch(1.0 0 0)',
    accentSubtle: 'oklch(0.96 0.05 340)',
    
    // Borders with proper contrast
    borderSubtle: 'oklch(0.88 0.008 50)',
    borderStrong: 'oklch(0.78 0.012 50)',
    borderSidebar: 'oklch(0.90 0.01 50)',
    
    // Shadows for depth and premium feel
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
    shadowSidebar: '2px 0 8px 0 rgb(0 0 0 / 0.04)',
    
    // States
    stateInfo: 'oklch(0.55 0.20 240)',
    stateWarning: 'oklch(0.60 0.20 60)',
    stateDanger: 'oklch(0.55 0.25 25)',
    stateSuccess: 'oklch(0.55 0.20 155)',
    
    // Additional
    input: 'oklch(0.97 0.005 50)',
    ring: '#FF78C7',
    radius: '0.5rem',
  },
};

export const themes: Record<ThemeName, ThemeConfig> = {
  'green-mantis': greenMantisTheme,
  'orchid-mantis': orchidMantisTheme,
};

/**
 * Apply theme tokens to CSS variables
 */
export function applyTheme(themeName: ThemeName) {
  const theme = themes[themeName];
  const root = document.documentElement;
  
  // Background layers
  root.style.setProperty('--bg-app', theme.tokens.bgApp);
  root.style.setProperty('--bg-page', theme.tokens.bgPage);
  root.style.setProperty('--bg-surface', theme.tokens.bgSurface);
  root.style.setProperty('--bg-elevated', theme.tokens.bgElevated);
  root.style.setProperty('--bg-sidebar', theme.tokens.bgSidebar);
  root.style.setProperty('--bg-sidebar-hover', theme.tokens.bgSidebarHover);
  
  // Typography
  root.style.setProperty('--text-primary', theme.tokens.textPrimary);
  root.style.setProperty('--text-secondary', theme.tokens.textSecondary);
  root.style.setProperty('--text-muted', theme.tokens.textMuted);
  root.style.setProperty('--text-disabled', theme.tokens.textDisabled);
  root.style.setProperty('--text-sidebar', theme.tokens.textSidebar);
  root.style.setProperty('--text-sidebar-active', theme.tokens.textSidebarActive);
  
  // Accent system
  root.style.setProperty('--accent-start', theme.tokens.accentStart);
  root.style.setProperty('--accent-mid', theme.tokens.accentMid);
  root.style.setProperty('--accent-end', theme.tokens.accentEnd);
  root.style.setProperty('--accent-gradient', theme.tokens.accentGradient);
  root.style.setProperty('--accent-foreground', theme.tokens.accentForeground);
  root.style.setProperty('--accent-subtle', theme.tokens.accentSubtle);
  
  // Borders
  root.style.setProperty('--border-subtle', theme.tokens.borderSubtle);
  root.style.setProperty('--border-strong', theme.tokens.borderStrong);
  root.style.setProperty('--border-sidebar', theme.tokens.borderSidebar);
  
  // Shadows
  root.style.setProperty('--shadow-sm', theme.tokens.shadowSm);
  root.style.setProperty('--shadow-md', theme.tokens.shadowMd);
  root.style.setProperty('--shadow-lg', theme.tokens.shadowLg);
  root.style.setProperty('--shadow-sidebar', theme.tokens.shadowSidebar);
  
  // States
  root.style.setProperty('--state-info', theme.tokens.stateInfo);
  root.style.setProperty('--state-warning', theme.tokens.stateWarning);
  root.style.setProperty('--state-danger', theme.tokens.stateDanger);
  root.style.setProperty('--state-success', theme.tokens.stateSuccess);
  
  // Additional
  root.style.setProperty('--input', theme.tokens.input);
  root.style.setProperty('--ring', theme.tokens.ring);
  root.style.setProperty('--radius', theme.tokens.radius);
  
  // Map to existing Tailwind tokens for compatibility
  root.style.setProperty('--background', theme.tokens.bgPage);
  root.style.setProperty('--foreground', theme.tokens.textPrimary);
  root.style.setProperty('--card', theme.tokens.bgSurface);
  root.style.setProperty('--card-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--popover', theme.tokens.bgElevated);
  root.style.setProperty('--popover-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--primary', theme.tokens.accentMid);
  root.style.setProperty('--primary-foreground', theme.tokens.accentForeground);
  root.style.setProperty('--secondary', theme.tokens.bgElevated);
  root.style.setProperty('--secondary-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--muted', theme.tokens.bgElevated);
  root.style.setProperty('--muted-foreground', theme.tokens.textMuted);
  root.style.setProperty('--accent', theme.tokens.accentMid);
  root.style.setProperty('--accent-foreground', theme.tokens.accentForeground);
  root.style.setProperty('--destructive', theme.tokens.stateDanger);
  root.style.setProperty('--destructive-foreground', theme.tokens.accentForeground);
  root.style.setProperty('--border', theme.tokens.borderSubtle);
  
  // Sidebar tokens for shadcn/ui sidebar component
  root.style.setProperty('--sidebar', theme.tokens.bgSidebar);
  root.style.setProperty('--sidebar-foreground', theme.tokens.textSidebar);
  root.style.setProperty('--sidebar-primary', theme.tokens.accentMid);
  root.style.setProperty('--sidebar-primary-foreground', theme.tokens.accentForeground);
  root.style.setProperty('--sidebar-accent', theme.tokens.bgSidebarHover);
  root.style.setProperty('--sidebar-accent-foreground', theme.tokens.textSidebarActive);
  root.style.setProperty('--sidebar-border', theme.tokens.borderSidebar);
  root.style.setProperty('--sidebar-ring', theme.tokens.ring);
  
  // Store theme preference
  localStorage.setItem('mantodeus-theme', themeName);
  
  // Update data attribute for CSS selectors
  root.setAttribute('data-theme', themeName);
}

/**
 * Get current theme from localStorage or default
 */
export function getCurrentTheme(): ThemeName {
  const stored = localStorage.getItem('mantodeus-theme') as ThemeName | null;
  if (stored && themes[stored]) {
    return stored;
  }
  
  // Default to Green Mantis (dark mode)
  return 'green-mantis';
}

/**
 * Initialize theme on app load
 */
export function initializeTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
}
