import React from 'react';
import { TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { analytics } from '@/services/analytics';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';

interface RecommendationData {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  averageRating: number;
  recommendedBy: string[];
  recommendedByUserId?: string;
  slug?: string;
  reason?: string;
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
    
    if (recommendation.slug) {
      navigate(`/entity/${recommendation.slug}?v=4`);
    } else {
      navigate(`/entity/${recommendation.id}?v=4`);
    }
  };

  const formatRecommendedBy = (recommendedBy: string[]) => {
    if (recommendedBy.length === 0) return null;
    if (recommendedBy.length === 1) return recommendedBy[0];
    if (recommendedBy.length === 2) return `${recommendedBy[0]} & ${recommendedBy[1]}`;
    return `${recommendedBy[0]} & ${recommendedBy.length - 1} others`;
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
          <p className="text-xs text-muted-foreground capitalize">{recommendation.type}</p>
        </div>
        
        {/* Rating */}
        <div className="flex items-center gap-1">
          <RatingRingIcon rating={recommendation.averageRating} size={12} />
          <span className="text-xs font-medium">{recommendation.averageRating.toFixed(1)}</span>
        </div>
        
        {/* Attribution */}
        {isNetworkRecommendation && recommendation.recommendedBy.length > 0 && recommendation.recommendedByUserId && (
          <div className="flex items-center gap-2">
            <ProfileAvatar 
              userId={recommendation.recommendedByUserId}
              size="xs"
              showSkeleton={false}
            />
            <p className="text-xs text-muted-foreground">
              {recommendation.recommendedBy[0]} recommended this
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