
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import NavBarComponent from '@/components/NavBarComponent';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminDashboardSummary } from '@/components/admin/AdminDashboardSummary';
import { AdminEntityManagementPanel } from '@/components/admin/AdminEntityManagementPanel';
import { AdminReviewsPanel } from '@/components/admin/AdminReviewsPanel';
import { AdminImageHealthPanel } from '@/components/admin/AdminImageHealthPanel';
import { AdminDebugPanel } from '@/components/admin/AdminDebugPanel';
import { EntityHierarchyPanel } from '@/components/admin/EntityHierarchyPanel';

const AdminPortal = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!user || !session) {
      console.log('AdminPortal: No authenticated user, redirecting to admin');
      navigate('/admin');
    }
  }, [user, session, navigate]);

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboardSummary />;
      case 'entity-management':
        return <AdminEntityManagementPanel />;
      case 'entity-hierarchies':
        return <EntityHierarchyPanel />;
      case 'reviews':
        return <AdminReviewsPanel />;
      case 'image-health':
        return <AdminImageHealthPanel />;
      case 'debug':
        return <AdminDebugPanel />;
      default:
        return <AdminDashboardSummary />;
    }
  };

  if (!user || !session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="xl:ml-64">
          <NavBarComponent />
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4">Admin Portal</h1>
            <p className="text-gray-500">
              You must be logged in to access the admin portal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="xl:ml-64">
        <NavBarComponent />
      </div>
      
      <div className="flex">
        <div className="hidden xl:block">
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        
        <div className="flex-1 xl:ml-64 min-w-0">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {renderActivePanel()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
