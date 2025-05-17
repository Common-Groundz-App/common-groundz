
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchEntityBySlug, 
  fetchEntityRecommendations, 
  fetchEntityReviews, 
  getEntityStats 
} from '@/services/entityService';
import { Entity } from '@/services/recommendation/types';

export const useEntityDetail = (slug: string) => {
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntityData = async () => {
      console.log('Fetching entity data for slug:', slug);
      setIsLoading(true);
      setError(null);

      try {
        // Fetch entity data
        const entityData = await fetchEntityBySlug(slug);
        if (!entityData) {
          setError('Entity not found');
          setIsLoading(false);
          return;
        }

        console.log('Found entity data:', entityData);
        setEntity(entityData);

        // Fetch related content
        const results = await Promise.all([
          fetchEntityRecommendations(entityData.id, user?.id || null),
          fetchEntityReviews(entityData.id, user?.id || null),
          getEntityStats(entityData.id)
        ]);
        
        const [entityRecommendations, entityReviews, entityStats] = results;

        console.log('Entity detail hook received recommendations:', entityRecommendations.length);
        console.log('Entity detail hook received reviews:', entityReviews.length);
        console.log('Entity detail hook received stats:', entityStats);

        setRecommendations(entityRecommendations);
        setReviews(entityReviews);
        setStats(entityStats);
      } catch (err) {
        console.error('Error fetching entity data:', err);
        setError('Failed to load entity data');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchEntityData();
    }
  }, [slug, user?.id]);

  // Function to refresh data
  const refreshData = async () => {
    if (!entity) return;
    
    console.log('Refreshing entity data for:', entity.name);
    setIsLoading(true);
    
    try {
      const [refreshedRecommendations, refreshedReviews, refreshedStats] = await Promise.all([
        fetchEntityRecommendations(entity.id, user?.id || null),
        fetchEntityReviews(entity.id, user?.id || null),
        getEntityStats(entity.id)
      ]);

      console.log('Refresh received recommendations:', refreshedRecommendations.length);
      console.log('Refresh received reviews:', refreshedReviews.length);

      setRecommendations(refreshedRecommendations);
      setReviews(refreshedReviews);
      setStats(refreshedStats);
    } catch (err) {
      console.error('Error refreshing entity data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    entity,
    recommendations,
    reviews,
    stats,
    isLoading,
    error,
    refreshData
  };
};
