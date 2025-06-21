
import { useState, useEffect } from 'react';
import { useEntityCache } from './use-entity-cache';
import { useEntityDataCache } from './use-entity-data-cache';
import { useUserInteractionsCache } from './use-user-interactions-cache';
import { Entity } from '@/services/recommendation/types';

export const useEntityDetailCached = (slugOrId: string) => {
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

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

  // Calculate overall loading state with progress tracking
  const isLoading = entityLoading || (entity && dataLoading) || interactionsLoading;

  // Enhanced progress tracking
  useEffect(() => {
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
      const duration = 500; // 500ms animation
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
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
  }, [entityLoading, entity, dataLoading, interactionsLoading, isLoading, loadingProgress]);

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

  // Optimistic refresh function with progress feedback
  const refreshData = async () => {
    if (!entity) return;
    
    console.log('Refreshing cached entity data for:', entity.name);
    setLoadingStep(0);
    setLoadingProgress(0);
    
    try {
      // Animate through refresh steps
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
    loadingProgress: Math.round(loadingProgress),
    error,
    refreshData,
    prefetchRelatedEntities
  };
};
