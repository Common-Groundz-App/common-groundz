
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Heart, MessageCircle, Bookmark, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Review } from '@/services/reviewService';

interface ReviewCardFooterProps {
  review: Review;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onConvert?: (id: string) => void;
}

const ReviewCardFooter: React.FC<ReviewCardFooterProps> = ({
  review,
  onLike,
  onSave,
  onConvert
}) => {
  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onLike(review.id);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSave(review.id);
  };

  const handleConvertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onConvert) {
      onConvert(review.id);
    }
  };

  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "transition-colors flex items-center gap-1 px-2",
            review.isLiked 
              ? "text-red-500" 
              : "text-gray-500 hover:text-red-500"
          )}
          onClick={handleLikeClick}
        >
          <Heart 
            size={16} 
            className={review.isLiked ? "fill-red-500" : ""} 
          />
          <span>{review.likes || 0}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="transition-colors flex items-center gap-1 px-2 text-gray-500 hover:text-gray-700"
        >
          <MessageCircle size={16} />
          {review.comment_count > 0 && (
            <span>{review.comment_count}</span>
          )}
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-8 w-8 transition-colors", 
            review.isSaved 
              ? "text-brand-orange" 
              : "text-gray-500 hover:text-brand-orange"
          )}
          onClick={handleSaveClick}
        >
          <Bookmark size={18} className={review.isSaved ? "fill-brand-orange" : ""} />
        </Button>

        {!review.is_converted && onConvert && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleConvertClick}
                className="text-xs flex items-center gap-1"
              >
                <UploadCloud size={14} /> Convert
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Convert this review to a recommendation</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default ReviewCardFooter;
