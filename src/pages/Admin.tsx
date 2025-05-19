
import React from 'react';
import { EntityImageMigration } from '@/components/admin/EntityImageMigration';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const Admin = () => {
  const { user } = useAuth();
  
  // Simple admin check - in a real app, you'd use roles
  // This is just a basic protection to avoid accidental access
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Admin Tools</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Entity Image Migration</h2>
          <EntityImageMigration />
        </section>
      </div>
    </div>
  );
};

export default Admin;
