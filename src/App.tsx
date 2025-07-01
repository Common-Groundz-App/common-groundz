
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ContentViewerProvider } from '@/contexts/ContentViewerContext';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';
import AuthInitializer from '@/components/AuthInitializer';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import Index from '@/pages/Index';
import Feed from '@/pages/Feed';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import Explore from '@/pages/Explore';
import Settings from '@/pages/Settings';
import Search from '@/pages/Search';
import EntityDetail from '@/pages/EntityDetail';
import PostView from '@/pages/PostView';
import RecommendationView from '@/pages/RecommendationView';
import ProductSearch from '@/pages/ProductSearch';
import AdminPortal from '@/pages/AdminPortal';
import NotFound from '@/pages/NotFound';
import { preloadSounds } from '@/services/feedbackService';
import { Howl } from 'howler';

// Create a client
const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Preload sounds on mount
    preloadSounds();

    // Unlock audio context on first user interaction
    const unlockAudio = () => {
      try {
        const silent = new Howl({ src: ['/sounds/like.mp3'], volume: 0 });
        silent.play();
        document.removeEventListener('click', unlockAudio);
      } catch (error) {
        console.error('Audio unlock failed:', error);
      }
    };

    document.addEventListener('click', unlockAudio);

    // Cleanup function to remove listener if component unmounts
    return () => {
      document.removeEventListener('click', unlockAudio);
    };
  }, []);

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
                  <Route path="/home" element={
                    <ProtectedRoute>
                      <Feed />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile/:id" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/explore" element={
                    <ProtectedRoute>
                      <Explore />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  } />
                  <Route path="/search" element={
                    <ProtectedRoute>
                      <Search />
                    </ProtectedRoute>
                  } />
                  <Route path="/search/:query" element={
                    <ProtectedRoute>
                      <Search />
                    </ProtectedRoute>
                  } />
                  <Route path="/entity/:slug" element={
                    <ProtectedRoute>
                      <EntityDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="/post/:postId" element={
                    <ProtectedRoute>
                      <PostView />
                    </ProtectedRoute>
                  } />
                  <Route path="/recommendations/:recommendationId" element={
                    <ProtectedRoute>
                      <RecommendationView />
                    </ProtectedRoute>
                  } />
                  <Route path="/product-search/:query" element={
                    <ProtectedRoute>
                      <ProductSearch />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminPortal />
                    </AdminRoute>
                  } />
                  <Route path="*" element={<NotFound />} />
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
