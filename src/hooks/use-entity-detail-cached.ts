
import { useState, useEffect } from 'react';
import { useEntityCache } from './use-entity-cache';
import { useEntityDataCache } from './use-entity-data-cache';
import { useUserInteractionsCache } from './use-user-interactions-cache';
import { Entity } from '@/services/recommendation/types';

export const useEntityDetailCached = (slugOrId: string) => {
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // Use cached entity data
  const { 
    entity, 
    isLoading: entityLoading, 
    error: entityError,
    prefetchEntity 
  } = useEntityCache({ slugOrId });

  // Use cached entity content (recommendations, reviews, stats)
  const {
    recommendations,
    reviews,
    stats,
    isLoading: dataLoading,
    error: dataError,
    prefetchEntityData
  } = useEntityDataCache({ 
    entityId: entity?.id || '', 
    enabled: !!entity?.id 
  });

  // Use cached user interactions
  const { interactions, isLoading: interactionsLoading } = useUserInteractionsCache();

  // Calculate overall loading state
  const isLoading = entityLoading || (entity && dataLoading) || interactionsLoading;

  // Handle errors
  useEffect(() => {
    if (entityError) {
      console.error('Entity error:', entityError);
      setError('Entity not found');
      return;
    }
    
    if (dataError) {
      console.error('Entity data error:', dataError);
      setError('Failed to load entity data');
      return;
    }

    setError(null);
  }, [entityError, dataError]);

  // Update loading steps for user feedback
  useEffect(() => {
    if (entityLoading) {
      setLoadingStep(1);
    } else if (entity && dataLoading) {
      setLoadingStep(2);
    } else if (!isLoading) {
      setLoadingStep(0);
    }
  }, [entityLoading, entity, dataLoading, isLoading]);

  // Refresh function that leverages cache invalidation
  const refreshData = async () => {
    if (!entity) return;
    
    console.log('Refreshing cached entity data for:', entity.name);
    setLoadingStep(1);
    
    try {
      // This will trigger a background refetch due to invalidation
      setLoadingStep(2);
      setError(null);
    } catch (err) {
      console.error('Error refreshing entity data:', err);
      setError('Failed to refresh data');
    } finally {
      setLoadingStep(0);
    }
  };

  // Prefetch related entities for performance
  const prefetchRelatedEntities = (relatedEntitySlugs: string[]) => {
    relatedEntitySlugs.forEach(slug => {
      prefetchEntity(slug);
    });
  };

  return {
    entity,
    recommendations,
    reviews,
    stats,
    interactions,
    isLoading,
    loadingStep,
    error,
    refreshData,
    prefetchRelatedEntities
  };
};
