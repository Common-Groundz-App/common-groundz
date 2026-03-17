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
import { Badge } from '@/components/ui/badge';
import { shouldHideCategory } from '@/services/categoryService';
import { getOptimalEntityImageUrl } from '@/utils/entityImageUtils';

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
    
    navigate(getEntityUrlWithParent(recommendation));
  };

  const truncateName = (name: string, max = 12): string => {
    if (!name || name.length <= max) return name || 'Unknown';
    return name.slice(0, max).trimEnd() + '…';
  };

  const formatRecommendedBy = (users: string[], count?: number): string => {
    const validUsers = users.filter(u => u && u.trim());
    if (validUsers.length === 0) return '';
    const totalCount = count || validUsers.length;
    if (totalCount === 1) return `${truncateName(validUsers[0])} recommends this`;
    if (totalCount === 2) return `${truncateName(validUsers[0])} & ${truncateName(validUsers[1] || validUsers[0])} recommend this`;
    return `${truncateName(validUsers[0])} & ${totalCount - 1} others recommend this`;
  };

  const formatShortTimeAgo = (dateString?: string): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
    const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
    
    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    if (diffInMonths < 12) return `${diffInMonths}mo ago`;
    return '1y+ ago';
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
        {getOptimalEntityImageUrl(recommendation) ? (
          <img 
            src={getOptimalEntityImageUrl(recommendation) || ''} 
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
          {recommendation.category_id && !shouldHideCategory(recommendation.category_id) ? (
            <EntityCategoryBadge 
              categoryId={recommendation.category_id} 
              showFullPath={false}
              variant="secondary"
              className="text-xs mt-1"
            />
          ) : (
            <Badge variant="secondary" className="text-xs mt-1">
              {getEntityTypeLabel(recommendation.type)}
            </Badge>
          )}
        </div>
        
        {/* Rating */}
        <div className="flex items-center gap-1">
          <RatingRingIcon rating={recommendation.averageRating} size={12} />
          <span className="text-xs font-medium">{recommendation.averageRating.toFixed(1)}</span>
        </div>
        
        {/* Attribution */}
        {isNetworkRecommendation && recommendation.recommendedBy.length > 0 && (
          <div className="flex items-center gap-1">
              {/* Show max 2 avatars */}
              <div className="flex -space-x-1">
                {(recommendation.recommendedByAvatars || recommendation.recommendedBy)
                  .slice(0, 2)
                  .map((avatar, index) => {
                    const isUrl = typeof avatar === 'string' && avatar.startsWith('http');
                    
                    return (
                      <Avatar key={index} className="h-4 w-4 border border-background">
                        <AvatarImage src={isUrl ? avatar : ''} />
                        <AvatarFallback className="text-xs">
                          {getInitials(recommendation.recommendedBy[index] || 'Unknown')}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                {(recommendation.recommendationCount || recommendation.recommendedBy.length) > 2 && (
                  <div className="h-4 w-4 rounded-full bg-muted border border-background flex items-center justify-center">
                    <span className="text-[8px] font-medium">
                      +{(recommendation.recommendationCount || recommendation.recommendedBy.length) - 2}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {formatRecommendedBy(recommendation.recommendedBy, recommendation.recommendationCount)}
                {recommendation.latestRecommendationDate && (
                  <span className="text-muted-foreground/70"> · {formatShortTimeAgo(recommendation.latestRecommendationDate)}</span>
                )}
              </p>
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