
import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Index from './pages/Index';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Explore from './pages/Explore';
import NotFound from './pages/NotFound';
import PostView from './pages/PostView';
import RecommendationView from './pages/RecommendationView';
import EntityDetail from './pages/EntityDetail';
import Admin from './pages/Admin'; // Add this import
import './App.css';
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './contexts/ThemeContext';
import { ContentViewerProvider } from './contexts/ContentViewerContext';
import ContentViewerModal from './components/content/ContentViewerModal';

function App() {
  return (
    <ThemeProvider>
      <ContentViewerProvider>
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
                path="/home" 
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
              <Route 
                path="/post/:postId" 
                element={
                  <ProtectedRoute>
                    <PostView />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/recommendation/:recommendationId" 
                element={
                  <ProtectedRoute>
                    <RecommendationView />
                  </ProtectedRoute>
                } 
              />
              {/* New route for entity details */}
              <Route 
                path="/entity/:slug" 
                element={
                  <EntityDetail />
                } 
              />
              {/* New admin route with protection */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
              {/* Redirect old edit routes to profile */}
              <Route path="/recommendations/edit/:id" element={<Navigate to="/profile" />} />
              <Route path="/posts/edit/:id" element={<Navigate to="/profile" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
            <ContentViewerModal />
          </TooltipProvider>
        </BrowserRouter>
      </ContentViewerProvider>
    </ThemeProvider>
  );
}

export default App;
