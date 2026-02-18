
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
  const [redirectToSlug, setRedirectToSlug] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntityData = async () => {
      console.log('🔍 Fetching entity data for slugOrId:', slugOrId);
      setIsLoading(true);
      setLoadingStep(0);
      setError(null);
      setRedirectToSlug(null);

      try {
        // Step 1: Fetch entity data first (required for entity ID)
        setLoadingStep(1);
        const fetchResult = await fetchEntityBySlug(slugOrId);
        
        if (!fetchResult.entity) {
          console.log('❌ Entity not found for:', slugOrId);
          setError('Entity not found');
          setIsLoading(false);
          return;
        }

        const entityData = fetchResult.entity;
        console.log('✅ Found entity data:', entityData);
        setEntity(entityData);

        // If matched via history, signal redirect needed
        if (fetchResult.matchedVia === 'history' && fetchResult.canonicalSlug) {
          console.log('🔄 Matched via history, redirect to:', fetchResult.canonicalSlug);
          setRedirectToSlug(fetchResult.canonicalSlug);
        }

        // Steps 2-4: Fetch recommendations, reviews, and stats in parallel
        setLoadingStep(2);
        console.log('🚀 Starting parallel data fetch for entity:', entityData.id);
        
        const [entityRecommendations, entityReviews, entityStats] = await Promise.all([
          fetchEntityRecommendations(entityData.id, user?.id || null),
          fetchEntityReviews(entityData.id, user?.id || null),
          getEntityStats(entityData.id)
        ]);

        console.log('✅ Parallel fetch completed');

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
      
      const [refreshedRecommendations, refreshedReviews, refreshedStats] = await Promise.all([
        fetchEntityRecommendations(entity.id, user?.id || null),
        fetchEntityReviews(entity.id, user?.id || null),
        getEntityStats(entity.id)
      ]);

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
    redirectToSlug,
    refreshData
  };
};
