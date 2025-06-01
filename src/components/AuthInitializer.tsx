
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthInitializerProps {
  children: React.ReactNode;
}

const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const { isLoading } = useAuth();

  console.log('🚀 [AuthInitializer] Render - isLoading:', isLoading);

  // Show full-screen loading until auth is completely ready
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Initializing application...</p>
        </div>
      </div>
    );
  }

  console.log('✅ [AuthInitializer] Auth ready, rendering app...');
  
  // Only render children when auth is fully initialized
  return <>{children}</>;
};

export default AuthInitializer;
