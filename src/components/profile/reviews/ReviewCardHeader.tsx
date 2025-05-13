
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { Review } from '@/services/reviewService';

interface ReviewCardHeaderProps {
  review: Review;
  getStatusBadge: () => React.ReactNode | null;
  getCategoryColor: (category: string) => string;
  getCategoryEmoji: (category: string) => string;
  getCategoryLabel: (category: string) => string;
}

const ReviewCardHeader: React.FC<ReviewCardHeaderProps> = ({
  review,
  getStatusBadge,
  getCategoryColor,
  getCategoryEmoji,
  getCategoryLabel
}) => {
  return (
    <div className="mb-3">
      {/* User info and timestamp */}
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={review.avatar_url || undefined} alt={review.username || 'User'} />
          <AvatarFallback>{(review.username || 'U')[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-medium text-xs">{review.username || 'User'}</div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(review.created_at), 'MMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Category & Status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={getCategoryColor(review.category)}>
          <span className="mr-1">{getCategoryEmoji(review.category)}</span>
          {getCategoryLabel(review.category)}
        </Badge>
        {getStatusBadge()}
        {review.is_converted && (
          <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 text-xs">
            <UploadCloud size={10} />
            <span>Converted</span>
          </Badge>
        )}
      </div>
    </div>
  );
};

export default ReviewCardHeader;
