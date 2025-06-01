
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/contexts/AuthContext';
import AuthContextBoundary from '@/components/AuthContextBoundary';
import RenderProtection from '@/components/RenderProtection';
import { initializeStorageService } from '@/services/storageService';
import './index.css';

console.log('🚀 [main] Starting app initialization...');

// Initialize storage service
initializeStorageService().catch(console.error);

// Make sure we have a root element before trying to render
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);

console.log('🔧 [main] Rendering app without StrictMode...');

root.render(
  <RenderProtection maxRenders={30} timeWindow={2000}>
    <AuthContextBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AuthContextBoundary>
  </RenderProtection>
);
