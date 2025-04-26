
import React, { createContext, useContext, useEffect, useState } from 'react';

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
  // Initialize with a default theme first
  const [theme, setTheme] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Now safely load the saved theme after initial render
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check localStorage for saved theme
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme);
    }
    
    // Check system preference for initial resolved theme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setResolvedTheme('dark');
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
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
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') return;

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
