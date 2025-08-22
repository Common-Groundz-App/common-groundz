import React from 'react';
import { Star, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RecommendationData {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  averageRating: number;
  recommendedBy: string[];
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
      className="group cursor-pointer bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {recommendation.image_url ? (
          <img 
            src={recommendation.image_url} 
            alt={recommendation.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-muted-foreground">
              {recommendation.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        
        {/* Network indicator */}
        {isNetworkRecommendation && (
          <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Users className="h-3 w-3" />
            Network
          </div>
        )}
        
        {!isNetworkRecommendation && (
          <div className="absolute top-2 right-2 bg-secondary/90 text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Popular
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight text-sm">
            {recommendation.name}
          </h3>
          <p className="text-xs text-muted-foreground capitalize mt-1">{recommendation.type}</p>
        </div>
        
        {/* Rating */}
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-medium">{recommendation.averageRating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground ml-1">rating</span>
        </div>
        
        {/* Attribution */}
        {isNetworkRecommendation && recommendation.recommendedBy.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {recommendation.recommendedBy.slice(0, 3).map((username, index) => (
                <Avatar key={index} className="h-5 w-5 border-2 border-card">
                  <AvatarImage src="" alt={username} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary text-[9px]">
                    {getInitials(username)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-xs text-primary font-medium">
              {formatRecommendedBy(recommendation.recommendedBy)}
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