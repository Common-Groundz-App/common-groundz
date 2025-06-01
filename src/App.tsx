
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ContentViewerProvider } from '@/contexts/ContentViewerContext';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';

// Create a client
const queryClient = new QueryClient();

function App() {
  console.log('🏗️ [App] Rendering - Phase 1 Debug Mode');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ContentViewerProvider>
          <AuthErrorBoundary>
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="text-center space-y-4 p-8">
                <h1 className="text-2xl font-bold text-foreground">
                  🔧 Phase 1: AuthProvider Isolation Test
                </h1>
                <p className="text-muted-foreground">
                  Testing AuthProvider stability without routing...
                </p>
                <div className="text-sm text-muted-foreground">
                  Check console for AuthProvider logs
                </div>
              </div>
            </div>
            <Toaster />
          </AuthErrorBoundary>
        </ContentViewerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
