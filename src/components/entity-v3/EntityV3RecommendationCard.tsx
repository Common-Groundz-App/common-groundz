
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Heart, Share2, ExternalLink, MapPin } from 'lucide-react';
import { Review } from '@/services/review/types';
import { formatDistanceToNow } from 'date-fns';

interface EntityV3RecommendationCardProps {
  recommendation: Review;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export const EntityV3RecommendationCard: React.FC<EntityV3RecommendationCardProps> = ({
  recommendation,
  onLike,
  onSave,
  isLoading = false,
  compact = false
}) => {
  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={recommendation.user?.avatar_url} />
              <AvatarFallback className="text-xs">
                {recommendation.user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1">
                  {renderStars(recommendation.rating)}
                </div>
                <span className="text-sm font-medium">{recommendation.rating}/5</span>
              </div>
              
              <h4 className="font-medium text-sm line-clamp-2 mb-1">
                {recommendation.title}
              </h4>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{recommendation.user?.username}</span>
                <span>•</span>
                <span>{formatDate(recommendation.created_at)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={recommendation.user?.avatar_url} />
            <AvatarFallback>
              {recommendation.user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground">
                {recommendation.user?.username || 'Anonymous User'}
              </span>
              {recommendation.is_recommended && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                  Recommended
                </Badge>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              {formatDate(recommendation.created_at)}
            </div>
          </div>
        </div>

        {/* Rating and Title */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              {renderStars(recommendation.rating)}
            </div>
            <span className="font-medium">{recommendation.rating}/5</span>
            <Badge variant="outline" className="text-xs">
              {recommendation.category}
            </Badge>
          </div>
          
          <h3 className="font-semibold text-lg text-foreground mb-2">
            {recommendation.title}
          </h3>
          
          {recommendation.subtitle && (
            <p className="text-sm text-muted-foreground">
              {recommendation.subtitle}
            </p>
          )}
        </div>

        {/* Description */}
        {recommendation.description && (
          <p className="text-foreground leading-relaxed mb-4 line-clamp-3">
            {recommendation.description}
          </p>
        )}

        {/* Venue Information */}
        {recommendation.venue && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{recommendation.venue}</span>
          </div>
        )}

        {/* Entity Link */}
        {recommendation.entity && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {recommendation.entity.image_url && (
                  <img 
                    src={recommendation.entity.image_url} 
                    alt={recommendation.entity.name}
                    className="w-10 h-10 rounded-md object-cover"
                  />
                )}
                <div>
                  <h4 className="font-medium text-sm">{recommendation.entity.name}</h4>
                  <p className="text-xs text-muted-foreground capitalize">
                    {recommendation.entity.type}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike?.(recommendation.id)}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Heart className={`w-4 h-4 ${recommendation.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-sm">{recommendation.likes || 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave?.(recommendation.id)}
            disabled={isLoading}
          >
            {recommendation.isSaved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
