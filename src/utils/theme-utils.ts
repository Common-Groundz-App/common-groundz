
import { useTheme } from '@/contexts/ThemeContext';

/**
 * A collection of utility functions and values for consistent theming
 * throughout the application.
 */

/**
 * Returns the appropriate CSS class based on the current theme
 * @param lightClass Class to apply in light mode
 * @param darkClass Class to apply in dark mode
 * @returns The appropriate class based on the current theme
 */
export const useThemedClass = (lightClass: string, darkClass: string): string => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? darkClass : lightClass;
};

/**
 * Standard theme-aware style object for card components
 */
export const useCardStyles = () => {
  const { getThemedValue } = useTheme();
  
  return {
    // Common use cases for themed styling
    cardBackground: getThemedValue('bg-white', 'bg-card'),
    cardShadow: getThemedValue('shadow-md', 'shadow-lg shadow-black/20'),
    cardBorder: getThemedValue('border border-gray-100', 'border border-muted/30'),
    cardHover: getThemedValue('hover:bg-gray-50', 'hover:bg-accent/50'),
    
    // Text colors
    primaryText: 'text-foreground',
    secondaryText: 'text-muted-foreground',
    
    // Buttons
    primaryButton: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondaryButton: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outlineButton: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghostButton: 'hover:bg-accent hover:text-accent-foreground',
    
    // Standard rounds
    normalRounded: 'rounded-md',
    fullRounded: 'rounded-full',
    
    // Standard paddings
    smallPadding: 'p-2',
    mediumPadding: 'p-4',
    largePadding: 'p-6',
  };
};

/**
 * Theme-aware style object for text elements
 */
export const useTextStyles = () => {
  return {
    heading: 'text-foreground font-bold',
    subheading: 'text-foreground/90 font-medium',
    body: 'text-foreground',
    muted: 'text-muted-foreground',
    link: 'text-primary hover:underline',
  };
};

/**
 * Standard theme-aware color values for developers
 */
export const standardColors = {
  brand: {
    orange: 'hsl(24.6, 95%, 53.1%)',
    orangeLight: 'hsl(27.6, 100%, 71.4%)',
    orangeDark: 'hsl(21.3, 83.3%, 31.6%)',
  },
};
