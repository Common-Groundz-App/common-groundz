
import React, { useState } from 'react';
import { Star, ExternalLink, AlertCircle, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getNetworkEntityRecommendationsWithCache, hasQualityNetworkRecommendations } from '@/services/networkRecommendationService';
import { getMixedFallbackRecommendations } from '@/services/fallbackRecommendationService';
import { RecommendationsModal } from '@/components/modals/RecommendationsModal';
import { RecommendationEntityCard } from '@/components/entity/RecommendationEntityCard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { analytics } from '@/services/analytics';

interface NetworkRecommendationsProps {
  entityId: string;
  userFollowingIds: string[];
}

interface DisplayRecommendation {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  averageRating: number;
  recommendedBy: string[];
  slug?: string;
  reason?: string;
}

export const NetworkRecommendations: React.FC<NetworkRecommendationsProps> = ({
  entityId,
  userFollowingIds
}) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Enhanced intelligent thresholds (Phase 4.1)
  const hasNetworkThreshold = user && userFollowingIds.length >= 3;

  // Check if user has quality network recommendations (Phase 4.1)
  const { data: hasQualityNetwork = false } = useQuery({
    queryKey: ['has-quality-network', entityId, user?.id],
    queryFn: async () => {
      if (!user?.id || !hasNetworkThreshold) return false;
      return await hasQualityNetworkRecommendations(user.id, entityId, 2);
    },
    enabled: !!user?.id && hasNetworkThreshold,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get network recommendations with retry logic (Phase 5.1)
  const { data: networkRecommendations = [], isLoading: networkLoading, error: networkError, refetch: refetchNetwork } = useQuery({
    queryKey: ['network-recommendations', entityId, user?.id, retryCount],
    queryFn: async () => {
      if (!user?.id || !hasNetworkThreshold) return [];
      return await getNetworkEntityRecommendationsWithCache(user.id, entityId, 6);
    },
    enabled: !!user?.id && hasNetworkThreshold,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
  });

  // Get fallback recommendations with diversity (Phase 4.3)
  const { data: fallbackRecommendations = [], isLoading: fallbackLoading, error: fallbackError, refetch: refetchFallback } = useQuery({
    queryKey: ['fallback-recommendations', entityId, retryCount],
    queryFn: async () => {
      return await getMixedFallbackRecommendations(entityId, undefined, 6);
    },
    enabled: true,
    staleTime: 1000 * 60 * 15, // 15 minutes
    retry: 2,
  });

  // Convert to display format
  const networkDisplay: DisplayRecommendation[] = networkRecommendations.map(rec => ({
    id: rec.entity_id,
    name: rec.entity_name,
    type: rec.entity_type,
    image_url: rec.entity_image_url,
    averageRating: rec.average_rating,
    recommendedBy: rec.displayUsernames,
    slug: rec.entity_slug
  }));

  const fallbackDisplay: DisplayRecommendation[] = fallbackRecommendations.map(rec => ({
    id: rec.entity_id,
    name: rec.entity_name,
    type: rec.entity_type,
    image_url: rec.entity_image_url,
    averageRating: rec.average_rating,
    recommendedBy: [],
    slug: rec.entity_slug,
    reason: rec.displayReason
  }));

  // Enhanced logic for showing network vs fallback (Phase 4.1)
  const hasQualityNetworkData = hasQualityNetwork && networkDisplay.length >= 2;
  const displayEntities = hasQualityNetworkData ? networkDisplay.slice(0, 3) : fallbackDisplay.slice(0, 3);
  const totalRecommendations = networkDisplay.length + fallbackDisplay.length;
  const showSeeAllButton = totalRecommendations > 3;
  const isLoading = networkLoading || fallbackLoading;
  const hasError = networkError || fallbackError;

  // Retry handler (Phase 5.1)
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    refetchNetwork();
    refetchFallback();
  };

  return (
    <ErrorBoundary fallbackMessage="Unable to load recommendations. Please refresh the page.">
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">
            {hasQualityNetworkData ? "Recommended by Your Network" : "You Might Also Consider"}
          </CardTitle>
          {showSeeAllButton && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                analytics.trackSeeAllClick(totalRecommendations, hasQualityNetworkData);
                analytics.trackModalInteraction('open', totalRecommendations);
                setIsModalOpen(true);
              }}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              See All
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {hasError && !isLoading ? (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-1">Unable to load recommendations</p>
                  <p className="text-xs text-muted-foreground mb-4">Please check your connection and try again</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                    <RefreshCcw className="h-3 w-3" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : displayEntities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayEntities.map((entity, index) => (
                <RecommendationEntityCard
                  key={entity.id || index}
                  recommendation={entity}
                  isNetworkRecommendation={hasQualityNetworkData}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {hasNetworkThreshold 
                    ? "No quality recommendations found in your network yet" 
                    : "Connect with more people to see personalized recommendations"
                  }
                </p>
                {!hasNetworkThreshold && (
                  <p className="text-xs text-muted-foreground">
                    Follow 3+ people to unlock network recommendations
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RecommendationsModal
        isOpen={isModalOpen}
        onClose={() => {
          analytics.trackModalInteraction('close', totalRecommendations);
          setIsModalOpen(false);
        }}
        entityName="this entity"
        networkRecommendations={networkRecommendations}
        fallbackRecommendations={fallbackRecommendations}
        hasNetworkData={hasQualityNetworkData}
        isLoading={isLoading}
      />
    </ErrorBoundary>
  );
};
