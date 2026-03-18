
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ContentViewerProvider } from '@/contexts/ContentViewerContext';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';
import AuthInitializer from '@/components/AuthInitializer';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppProtectedRoute from '@/components/AppProtectedRoute';
import RequireCompleteProfile from '@/components/auth/RequireCompleteProfile';
import AdminRoute from '@/components/AdminRoute';
import Index from '@/pages/Index';
import Feed from '@/pages/Feed';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import ProfileRedirect from '@/components/ProfileRedirect';
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
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import CookiePolicy from '@/pages/CookiePolicy';
import OfflineBanner from '@/components/OfflineBanner';
import { preloadSounds } from '@/services/feedbackService';
import { Howl } from 'howler';
import { AuthPromptProvider } from '@/contexts/AuthPromptContext';
import { networkStatusService } from '@/services/networkStatusService';

/**
 * Global Error & Network Policy:
 * 1. Background queries fail silently — no destructive toasts
 * 2. User mutations (like, follow, post, delete) can show error toasts
 * 3. Never clear UI data on fetch failure — stale-while-revalidate
 * 4. All polling respects shared network state via useNetworkStatus()
 * 5. navigator.onLine only checked inside networkStatusService
 * 6. Only transport failures count toward offline detection
 */

// Wire React Query's online manager to our shared singleton
onlineManager.setEventListener((setOnline) => {
  return networkStatusService.subscribe(() => {
    setOnline(networkStatusService.getSnapshot().isOnline);
  });
});

// Create a client with global defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

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
              <AuthPromptProvider>
                <OfflineBanner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  {/* 
                    IMPORTANT: Do NOT use AppProtectedRoute here.
                    This route must be accessible to authenticated users
                    whose profile is incomplete (no username yet).
                    
                    RequireCompleteProfile with allowIncomplete ensures:
                    - Soft-deleted users are still caught and redirected
                    - Users without usernames can access this page
                  */}
                  <Route path="/complete-profile" element={
                    <ProtectedRoute>
                      <RequireCompleteProfile allowIncomplete>
                        <CompleteProfile />
                      </RequireCompleteProfile>
                    </ProtectedRoute>
                  } />
                  <Route path="/account-deleted" element={<AccountDeleted />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                  <Route path="/home" element={
                    <AppProtectedRoute>
                      <Feed />
                    </AppProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <AppProtectedRoute>
                      <ProfileRedirect />
                    </AppProtectedRoute>
                  } />
                  <Route path="/profile/:id" element={
                    <AppProtectedRoute>
                      <Profile />
                    </AppProtectedRoute>
                  } />
                  <Route path="/explore" element={
                    <AppProtectedRoute>
                      <Explore />
                    </AppProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <AppProtectedRoute>
                      <Settings />
                    </AppProtectedRoute>
                  } />
                  <Route path="/my-stuff" element={
                    <AppProtectedRoute>
                      <MyStuffPage />
                    </AppProtectedRoute>
                  } />
                  <Route path="/saved-insights" element={
                    <AppProtectedRoute>
                      <SavedInsights />
                    </AppProtectedRoute>
                  } />
                  <Route path="/search" element={
                    <AppProtectedRoute>
                      <Search />
                    </AppProtectedRoute>
                  } />
                  <Route path="/search/:query" element={
                    <AppProtectedRoute>
                      <Search />
                    </AppProtectedRoute>
                  } />
                  <Route path="/entity/:slug" element={<EntityDetail />} />
                  <Route path="/entity/:parentSlug/:childSlug" element={<EntityDetail />} />
                  <Route path="/post/:postId" element={<PostView />} />
                  <Route path="/recommendations/:recommendationId" element={<RecommendationView />} />
                  <Route path="/t/:hashtag" element={
                    <AppProtectedRoute>
                      <TagPage />
                    </AppProtectedRoute>
                  } />
                  <Route path="/product-search/:query" element={
                    <AppProtectedRoute>
                      <ProductSearch />
                    </AppProtectedRoute>
                  } />
                  <Route path="/places" element={
                    <AppProtectedRoute>
                      <PlacesPage />
                    </AppProtectedRoute>
                  } />
                  <Route path="/products" element={
                    <AppProtectedRoute>
                      <ProductsPage />
                    </AppProtectedRoute>
                  } />
                  <Route path="/books" element={
                    <AppProtectedRoute>
                      <BooksPage />
                    </AppProtectedRoute>
                  } />
                  <Route path="/movies" element={
                    <AppProtectedRoute>
                      <MoviesPage />
                    </AppProtectedRoute>
                  } />
                  <Route path="/food" element={
                    <AppProtectedRoute>
                      <FoodPage />
                    </AppProtectedRoute>
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
                    <AppProtectedRoute>
                      <YourData />
                    </AppProtectedRoute>
                  } />
                  <Route path="/u/:username" element={<UserProfile />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthPromptProvider>
              </AuthInitializer>
            </Router>
            <Toaster />
            <SonnerToaster />
          </AuthErrorBoundary>
        </ContentViewerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
