
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { EntityImageMigration } from '@/components/admin/EntityImageMigration';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

const Admin = () => {
  const { user, isLoading } = useAuth();
  
  // Check if user is loading
  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }
  
  // Check if user is not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Simple admin check - only users with @lovable.dev email can access
  const isAdmin = user?.email?.includes('@lovable.dev');
  
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access the admin area.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Entity Image Migration</h2>
          <p className="text-muted-foreground mb-6">
            Use this tool to migrate entity images to Supabase Storage for improved reliability.
          </p>
          
          <EntityImageMigration />
        </div>
      </div>
    </div>
  );
};

export default Admin;
