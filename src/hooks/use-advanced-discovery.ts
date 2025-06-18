
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { advancedPersonalizationService, PersonalizationContext, AdvancedRecommendation } from '@/services/advancedPersonalizationService';
import { socialIntelligenceService } from '@/services/socialIntelligenceService';

interface UseAdvancedDiscoveryProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableSocialIntelligence?: boolean;
  enableCollaborativeFiltering?: boolean;
}

export const useAdvancedDiscovery = ({
  autoRefresh = false,
  refreshInterval = 15 * 60 * 1000, // 15 minutes
  enableSocialIntelligence = true,
  enableCollaborativeFiltering = true
}: UseAdvancedDiscoveryProps = {}) => {
  const { user } = useAuth();
  const [advancedRecommendations, setAdvancedRecommendations] = useState<AdvancedRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [context, setContext] = useState<PersonalizationContext>({
    timeOfDay: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    season: getSeason(),
    recentActivity: []
  });

  const fetchAdvancedRecommendations = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Update context
      const currentContext: PersonalizationContext = {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        season: getSeason(),
        recentActivity: []
      };
      setContext(currentContext);

      // Get advanced recommendations
      const recommendations = await advancedPersonalizationService.getAdvancedRecommendations(
        user.id,
        currentContext,
        12
      );

      setAdvancedRecommendations(recommendations);
      setLastRefresh(new Date());

      // Background: Update social influence scores
      if (enableSocialIntelligence) {
        socialIntelligenceService.calculateSocialInfluenceScores(user.id);
      }

    } catch (error) {
      console.error('Error fetching advanced recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Learn from user interactions
  const trackAdvancedInteraction = async (
    entityId: string,
    interactionType: 'view' | 'like' | 'save' | 'click',
    algorithm?: string
  ) => {
    if (!user?.id) return;

    try {
      // Convert interaction to feedback
      const feedback = interactionType === 'like' || interactionType === 'save' ? 'like' : 
                      interactionType === 'click' ? 'like' : 'not_interested';

      if (algorithm) {
        await advancedPersonalizationService.learnFromFeedback(
          user.id,
          entityId,
          feedback,
          algorithm
        );
      }
    } catch (error) {
      console.error('Error tracking advanced interaction:', error);
    }
  };

  useEffect(() => {
    fetchAdvancedRecommendations();

    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      intervalId = setInterval(fetchAdvancedRecommendations, refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, autoRefresh, refreshInterval]);

  const refreshAdvancedDiscovery = () => {
    fetchAdvancedRecommendations();
  };

  // Get recommendations by algorithm type
  const getRecommendationsByAlgorithm = (algorithm: string) => {
    return advancedRecommendations.filter(rec => rec.algorithm === algorithm);
  };

  // Get high confidence recommendations
  const getHighConfidenceRecommendations = (minConfidence: number = 0.7) => {
    return advancedRecommendations.filter(rec => rec.confidenceScore >= minConfidence);
  };

  return {
    advancedRecommendations,
    isLoading,
    lastRefresh,
    context,
    refreshAdvancedDiscovery,
    trackAdvancedInteraction,
    getRecommendationsByAlgorithm,
    getHighConfidenceRecommendations
  };
};

// Helper function to get current season
function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}
