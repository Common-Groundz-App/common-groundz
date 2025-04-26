
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
  // Initialize with default values that don't depend on browser APIs
  const [theme, setTheme] = React.useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light');

  // Load saved theme after component mounts
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Check localStorage for saved theme
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
      
      // Check system preference for initial resolved theme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setResolvedTheme('dark');
      }
    } catch (error) {
      console.error("Error accessing browser APIs:", error);
    }
  }, []);

  // Apply theme to document
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
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
      console.error("Error applying theme:", error);
    }
  }, [theme]);

  // Listen for system theme changes
  React.useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') return;

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        if (typeof window === 'undefined') return;
        
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        const newTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.add(newTheme);
        setResolvedTheme(newTheme);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      console.error("Error setting up media query listener:", error);
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
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
