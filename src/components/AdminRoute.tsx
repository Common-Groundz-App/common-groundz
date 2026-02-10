
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/integrations/supabase/client';

type AdminRouteProps = {
  children: React.ReactNode;
};

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  return (
    <ProtectedRoute>
      <AdminAccessCheck user={user} isLoading={isLoading}>
        {children}
      </AdminAccessCheck>
    </ProtectedRoute>
  );
};

const AdminAccessCheck: React.FC<{
  user: any;
  isLoading: boolean;
  children: React.ReactNode;
}> = ({ user, isLoading, children }) => {
  const [adminStatus, setAdminStatus] = useState<'loading' | 'granted' | 'denied'>('loading');

  useEffect(() => {
    if (isLoading || !user?.email) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('is_admin_user', { user_email: user.email });
      if (cancelled) return;
      if (error || !data) {
        console.log('AdminRoute: Admin check failed, redirecting', error);
        setAdminStatus('denied');
      } else {
        console.log('AdminRoute: Admin access confirmed for:', user.email);
        setAdminStatus('granted');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email, isLoading]);

  if (isLoading || adminStatus === 'loading') {
    return <LoadingSpinner size="lg" text="Checking admin access..." className="min-h-screen flex items-center justify-center" />;
  }

  if (adminStatus === 'denied') {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
