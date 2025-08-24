
import React, { useState } from 'react';
import { Star, ExternalLink, AlertCircle, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecommendationsModal } from '@/components/modals/RecommendationsModal';
import { RecommendationEntityCard } from '@/components/entity/RecommendationEntityCard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { analytics } from '@/services/analytics';

interface NetworkRecommendationsProps {
  entityId: string;
  userFollowingIds?: string[];
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
  is_same_category?: boolean;
}

export const NetworkRecommendations: React.FC<NetworkRecommendationsProps> = ({
  entityId,
  userFollowingIds = []
}) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  console.log('NetworkRecommendations props:', { entityId, userFollowingIds });

  // Check if user has any network activity (not entity-specific)
  const {
    data: hasNetworkActivity,
    isLoading: isCheckingNetwork,
    error: networkCheckError
  } = useQuery({
    queryKey: ['has-network-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase.rpc('has_network_activity', {
        p_user_id: user.id,
        p_min_count: 3
      });
      
      if (error) {
        console.error('Error checking network activity:', error);
        return false;
      }
      
      console.log('has_network_activity result:', data);
      return data || false;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });

  // Fetch network discovery recommendations (from people you follow, any entities)
  const {
    data: networkRecommendations = [],
    isLoading: isLoadingNetwork,
    error: networkError,
    refetch: refetchNetwork
  } = useQuery({
    queryKey: ['network-discovery-recommendations', user?.id, entityId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_network_recommendations_discovery', {
        p_user_id: user.id,
        p_current_entity_id: entityId,
        p_limit: 6
      });
      
      if (error) {
        console.error('Error fetching network discovery recommendations:', error);
        return [];
      }
      
      console.log('Network discovery recommendations fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id && !!entityId && hasNetworkActivity === true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });

  // Get fallback recommendations when no network activity
  const {
    data: fallbackRecommendations = [],
    isLoading: fallbackLoading,
    error: fallbackError,
    refetch: refetchFallback
  } = useQuery({
    queryKey: ['fallback-recommendations', entityId, retryCount],
    queryFn: async () => {
      console.log('🔍 Fetching fallback recommendations for entity:', entityId);
      
      try {
        const { data, error } = await supabase.rpc('get_fallback_entity_recommendations', {
          p_entity_id: entityId,
          p_current_user_id: user?.id || null,
          p_limit: 6
        });
        
        if (error) {
          console.error('❌ Error fetching fallback recommendations:', error);
          throw error;
        }
        
        console.log('📊 Fallback recommendations fetched:', data?.length || 0);
        return data || [];
      } catch (error) {
        console.error('❌ Fallback recommendations fetch failed:', error);
        throw error;
      }
    },
    enabled: hasNetworkActivity === false, // Only when no network activity
    staleTime: 1000 * 60 * 15, // 15 minutes
    retry: 2,
  });

  // Convert network discovery recommendations to display format
  const networkDisplay: DisplayRecommendation[] = networkRecommendations.map(rec => ({
    id: rec.entity_id,
    name: rec.entity_name || 'Untitled',
    type: rec.entity_type || 'Unknown',
    image_url: rec.entity_image_url,
    averageRating: rec.rating || 0,
    recommendedBy: [rec.username || 'Unknown User'],
    slug: undefined,
    reason: rec.recommendation_reason,
    is_same_category: rec.is_same_category
  }));

  // Convert fallback recommendations to display format
  const fallbackDisplay: DisplayRecommendation[] = fallbackRecommendations.map(rec => ({
    id: rec.entity_id,
    name: rec.entity_name,
    type: rec.entity_type,
    image_url: rec.entity_image_url,
    averageRating: rec.avg_rating || 0,
    recommendedBy: [],
    slug: undefined,
    reason: rec.display_reason
  }));

  // Determine what to show: always prefer network recommendations when available
  const showNetworkRecommendations = hasNetworkActivity && networkDisplay.length > 0;
  const displayEntities = showNetworkRecommendations ? networkDisplay.slice(0, 3) : fallbackDisplay.slice(0, 3);
  const totalRecommendations = showNetworkRecommendations ? networkDisplay.length : fallbackDisplay.length;
  const showSeeAllButton = totalRecommendations > 3;
  const isLoading = isCheckingNetwork || isLoadingNetwork || fallbackLoading;
  const hasError = networkCheckError || networkError || fallbackError;
  
  console.log('🎯 Recommendation state:', {
    hasNetworkActivity,
    networkCount: networkDisplay.length,
    fallbackCount: fallbackDisplay.length,
    showingNetwork: showNetworkRecommendations,
    totalRecommendations,
    isLoading,
    hasError: !!hasError
  });

  // Retry handler
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
            {showNetworkRecommendations ? "Recommended by Your Network" : "You Might Also Consider"}
          </CardTitle>
          {showSeeAllButton && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                analytics.trackSeeAllClick(totalRecommendations, showNetworkRecommendations);
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
                  isNetworkRecommendation={showNetworkRecommendations}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {hasNetworkActivity 
                    ? "No recommendations found in your network yet" 
                    : "Connect with more people to see personalized recommendations"
                  }
                </p>
                {!hasNetworkActivity && (
                  <p className="text-xs text-muted-foreground">
                    Follow more active users to unlock network recommendations
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
        networkRecommendations={[]} // Simplified for now - pass empty array
        fallbackRecommendations={[]} // Simplified for now - pass empty array
        hasNetworkData={showNetworkRecommendations}
        isLoading={isLoading}
      />
    </ErrorBoundary>
  );
};
