
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ProtectedRoute from '@/components/ProtectedRoute';

type AdminRouteProps = {
  children: React.ReactNode;
};

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  // First ensure user is authenticated via ProtectedRoute
  return (
    <ProtectedRoute>
      <AdminAccessCheck user={user} isLoading={isLoading}>
        {children}
      </AdminAccessCheck>
    </ProtectedRoute>
  );
};

// Separate component for admin access check to avoid nesting issues
const AdminAccessCheck: React.FC<{
  user: any;
  isLoading: boolean;
  children: React.ReactNode;
}> = ({ user, isLoading, children }) => {
  
  // Show loading while checking auth
  if (isLoading) {
    return <LoadingSpinner size="lg" text="Checking admin access..." className="min-h-screen flex items-center justify-center" />;
  }

  // Check if user email ends with @lovable.dev
  const isAdmin = user?.email?.endsWith('@lovable.dev');

  if (!isAdmin) {
    console.log('AdminRoute: User does not have admin access, redirecting to home');
    return <Navigate to="/home" replace />;
  }

  console.log('AdminRoute: Admin access confirmed for:', user.email);
  return <>{children}</>;
};

export default AdminRoute;
