
import React from 'react';
import { Entity } from '@/services/recommendation/types';
import { EntityV3SidebarActions } from './EntityV3SidebarActions';
import { EntityV3SidebarRelated } from './EntityV3SidebarRelated';
import { EntityV3SidebarActivity } from './EntityV3SidebarActivity';
import { EntityV3SidebarStats } from './EntityV3SidebarStats';
import { EntityV3SidebarPersonalized } from './EntityV3SidebarPersonalized';
import { useAuth } from '@/contexts/AuthContext';

interface EntityV3SidebarProps {
  entity: Entity;
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}

export const EntityV3Sidebar: React.FC<EntityV3SidebarProps> = ({ entity, stats }) => {
  const { user } = useAuth();

  return (
    <div className="lg:col-span-1 space-y-6">
      {/* Enhanced Quick Actions */}
      <EntityV3SidebarActions entity={entity} stats={stats} />
      
      {/* Personalized Recommendations */}
      <EntityV3SidebarPersonalized 
        userId={user?.id}
        entityId={entity.id}
      />
      
      {/* Related Entities */}
      <EntityV3SidebarRelated entity={entity} />
      
      {/* Recent Activity */}
      <EntityV3SidebarActivity entityId={entity.id} />
      
      {/* Analytics & Stats */}
      <EntityV3SidebarStats entityId={entity.id} />
    </div>
  );
};
