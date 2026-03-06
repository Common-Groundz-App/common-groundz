import React from 'react';
import { NavBarComponent } from '@/components/NavBarComponent';
import GuestNavBar from '@/components/profile/GuestNavBar';
import { EntityDetailLoadingProgress } from '@/components/ui/entity-detail-loading-progress';
import { useAuth } from '@/contexts/AuthContext';

interface EntityV4LoadingWrapperProps {
  entityName?: string;
  entityType?: string;
}

export const EntityV4LoadingWrapper = ({ 
  entityName, 
  entityType = 'product' 
}: EntityV4LoadingWrapperProps) => {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation Bar - match loaded state: GuestNavBar for guests, NavBarComponent for auth users */}
      {isLoading || !user ? <GuestNavBar /> : <NavBarComponent />}
      
      {/* Centered Loading Content */}
      <div className="flex-1 flex items-center justify-center">
        <EntityDetailLoadingProgress 
          entityName={entityName} 
          entityType={entityType}
        />
      </div>
    </div>
  );
};
