/**
 * Mantodeus Manager Theme System
 * Production-grade theming with two named themes:
 * - Green Mantis (Dark Mode)
 * - Orchid Mantis (Light Mode)
 * 
 * All components MUST use CSS variables, never hard-coded colors.
 */

export type ThemeName = 'green-mantis' | 'orchid-mantis';

export interface ThemeConfig {
  name: ThemeName;
  displayName: string;
  description: string;
  tokens: ThemeTokens;
}

export interface ThemeTokens {
  // Background layers
  bgApp: string;
  bgPage: string;
  bgSurface: string;
  bgElevated: string;
  
  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  
  // Borders
  borderSubtle: string;
  borderStrong: string;
  
  // Accent system
  accentStart: string;
  accentMid: string;
  accentEnd: string;
  accentSolid: string;
  accentGradient: string;
  
  // States
  stateInfo: string;
  stateWarning: string;
  stateDanger: string;
  stateSuccess: string;
  
  // Overlays for lightboxes/modals
  overlayLight: string;
  overlayMedium: string;
  overlayHeavy: string;
  
  // Shadows
  shadowSoft: string;
  shadowElevated: string;
}

/**
 * Green Mantis Theme (Dark Mode)
 * Exodus-style depth with subtle blue-tinted gradients
 */
export const greenMantisTheme: ThemeConfig = {
  name: 'green-mantis',
  displayName: 'Green Mantis',
  description: 'Optimised for focus and low-light work',
  tokens: {
    // Backgrounds - Superwhisper-inspired deep blacks (matches example)
    bgApp: 'oklch(0.10 0 0)',
    bgPage: 'oklch(0.10 0 0)',
    bgSurface: 'oklch(0.12 0 0)',
    bgElevated: 'oklch(0.14 0 0)',
    
    // Typography - matches example
    textPrimary: 'oklch(0.95 0 0)',
    textSecondary: 'oklch(0.70 0 0)',
    textMuted: 'oklch(0.50 0 0)',
    textDisabled: 'oklch(0.40 0 0)',
    
    // Borders - matches example
    borderSubtle: 'oklch(0.20 0 0)',
    borderStrong: 'oklch(0.30 0 0)',
    
    // Accent - Mantis Green
    accentStart: '#0CF57E',
    accentMid: '#2BFFA0',
    accentEnd: '#07C964',
    accentSolid: '#0CF57E',
    accentGradient: 'linear-gradient(135deg, #0CF57E 0%, #2BFFA0 50%, #07C964 100%)',
    
    // States - muted palette (no blue in dark mode)
    stateInfo: 'oklch(0.70 0.15 200)',  // Muted blue-grey
    stateWarning: 'oklch(0.75 0.15 60)',
    stateDanger: 'oklch(0.70 0.15 25)',
    stateSuccess: 'oklch(0.70 0.15 150)',
    
    // Overlays
    overlayLight: 'rgba(0,0,0,0.4)',
    overlayMedium: 'rgba(0,0,0,0.7)',
    overlayHeavy: 'rgba(0,0,0,0.95)',
    
    // Shadows
    shadowSoft: '0 1px 3px 0 rgba(0,0,0,0.3)',
    shadowElevated: '0 4px 12px 0 rgba(0,0,0,0.4)',
  },
};

/**
 * Orchid Mantis Theme (Light Mode)
 * Warm, elegant with subtle pink-tinted gradients
 */
export const orchidMantisTheme: ThemeConfig = {
  name: 'orchid-mantis',
  displayName: 'Orchid Mantis',
  description: 'Designed for clarity and daylight use',
  tokens: {
    // Backgrounds - Superwhisper-inspired warm tint (matches example)
    bgApp: 'oklch(0.98 0.01 85)',
    bgPage: 'oklch(0.98 0.01 85)',
    bgSurface: 'oklch(0.96 0.01 85)',
    bgElevated: 'oklch(0.94 0.01 85)',
    
    // Typography - matches example
    textPrimary: 'oklch(0.20 0.01 85)',
    textSecondary: 'oklch(0.45 0.01 85)',
    textMuted: 'oklch(0.60 0.01 85)',
    textDisabled: 'oklch(0.70 0.01 85)',
    
    // Borders - matches example
    borderSubtle: 'oklch(0.88 0.01 85)',
    borderStrong: 'oklch(0.80 0.01 85)',
    
    // Accent - Orchid Pink (NO GREEN)
    accentStart: '#FF4FA3',
    accentMid: '#FF78C7',
    accentEnd: '#E83D8C',
    accentSolid: '#FF4FA3',
    accentGradient: 'linear-gradient(135deg, #FF4FA3 0%, #FF78C7 50%, #E83D8C 100%)',
    
    // States - muted palette
    stateInfo: 'oklch(0.65 0.15 200)',  // Muted blue-grey
    stateWarning: 'oklch(0.70 0.15 60)',
    stateDanger: 'oklch(0.65 0.15 25)',
    stateSuccess: 'oklch(0.65 0.15 150)',
    
    // Overlays
    overlayLight: 'rgba(28,31,35,0.3)',
    overlayMedium: 'rgba(28,31,35,0.6)',
    overlayHeavy: 'rgba(28,31,35,0.92)',
    
    // Shadows
    shadowSoft: '0 1px 3px 0 rgba(0,0,0,0.08)',
    shadowElevated: '0 4px 12px 0 rgba(0,0,0,0.12)',
  },
};

export const themes: Record<ThemeName, ThemeConfig> = {
  'green-mantis': greenMantisTheme,
  'orchid-mantis': orchidMantisTheme,
};

