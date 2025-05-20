
import React, { useEffect } from 'react';
import { EntityImageMigration } from '@/components/admin/EntityImageMigration';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, InfoIcon, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      <h1 className="text-3xl font-bold mb-4">Admin Tools</h1>
      
      <Alert variant="default" className="mb-8">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Admin Access</AlertTitle>
        <AlertDescription>
          These tools are for platform administrators only. Changes made here affect system-wide functionality.
        </AlertDescription>
      </Alert>
      
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Coming soon
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Coming soon
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between items-center">
            <div className="text-lg font-medium">Online</div>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">--</div>
            <p className="text-xs text-muted-foreground">
              Coming soon
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Entity Image Migration</h2>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              This tool downloads entity images to Supabase Storage and updates your database records 
              to point to the new reliable URLs.
            </AlertDescription>
          </Alert>
          <EntityImageMigration />
        </section>
      </div>
    </div>
  );
};

export default Admin;
