
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  // Debug information
  React.useEffect(() => {
    console.log('ProtectedRoute state:', { isLoading, isAuthenticated: !!user });
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('User not authenticated, redirecting to auth page');
    return <Navigate to="/auth" replace />;
  }

  console.log('User authenticated, showing protected content');
  return <>{children}</>;
};

export default ProtectedRoute;
