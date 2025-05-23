
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ContentViewerProvider } from '@/contexts/ContentViewerContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Feed from '@/pages/Feed';
import Explore from '@/pages/Explore';
import Profile from '@/pages/Profile';
import PostView from '@/pages/PostView';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import RecommendationView from '@/pages/RecommendationView';
import EntityDetail from '@/pages/EntityDetail';
import Search from '@/pages/Search';
import ContentViewerModal from '@/components/content/ContentViewerModal';

// Create a client
const queryClient = new QueryClient();

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          // User is authenticated
          console.log('User is authenticated');
        } else {
          // User is not authenticated
          console.log('User is not authenticated');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthProvider>
      <Router>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ContentViewerProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <Search />
                    </ProtectedRoute>
                  }
                />
                <Route path="/auth" element={<Auth />} />
                <Route path="/home" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
                <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/post/:id" element={<ProtectedRoute><PostView /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/recommendations/:id" element={<ProtectedRoute><RecommendationView /></ProtectedRoute>} />
                <Route path="/places/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
                <Route path="/movies/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
                <Route path="/books/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
                <Route path="/food/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ContentViewerModal />
              <Toaster />
            </ContentViewerProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
