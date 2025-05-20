
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EntityImageMigration } from '@/components/admin/EntityImageMigration';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Check if the current user is an admin (basic check)
  const isAdmin = user?.email?.endsWith('@lovable.dev');
  
  // If not admin, show unauthorized message and redirect after a delay
  React.useEffect(() => {
    if (user && !isAdmin) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, navigate]);
  
  if (!user) {
    return <div>Loading...</div>;
  }
  
  if (!isAdmin) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Unauthorized Access</AlertTitle>
          <AlertDescription>
            You do not have permission to access the admin area. You will be redirected to the home page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-8">
        <LayoutDashboard className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Entity Image Migration</h2>
        <EntityImageMigration />
      </div>
    </div>
  );
};

export default Admin;
