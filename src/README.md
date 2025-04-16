
# Common Groundz - Theming Guide

## Theme System

Our application uses Tailwind CSS with a coordinated theme system that automatically handles both light and dark modes. The theming is based on CSS variables that are defined in `index.css` and managed through the `ThemeContext`.

## Using the Theme System

### Basic Usage

Always use semantic color variables from Tailwind instead of hardcoded colors:

```tsx
// GOOD ✅ - Uses semantic theme colors
<div className="bg-background text-foreground">
  <p className="text-muted-foreground">This will adapt to theme changes</p>
</div>

// BAD ❌ - Hardcoded colors
<div className="bg-white text-black">
  <p className="text-gray-500">This won't adapt to dark mode</p>
</div>
```

### Theme Context

Use the `useTheme` hook to access the current theme:

```tsx
import { useTheme } from '@/contexts/ThemeContext';

const MyComponent = () => {
  const { theme, setTheme, resolvedTheme, isLightMode, isDarkMode } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>Resolved theme: {resolvedTheme}</p>
      
      {isLightMode && <p>This is only visible in light mode</p>}
      {isDarkMode && <p>This is only visible in dark mode</p>}
      
      <button onClick={() => setTheme('dark')}>Set Dark Theme</button>
      <button onClick={() => setTheme('light')}>Set Light Theme</button>
      <button onClick={() => setTheme('system')}>Use System Theme</button>
    </div>
  );
};
```

### Conditional Values Based on Theme

Use the `getThemedValue` function to switch values based on the current theme:

```tsx
import { useTheme } from '@/contexts/ThemeContext';

const MyComponent = () => {
  const { getThemedValue } = useTheme();
  
  const borderStyle = getThemedValue('border-gray-200', 'border-gray-700');
  const logoSrc = getThemedValue('/logo-light.png', '/logo-dark.png');
  
  return (
    <div className={`${borderStyle} p-4`}>
      <img src={logoSrc} alt="Logo" />
    </div>
  );
};
```

### Using Theme Utility Functions

We provide utility functions to help with theming:

```tsx
import { useCardStyles, useTextStyles, useThemedClass } from '@/utils/theme-utils';

const MyComponent = () => {
  const cardStyles = useCardStyles();
  const textStyles = useTextStyles();
  const containerClass = useThemedClass('bg-white', 'bg-gray-800');
  
  return (
    <div className={containerClass}>
      <div className={`${cardStyles.cardBackground} ${cardStyles.cardShadow} ${cardStyles.mediumPadding} ${cardStyles.normalRounded}`}>
        <h2 className={textStyles.heading}>Card Title</h2>
        <p className={textStyles.body}>This is some card content</p>
        <a href="#" className={textStyles.link}>Learn more</a>
      </div>
    </div>
  );
};
```

## Best Practices

1. **Use semantic color variables** - Always use Tailwind's semantic color classes like `bg-background`, `text-foreground`, etc.
2. **Use utility classes** - Take advantage of the utility classes in `index.css` like `.theme-card`, `.theme-accent`, etc.
3. **Use the theme utilities** - Use `useCardStyles`, `useTextStyles`, and `useThemedClass` for consistent styling
4. **Test in both modes** - Always test your components in both light and dark mode

## Component Examples

### Cards and Containers
```tsx
// Card example with proper theming
<div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-4">
  <h3 className="text-foreground font-bold">Card Title</h3>
  <p className="text-muted-foreground">Card content that respects the theme</p>
</div>
```

### Text Elements
```tsx
// Text with semantic colors
<div>
  <h1 className="text-foreground font-bold text-2xl">Main Heading</h1>
  <h2 className="text-foreground font-semibold text-xl">Subheading</h2>
  <p className="text-foreground">Regular text</p>
  <p className="text-muted-foreground">Muted text for less emphasis</p>
  <a href="#" className="text-primary hover:underline">Themed link</a>
</div>
```

### Buttons
```tsx
// Buttons with theming
<div className="space-y-2">
  <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
    Primary Button
  </button>
  <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md">
    Secondary Button
  </button>
  <button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md">
    Outline Button
  </button>
</div>
```

### Inputs
```tsx
// Inputs with theming
<div className="space-y-2">
  <label className="text-foreground">Name</label>
  <input 
    type="text" 
    className="bg-background border border-input rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-ring"
    placeholder="Enter your name" 
  />
</div>
```
