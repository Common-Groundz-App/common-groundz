
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, session, isLoading } = useAuth();

  // Show loading state while authentication is being checked
  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading your account..." className="min-h-screen flex items-center justify-center" />;
  }

  // Enhanced authentication check with session validation
  if (!user || !session) {
    console.log('🚫 ProtectedRoute: No user or session, redirecting to landing page');
    return <Navigate to="/" replace />;
  }

  // Additional session validation with expiry check
  if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
    console.log('🚫 ProtectedRoute: Session expired, redirecting to landing page');
    return <Navigate to="/" replace />;
  }

  // Validate session integrity
  if (!session.access_token || !session.user) {
    console.log('🚫 ProtectedRoute: Invalid session structure, redirecting to landing page');
    return <Navigate to="/" replace />;
  }

  // Ensure user ID matches session user ID
  if (user.id !== session.user.id) {
    console.log('🚫 ProtectedRoute: User/session ID mismatch, redirecting to landing page');
    return <Navigate to="/" replace />;
  }

  console.log('✅ ProtectedRoute: User authenticated with valid session, rendering protected content');
  // If user is authenticated with valid session, render the children
  return <>{children}</>;
};

export default ProtectedRoute;
