
import React from 'react';
import { useParams } from 'react-router-dom';
import { useEntityDetailCached } from '@/hooks/use-entity-detail-cached';
import { EntityV3LayoutContainer } from '@/components/entity-v3/EntityV3LayoutContainer';
import { EntityV3Header } from '@/components/entity-v3/EntityV3Header';
import { EntityV3Hero } from '@/components/entity-v3/EntityV3Hero';
import { EntityV3Sidebar } from '@/components/entity-v3/EntityV3Sidebar';
import { EntityV3Content } from '@/components/entity-v3/EntityV3Content';
import { EntityV3LoadingState } from '@/components/entity-v3/EntityV3LoadingState';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';

const EntityDetailV3 = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    error,
    loadingProgress
  } = useEntityDetailCached(slug || '');

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Entity not found</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !entity) {
    return <EntityV3LoadingState progress={loadingProgress} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <EntityPreviewToggle />
      
      <EntityV3LayoutContainer>
        <EntityV3Header entity={entity} />
        
        <EntityV3Hero 
          entity={entity}
          stats={stats}
        />
        
        <EntityV3Content
          entity={entity}
          recommendations={recommendations}
          reviews={reviews}
        />
        
        <EntityV3Sidebar 
          entity={entity}
          stats={stats}
        />
      </EntityV3LayoutContainer>
    </div>
  );
};

export default EntityDetailV3;
