
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ContentViewerProvider } from '@/contexts/ContentViewerContext';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';
import AuthInitializer from '@/components/AuthInitializer';
import Index from '@/pages/Index';
import Feed from '@/pages/Feed';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import Explore from '@/pages/Explore';
import Settings from '@/pages/Settings';

// Create a client
const queryClient = new QueryClient();

function App() {
  console.log('🏗️ [App] Rendering - Phase 6.3 with Settings route added');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ContentViewerProvider>
          <AuthErrorBoundary>
            <Router>
              <AuthInitializer>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/home" element={<Feed />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:id" element={<Profile />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </AuthInitializer>
            </Router>
            <Toaster />
          </AuthErrorBoundary>
        </ContentViewerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
