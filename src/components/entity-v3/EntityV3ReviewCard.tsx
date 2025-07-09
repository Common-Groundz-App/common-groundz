
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, ThumbsUp, ThumbsDown, Share2, Flag, Calendar, CheckCircle, MoreHorizontal } from 'lucide-react';
import { Review } from '@/services/review/types';
import { formatDistanceToNow } from 'date-fns';

interface EntityV3ReviewCardProps {
  review: Review;
  onLike?: (reviewId: string) => void;
  onSave?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
  isLoading?: boolean;
}

export const EntityV3ReviewCard: React.FC<EntityV3ReviewCardProps> = ({
  review,
  onLike,
  onSave,
  onReport,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const shouldTruncate = review.description && review.description.length > 200;
  const displayText = shouldTruncate && !isExpanded 
    ? review.description.substring(0, 200) + '...' 
    : review.description;

  const renderStars = (rating: number, size = "w-4 h-4") => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`${size} ${
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

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        {/* Header with user info and rating */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={review.user?.avatar_url} />
              <AvatarFallback>
                {review.user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">
                  {review.user?.username || 'Anonymous User'}
                </span>
                {review.is_verified && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                {review.trust_score && review.trust_score > 1.5 && (
                  <Badge variant="secondary" className="text-xs">
                    Trusted Reviewer
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatDate(review.created_at)}
                {review.experience_date && (
                  <span>• Visited {formatDate(review.experience_date)}</span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActions(!showActions)}
            className="relative"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>

        {/* Rating and title */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              {renderStars(review.rating)}
            </div>
            <span className="text-sm font-medium">{review.rating}/5</span>
            {review.latest_rating && review.latest_rating !== review.rating && (
              <Badge variant="outline" className="text-xs">
                Updated: {review.latest_rating}/5
              </Badge>
            )}
          </div>
          
          <h4 className="font-semibold text-foreground text-lg leading-tight">
            {review.title}
          </h4>
          
          {review.subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {review.subtitle}
            </p>
          )}
        </div>

        {/* Review content */}
        {review.description && (
          <div className="mb-4">
            <p className="text-foreground leading-relaxed">
              {displayText}
            </p>
            {shouldTruncate && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0 h-auto text-primary hover:underline mt-1"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </Button>
            )}
          </div>
        )}

        {/* Review metadata */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="text-xs">
            {review.category}
          </Badge>
          {review.venue && (
            <Badge variant="outline" className="text-xs">
              📍 {review.venue}
            </Badge>
          )}
          {review.has_timeline && (
            <Badge variant="secondary" className="text-xs">
              Timeline Review ({review.timeline_count} updates)
            </Badge>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike?.(review.id)}
              disabled={isLoading}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ThumbsUp className={`w-4 h-4 ${review.isLiked ? 'fill-current text-primary' : ''}`} />
              <span className="text-sm">{review.likes || 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSave?.(review.id)}
              disabled={isLoading}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ThumbsDown className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReport?.(review.id)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Flag className="w-4 h-4" />
            Report
          </Button>
        </div>

        {/* Action menu */}
        {showActions && (
          <div className="absolute right-4 top-16 bg-background border rounded-md shadow-lg z-10 p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              Follow Reviewer
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              View Profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
