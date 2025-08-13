
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/contexts/AuthContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import AuthContextBoundary from '@/components/AuthContextBoundary';
import RenderProtection from '@/components/RenderProtection';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeStorageService } from '@/services/storageService';
import './index.css';

// Initialize storage service
initializeStorageService().catch(console.error);

// Make sure we have a root element before trying to render
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthContextBoundary>
      <AuthProvider>
        <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeProvider>
            <PreferencesProvider>
              <LocationProvider>
                <TooltipProvider>
                  <RenderProtection maxRenders={30} timeWindow={2000}>
                    <App />
                  </RenderProtection>
                </TooltipProvider>
              </LocationProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </NextThemeProvider>
      </AuthProvider>
    </AuthContextBoundary>
  </React.StrictMode>
);
