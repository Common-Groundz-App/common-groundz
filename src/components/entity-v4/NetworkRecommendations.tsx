
import React, { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getNetworkEntityRecommendationsWithCache, hasNetworkRecommendations } from '@/services/networkRecommendationService';
import { getFallbackEntityRecommendationsWithCache } from '@/services/fallbackRecommendationService';
import { RecommendationsModal } from '@/components/modals/RecommendationsModal';
import { RecommendationEntityCard } from '@/components/entity/RecommendationEntityCard';

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

  // Check if user has sufficient network for network recommendations
  const hasNetworkThreshold = user && userFollowingIds.length >= 3;

  // Get network recommendations
  const { data: networkRecommendations = [], isLoading: networkLoading } = useQuery({
    queryKey: ['network-recommendations', entityId, user?.id],
    queryFn: async () => {
      if (!user?.id || !hasNetworkThreshold) return [];
      return await getNetworkEntityRecommendationsWithCache(user.id, entityId, 6);
    },
    enabled: !!user?.id && hasNetworkThreshold,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Get fallback recommendations
  const { data: fallbackRecommendations = [], isLoading: fallbackLoading } = useQuery({
    queryKey: ['fallback-recommendations', entityId],
    queryFn: async () => {
      return await getFallbackEntityRecommendationsWithCache(entityId, undefined, 6);
    },
    enabled: true,
    staleTime: 1000 * 60 * 15, // 15 minutes
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

  const hasNetworkData = networkDisplay.length > 0;
  const displayEntities = hasNetworkData ? networkDisplay.slice(0, 3) : fallbackDisplay.slice(0, 3);
  const totalRecommendations = networkDisplay.length + fallbackDisplay.length;
  const showSeeAllButton = totalRecommendations > 3;
  const isLoading = networkLoading || fallbackLoading;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>
            {hasNetworkData ? "Recommended by Your Network" : "You Might Also Consider"}
          </CardTitle>
          {showSeeAllButton && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="text-primary hover:text-primary/80"
            >
              See All
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                  isNetworkRecommendation={hasNetworkData}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No recommendations available at the moment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <RecommendationsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entityName="this entity"
        networkRecommendations={networkRecommendations}
        fallbackRecommendations={fallbackRecommendations}
        hasNetworkData={hasNetworkData}
        isLoading={isLoading}
      />
    </>
  );
};
