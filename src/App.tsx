
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Index from './pages/Index';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Explore from './pages/Explore';
import NotFound from './pages/NotFound';
import './App.css';
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './contexts/ThemeContext';

// Helper component for dynamic redirects
const OldRecommendationRedirect = () => {
  const location = useLocation();
  const recommendationId = location.pathname.split('/').pop();
  return <Navigate to={`/profile?rec=${recommendationId}`} replace />;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/feed" 
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile/:userId" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/explore" 
              element={
                <ProtectedRoute>
                  <Explore />
                </ProtectedRoute>
              } 
            />
            {/* Redirect old recommendation URLs to profile with recommendation parameter */}
            <Route path="/recommendations/:id" element={<OldRecommendationRedirect />} />
            {/* Redirect old edit routes to profile */}
            <Route path="/recommendations/edit/:id" element={<Navigate to="/profile" />} />
            <Route path="/posts/edit/:id" element={<Navigate to="/profile" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </TooltipProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
