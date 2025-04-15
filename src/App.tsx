
import { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Feed from '@/pages/Feed';
import Profile from '@/pages/Profile';
import Explore from '@/pages/Explore';
import NotFound from '@/pages/NotFound';
import Settings from '@/pages/Settings';
import RecommendationDetail from '@/pages/RecommendationDetail';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from '@/components/ProtectedRoute';

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/recommendations/:id" element={<RecommendationDetail />} />
              <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
