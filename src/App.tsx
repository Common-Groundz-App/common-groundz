import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from 'react-query';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Explore from './pages/Explore';
import SearchResultsPage from './pages/SearchResultsPage';
import NotFound from './pages/NotFound';
import RecommendationDetail from './pages/RecommendationDetail';
import CreateRecommendation from './pages/CreateRecommendation';
import EditRecommendation from './pages/EditRecommendation';
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
