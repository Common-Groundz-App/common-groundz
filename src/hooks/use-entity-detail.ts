
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchEntityBySlug, 
  fetchEntityRecommendations, 
  fetchEntityReviews, 
  getEntityStats 
} from '@/services/entityService';
import { Entity } from '@/services/recommendation/types';

export const useEntityDetail = (slugOrId: string) => {
  const { user } = useAuth();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  }>({
    recommendationCount: 0,
    reviewCount: 0,
    averageRating: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntityData = async () => {
      console.log('🔍 Fetching entity data for slugOrId:', slugOrId);
      setIsLoading(true);
      setLoadingStep(0);
      setError(null);

      try {
        // Step 1: Fetch entity data first (required for entity ID)
        setLoadingStep(1);
        const entityData = await fetchEntityBySlug(slugOrId, user?.id);
        if (!entityData) {
          console.log('❌ Entity not found or not accessible for:', slugOrId);
          setError('Entity not found or not accessible');
          setIsLoading(false);
          return;
        }

        console.log('✅ Found entity data:', entityData);
        setEntity(entityData);

        // Steps 2-4: Fetch recommendations, reviews, and stats in parallel
        setLoadingStep(2);
        console.log('🚀 Starting parallel data fetch for entity:', entityData.id);
        
        const [entityRecommendations, entityReviews, entityStats] = await Promise.all([
          fetchEntityRecommendations(entityData.id, user?.id || null),
          fetchEntityReviews(entityData.id, user?.id || null),
          getEntityStats(entityData.id)
        ]);

        console.log('✅ Parallel fetch completed');
        console.log('Entity recommendations fetched:', entityRecommendations.length);
        console.log('Entity reviews fetched:', entityReviews.length);
        console.log('Entity stats fetched:', entityStats);
        
        if (entityReviews && entityReviews.length > 0) {
          console.log('Sample review structure:', JSON.stringify(entityReviews[0], null, 2));
        }

        // Update all state at once after parallel fetch
        setRecommendations(entityRecommendations);
        setReviews(entityReviews);
        setStats(entityStats);
        
      } catch (err) {
        console.error('Error fetching entity data:', err);
        setError('Failed to load entity data');
      } finally {
        setIsLoading(false);
        setLoadingStep(0);
      }
    };

    if (slugOrId) {
      fetchEntityData();
    }
  }, [slugOrId, user?.id]);

  // Function to refresh data - also use parallel loading
  const refreshData = async () => {
    if (!entity) return;
    
    console.log('Refreshing entity data for:', entity.name);
    setIsLoading(true);
    setLoadingStep(1);
    
    try {
      setLoadingStep(2);
      console.log('🚀 Starting parallel refresh for entity:', entity.id);
      
      const [refreshedRecommendations, refreshedReviews, refreshedStats] = await Promise.all([
        fetchEntityRecommendations(entity.id, user?.id || null),
        fetchEntityReviews(entity.id, user?.id || null),
        getEntityStats(entity.id)
      ]);

      console.log('✅ Parallel refresh completed');
      console.log('Refresh received recommendations:', refreshedRecommendations.length);
      console.log('Refresh received reviews:', refreshedReviews.length);
      
      if (refreshedReviews && refreshedReviews.length > 0) {
        console.log('Sample refreshed review structure:', JSON.stringify(refreshedReviews[0], null, 2));
      }

      // Update all state at once after parallel refresh  
      setRecommendations(refreshedRecommendations);
      setReviews(refreshedReviews);
      setStats(refreshedStats);
    } catch (err) {
      console.error('Error refreshing entity data:', err);
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  return {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    loadingStep,
    error,
    refreshData
  };
};
