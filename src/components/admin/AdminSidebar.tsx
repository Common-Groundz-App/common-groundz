
import React from 'react';
import { Shield, BarChart3, Database, FileText } from 'lucide-react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const navigationItems = [
    {
      name: 'Overview',
      url: '#overview',
      icon: BarChart3,
      onClick: () => onTabChange('overview')
    },
    {
      name: 'Entity Management',
      url: '#entity-management',
      icon: Database,
      onClick: () => onTabChange('entity-management')
    },
    {
      name: 'Content Management',
      url: '#content-management',
      icon: FileText,
      onClick: () => onTabChange('content-management')
    }
  ];

  return (
    <VerticalTubelightNavbar
      items={navigationItems}
      initialActiveTab={activeTab}
      className="fixed left-0 top-0 h-screen pt-4 pl-4"
      rightSection={
        <div className="flex items-center gap-2 text-primary">
          <Shield className="h-4 w-4" />
          <span className="text-sm font-medium">Admin</span>
        </div>
      }
    />
  );
};

export default AdminSidebar;
