
import React, { useState } from 'react';
import { Calendar, ChevronDown, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Review } from '@/services/reviewService';
import { MediaItem } from '@/types/media';
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';

interface ReviewCardBodyProps {
  review: Review;
  mediaItems: MediaItem[];
  getFallbackImage: () => string;
  getCategoryFallbackImage: (category: string) => string;
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
}

const CONTENT_LIMIT = 120;

const ReviewCardBody: React.FC<ReviewCardBodyProps> = ({
  review,
  mediaItems,
  getFallbackImage,
  getCategoryFallbackImage,
  isExpanded,
  setIsExpanded
}) => {
  return (
    <div className="space-y-3">
      {/* Media Gallery */}
      <div className="h-48 relative overflow-hidden rounded-lg">
        {mediaItems.length > 0 ? (
          <PostMediaDisplay
            media={mediaItems}
            aspectRatio="16:9"
            objectFit="cover"
            enableBackground={true}
            className="w-full h-full rounded-lg"
            thumbnailDisplay="hover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden rounded-lg">
            <ImageWithFallback
              src={getFallbackImage()}
              alt={`${review.title} - ${review.category}`}
              className="w-full h-full object-cover"
              fallbackSrc={getCategoryFallbackImage(review.category)}
            />
          </div>
        )}
        
        {/* Media Counter Badge */}
        {mediaItems.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center">
            <ImageIcon size={14} className="mr-1" />
            +{mediaItems.length - 1} more
          </div>
        )}
      </div>

      {/* Title and Rating */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold line-clamp-2">{review.title}</h3>
        <div className="flex-shrink-0">
          <ConnectedRingsRating 
            value={review.rating} 
            size="sm" 
            showLabel={true}
          />
        </div>
      </div>

      {/* Venue and Experience Date */}
      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
        {review.venue && (
          <span className="flex items-center gap-1 truncate max-w-[150px]">
            <span>📍</span>
            {review.venue}
          </span>
        )}
        
        {review.experience_date && (
          <span className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {format(new Date(review.experience_date), 'MMM d, yyyy')}
          </span>
        )}
      </div>

      {/* Review description with expandable text */}
      {review.description && (
        <div>
          <div className={cn(
            "text-xs text-muted-foreground relative",
            isExpanded ? "" : "max-h-[60px] overflow-hidden"
          )}>
            <p>{review.description}</p>
            
            {(!isExpanded && review.description && review.description.length > CONTENT_LIMIT) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent h-8" />
            )}
          </div>
          
          {review.description && review.description.length > CONTENT_LIMIT && (
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto text-xs font-normal text-muted-foreground mt-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Show less" : "Show more"}
              <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", isExpanded && "rotate-180")} />
            </Button>
          )}
        </div>
      )}

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {review.tags.slice(0, 3).map((tag, index) => (
            <Badge 
              key={index}
              variant="outline" 
              className="text-xs bg-gray-50 dark:bg-gray-800 hover:bg-gray-100"
            >
              {tag}
            </Badge>
          ))}
          {review.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{review.tags.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewCardBody;
