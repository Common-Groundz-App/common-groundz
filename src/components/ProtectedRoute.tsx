
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  // Show loading state while authentication is being checked
  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading your account..." className="min-h-screen flex items-center justify-center" />;
  }

  // Redirect to landing page if user is not authenticated
  if (!user) {
    console.log("User not authenticated, redirecting to /");
    return <Navigate to="/" replace />;
  }

  // If user is authenticated, render the children
  console.log("User authenticated, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
