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
    
    // States - functional colors (blue for info/buttons, muted for others)
    stateInfo: '#3B82F6',  // Blue for functional buttons (Mark as Sent, form submissions, etc.)
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
    
    // States - functional colors (blue for info/buttons, muted for others)
    stateInfo: '#3B82F6',  // Blue for functional buttons (Mark as Sent, form submissions, etc.)
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
 * Apply theme - sets data-theme attribute only
 * All CSS variables are defined in index.css using [data-theme] selectors
 */
export function applyTheme(themeName: ThemeName) {
  const root = document.documentElement;
  
  // Set data attribute for CSS selectors - this is the ONLY way themes are applied
  root.setAttribute('data-theme', themeName);
  
  // Store preference
  localStorage.setItem('mantodeus.theme', themeName);
  
  // Update theme-color meta tag for browser UI (mobile pull-to-refresh background)
  // Use neutral hex values that approximate the theme backgrounds
  let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  // Approximate hex values for oklch backgrounds (for meta tag compatibility)
  themeColorMeta.content = themeName === 'green-mantis' ? '#1A1A1A' : '#FAFAF8';
  
  // Set HTML and body background colors for off-screen areas (browser chrome, mobile pull-to-refresh, iOS status bar)
  // Use neutral hex values that match the oklch background colors exactly
  // Light: oklch(0.985 0.004 95) ≈ #FAFAF8
  // Dark: oklch(0.10 0 0) ≈ #1A1A1A
  const bgColor = themeName === 'green-mantis' ? '#1A1A1A' : '#FAFAF8';
  // Set on html element for off-screen scroll areas (works in both web and PWA)
  root.style.setProperty('background-color', bgColor, 'important');
  // Set on body element as well
  if (document.body) {
    document.body.style.setProperty('background-color', bgColor, 'important');
  }
  // Also set on #root to ensure consistency
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.style.setProperty('background-color', bgColor, 'important');
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
