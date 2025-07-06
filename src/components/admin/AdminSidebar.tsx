import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  Database,
  MessageSquare,
  ImageIcon,
  Bug,
  Shield,
  Building2
} from "lucide-react"

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface SidebarButtonProps {
  icon: React.ComponentType<any>;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  icon: Icon,
  label,
  active,
  onClick
}) => {
  return (
    <Button
      variant="ghost"
      className={`w-full justify-start gap-2 ${
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground'
      }`}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
};

const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  return (
    <div className="fixed left-0 top-0 z-40 h-screen w-64 bg-background border-r">
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Shield className="h-6 w-6 text-primary" />
          <span className="ml-2 text-lg font-semibold">Admin Panel</span>
        </div>
        
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-2">
            <SidebarButton
              icon={BarChart3}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => onTabChange('dashboard')}
            />
            
            <SidebarButton
              icon={Database}
              label="Entity Management"
              active={activeTab === 'entity-management'}
              onClick={() => onTabChange('entity-management')}
            />
            
            <SidebarButton
              icon={Building2}
              label="Entity Hierarchies"
              active={activeTab === 'entity-hierarchies'}
              onClick={() => onTabChange('entity-hierarchies')}
            />
            
            <SidebarButton
              icon={MessageSquare}
              label="Reviews"
              active={activeTab === 'reviews'}
              onClick={() => onTabChange('reviews')}
            />
            
            <SidebarButton
              icon={ImageIcon}
              label="Image Health"
              active={activeTab === 'image-health'}
              onClick={() => onTabChange('image-health')}
            />
            
            <SidebarButton
              icon={Bug}
              label="Debug Panel"
              active={activeTab === 'debug'}
              onClick={() => onTabChange('debug')}
            />
          </nav>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminSidebar;
