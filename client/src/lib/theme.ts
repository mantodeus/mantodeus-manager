/**
 * Theme System for Mantodeus Manager
 * 
 * A production-ready theme system with two named themes:
 * - Green Mantis (Dark Mode): Inspired by Exodus wallet, night operations
 * - Orchid Mantis (Light Mode): Inspired by orchid mantis, daylight clarity
 * 
 * All tokens use CSS variables for runtime theme switching.
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
  
  // Accent system (gradients)
  accentStart: string;
  accentMid: string;
  accentEnd: string;
  accentGradient: string;
  accentForeground: string;
  
  // Borders & dividers
  borderSubtle: string;
  borderStrong: string;
  
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
 * Mood: Dark, engineered, calm, powerful
 */
export const greenMantisTheme: ThemeConfig = {
  name: 'green-mantis',
  displayName: 'Green Mantis',
  description: 'Optimised for focus and low-light work',
  tokens: {
    // Background layers - near-black with blue tint
    bgApp: 'linear-gradient(180deg, oklch(0.08 0.01 240) 0%, oklch(0.10 0 0) 100%)',
    bgPage: 'oklch(0.10 0 0)',
    bgSurface: '#0D0E10',
    bgElevated: 'oklch(0.12 0 0)',
    
    // Typography - no pure white
    textPrimary: 'oklch(0.78 0 0)',
    textSecondary: 'oklch(0.65 0 0)',
    textMuted: 'oklch(0.50 0 0)',
    textDisabled: 'oklch(0.35 0 0)',
    
    // Accent - Mantis green gradient
    accentStart: '#0CF57E',
    accentMid: '#2BFFA0',
    accentEnd: '#07C964',
    accentGradient: 'linear-gradient(135deg, #0CF57E 0%, #2BFFA0 50%, #07C964 100%)',
    accentForeground: 'oklch(0.1 0 0)',
    
    // Borders
    borderSubtle: 'oklch(0.15 0 0)',
    borderStrong: 'oklch(0.25 0 0)',
    
    // States
    stateInfo: 'oklch(0.65 0.20 240)',
    stateWarning: 'oklch(0.70 0.20 60)',
    stateDanger: 'oklch(0.60 0.25 25)',
    stateSuccess: 'oklch(0.65 0.20 155)',
    
    // Additional
    input: 'oklch(0.20 0 0)',
    ring: '#2BFFA0',
    radius: '0.5rem',
  },
};

/**
 * Orchid Mantis Theme (Light Mode)
 * Inspiration: Orchid mantis, daylight, clarity, craft
 * Mood: Light, warm, elegant, professional
 */
export const orchidMantisTheme: ThemeConfig = {
  name: 'orchid-mantis',
  displayName: 'Orchid Mantis',
  description: 'Designed for clarity and daylight use',
  tokens: {
    // Background layers - warm off-whites and beige
    bgApp: 'linear-gradient(180deg, oklch(0.96 0.01 60) 0%, oklch(0.98 0.005 50) 100%)',
    bgPage: 'oklch(0.98 0.005 50)',
    bgSurface: 'oklch(1.0 0 0)',
    bgElevated: 'oklch(0.99 0.005 50)',
    
    // Typography - no pure black
    textPrimary: 'oklch(0.20 0 0)',
    textSecondary: 'oklch(0.35 0 0)',
    textMuted: 'oklch(0.50 0 0)',
    textDisabled: 'oklch(0.65 0 0)',
    
    // Accent - Orchid pink gradient
    accentStart: '#FF4FA3',
    accentMid: '#FF78C7',
    accentEnd: '#E83D8C',
    accentGradient: 'linear-gradient(135deg, #FF4FA3 0%, #FF78C7 50%, #E83D8C 100%)',
    accentForeground: 'oklch(1.0 0 0)',
    
    // Borders
    borderSubtle: 'oklch(0.90 0.005 50)',
    borderStrong: 'oklch(0.80 0.01 50)',
    
    // States
    stateInfo: 'oklch(0.55 0.20 240)',
    stateWarning: 'oklch(0.60 0.20 60)',
    stateDanger: 'oklch(0.55 0.25 25)',
    stateSuccess: 'oklch(0.55 0.20 155)',
    
    // Additional
    input: 'oklch(0.95 0.005 50)',
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
  
  // Typography
  root.style.setProperty('--text-primary', theme.tokens.textPrimary);
  root.style.setProperty('--text-secondary', theme.tokens.textSecondary);
  root.style.setProperty('--text-muted', theme.tokens.textMuted);
  root.style.setProperty('--text-disabled', theme.tokens.textDisabled);
  
  // Accent system
  root.style.setProperty('--accent-start', theme.tokens.accentStart);
  root.style.setProperty('--accent-mid', theme.tokens.accentMid);
  root.style.setProperty('--accent-end', theme.tokens.accentEnd);
  root.style.setProperty('--accent-gradient', theme.tokens.accentGradient);
  root.style.setProperty('--accent-foreground', theme.tokens.accentForeground);
  
  // Borders
  root.style.setProperty('--border-subtle', theme.tokens.borderSubtle);
  root.style.setProperty('--border-strong', theme.tokens.borderStrong);
  
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
  
  // Store theme preference
  localStorage.setItem('mantodeus-theme', themeName);
  
  // Update data attribute for CSS selectors
  root.setAttribute('data-theme', themeName);
}

/**
 * Get current theme from localStorage or system preference
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
