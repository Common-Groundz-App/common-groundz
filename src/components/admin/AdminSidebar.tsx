
import React, { useEffect, useState } from 'react';
import { Shield, BarChart3, Database, FileText, MessageSquare, Award, GitBranch, Users, HardDrive, ToggleRight, Gavel } from 'lucide-react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const [currentActiveTab, setCurrentActiveTab] = useState(activeTab);

  // Sync with parent activeTab changes
  useEffect(() => {
    setCurrentActiveTab(activeTab);
  }, [activeTab]);

  // Pending moderation count (refreshes every 60s)
  const { data: pendingCount } = useQuery({
    queryKey: ['admin-pending-entity-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_pending_entity_count');
      if (error) return 0;
      return (data as number) ?? 0;
    },
    refetchInterval: 60_000,
  });

  const navigationItems = [
    {
      name: 'Overview',
      url: '#overview',
      icon: BarChart3,
      onClick: () => { setCurrentActiveTab('Overview'); onTabChange('overview'); },
    },
    {
      name: 'Entity Management',
      url: '#entity-management',
      icon: Database,
      onClick: () => { setCurrentActiveTab('Entity Management'); onTabChange('entity-management'); },
    },
    {
      name: 'Moderation',
      url: '#moderation',
      icon: Gavel,
      badge: pendingCount && pendingCount > 0 ? pendingCount : undefined,
      onClick: () => { setCurrentActiveTab('Moderation'); onTabChange('moderation'); },
    },
    {
      name: 'Content Management',
      url: '#content-management',
      icon: FileText,
      onClick: () => { setCurrentActiveTab('Content Management'); onTabChange('content-management'); },
    },
    {
      name: 'Suggestions',
      url: '#suggestions-management',
      icon: MessageSquare,
      onClick: () => { setCurrentActiveTab('Suggestions'); onTabChange('suggestions-management'); },
    },
    {
      name: 'Brand Claims',
      url: '#brand-claims',
      icon: Award,
      onClick: () => { setCurrentActiveTab('Brand Claims'); onTabChange('brand-claims'); },
    },
    {
      name: 'Product Relationships',
      url: '#product-relationships',
      icon: GitBranch,
      onClick: () => { setCurrentActiveTab('Product Relationships'); onTabChange('product-relationships'); },
    },
    {
      name: 'User Management',
      url: '#user-management',
      icon: Users,
      onClick: () => { setCurrentActiveTab('User Management'); onTabChange('user-management'); },
    },
    {
      name: 'Media Cleanup',
      url: '#media-cleanup',
      icon: HardDrive,
      onClick: () => { setCurrentActiveTab('Media Cleanup'); onTabChange('media-cleanup'); },
    },
    {
      name: 'Feature Flags',
      url: '#feature-flags',
      icon: ToggleRight,
      onClick: () => { setCurrentActiveTab('Feature Flags'); onTabChange('feature-flags'); },
    },
  ];

  const getDisplayTabName = (tabName: string) => {
    switch (tabName) {
      case 'overview': return 'Overview';
      case 'entity-management': return 'Entity Management';
      case 'moderation': return 'Moderation';
      case 'content-management': return 'Content Management';
      case 'suggestions-management': return 'Suggestions';
      case 'brand-claims': return 'Brand Claims';
      case 'product-relationships': return 'Product Relationships';
      case 'user-management': return 'User Management';
      case 'media-cleanup': return 'Media Cleanup';
      case 'feature-flags': return 'Feature Flags';
      default: return 'Overview';
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 text-primary bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full border border-border">
        <Shield className="h-4 w-4" />
        <span className="text-sm font-medium">Admin</span>
      </div>

      <VerticalTubelightNavbar
        items={navigationItems}
        initialActiveTab={getDisplayTabName(activeTab)}
        className="fixed left-0 top-0 h-screen pt-4 pl-4"
      />
    </div>
  );
};

export default AdminSidebar;
