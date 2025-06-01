
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ContentViewerProvider } from '@/contexts/ContentViewerContext';
import ProtectedRoute from '@/components/ProtectedRoute';
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
import ProductSearch from '@/pages/ProductSearch';
import ContentViewerModal from '@/components/content/ContentViewerModal';
import ProfileRedirect from '@/components/ProfileRedirect';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
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
              <Route
                path="/search/products/:query"
                element={
                  <ProtectedRoute>
                    <ProductSearch />
                  </ProtectedRoute>
                }
              />
              <Route path="/auth" element={<Auth />} />
              <Route path="/home" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
              <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfileRedirect /></ProtectedRoute>} />
              <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/post/:id" element={<ProtectedRoute><PostView /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/recommendations/:id" element={<ProtectedRoute><RecommendationView /></ProtectedRoute>} />
              
              {/* Entity routes - support all entity types with both old and new formats */}
              <Route path="/entity/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
              <Route path="/place/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
              <Route path="/movie/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
              <Route path="/book/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
              <Route path="/food/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
              <Route path="/product/:slug" element={<ProtectedRoute><EntityDetail /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ContentViewerModal />
            <Toaster />
          </ContentViewerProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
