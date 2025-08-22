import React from 'react';
import { Star, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    if (recommendedBy.length === 1) return `Recommended by ${recommendedBy[0]}`;
    if (recommendedBy.length === 2) return `Recommended by ${recommendedBy[0]} and ${recommendedBy[1]}`;
    return `Recommended by ${recommendedBy[0]}, ${recommendedBy[1]} and ${recommendedBy.length - 2} others`;
  };

  return (
    <div 
      onClick={handleClick}
      className="group relative flex flex-col gap-3 p-4 border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer bg-card hover:bg-card/80"
    >
      {/* Image and basic info */}
      <div className="flex items-start gap-3">
        <div className="relative">
          <img 
            src={recommendation.image_url || '/placeholder.svg'} 
            alt={recommendation.name}
            className="w-14 h-14 rounded-lg object-cover" 
          />
          {!isNetworkRecommendation && (
            <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
              <TrendingUp className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {recommendation.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {recommendation.type}
          </p>
          
          {/* Rating */}
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">
              {recommendation.averageRating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div className="mt-2">
        {isNetworkRecommendation && recommendation.recommendedBy.length > 0 ? (
          <p className="text-xs text-primary font-medium">
            {formatRecommendedBy(recommendation.recommendedBy)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {recommendation.reason || 'Popular choice'}
          </p>
        )}
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
    </div>
  );
};