/**
 * Apply theme tokens to CSS variables on :root
 */
export function applyTheme(themeName: ThemeName) {
  const theme = themes[themeName];
  const root = document.documentElement;
  
  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', themeName);
  
  // Background layers
  root.style.setProperty('--bg-app', theme.tokens.bgApp);
  root.style.setProperty('--bg-page', theme.tokens.bgPage);
  root.style.setProperty('--bg-surface', theme.tokens.bgSurface);
  root.style.setProperty('--bg-elevated', theme.tokens.bgElevated);
  
  // Typography
  root.style.setProperty('--text-primary', theme.tokens.textPrimary);
  root.style.setProperty('--text-secondary', theme.tokens.textSecondary);
  root.style.setProperty('--text-muted', theme.tokens.textMuted);
  root.style.setProperty('--text-disabled', theme.tokens.textDisabled);
  
  // Borders
  root.style.setProperty('--border-subtle', theme.tokens.borderSubtle);
  root.style.setProperty('--border-strong', theme.tokens.borderStrong);
  
  // Accent system
  root.style.setProperty('--accent-start', theme.tokens.accentStart);
  root.style.setProperty('--accent-mid', theme.tokens.accentMid);
  root.style.setProperty('--accent-end', theme.tokens.accentEnd);
  root.style.setProperty('--accent-solid', theme.tokens.accentSolid);
  root.style.setProperty('--accent-gradient', theme.tokens.accentGradient);
  
  // States
  root.style.setProperty('--state-info', theme.tokens.stateInfo);
  root.style.setProperty('--state-warning', theme.tokens.stateWarning);
  root.style.setProperty('--state-danger', theme.tokens.stateDanger);
  root.style.setProperty('--state-success', theme.tokens.stateSuccess);
  
  // Overlays
  root.style.setProperty('--overlay-light', theme.tokens.overlayLight);
  root.style.setProperty('--overlay-medium', theme.tokens.overlayMedium);
  root.style.setProperty('--overlay-heavy', theme.tokens.overlayHeavy);
  
  // Shadows
  root.style.setProperty('--shadow-soft', theme.tokens.shadowSoft);
  root.style.setProperty('--shadow-elevated', theme.tokens.shadowElevated);
  
  // Map to existing Tailwind/shadcn tokens for compatibility
  root.style.setProperty('--background', theme.tokens.bgPage);
  root.style.setProperty('--foreground', theme.tokens.textPrimary);
  root.style.setProperty('--card', theme.tokens.bgSurface);
  root.style.setProperty('--card-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--popover', theme.tokens.bgElevated);
  root.style.setProperty('--popover-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--primary', theme.tokens.accentSolid);
  root.style.setProperty('--primary-foreground', themeName === 'green-mantis' ? 'oklch(0.10 0 0)' : 'oklch(0.98 0.01 85)');
  root.style.setProperty('--secondary', theme.tokens.bgElevated);
  root.style.setProperty('--secondary-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--muted', theme.tokens.bgElevated);
  root.style.setProperty('--muted-foreground', theme.tokens.textMuted);
  root.style.setProperty('--accent', theme.tokens.accentSolid);
  root.style.setProperty('--accent-foreground', themeName === 'green-mantis' ? 'oklch(0.10 0 0)' : 'oklch(0.98 0.01 85)');
  root.style.setProperty('--destructive', theme.tokens.stateDanger);
  root.style.setProperty('--destructive-foreground', '#FFFFFF');
  root.style.setProperty('--border', theme.tokens.borderSubtle);
  root.style.setProperty('--input', theme.tokens.bgSurface);
  root.style.setProperty('--ring', theme.tokens.accentSolid);
  root.style.setProperty('--radius', '0.5rem');
  
  // Sidebar tokens
  root.style.setProperty('--sidebar', theme.tokens.bgSurface);
  root.style.setProperty('--sidebar-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--sidebar-primary', theme.tokens.accentSolid);
  root.style.setProperty('--sidebar-primary-foreground', themeName === 'green-mantis' ? 'oklch(0.10 0 0)' : 'oklch(0.98 0.01 85)');
  root.style.setProperty('--sidebar-accent', theme.tokens.bgElevated);
  root.style.setProperty('--sidebar-accent-foreground', theme.tokens.textPrimary);
  root.style.setProperty('--sidebar-border', theme.tokens.borderSubtle);
  root.style.setProperty('--sidebar-ring', theme.tokens.accentSolid);
  
  // Store preference
  localStorage.setItem('mantodeus.theme', themeName);
  
  // Update theme-color meta tag for browser UI (mobile pull-to-refresh background)
  let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = theme.tokens.bgPage;
  
  // Set HTML and body background colors to match theme (for off-screen areas)
  root.style.backgroundColor = theme.tokens.bgPage;
  if (document.body) {
    document.body.style.backgroundColor = theme.tokens.bgPage;
  }
}

/**
 * Get current theme from localStorage or system preference
 */
export function getCurrentTheme(): ThemeName {
  const stored = localStorage.getItem('mantodeus.theme') as ThemeName | null;
  if (stored && themes[stored]) {
    return stored;
  }
  
  // Check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'green-mantis' : 'orchid-mantis';
  }
  
  // Default to Green Mantis
  return 'green-mantis';
}

/**
 * Initialize theme on app load
 */
export function initializeTheme() {
  const theme = getCurrentTheme();
  
  // Remove any .dark class from old theme system
  document.documentElement.classList.remove('dark');
  
  // Apply the new theme system
  applyTheme(theme);
  
  // Force immediate reflow to ensure CSS is applied
  document.documentElement.offsetHeight;
}
