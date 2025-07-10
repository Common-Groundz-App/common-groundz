
import React from 'react';
import { useParams } from 'react-router-dom';
import { EntityV3LayoutContainer } from './EntityV3LayoutContainer';
import { EntityV3Header } from './EntityV3Header';
import { EntityV3Hero } from './EntityV3Hero';
import { EntityV3ActionButtons } from './EntityV3ActionButtons';
import { useEntityDetailCached } from '@/hooks/use-entity-detail-cached';

export const EntityV3: React.FC = () => {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  
  const {
    entity,
    stats,
    isLoading,
    error
  } = useEntityDetailCached(slugOrId || '');

  if (error) {
    return (
      <EntityV3LayoutContainer>
        <div className="col-span-full flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Entity Not Found</h1>
            <p className="text-muted-foreground">
              The entity you're looking for doesn't exist or has been removed.
            </p>
          </div>
        </div>
      </EntityV3LayoutContainer>
    );
  }

  return (
    <EntityV3LayoutContainer>
      {/* Header Section */}
      <EntityV3Header
        entity={entity}
        parentEntity={entity?.parent_id ? { id: entity.parent_id, name: 'Parent' } as any : null}
        isLoading={isLoading}
      />

      {/* Hero Section */}
      <EntityV3Hero
        entity={entity}
        stats={stats}
        isLoading={isLoading}
      />

      {/* Action Buttons */}
      <EntityV3ActionButtons
        entityId={entity?.id || ''}
        entityName={entity?.name || ''}
        isLoading={isLoading}
      />

      {/* Placeholder for future content sections */}
      <div className="col-span-full">
        <div className="text-center py-12 text-muted-foreground">
          <p>More content sections will be added here...</p>
        </div>
      </div>
    </EntityV3LayoutContainer>
  );
};
