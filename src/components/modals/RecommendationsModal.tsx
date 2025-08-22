import React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RecommendationEntityCard } from '@/components/entity/RecommendationEntityCard';
import { ProcessedNetworkRecommendation } from '@/services/networkRecommendationService';
import { ProcessedFallbackRecommendation } from '@/services/fallbackRecommendationService';

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  networkRecommendations: ProcessedNetworkRecommendation[];
  fallbackRecommendations: ProcessedFallbackRecommendation[];
  hasNetworkData: boolean;
  isLoading: boolean;
}

export const RecommendationsModal: React.FC<RecommendationsModalProps> = ({
  isOpen,
  onClose,
  entityName,
  networkRecommendations,
  fallbackRecommendations,
  hasNetworkData,
  isLoading
}) => {
  const allRecommendations = [...networkRecommendations, ...fallbackRecommendations];
  const title = hasNetworkData 
    ? `Network Recommendations for ${entityName}`
    : `Similar to ${entityName}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold">
            {title}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="overflow-y-auto py-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : allRecommendations.length > 0 ? (
            <>
              {hasNetworkData && networkRecommendations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3 text-primary">
                    From Your Network
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {networkRecommendations.map((recommendation) => (
                      <RecommendationEntityCard
                        key={recommendation.entity_id}
                        recommendation={{
                          id: recommendation.entity_id,
                          name: recommendation.entity_name,
                          type: recommendation.entity_type,
                          image_url: recommendation.entity_image_url,
                          averageRating: recommendation.average_rating,
                          recommendedBy: recommendation.displayUsernames,
                          slug: recommendation.entity_slug
                        }}
                        isNetworkRecommendation={true}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {fallbackRecommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 text-primary">
                    Popular Choices
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fallbackRecommendations.map((recommendation) => (
                      <RecommendationEntityCard
                        key={recommendation.entity_id}
                        recommendation={{
                          id: recommendation.entity_id,
                          name: recommendation.entity_name,
                          type: recommendation.entity_type,
                          image_url: recommendation.entity_image_url,
                          averageRating: recommendation.average_rating,
                          recommendedBy: [],
                          slug: recommendation.entity_slug,
                          reason: recommendation.displayReason
                        }}
                        isNetworkRecommendation={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No recommendations found at the moment. Try following more users or check back later.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};