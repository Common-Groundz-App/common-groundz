
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { enhancedExploreService, PersonalizedEntity } from '@/services/enhancedExploreService';

interface UseEnhancedExploreProps {
  category?: string;
  limit?: number;
  trackInteractions?: boolean;
}

export const useEnhancedExplore = ({ 
  category, 
  limit = 6, 
  trackInteractions = true 
}: UseEnhancedExploreProps = {}) => {
  const { user } = useAuth();
  const [featuredEntities, setFeaturedEntities] = useState<PersonalizedEntity[]>([]);
  const [trendingEntities, setTrendingEntities] = useState<PersonalizedEntity[]>([]);
  const [hiddenGems, setHiddenGems] = useState<PersonalizedEntity[]>([]);
  const [curatedCollections, setCuratedCollections] = useState<{ [key: string]: PersonalizedEntity[] }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEnhancedData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all data in parallel
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
      } catch (error) {
        console.error('Error fetching enhanced explore data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnhancedData();
  }, [user?.id, category, limit]);

  // Function to track entity interactions
  const trackEntityInteraction = async (
    entityId: string,
    entityType: string,
    entityCategory: string,
    interactionType: 'view' | 'like' | 'save' | 'click' = 'click'
  ) => {
    if (!trackInteractions || !user?.id) return;
    
    await enhancedExploreService.trackUserInteraction(
      user.id,
      entityId,
      entityType,
      entityCategory,
      interactionType
    );
  };

  return {
    featuredEntities,
    trendingEntities,
    hiddenGems,
    curatedCollections,
    isLoading,
    trackEntityInteraction,
    refreshData: () => {
      // Trigger re-fetch by updating a dependency
      setIsLoading(true);
    }
  };
};
