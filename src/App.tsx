
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
import MyStuffPage from '@/pages/MyStuffPage';
import SavedInsights from '@/pages/SavedInsights';
import Search from '@/pages/Search';
import EntityDetail from '@/pages/EntityDetail';
import PostView from '@/pages/PostView';
import RecommendationView from '@/pages/RecommendationView';
import TagPage from '@/pages/TagPage';
import ProductSearch from '@/pages/ProductSearch';
import PlacesPage from '@/pages/PlacesPage';
import ProductsPage from '@/pages/ProductsPage';
import BooksPage from '@/pages/BooksPage';
import MoviesPage from '@/pages/MoviesPage';
import FoodPage from '@/pages/FoodPage';
import AdminPortal from '@/pages/AdminPortal';
import AdminEntityEdit from '@/pages/admin/AdminEntityEdit';
import YourData from '@/pages/YourData';
import NotFound from '@/pages/NotFound';
import UserProfile from '@/pages/UserProfile';
import ResetPassword from '@/pages/ResetPassword';
import CompleteProfile from '@/pages/CompleteProfile';
import AccountDeleted from '@/pages/AccountDeleted';
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
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/complete-profile" element={
                    <ProtectedRoute>
                      <CompleteProfile />
                    </ProtectedRoute>
                  } />
                  <Route path="/account-deleted" element={<AccountDeleted />} />
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
                  <Route path="/my-stuff" element={
                    <ProtectedRoute>
                      <MyStuffPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/saved-insights" element={
                    <ProtectedRoute>
                      <SavedInsights />
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
                  <Route path="/entity/:parentSlug/:childSlug" element={
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
                  <Route path="/t/:hashtag" element={
                    <ProtectedRoute>
                      <TagPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/product-search/:query" element={
                    <ProtectedRoute>
                      <ProductSearch />
                    </ProtectedRoute>
                  } />
                  <Route path="/places" element={
                    <ProtectedRoute>
                      <PlacesPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/products" element={
                    <ProtectedRoute>
                      <ProductsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/books" element={
                    <ProtectedRoute>
                      <BooksPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/movies" element={
                    <ProtectedRoute>
                      <MoviesPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/food" element={
                    <ProtectedRoute>
                      <FoodPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminPortal />
                    </AdminRoute>
                  } />
                  <Route path="/admin/entities/:id/edit" element={
                    <AdminRoute>
                      <AdminEntityEdit />
                    </AdminRoute>
                  } />
                  <Route path="/your-data" element={
                    <ProtectedRoute>
                      <YourData />
                    </ProtectedRoute>
                  } />
                  <Route path="/u/:username" element={<UserProfile />} />
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
