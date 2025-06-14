
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { AdminReviewsPanel } from '@/components/admin/AdminReviewsPanel';
import { AdminEntitiesPanel } from '@/components/admin/AdminEntitiesPanel';
import { AdminDashboardSummary } from '@/components/admin/AdminDashboardSummary';

const AdminPortal = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <NavBarComponent />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/home" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Feed
            </Link>
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Portal</h1>
          </div>
          <p className="text-muted-foreground">
            Administrative tools and controls for the platform
          </p>
        </div>

        <div className="space-y-6">
          {/* Admin Access Confirmation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Admin Access Confirmed
              </CardTitle>
              <CardDescription>
                You have successfully accessed the admin portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Logged in as:
                </p>
                <p className="font-mono text-sm">
                  {user?.email}
                </p>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>
                  This is Phase 4.5 of the admin system implementation. 
                  You can now manage dynamic reviews, their AI summaries, entity-level AI summaries, and perform bulk operations.
                </p>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Quick Actions:</p>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link to="/home">Return to Feed</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/settings">Settings</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Summary Section */}
          <AdminDashboardSummary />

          {/* Review Management Section */}
          <AdminReviewsPanel />

          {/* Entity AI Summaries Section */}
          <AdminEntitiesPanel />
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
