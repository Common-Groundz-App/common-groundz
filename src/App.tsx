
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import NavBarComponent from '@/components/NavBarComponent';
import { Search } from '@/pages/Search';
import { TagPage } from '@/pages/TagPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background">
                    <NavBarComponent />
                    <div className="pt-16">
                      <div className="text-center py-20">
                        <h1 className="text-4xl font-bold mb-4">Welcome</h1>
                        <p className="text-muted-foreground">Your feed will be here soon!</p>
                      </div>
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/search" element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background">
                    <NavBarComponent />
                    <div className="pt-16">
                      <Search />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
              
              <Route path="/t/:tag" element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background">
                    <NavBarComponent />
                    <div className="pt-16">
                      <TagPage />
                    </div>
                  </div>
                </ProtectedRoute>
              } />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
