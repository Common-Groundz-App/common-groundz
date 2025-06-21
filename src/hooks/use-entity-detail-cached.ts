
import { useState, useEffect } from 'react';
import { useEntityCache } from './use-entity-cache';
import { useEntityDataCache } from './use-entity-data-cache';
import { useUserInteractionsCache } from './use-user-interactions-cache';
import { Entity } from '@/services/recommendation/types';

export const useEntityDetailCached = (slugOrId: string, optimisticEntity?: any) => {
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isOptimisticCreation, setIsOptimisticCreation] = useState(false);

  // Check if this is an optimistic entity (temporary ID or optimistic flag)
  const isOptimistic = slugOrId.startsWith('temp-') || optimisticEntity?.isOptimistic;

  // Use cached entity data (skip for optimistic entities)
  const { 
    entity, 
    isLoading: entityLoading, 
    error: entityError,
    prefetchEntity 
  } = useEntityCache({ 
    slugOrId, 
    enabled: !isOptimistic // Disable for optimistic entities
  });

  // Use cached entity content (skip for optimistic entities initially)
  const {
    recommendations,
    reviews,
    stats,
    isLoading: dataLoading,
    error: dataError,
    prefetchEntityData
  } = useEntityDataCache({ 
    entityId: entity?.id || '', 
    enabled: !!entity?.id && !isOptimistic
  });

  // Use cached user interactions
  const { interactions, isLoading: interactionsLoading } = useUserInteractionsCache();

  // For optimistic entities, use optimistic data initially
  const displayEntity = isOptimistic ? optimisticEntity : entity;

  // Calculate overall loading state with progress tracking
  const isLoading = isOptimistic ? false : (entityLoading || (entity && dataLoading) || interactionsLoading);

  // Enhanced progress tracking with optimistic creation support
  useEffect(() => {
    if (isOptimistic) {
      setIsOptimisticCreation(true);
      setLoadingStep(1);
      setLoadingProgress(25);
      
      // Simulate progressive completion for optimistic entities
      const progressTimer = setTimeout(() => {
        setLoadingProgress(50);
      }, 1000);
      
      const completionTimer = setTimeout(() => {
        setLoadingProgress(100);
        setIsOptimisticCreation(false);
      }, 3000);
      
      return () => {
        clearTimeout(progressTimer);
        clearTimeout(completionTimer);
      };
    }
    
    // Regular progress tracking for existing entities
    let currentProgress = 0;
    let currentStep = 0;

    if (entityLoading) {
      currentStep = 0;
      currentProgress = 20;
    } else if (entity && dataLoading) {
      currentStep = 1;
      currentProgress = 60;
    } else if (interactionsLoading) {
      currentStep = 2;
      currentProgress = 80;
    } else if (!isLoading) {
      currentStep = 3;
      currentProgress = 100;
    }

    setLoadingStep(currentStep);
    
    // Animate progress smoothly
    const animateProgress = (target: number) => {
      const startProgress = loadingProgress;
      const duration = 500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startProgress + (target - startProgress) * easeOutQuart;
        
        setLoadingProgress(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    };
    
    animateProgress(currentProgress);
  }, [entityLoading, entity, dataLoading, interactionsLoading, isLoading, isOptimistic, loadingProgress]);

  // Handle errors (skip for optimistic entities)
  useEffect(() => {
    if (isOptimistic) return;
    
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
  }, [entityError, dataError, isOptimistic]);

  // Optimistic refresh function with progress feedback
  const refreshData = async () => {
    if (!displayEntity || isOptimistic) return;
    
    console.log('Refreshing cached entity data for:', displayEntity.name);
    setLoadingStep(0);
    setLoadingProgress(0);
    
    try {
      const refreshSteps = [
        { step: 1, progress: 30 },
        { step: 2, progress: 70 },
        { step: 3, progress: 100 }
      ];
      
      for (const { step, progress } of refreshSteps) {
        setLoadingStep(step);
        setLoadingProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error refreshing entity data:', err);
      setError('Failed to refresh data');
    } finally {
      setLoadingStep(0);
      setLoadingProgress(0);
    }
  };

  // Prefetch related entities for performance
  const prefetchRelatedEntities = (relatedEntitySlugs: string[]) => {
    if (isOptimistic) return; // Skip for optimistic entities
    
    relatedEntitySlugs.forEach(slug => {
      prefetchEntity(slug);
    });
  };

  return {
    entity: displayEntity,
    recommendations: isOptimistic ? [] : recommendations,
    reviews: isOptimistic ? [] : reviews,
    stats: isOptimistic ? null : stats,
    interactions,
    isLoading,
    isOptimisticCreation,
    loadingStep,
    loadingProgress: Math.round(loadingProgress),
    error,
    refreshData,
    prefetchRelatedEntities
  };
};
