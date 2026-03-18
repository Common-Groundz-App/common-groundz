
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { enhancedExploreService, PersonalizedEntity } from '@/services/enhancedExploreService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

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
  const { isOnline } = useNetworkStatus();
  const [featuredEntities, setFeaturedEntities] = useState<PersonalizedEntity[]>([]);
  const [trendingEntities, setTrendingEntities] = useState<PersonalizedEntity[]>([]);
  const [hiddenGems, setHiddenGems] = useState<PersonalizedEntity[]>([]);
  const [curatedCollections, setCuratedCollections] = useState<{ [key: string]: PersonalizedEntity[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchEnhancedData = async () => {
      if (!isOnline) return;
      
      try {
        setIsLoading(true);
        
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
    
    if (enableTemporalPersonalization && user?.id) {
      const scheduleNext = () => {
        timerRef.current = setTimeout(async () => {
          if (document.hidden || !isOnline) {
            scheduleNext();
            return;
          }
          await fetchEnhancedData();
          scheduleNext();
        }, 10 * 60 * 1000);
      };
      scheduleNext();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user?.id, category, limit, enableTemporalPersonalization, isOnline]);

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
      
      if (interactionType === 'like' || interactionType === 'save') {
        setTimeout(() => {
          refreshFeaturedEntities();
        }, 1000);
      }
    } catch (error) {
      console.error('Error tracking entity interaction:', error);
    }
  };

  const refreshFeaturedEntities = async () => {
    if (!user?.id) return;
    
    try {
      const featured = await enhancedExploreService.getPersonalizedFeaturedEntities(user.id, 3);
      setFeaturedEntities(featured);
    } catch (error) {
      console.error('Error refreshing featured entities:', error);
    }
  };

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
