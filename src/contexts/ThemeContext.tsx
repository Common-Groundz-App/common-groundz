
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  getThemedValue: <T>(lightValue: T, darkValue: T) => T;
  isLightMode: boolean;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Use safer initialization that won't break SSR or during initial render
  const [theme, setTheme] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  
  // Initialize theme from localStorage and system preference
  useEffect(() => {
    try {
      // Check localStorage first
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
      
      // Apply initial resolved theme
      if (savedTheme === 'system' || !savedTheme) {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(systemPrefersDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(savedTheme === 'dark' ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Error initializing theme:', error);
    }
  }, []);

  // Apply theme to document when theme changes
  useEffect(() => {
    try {
      const root = window.document.documentElement;
      
      // Remove any previous class
      root.classList.remove('light', 'dark');
      
      // Save to localStorage
      localStorage.setItem('theme', theme);

      // Apply theme
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
        setResolvedTheme(systemTheme);
      } else {
        root.classList.add(theme);
        setResolvedTheme(theme);
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        try {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          const newTheme = mediaQuery.matches ? 'dark' : 'light';
          root.classList.add(newTheme);
          setResolvedTheme(newTheme);
        } catch (error) {
          console.error('Error handling theme change:', error);
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      console.error('Error setting up system theme listener:', error);
    }
  }, [theme]);

  // Utility function to get the correct value based on current theme
  const getThemedValue = <T,>(lightValue: T, darkValue: T): T => {
    return resolvedTheme === 'dark' ? darkValue : lightValue;
  };
  
  // Helper booleans for simpler conditional logic in components
  const isLightMode = resolvedTheme === 'light';
  const isDarkMode = resolvedTheme === 'dark';

  const value = {
    theme,
    setTheme,
    resolvedTheme,
    getThemedValue,
    isLightMode,
    isDarkMode
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
