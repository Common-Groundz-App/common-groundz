import React from 'react';
import { TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { analytics } from '@/services/analytics';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { getEntityUrlWithParent } from '@/utils/entityUrlUtils';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { EntityCategoryBadge } from '@/components/entity/EntityCategoryBadge';

interface RecommendationData {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  averageRating: number;
  recommendedBy: string[];
  recommendedByUserId?: string | string[];
  recommendedByAvatars?: string[];
  recommendationCount?: number;
  slug?: string;
  parent_id?: string;
  parent_slug?: string;
  reason?: string;
  latestRecommendationDate?: string;
  hasTimelineUpdates?: boolean;
  category_id?: string;
}

interface RecommendationEntityCardProps {
  recommendation: RecommendationData;
  isNetworkRecommendation: boolean;
}

export const RecommendationEntityCard: React.FC<RecommendationEntityCardProps> = ({
  recommendation,
  isNetworkRecommendation
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Track analytics (Phase 5.2)
    analytics.trackRecommendationClick(
      recommendation.id,
      recommendation.name,
      isNetworkRecommendation,
      'main'
    );
    
    navigate(`${getEntityUrlWithParent(recommendation)}?v=4`);
  };

  const formatRecommendedBy = (users: string[], count?: number): string => {
    if (users.length === 0) return 'Unknown';
    if (users.length === 1) return `${users[0]} recommends this`;
    if (users.length === 2) return `${users[0]} and ${users[1]} recommend this`;
    if (users.length === 3) return `${users[0]}, ${users[1]} and ${users[2]} recommend this`;
    
    // If we have a count and it's different from users.length, use the count
    const totalCount = count || users.length;
    const othersCount = totalCount - 2;
    return `${users[0]}, ${users[1]} and ${othersCount} others recommend this`;
  };

  const formatTimeAgo = (dateString?: string): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
    const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
    
    if (diffInHours < 1) return 'recommended recently';
    if (diffInHours < 24) return `recommended ${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    if (diffInDays === 1) return 'recommended yesterday';
    if (diffInDays < 7) return `recommended ${diffInDays} days ago`;
    if (diffInWeeks === 1) return 'recommended 1 week ago';
    if (diffInWeeks < 4) return `recommended ${diffInWeeks} weeks ago`;
    if (diffInMonths === 1) return 'recommended 1 month ago';
    if (diffInMonths < 12) return `recommended ${diffInMonths} months ago`;
    return 'recommended over a year ago';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div 
      onClick={handleClick}
      className="group cursor-pointer bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 flex gap-3 p-3"
    >
      {/* Image */}
      <div className="w-16 h-16 bg-muted relative overflow-hidden rounded-md flex-shrink-0">
        {recommendation.image_url ? (
          <img 
            src={recommendation.image_url} 
            alt={recommendation.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <span className="text-sm font-bold text-muted-foreground">
              {recommendation.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight text-sm">
            {recommendation.name}
          </h3>
          {recommendation.category_id ? (
            <EntityCategoryBadge 
              categoryId={recommendation.category_id} 
              showFullPath={false}
              variant="secondary"
              className="text-xs mt-1"
            />
          ) : (
            <p className="text-xs text-muted-foreground">{getEntityTypeLabel(recommendation.type)}</p>
          )}
        </div>
        
        {/* Rating */}
        <div className="flex items-center gap-1">
          <RatingRingIcon rating={recommendation.averageRating} size={12} />
          <span className="text-xs font-medium">{recommendation.averageRating.toFixed(1)}</span>
        </div>
        
        {/* Attribution */}
        {isNetworkRecommendation && recommendation.recommendedBy.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              {/* Show multiple avatars */}
              <div className="flex -space-x-1">
                {(recommendation.recommendedByAvatars || recommendation.recommendedBy)
                  .slice(0, 3)
                  .map((avatar, index) => {
                    const isUrl = typeof avatar === 'string' && avatar.startsWith('http');
                    const userId = Array.isArray(recommendation.recommendedByUserId) 
                      ? recommendation.recommendedByUserId[index] 
                      : recommendation.recommendedByUserId;
                    
                    return (
                      <Avatar key={index} className="h-4 w-4 border border-background">
                        <AvatarImage src={isUrl ? avatar : ''} />
                        <AvatarFallback className="text-xs">
                          {getInitials(recommendation.recommendedBy[index] || 'Unknown')}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                {(recommendation.recommendationCount || recommendation.recommendedBy.length) > 3 && (
                  <div className="h-4 w-4 rounded-full bg-muted border border-background flex items-center justify-center">
                    <span className="text-xs font-medium">
                      +{(recommendation.recommendationCount || recommendation.recommendedBy.length) - 3}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatRecommendedBy(recommendation.recommendedBy, recommendation.recommendationCount)}
              </p>
            </div>
            {recommendation.latestRecommendationDate && (
              <p className="text-xs text-muted-foreground/70">
                {formatTimeAgo(recommendation.latestRecommendationDate)}
              </p>
            )}
          </div>
        )}
        
        {!isNetworkRecommendation && (
          <p className="text-xs text-muted-foreground">
            {recommendation.reason || 'Popular recommendation'}
          </p>
        )}
      </div>
    </div>
  );
};