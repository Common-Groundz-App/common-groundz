
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Index';
import Login from './pages/Auth';
import Signup from './pages/Auth';
import Profile from './pages/Profile';
import EditProfile from './pages/Settings';
import Explore from './pages/Explore';
import SearchResultsPage from './pages/Search';
import NotFound from './pages/NotFound';
import RecommendationDetail from './pages/RecommendationView';
import CreateRecommendation from './pages/Settings';
import EditRecommendation from './pages/Settings';
import { Toaster } from '@/components/ui/toaster';
import EntityDetail from './pages/EntityDetail';
import OptimizedEntityDetail from '@/pages/OptimizedEntityDetail';

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/search/products/:query" element={<SearchResultsPage />} />
            <Route path="/recommendation/:id" element={<RecommendationDetail />} />
            <Route path="/create-recommendation" element={<CreateRecommendation />} />
            <Route path="/edit-recommendation/:id" element={<EditRecommendation />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/entity/:slug" element={<OptimizedEntityDetail />} />
          </Routes>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
