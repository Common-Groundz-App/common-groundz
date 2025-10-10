import React from 'react';
import { NavBarComponent } from '@/components/NavBarComponent';
import { EntityDetailLoadingProgress } from '@/components/ui/entity-detail-loading-progress';

interface EntityV4LoadingWrapperProps {
  entityName?: string;
  entityType?: string;
}

export const EntityV4LoadingWrapper = ({ 
  entityName, 
  entityType = 'product' 
}: EntityV4LoadingWrapperProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation Bar - same as loaded state */}
      <NavBarComponent />
      
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
