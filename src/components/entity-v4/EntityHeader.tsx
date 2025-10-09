import React, { useEffect, useState } from 'react';
import { EntityParentBreadcrumb } from '@/components/entity/EntityParentBreadcrumb';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';
import { getSentimentColor, getSentimentLabel } from '@/utils/ratingColorUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitySave } from '@/hooks/use-entity-save';
import { useEntityShare } from '@/hooks/use-entity-share';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTapDetection } from '@/hooks/use-tap-detection';
import { Share, Bookmark, Users, ThumbsUp, CheckCircle, AlertTriangle, Globe, Navigation, MoreHorizontal, RefreshCw } from "lucide-react";
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConnectedRingsRating } from "@/components/ui/connected-rings";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { EntityFollowersCount } from '@/components/entity/EntityFollowersCount';
import { EntitySocialFollowers } from '@/components/entity/EntitySocialFollowers';
import { Entity } from '@/services/recommendation/types';
import { EntityStats } from '@/hooks/use-entity-detail-cached';
import { hasLocationData, openGoogleMaps, hasWebsiteData, getEntityWebsiteUrl } from '@/utils/locationUtils';

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
  onRatingClick?: () => void;
  onRefreshHeroImage?: () => Promise<void>;
  isRefreshingImage?: boolean;
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  entity,
  stats,
  entityImage,
  entityData,
  onRecommendationModalOpen,
  onReviewAction,
  reviewActionConfig,
  onRatingClick,
  onRefreshHeroImage,
  isRefreshingImage = false
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // State for image refresh functionality
  const [isImageExpired, setIsImageExpired] = useState(false);

  // Reset expiration flag when entityImage prop changes (after successful refresh)
  useEffect(() => {
    console.log('EntityHeader: entityImage prop changed, resetting expiration flag');
    setIsImageExpired(false);
  }, [entityImage]);
  
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

  // Tap detection for rating blocks
  const ratingTapDetection = useTapDetection({
    onTap: () => {
      if (onRatingClick) {
        onRatingClick();
      }
    }
  });

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Brand Info */}
          <div className="lg:col-span-2">
            {/* Mobile: Stack image above content, Desktop: side-by-side */}
            <div className={`${isMobile ? 'flex flex-col' : 'flex gap-6'}`}>
              {/* Image with refresh capability */}
              <div className={`${isMobile ? 'w-full mb-4' : 'flex-shrink-0'} relative group`}>
                <ImageWithFallback
                  src={entityImage}
                  alt={entityData.name}
                  entityType={entity.type}
                  className={`${isMobile ? 'w-full h-48 rounded-lg object-cover' : 'w-24 h-24 rounded-lg object-cover'}`}
                  onError={() => {
                    console.log('EntityHeader: Hero image failed to load (expired/403), showing refresh button');
                    setIsImageExpired(true);
                  }}
                  suppressConsoleErrors={false}
                />
                
                {/* Refresh Button - Only shown when image is expired AND user is authenticated */}
                {user && isImageExpired && onRefreshHeroImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm animate-in fade-in duration-300">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={() => onRefreshHeroImage?.()}
                            disabled={isRefreshingImage}
                            className="bg-white/90 hover:bg-white text-gray-900 shadow-lg"
                          >
                            <RefreshCw className={`w-5 h-5 ${isRefreshingImage ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isRefreshingImage ? 'Refreshing...' : 'Refresh Image'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 relative">
                {/* Title and Status Section */}
                <div className={`${isMobile ? 'mb-3' : 'flex items-center justify-between mb-2'}`}>
                  <div className={`flex items-center ${isMobile ? 'flex-wrap gap-2 mb-3' : 'gap-3'}`}>
                    <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900 ${isMobile ? 'w-full' : ''}`}>
                      {entityData.name}
                    </h1>
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
                    
                    {/* Three-dots menu for Share/Save */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border z-50">
                        <DropdownMenuItem onClick={handleShare} className="flex items-center gap-2 cursor-pointer">
                          <Share className="h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={toggleSave} 
                          disabled={isSaveLoading}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current text-brand-orange' : ''}`} />
                          {isSaved ? 'Saved' : 'Save'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className={`text-gray-600 mb-4 leading-relaxed ${isMobile ? 'text-sm' : ''}`}>
                  <RichTextDisplay content={entityData.description} />
                </div>
                
                {/* Ratings - Always stack on mobile, side-by-side on larger screens */}
                <div className={`flex flex-col ${isMobile ? 'gap-4' : 'sm:flex-row sm:items-center gap-3'} mb-4`}>
                  {/* Overall Rating */}
                  <div className={`flex items-center gap-4 flex-shrink-0 ${isMobile ? '' : 'sm:min-w-0'}`}>
                    <div 
                      className={`flex items-center gap-2 ${onRatingClick ? 'cursor-pointer active:scale-105 transition-transform duration-200 select-none' : ''}`}
                      style={onRatingClick ? { touchAction: 'manipulation', minHeight: '44px', minWidth: '44px' } : {}}
                      {...(onRatingClick ? ratingTapDetection : {})}
                      role={onRatingClick ? "button" : undefined}
                      tabIndex={onRatingClick ? 0 : undefined}
                      onKeyDown={onRatingClick ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRatingClick();
                        }
                      } : undefined}
                      aria-label={onRatingClick ? "View reviews and ratings" : undefined}
                    >
                      <ConnectedRingsRating
                        value={entityData.rating}
                        variant="badge"
                        showValue={false}
                        size={isMobile ? "sm" : "md"}
                        minimal={true}
                      />
                      <span 
                        className={`${isMobile ? 'text-base' : 'text-lg'} font-bold`}
                        style={{ color: getSentimentColor(entityData.rating, entityData.totalReviews > 0) }}
                      >
                        {entityData.totalReviews > 0 ? entityData.rating.toFixed(1) : "0"}
                      </span>
                    </div>
                    
                    <div className={`leading-tight ${isMobile ? '' : 'sm:min-w-0'}`}>
                      <div className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'} text-gray-900 flex items-center gap-1`}>
                        <span 
                          className={`${onRatingClick ? 'cursor-pointer hover:text-primary active:scale-105 transition-all duration-200' : ''}`}
                          onClick={onRatingClick}
                          role={onRatingClick ? "button" : undefined}
                          tabIndex={onRatingClick ? 0 : undefined}
                          onKeyDown={onRatingClick ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRatingClick();
                            }
                          } : undefined}
                          aria-label={onRatingClick ? "View overall ratings and reviews" : undefined}
                        >
                          Overall Rating
                        </span>
                        <InfoTooltip content="Overall Rating is the average review rating from all users who reviewed this item on Common Groundz." />
                      </div>
                      <div 
                        className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold`}
                        style={{ color: getSentimentColor(entityData.rating, entityData.totalReviews > 0) }}
                      >
                        {getSentimentLabel(entityData.rating, entityData.totalReviews > 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({entityData.totalReviews.toLocaleString()} {entityData.totalReviews === 1 ? 'review' : 'reviews'})
                      </div>
                    </div>
                  </div>
                  
                  {/* Circle Rating */}
                  {user && (
                    circleRating !== null ? (
                      <div className={`flex items-center gap-4 flex-shrink-0 ${isMobile ? '' : 'sm:min-w-0'}`}>
                        <div 
                          className={`flex items-center gap-2 ${onRatingClick ? 'cursor-pointer active:scale-105 transition-transform duration-200 select-none' : ''}`}
                          style={onRatingClick ? { touchAction: 'manipulation', minHeight: '44px', minWidth: '44px' } : {}}
                          {...(onRatingClick ? ratingTapDetection : {})}
                          role={onRatingClick ? "button" : undefined}
                          tabIndex={onRatingClick ? 0 : undefined}
                          onKeyDown={onRatingClick ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRatingClick();
                            }
                          } : undefined}
                          aria-label={onRatingClick ? "View reviews and ratings from your circle" : undefined}
                        >
                          <div className="w-fit">
                            <ConnectedRingsRating
                              value={circleRating}
                              variant="badge"
                              showValue={false}
                              size={isMobile ? "sm" : "md"}
                              minimal={true}
                            />
                          </div>
                          <span 
                            className={`${isMobile ? 'text-base' : 'text-lg'} font-bold`}
                            style={{ color: getSentimentColor(circleRating, circleRatingCount > 0) }}
                          >
                            {circleRatingCount > 0 ? circleRating.toFixed(1) : "0"}
                          </span>
                        </div>

                        <div className={`leading-tight ${isMobile ? '' : 'sm:min-w-0'}`}>
                          <div className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'} text-brand-orange flex items-center gap-1`}>
                            <span 
                              className={`${onRatingClick ? 'cursor-pointer hover:text-primary active:scale-105 transition-all duration-200' : ''}`}
                              onClick={onRatingClick}
                              role={onRatingClick ? "button" : undefined}
                              tabIndex={onRatingClick ? 0 : undefined}
                              onKeyDown={onRatingClick ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onRatingClick();
                                }
                              } : undefined}
                              aria-label={onRatingClick ? "View circle ratings and reviews" : undefined}
                            >
                              Circle Rating
                            </span>
                            <InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />
                          </div>
                          <div 
                            className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold`}
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
                            stats={stats}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={`flex items-center gap-4 flex-shrink-0 ${isMobile ? '' : 'sm:min-w-0'}`}>
                        <div 
                          className={`flex items-center gap-2 ${onRatingClick ? 'cursor-pointer active:scale-105 transition-transform duration-200 select-none' : ''}`}
                          style={onRatingClick ? { touchAction: 'manipulation', minHeight: '44px', minWidth: '44px' } : {}}
                          {...(onRatingClick ? ratingTapDetection : {})}
                          role={onRatingClick ? "button" : undefined}
                          tabIndex={onRatingClick ? 0 : undefined}
                          onKeyDown={onRatingClick ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRatingClick();
                            }
                          } : undefined}
                          aria-label={onRatingClick ? "View reviews and ratings from your circle" : undefined}
                        >
                          <div className="w-fit">
                            <ConnectedRingsRating
                              value={0}
                              variant="badge"
                              showValue={false}
                              size={isMobile ? "sm" : "md"}
                              minimal={true}
                            />
                          </div>
                          <span className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-muted-foreground`}>
                            0
                          </span>
                        </div>

                        <div className={`leading-tight ${isMobile ? '' : 'sm:min-w-0'}`}>
                          <div className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'} text-brand-orange flex items-center gap-1`}>
                            <span 
                              className={`${onRatingClick ? 'cursor-pointer hover:text-primary active:scale-105 transition-all duration-200' : ''}`}
                              onClick={onRatingClick}
                              role={onRatingClick ? "button" : undefined}
                              tabIndex={onRatingClick ? 0 : undefined}
                              onKeyDown={onRatingClick ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onRatingClick();
                                }
                              } : undefined}
                              aria-label={onRatingClick ? "View circle ratings and reviews" : undefined}
                            >
                              Circle Rating
                            </span>
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
                {entity && (
                  <div className={`flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center ${isMobile ? 'min-[400px]:gap-4' : 'min-[400px]:gap-6'} text-sm text-muted-foreground mb-4`}>
                    {/* Followers */}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <EntityFollowersCount entityId={entity.id} />
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
                )}

                {/* Action Buttons - Mobile: Stack 2x2, Desktop: Horizontal */}
                <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-3'} min-w-0 ${isMobile ? '' : 'pr-4'}`}>
                  {entity && (
                    <EntityFollowButton
                      entityId={entity.id}
                      entityName={entity.name}
                      variant="outline"
                    />
                  )}
                  <Button 
                    className={`bg-brand-orange hover:bg-brand-orange/90 text-white ${isMobile ? 'h-11 text-sm' : ''}`}
                    onClick={onReviewAction}
                  >
                    <reviewActionConfig.icon className="w-4 h-4 mr-2" />
                    {isMobile ? 'Review' : reviewActionConfig.text}
                  </Button>
                  {entity && hasWebsiteData(entity) && (() => {
                    const websiteUrl = getEntityWebsiteUrl(entity);
                    return websiteUrl && (
                      <Button 
                        variant="outline"
                        className={`border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white ${isMobile ? 'h-11 text-sm' : ''}`}
                        onClick={() => window.open(websiteUrl, '_blank')}
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        {isMobile ? 'Website' : 'Visit Website'}
                      </Button>
                    );
                  })()}
                  {entity && hasLocationData(entity) && (
                    <Button 
                      className={`bg-blue-600 hover:bg-blue-700 text-white ${isMobile ? 'h-11 text-sm' : ''}`}
                      onClick={() => openGoogleMaps(entity)}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      {isMobile ? 'Directions' : 'Get Directions'}
                    </Button>
                  )}
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
