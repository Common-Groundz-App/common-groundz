
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { Home } from '@/pages/Home';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import { Search } from '@/pages/Search';
import { Recommendations } from '@/pages/Recommendations';
import { RecommendationDetail } from '@/pages/RecommendationDetail';
import { CreateRecommendation } from '@/pages/CreateRecommendation';
import { EditRecommendation } from '@/pages/EditRecommendation';
import { PostDetail } from '@/pages/PostDetail';
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
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/profile/:username" element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/search" element={
                <ProtectedRoute>
                  <Layout>
                    <Search />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/recommendations" element={
                <ProtectedRoute>
                  <Layout>
                    <Recommendations />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/recommendations/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <RecommendationDetail />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/create-recommendation" element={
                <ProtectedRoute>
                  <Layout>
                    <CreateRecommendation />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/edit-recommendation/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <EditRecommendation />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/posts/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <PostDetail />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/t/:tag" element={
                <ProtectedRoute>
                  <Layout>
                    <TagPage />
                  </Layout>
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
