
import React, { useEffect } from 'react';
import { EntityImageMigration } from '@/components/admin/EntityImageMigration';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Show a toast when accessing the admin page without being logged in
  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to be logged in to access the Admin tools",
        variant: "destructive",
      });
    }
  }, [user, toast]);
  
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
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Make sure you've created an "entity-images" bucket in your Supabase project 
              and set it to public access before using this tool.
            </AlertDescription>
          </Alert>
          <EntityImageMigration />
        </section>
      </div>
    </div>
  );
};

export default Admin;
