
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchEntityBySlug, 
  fetchEntityRecommendations, 
  fetchEntityReviews, 
  getEntityStats 
} from '@/services/entityService';
import { findOrCreateEntity } from '@/services/recommendation/entityOperations';
import { Entity } from '@/services/recommendation/types';

interface OptimizedEntityState {
  entity: Entity | null;
  recommendations: any[];
  reviews: any[];
  stats: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
  isLoading: boolean;
  isInitialLoad: boolean;
  loadingStates: {
    entity: boolean;
    recommendations: boolean;
    reviews: boolean;
    stats: boolean;
  };
  error: string | null;
}

export const useOptimizedEntityDetail = (slugOrId: string) => {
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [state, setState] = useState<OptimizedEntityState>({
    entity: null,
    recommendations: [],
    reviews: [],
    stats: {
      recommendationCount: 0,
      reviewCount: 0,
      averageRating: null
    },
    isLoading: true,
    isInitialLoad: true,
    loadingStates: {
      entity: true,
      recommendations: true,
      reviews: true,
      stats: true,
    },
    error: null
  });

  const updateLoadingState = (key: keyof OptimizedEntityState['loadingStates'], value: boolean) => {
    setState(prev => ({
      ...prev,
      loadingStates: {
        ...prev.loadingStates,
        [key]: value
      }
    }));
  };

  // Optimized entity fetching with parallel operations
  useEffect(() => {
    if (!slugOrId) return;

    const fetchEntityData = async () => {
      // Cancel any previous requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      console.log('🚀 Starting optimized entity fetch for:', slugOrId);
      
      setState(prev => ({
        ...prev,
        isLoading: true,
        isInitialLoad: true,
        error: null,
        loadingStates: {
          entity: true,
          recommendations: true,
          reviews: true,
          stats: true,
        }
      }));

      try {
        // Step 1: Fetch entity first (critical path)
        console.log('🔍 Fetching entity data...');
        updateLoadingState('entity', true);
        
        const entityData = await fetchEntityBySlug(slugOrId);
        
        if (signal.aborted) return;
        
        if (!entityData) {
          console.log('❌ Entity not found for:', slugOrId);
          setState(prev => ({
            ...prev,
            error: 'Entity not found',
            isLoading: false,
            isInitialLoad: false,
            loadingStates: {
              entity: false,
              recommendations: false,
              reviews: false,
              stats: false,
            }
          }));
          return;
        }

        console.log('✅ Entity found:', entityData.name);
        
        // Update entity immediately to show basic info
        setState(prev => ({
          ...prev,
          entity: entityData,
          isInitialLoad: false
        }));
        updateLoadingState('entity', false);

        // Step 2: Fetch all related data in parallel (non-blocking)
        console.log('📊 Fetching related data in parallel...');
        
        const parallelFetches = [
          fetchEntityRecommendations(entityData.id, user?.id || null)
            .then(data => {
              if (!signal.aborted) {
                console.log('✅ Recommendations loaded:', data.length);
                setState(prev => ({ ...prev, recommendations: data }));
                updateLoadingState('recommendations', false);
              }
              return data;
            })
            .catch(err => {
              console.error('❌ Error loading recommendations:', err);
              updateLoadingState('recommendations', false);
              return [];
            }),
            
          fetchEntityReviews(entityData.id, user?.id || null)
            .then(data => {
              if (!signal.aborted) {
                console.log('✅ Reviews loaded:', data.length);
                setState(prev => ({ ...prev, reviews: data }));
                updateLoadingState('reviews', false);
              }
              return data;
            })
            .catch(err => {
              console.error('❌ Error loading reviews:', err);
              updateLoadingState('reviews', false);
              return [];
            }),
            
          getEntityStats(entityData.id)
            .then(data => {
              if (!signal.aborted) {
                console.log('✅ Stats loaded:', data);
                setState(prev => ({ ...prev, stats: data }));
                updateLoadingState('stats', false);
              }
              return data;
            })
            .catch(err => {
              console.error('❌ Error loading stats:', err);
              updateLoadingState('stats', false);
              return {
                recommendationCount: 0,
                reviewCount: 0,
                averageRating: null
              };
            })
        ];

        // Wait for all parallel operations to complete
        await Promise.allSettled(parallelFetches);

        if (!signal.aborted) {
          console.log('🎉 All entity data loaded successfully');
          setState(prev => ({ ...prev, isLoading: false }));
        }

      } catch (err) {
        if (!signal.aborted) {
          console.error('💥 Entity fetch error:', err);
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to load entity data',
            isLoading: false,
            isInitialLoad: false,
            loadingStates: {
              entity: false,
              recommendations: false,
              reviews: false,
              stats: false,
            }
          }));
        }
      }
    };

    fetchEntityData();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [slugOrId, user?.id]);

  // Fast refresh function for user actions
  const refreshData = async () => {
    if (!state.entity) return;
    
    console.log('🔄 Fast refresh for entity:', state.entity.name);
    
    // Don't show loading for refresh operations
    try {
      const [refreshedRecommendations, refreshedReviews, refreshedStats] = await Promise.allSettled([
        fetchEntityRecommendations(state.entity.id, user?.id || null),
        fetchEntityReviews(state.entity.id, user?.id || null),
        getEntityStats(state.entity.id)
      ]);

      setState(prev => ({
        ...prev,
        recommendations: refreshedRecommendations.status === 'fulfilled' ? refreshedRecommendations.value : prev.recommendations,
        reviews: refreshedReviews.status === 'fulfilled' ? refreshedReviews.value : prev.reviews,
        stats: refreshedStats.status === 'fulfilled' ? refreshedStats.value : prev.stats
      }));

      console.log('✅ Fast refresh completed');
    } catch (err) {
      console.error('❌ Fast refresh error:', err);
    }
  };

  return {
    ...state,
    refreshData
  };
};
