
import React from 'react';
import { EntityParentBreadcrumb } from '@/components/entity/EntityParentBreadcrumb';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';
import { getSentimentColor, getSentimentLabel } from '@/utils/ratingColorUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitySave } from '@/hooks/use-entity-save';
import { useEntityShare } from '@/hooks/use-entity-share';
import { Share, Bookmark, Users, ThumbsUp, CheckCircle, AlertTriangle, Globe, Navigation } from "lucide-react";
import { ConnectedRingsRating } from "@/components/ui/connected-rings";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { EntityFollowersCount } from '@/components/entity/EntityFollowersCount';
import { EntitySocialFollowers } from '@/components/entity/EntitySocialFollowers';
import { Entity } from '@/services/recommendation/types';
import { EntityStats } from '@/hooks/use-entity-detail-cached';

interface EntityHeaderProps {
  entity: Entity;
  stats: EntityStats | null;
  entityImage: string;
  entityData: {
    name: string;
    description: string;
    rating: number;
    totalReviews: number;
    claimed: boolean;
    website: string;
  };
  onRecommendationModalOpen: () => void;
  onReviewAction: () => void;
  reviewActionConfig: {
    text: string;
    icon: any;
    action: () => void;
    tooltip: string | null;
  };
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  entity,
  stats,
  entityImage,
  entityData,
  onRecommendationModalOpen,
  onReviewAction,
  reviewActionConfig
}) => {
  const { user } = useAuth();
  
  // Fetch entity hierarchy data
  const {
    parentEntity,
    isLoading: hierarchyLoading
  } = useEntityHierarchy(entity?.id || null);

  // Fetch circle rating data
  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');

  // Entity save functionality
  const {
    isSaved,
    saveCount,
    toggleSave,
    isLoading: isSaveLoading
  } = useEntitySave({
    entityId: entity?.id || '',
    enabled: !!entity?.id
  });

  // Entity share functionality
  const { shareEntity } = useEntityShare();

  const handleShare = async () => {
    if (!entity) return;

    const entityUrl = `${window.location.origin}/entity/${entity.slug || entity.id}?v=4`;
    
    await shareEntity({
      name: entity.name,
      description: entity.description || undefined,
      url: entityUrl
    });
  };

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <EntityParentBreadcrumb 
          currentEntity={entity}
          parentEntity={parentEntity}
          isLoading={hierarchyLoading}
        />

        <div className="grid grid-cols-1 gap-8">
          {/* Brand Info */}
          <div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <img src={entityImage} alt={entityData.name} className="w-16 h-16 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{entityData.name}</h1>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {entityData.claimed ? (
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Claimed
                          </div>
                        ) : (
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Unclaimed
                          </div>
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-popover text-popover-foreground border rounded-md shadow-md p-3 max-w-xs">
                        <p className="text-sm">
                          {entityData.claimed 
                            ? "This listing is actively managed by the owner." 
                            : "This listing hasn't been claimed yet. Claim it for free to update info, add photos, respond to reviews, and more."
                          }
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Top-right action buttons */}
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-foreground hover:text-primary gap-2"
                      onClick={handleShare}
                    >
                      <Share className="w-4 h-4" />
                      Share
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`gap-2 ${isSaved ? 'text-brand-orange hover:text-brand-orange/80' : 'text-foreground hover:text-primary'}`}
                      onClick={toggleSave}
                      disabled={isSaveLoading}
                    >
                      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                      {isSaved ? 'Saved' : 'Save'}
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600 mb-4 leading-relaxed">{entityData.description}</p>
                
                {/* Ratings */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:w-auto">
                    <div className="flex items-center gap-2">
                      <ConnectedRingsRating
                        value={entityData.rating}
                        variant="badge"
                        showValue={false}
                        size="md"
                        minimal={true}
                      />
                      <span 
                        className="text-lg font-bold" 
                        style={{ color: getSentimentColor(entityData.rating, entityData.totalReviews > 0) }}
                      >
                        {entityData.totalReviews > 0 ? entityData.rating.toFixed(1) : "0"}
                      </span>
                    </div>
                    
                    <div className="leading-tight">
                      <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                        Overall Rating
                        <InfoTooltip content="Overall Rating is the average review rating from all users who reviewed this item on Common Groundz." />
                      </div>
                      <div 
                        className="text-sm font-bold" 
                        style={{ color: getSentimentColor(entityData.rating, entityData.totalReviews > 0) }}
                      >
                        {getSentimentLabel(entityData.rating, entityData.totalReviews > 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({entityData.totalReviews.toLocaleString()} {entityData.totalReviews === 1 ? 'review' : 'reviews'})
                      </div>
                    </div>
                  </div>
                  {user && (
                    circleRating !== null ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:w-auto">
                        <div className="flex items-center gap-2">
                          <div className="w-fit">
                            <ConnectedRingsRating
                              value={circleRating}
                              variant="badge"
                              showValue={false}
                              size="md"
                              minimal={true}
                            />
                          </div>
                          <span 
                            className="text-lg font-bold" 
                            style={{ color: getSentimentColor(circleRating, circleRatingCount > 0) }}
                          >
                            {circleRatingCount > 0 ? circleRating.toFixed(1) : "0"}
                          </span>
                        </div>

                        <div className="leading-tight">
                          <div className="font-semibold text-sm text-brand-orange flex items-center gap-1">
                            Circle Rating
                            <InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />
                          </div>
                          <div 
                            className="text-sm font-bold" 
                            style={{ color: getSentimentColor(circleRating, circleRatingCount > 0) }}
                          >
                            {getSentimentLabel(circleRating, circleRatingCount > 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Based on {circleRatingCount} rating{circleRatingCount !== 1 ? 's' : ''} from your circle
                          </div>
                          <CircleContributorsPreview 
                            contributors={circleContributors}
                            totalCount={circleRatingCount}
                            maxDisplay={4}
                            entityName={entity?.name}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:w-auto">
                        <div className="flex items-center gap-2">
                          <div className="w-fit">
                            <ConnectedRingsRating
                              value={0}
                              variant="badge"
                              showValue={false}
                              size="md"
                              minimal={true}
                            />
                          </div>
                          <span className="text-lg font-bold text-muted-foreground">
                            0
                          </span>
                        </div>

                        <div className="leading-tight">
                          <div className="font-semibold text-sm text-brand-orange flex items-center gap-1">
                            Circle Rating
                            <InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            No ratings from your circle
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Followers and Recommendations Section - Combined */}
                {entity && (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                    {/* Followers */}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <EntityFollowersCount entityId={entity.id} />
                    </div>
                    
                    {/* Recommendations - Make clickable as one unit */}
                    {stats && (stats.recommendationCount > 0 || (user && stats.circleRecommendationCount > 0)) && (
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4" />
                        <button
                          onClick={onRecommendationModalOpen}
                          className="text-foreground hover:text-brand-orange hover:underline font-medium cursor-pointer transition-colors"
                        >
                          {stats.recommendationCount > 0 && (
                            <>
                              <span className="text-brand-orange">{stats.recommendationCount.toLocaleString()}</span> Recommending
                              {user && stats.circleRecommendationCount > 0 && (
                                <>
                                  {' '}<span className="text-muted-foreground">(</span><span className="text-brand-orange font-medium">{stats.circleRecommendationCount} from circle</span><span className="text-muted-foreground">)</span>
                                </>
                              )}
                            </>
                          )}
                          {stats.recommendationCount === 0 && user && stats.circleRecommendationCount > 0 && (
                            <span className="text-brand-orange font-medium">{stats.circleRecommendationCount} from your circle</span>
                          )}
                        </button>
                        <InfoTooltip 
                          content={`Reviews with 4 or more circles are considered recommendations.
"From circle" shows how many people you follow have recommended this recently.
Only recent ratings are counted to keep things current and relevant.`}
                          side="top"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 min-w-0">
                  {entity && (
                    <EntityFollowButton
                      entityId={entity.id}
                      entityName={entity.name}
                      variant="outline"
                    />
                  )}
                  <Button 
                    className="bg-brand-orange hover:bg-brand-orange/90 text-white text-xs sm:text-sm"
                    size="sm"
                    onClick={onReviewAction}
                  >
                    <reviewActionConfig.icon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    {reviewActionConfig.text}
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white text-xs sm:text-sm"
                    onClick={() => entityData.website && window.open(`https://${entityData.website.replace(/^https?:\/\//, '')}`, '_blank')}
                    disabled={!entityData.website}
                  >
                    <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Visit Website</span>
                    <span className="sm:hidden">Website</span>
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
                    size="sm"
                  >
                    <Navigation className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Get Directions</span>
                    <span className="sm:hidden">Directions</span>
                  </Button>
                </div>

                {/* Social Avatars Section */}
                {entity && (
                  <div className="mt-4">
                    <EntitySocialFollowers entityId={entity.id} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
