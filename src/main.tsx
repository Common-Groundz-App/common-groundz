
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LocationProvider } from '@/contexts/LocationContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import './index.css';

// Make sure we have a root element before trying to render
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <PreferencesProvider>
      <LocationProvider>
        <App />
      </LocationProvider>
    </PreferencesProvider>
  </React.StrictMode>
);
