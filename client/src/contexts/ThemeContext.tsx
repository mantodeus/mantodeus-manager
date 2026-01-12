import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeName, getCurrentTheme, applyTheme } from "@/lib/theme";

interface ThemeContextType {
  theme: ThemeName;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme,
  switchable = false,
}: ThemeProviderProps) {
  // Use unified theme system - read from mantodeus.theme key
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (switchable) {
      // Use the same key as theme.ts
      return getCurrentTheme();
    }
    // If not switchable, use default or get current theme
    return defaultTheme || getCurrentTheme();
  });

  useEffect(() => {
    // Apply theme when it changes (only if switchable)
    if (switchable) {
      applyTheme(theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        const newTheme: ThemeName = theme === 'green-mantis' ? 'orchid-mantis' : 'green-mantis';
        setTheme(newTheme);
        applyTheme(newTheme);
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
