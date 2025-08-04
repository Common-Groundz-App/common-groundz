
import React from 'react';
import { Entity } from '@/services/recommendation/types';
import { ConnectedRingsRating } from "@/components/ui/connected-rings";
import { getSentimentColor, getSentimentLabel } from '@/utils/ratingColorUtils';
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share, Bookmark, Globe, Navigation, CheckCircle, AlertTriangle, Users, ThumbsUp } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClaimedBadgeTooltip } from '@/components/ui/claimed-badge-tooltip';

interface EntityV3HeaderProps {
  entity: Entity;
  stats: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
    circleRecommendationCount: number;
  };
  circleRating: number | null;
  circleRatingCount: number;
  user: any;
  isSaved: boolean;
  isSaveLoading: boolean;
  onShare: () => void;
  onToggleSave: () => void;
}

export const EntityV3Header: React.FC<EntityV3HeaderProps> = ({
  entity,
  stats,
  circleRating,
  circleRatingCount,
  user,
  isSaved,
  isSaveLoading,
  onShare,
  onToggleSave
}) => {
  const entityImage = entity?.image_url || '/placeholder-entity.png';
  
  return (
    <TooltipProvider delayDuration={0}>
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Brand Info */}
            <div className="lg:col-span-2">
              <div className="flex gap-6">
                <img 
                  src={entityImage} 
                  alt={entity.name} 
                  className="w-24 h-24 rounded-lg object-cover" 
                />
                <div className="flex-1 relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-bold text-gray-900">{entity.name}</h1>
                      {entity.is_claimed ? (
                        <ClaimedBadgeTooltip content="This listing is actively managed by the owner.">
                          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Claimed
                          </Badge>
                        </ClaimedBadgeTooltip>
                      ) : (
                        <ClaimedBadgeTooltip content="This listing hasn't been claimed yet. Claim it for free to update info, add photos, respond to reviews, and more.">
                          <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Unclaimed
                          </Badge>
                        </ClaimedBadgeTooltip>
                      )}
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
                  
                  <p className="text-gray-600 mb-4 leading-relaxed">{entity.description}</p>
                  
                  {/* Ratings and Stats */}
                  <div className="flex items-center gap-6 mb-4">
                    {/* Overall Rating */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <ConnectedRingsRating
                          value={stats.averageRating || 0}
                          variant="badge"
                          showValue={false}
                          size="md"
                          minimal={true}
                        />
                        <span 
                          className="text-lg font-bold" 
                          style={{ color: getSentimentColor(stats.averageRating || 0, stats.reviewCount > 0) }}
                        >
                          {stats.reviewCount > 0 ? (stats.averageRating || 0).toFixed(1) : "0"}
                        </span>
                      </div>
                      
                      <div className="leading-tight min-w-[140px]">
                        <div className="font-semibold text-sm whitespace-nowrap text-gray-900 flex items-center gap-1">
                          Overall Rating
                          <InfoTooltip content="Overall Rating is the average review rating from all users who reviewed this item on Common Groundz." />
                        </div>
                        <div 
                          className="text-sm font-bold" 
                          style={{ color: getSentimentColor(stats.averageRating || 0, stats.reviewCount > 0) }}
                        >
                          {getSentimentLabel(stats.averageRating || 0, stats.reviewCount > 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ({stats.reviewCount.toLocaleString()} {stats.reviewCount === 1 ? 'review' : 'reviews'})
                        </div>
                      </div>
                    </div>

                    {/* Circle Rating (only if user is logged in) */}
                    {user && (
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <ConnectedRingsRating
                            value={circleRating || 0}
                            variant="badge"
                            showValue={false}
                            size="md"
                            minimal={true}
                          />
                          <span 
                            className="text-lg font-bold" 
                            style={{ color: getSentimentColor(circleRating || 0, circleRatingCount > 0) }}
                          >
                            {circleRatingCount > 0 ? (circleRating || 0).toFixed(1) : "0"}
                          </span>
                        </div>

                        <div className="leading-tight min-w-[140px]">
                          <div className="font-semibold text-sm whitespace-nowrap text-brand-orange flex items-center gap-1">
                            Circle Rating
                            <InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />
                          </div>
                          <div 
                            className="text-sm font-bold" 
                            style={{ color: getSentimentColor(circleRating || 0, circleRatingCount > 0) }}
                          >
                            {getSentimentLabel(circleRating || 0, circleRatingCount > 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Based on {circleRatingCount} rating{circleRatingCount !== 1 ? 's' : ''} from your circle
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recommendation Counts */}
                  <div className="flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="font-medium">
                        {stats.recommendationCount > 0 ? (
                          <>
                            {stats.recommendationCount} Recommending
                            {user && stats.circleRecommendationCount > 0 && (
                              <span className="text-brand-orange ml-1">
                                ({stats.circleRecommendationCount} from circle)
                              </span>
                            )}
                          </>
                        ) : (
                          "No recommendations yet"
                        )}
                      </span>
                    </div>

                    {/* Followers Section */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Followers</span>
                      <span className="font-medium">0</span> {/* Placeholder - will be populated when EntityFollowersCount is available */}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 min-w-0 pr-4">
                    <Button 
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                      onClick={() => entity.website_url && window.open(`https://${entity.website_url.replace(/^https?:\/\//, '')}`, '_blank')}
                      disabled={!entity.website_url}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Visit Website
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Navigation className="w-4 h-4 mr-2" />
                      Get Directions
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
