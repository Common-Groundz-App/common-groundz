import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { AdminReviewsPanel } from '@/components/admin/AdminReviewsPanel';
import { AdminEntitiesPanel } from '@/components/admin/AdminEntitiesPanel';
import { AdminDashboardSummary } from '@/components/admin/AdminDashboardSummary';
import { AdminImageHealthPanel } from '@/components/admin/AdminImageHealthPanel';
import { AdminEntityManagementPanel } from '@/components/admin/AdminEntityManagementPanel';
import { AdminDebugPanel } from '@/components/admin/AdminDebugPanel';
import { AdminPhotoModerationPanel } from '@/components/admin/AdminPhotoModerationPanel';
import { AdminSuggestionsPanel } from '@/components/admin/AdminSuggestionsPanel';
import AdminSidebar from '@/components/admin/AdminSidebar';

const AdminPortal = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const renderOverviewContent = () => (
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
              This is Phase 5 of the admin system implementation. 
              You can now manage dynamic reviews, their AI summaries, entity-level AI summaries, 
              perform bulk operations, monitor image health, and manage entity image storage across all entities.
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

      {/* Debug Panel */}
      <AdminDebugPanel />

      {/* Dashboard Summary Section */}
      <AdminDashboardSummary />
    </div>
  );

  const renderEntityManagementContent = () => (
    <div className="space-y-6">
      {/* Entity Management Section */}
      <AdminEntityManagementPanel />

      {/* Image Health Monitoring Section */}
      <AdminImageHealthPanel />
    </div>
  );

  const renderContentManagementContent = () => (
    <div className="space-y-6">
      {/* Review Management Section */}
      <AdminReviewsPanel />

      {/* Entity AI Summaries Section */}
      <AdminEntitiesPanel />

      {/* Photo Moderation Section */}
      <AdminPhotoModerationPanel />
    </div>
  );

  const renderSuggestionsManagementContent = () => (
    <div className="space-y-6">
      {/* Entity Suggestions Section */}
      <AdminSuggestionsPanel />
    </div>
  );

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewContent();
      case 'entity-management':
        return renderEntityManagementContent();
      case 'content-management':
        return renderContentManagementContent();
      case 'suggestions-management':
        return renderSuggestionsManagementContent();
      default:
        return renderOverviewContent();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Horizontal Navbar - Offset by sidebar width on xl+ screens */}
      <div className="xl:ml-64">
        <NavBarComponent />
      </div>
      
      <div className="flex">
        {/* Admin Sidebar - Only show on xl+ screens */}
        <div className="hidden xl:block">
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        
        <div className="flex-1 xl:ml-64 min-w-0">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
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

            {/* Mobile Tab Navigation - Only show on mobile screens */}
            <div className="xl:hidden mb-6">
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('entity-management')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'entity-management'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Entities
                </button>
                <button
                  onClick={() => setActiveTab('content-management')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'content-management'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Content
                </button>
                <button
                  onClick={() => setActiveTab('suggestions-management')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'suggestions-management'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Suggestions
                </button>
              </div>
            </div>

            {/* Active Content */}
            {renderActiveContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
