
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { checkAdminAccess } from '@/services/adminService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, BarChart3, FileText, Building2 } from 'lucide-react';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminReviewsList from '@/components/admin/AdminReviewsList';
import AdminEntitiesList from '@/components/admin/AdminEntitiesList';
import { useToast } from '@/hooks/use-toast';

const AdminPortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAdminAccess = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      try {
        const hasAccess = await checkAdminAccess();
        setIsAdmin(hasAccess);
        
        if (!hasAccess) {
          toast({
            title: 'Access Denied',
            description: 'You do not have admin privileges to access this portal.',
            variant: 'destructive'
          });
          navigate('/');
        }
      } catch (error) {
        console.error('Error verifying admin access:', error);
        setIsAdmin(false);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAdminAccess();
  }, [user, navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-8 w-8 mx-auto animate-pulse text-primary" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Admin Portal</h1>
              <p className="text-muted-foreground">
                Manage AI summaries and monitor system activity
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Administrator Access
          </Badge>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-2">
              <FileText className="h-4 w-4" />
              Dynamic Reviews
            </TabsTrigger>
            <TabsTrigger value="entities" className="gap-2">
              <Building2 className="h-4 w-4" />
              Entities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Dynamic Reviews Management</CardTitle>
                <CardDescription>
                  Manage AI summary generation for reviews with timeline data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminReviewsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entities">
            <Card>
              <CardHeader>
                <CardTitle>Entity Management</CardTitle>
                <CardDescription>
                  Manage AI summary generation for entities with dynamic reviews
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminEntitiesList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPortal;
