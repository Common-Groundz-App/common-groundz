
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Index from './pages/Index';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import './App.css';
import { Toaster } from "./components/ui/toaster";
import { SearchDialog } from './components/SearchDialog';
import { TooltipProvider } from './components/ui/tooltip';

function App() {
  return (
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
          {/* Redirect old edit routes to profile */}
          <Route path="/recommendations/edit/:id" element={<Navigate to="/profile" />} />
          <Route path="/posts/edit/:id" element={<Navigate to="/profile" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SearchDialog open={false} onOpenChange={() => {}} />
        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
