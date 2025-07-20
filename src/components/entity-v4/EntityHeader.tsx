
import React from 'react';
import { Entity } from '@/services/recommendation/types';
import { SafeUserProfile } from '@/types/profile';
import { EntityParentBreadcrumb } from '@/components/entity/EntityParentBreadcrumb';
import { ConnectedRingsRating } from "@/components/ui/connected-rings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { EntitySocialFollowers } from '@/components/entity/EntitySocialFollowers';
import { getSentimentColor, getSentimentLabel } from '@/utils/ratingColorUtils';
import { CheckCircle, AlertTriangle, Share, Bookmark, Users, ThumbsUp, MessageSquare, Globe, Navigation } from "lucide-react";

interface EntityHeaderProps {
  entity: Entity;
  parentEntity?: Entity | null;
  hierarchyLoading: boolean;
  entityImage: string;
  stats: {
    averageRating?: number;
    reviewCount?: number;
    recommendationCount: number;
    circleRecommendationCount: number;
  };
  user: SafeUserProfile | null;
  circleRating: number | null;
  circleRatingCount: number;
  circleContributors: any[];
  isSaved: boolean;
  isSaveLoading: boolean;
  onShare: () => void;
  onToggleSave: () => void;
  onRecommendationModalOpen: () => void;
  onSidebarAction: () => void;
  sidebarButtonConfig: {
    text: string;
    icon: typeof MessageSquare;
    action: () => void;
    tooltip: string | null;
  };
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  entity,
  parentEntity,
  hierarchyLoading,
  entityImage,
  stats,
  user,
  circleRating,
  circleRatingCount,
  circleContributors,
  isSaved,
  isSaveLoading,
  onShare,
  onToggleSave,
  onRecommendationModalOpen,
  onSidebarAction,
  sidebarButtonConfig
}) => {
  const entityData = {
    name: entity.name,
    description: entity.description || '',
    rating: stats.averageRating || 0,
    totalReviews: stats.reviewCount || 0,
    claimed: entity.is_claimed || false,
    website: entity.website_url || ''
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Brand Info */}
          <div className="lg:col-span-2">
            <div className="flex gap-6">
              <img src={entityImage} alt={entityData.name} className="w-24 h-24 rounded-lg object-cover" />
              <div className="flex-1 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">{entityData.name}</h1>
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
                      onClick={onShare}
                    >
                      <Share className="w-4 h-4" />
                      Share
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`gap-2 ${isSaved ? 'text-brand-orange hover:text-brand-orange/80' : 'text-foreground hover:text-primary'}`}
                      onClick={onToggleSave}
                      disabled={isSaveLoading}
                    >
                      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                      {isSaved ? 'Saved' : 'Save'}
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600 mb-4 leading-relaxed">{entityData.description}</p>
                
                {/* Ratings */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-4 flex-shrink-0 min-w-[300px]">
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
                    
                    <div className="leading-tight min-w-[140px]">
                      <div className="font-semibold text-sm whitespace-nowrap text-gray-900 flex items-center gap-1">
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
                      <div className="flex items-center gap-4 flex-shrink-0">
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

                        <div className="leading-tight min-w-[140px]">
                          <div className="font-semibold text-sm whitespace-nowrap text-brand-orange flex items-center gap-1">
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
                            entityName={entity.name}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 flex-shrink-0">
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

                        <div className="leading-tight min-w-[140px]">
                          <div className="font-semibold text-sm whitespace-nowrap text-brand-orange flex items-center gap-1">
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

                {/* Followers and Recommendations Section */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                  {/* Followers */}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{/* EntityFollowersCount would go here */}</span>
                  </div>
                  
                  {/* Recommendations */}
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

                {/* Action Buttons */}
                <div className="flex gap-3 min-w-0 pr-4">
                  <EntityFollowButton
                    entityId={entity.id}
                    entityName={entity.name}
                    variant="outline"
                  />
                  <Button 
                    className="bg-brand-orange hover:bg-brand-orange/90 text-white"
                    onClick={sidebarButtonConfig.action}
                  >
                    <sidebarButtonConfig.icon className="w-4 h-4 mr-2" />
                    {sidebarButtonConfig.text}
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                    onClick={() => entityData.website && window.open(`https://${entityData.website.replace(/^https?:\/\//, '')}`, '_blank')}
                    disabled={!entityData.website}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Visit Website
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                </div>

                {/* Social Avatars Section */}
                <div className="mt-4">
                  <EntitySocialFollowers entityId={entity.id} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
