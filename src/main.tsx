
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

// Make sure we have a root element before trying to render
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Create a client with configuration to avoid unnecessary refetches
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetch when tab regains focus
      staleTime: 5 * 60 * 1000, // Data remains fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Cache persists for 10 minutes (replaced cacheTime)
    },
  },
});

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationProvider>
          <App />
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
