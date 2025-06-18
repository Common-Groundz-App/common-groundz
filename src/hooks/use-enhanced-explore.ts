
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { enhancedExploreService, PersonalizedEntity } from '@/services/enhancedExploreService';

interface UseEnhancedExploreProps {
  category?: string;
  limit?: number;
  trackInteractions?: boolean;
  enableTemporalPersonalization?: boolean;
}

export const useEnhancedExplore = ({ 
  category, 
  limit = 6, 
  trackInteractions = true,
  enableTemporalPersonalization = true
}: UseEnhancedExploreProps = {}) => {
  const { user } = useAuth();
  const [featuredEntities, setFeaturedEntities] = useState<PersonalizedEntity[]>([]);
  const [trendingEntities, setTrendingEntities] = useState<PersonalizedEntity[]>([]);
  const [hiddenGems, setHiddenGems] = useState<PersonalizedEntity[]>([]);
  const [curatedCollections, setCuratedCollections] = useState<{ [key: string]: PersonalizedEntity[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const fetchEnhancedData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all data in parallel with enhanced algorithms
        const [featured, trending, gems, collections] = await Promise.all([
          enhancedExploreService.getPersonalizedFeaturedEntities(user?.id, 3),
          enhancedExploreService.getTrendingEntitiesByCategory(category, limit),
          enhancedExploreService.getHiddenGems(category, Math.min(3, limit)),
          enhancedExploreService.getCuratedCollections(category)
        ]);

        setFeaturedEntities(featured);
        setTrendingEntities(trending);
        setHiddenGems(gems);
        setCuratedCollections(collections);
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Error fetching enhanced explore data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnhancedData();
    
    // Auto-refresh data every 10 minutes if temporal personalization is enabled
    let intervalId: NodeJS.Timeout | null = null;
    if (enableTemporalPersonalization && user?.id) {
      intervalId = setInterval(fetchEnhancedData, 10 * 60 * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, category, limit, enableTemporalPersonalization]);

  // Enhanced function to track entity interactions with temporal context
  const trackEntityInteraction = async (
    entityId: string,
    entityType: string,
    entityCategory: string,
    interactionType: 'view' | 'like' | 'save' | 'click' = 'click'
  ) => {
    if (!trackInteractions || !user?.id) return;
    
    try {
      await enhancedExploreService.trackUserInteraction(
        user.id,
        entityId,
        entityType,
        entityCategory,
        interactionType
      );
      
      // Soft refresh featured entities after interaction to reflect changes
      if (interactionType === 'like' || interactionType === 'save') {
        setTimeout(() => {
          refreshFeaturedEntities();
        }, 1000);
      }
    } catch (error) {
      console.error('Error tracking entity interaction:', error);
    }
  };

  // Refresh only featured entities (faster than full refresh)
  const refreshFeaturedEntities = async () => {
    if (!user?.id) return;
    
    try {
      const featured = await enhancedExploreService.getPersonalizedFeaturedEntities(user.id, 3);
      setFeaturedEntities(featured);
    } catch (error) {
      console.error('Error refreshing featured entities:', error);
    }
  };

  // Force refresh all data
  const refreshData = async () => {
    setIsLoading(true);
    
    try {
      const [featured, trending, gems, collections] = await Promise.all([
        enhancedExploreService.getPersonalizedFeaturedEntities(user?.id, 3),
        enhancedExploreService.getTrendingEntitiesByCategory(category, limit),
        enhancedExploreService.getHiddenGems(category, Math.min(3, limit)),
        enhancedExploreService.getCuratedCollections(category)
      ]);

      setFeaturedEntities(featured);
      setTrendingEntities(trending);
      setHiddenGems(gems);
      setCuratedCollections(collections);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing explore data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    featuredEntities,
    trendingEntities,
    hiddenGems,
    curatedCollections,
    isLoading,
    lastRefresh,
    trackEntityInteraction,
    refreshData,
    refreshFeaturedEntities
  };
};
