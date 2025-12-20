/**
 * useTheme Hook
 * 
 * React hook for managing theme state and switching between themes.
 */

import { useState, useEffect } from 'react';
import { ThemeName, applyTheme, getCurrentTheme, themes } from '@/lib/theme';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(getCurrentTheme());

  useEffect(() => {
    // Apply theme on mount and when it changes
    applyTheme(theme);
  }, [theme]);

  const switchTheme = (newTheme: ThemeName) => {
    setTheme(newTheme);
  };

  return {
    theme,
    switchTheme,
    themes,
    currentThemeConfig: themes[theme],
  };
}
