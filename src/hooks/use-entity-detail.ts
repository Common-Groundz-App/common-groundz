
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
        // Step 1: Fetch entity data
        setLoadingStep(1);
        const entityData = await fetchEntityBySlug(slugOrId);
        if (!entityData) {
          console.log('❌ Entity not found for:', slugOrId);
          setError('Entity not found');
          setIsLoading(false);
          return;
        }

        console.log('✅ Found entity data:', entityData);
        setEntity(entityData);

        // Step 2: Fetch recommendations
        setLoadingStep(2);
        const entityRecommendations = await fetchEntityRecommendations(entityData.id, user?.id || null);
        console.log('Entity recommendations fetched:', entityRecommendations);
        setRecommendations(entityRecommendations);
        
        // Step 3: Fetch reviews
        setLoadingStep(3);
        const entityReviews = await fetchEntityReviews(entityData.id, user?.id || null);
        console.log('Entity reviews fetched:', entityReviews);
        if (entityReviews && entityReviews.length > 0) {
          console.log('Sample review structure:', JSON.stringify(entityReviews[0], null, 2));
        }
        setReviews(entityReviews);
        
        // Step 4: Fetch statistics
        setLoadingStep(4);
        const entityStats = await getEntityStats(entityData.id);
        console.log('Entity stats fetched:', entityStats);
        setStats(entityStats);

        console.log('Entity detail hook received recommendations:', entityRecommendations.length);
        console.log('Entity detail hook received reviews:', entityReviews.length);
        
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

  // Function to refresh data
  const refreshData = async () => {
    if (!entity) return;
    
    console.log('Refreshing entity data for:', entity.name);
    setIsLoading(true);
    setLoadingStep(1);
    
    try {
      setLoadingStep(2);
      const refreshedRecommendations = await fetchEntityRecommendations(entity.id, user?.id || null);
      
      setLoadingStep(3);
      const refreshedReviews = await fetchEntityReviews(entity.id, user?.id || null);
      
      setLoadingStep(4);
      const refreshedStats = await getEntityStats(entity.id);

      console.log('Refresh received recommendations:', refreshedRecommendations.length);
      console.log('Refresh received reviews:', refreshedReviews.length);
      
      if (refreshedReviews && refreshedReviews.length > 0) {
        console.log('Sample refreshed review structure:', JSON.stringify(refreshedReviews[0], null, 2));
      }

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
