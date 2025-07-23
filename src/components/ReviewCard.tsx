
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ReviewWithUser } from '@/types/entities';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';

interface ReviewCardProps {
  review: ReviewWithUser | {
    id: number;
    name: string;
    avatar: string;
    rating: number;
    date: string;
    title: string;
    content: string;
    verified: boolean;
    helpful: number;
  };
  onHelpfulClick?: (reviewId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onHelpfulClick }) => {
  // Transform ReviewWithUser to match the expected UI format
  const transformedReview = 'user' in review ? {
    id: review.id,
    userId: review.user_id,
    name: review.user.username || 'Unknown User',
    avatar: review.user.avatar_url || '',
    rating: review.rating,
    date: new Date(review.created_at).toLocaleDateString(),
    title: review.title,
    content: review.description || '',
    verified: review.is_verified || false,
    helpful: review.likes || 0
  } : {
    id: review.id.toString(),
    userId: null, // Legacy format doesn't have user ID
    name: review.name,
    avatar: review.avatar,
    rating: review.rating,
    date: review.date,
    title: review.title,
    content: review.content,
    verified: review.verified,
    helpful: review.helpful
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <ProfileAvatar
          userId={transformedReview.userId}
          size="lg"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900">{transformedReview.name}</h4>
            {transformedReview.verified && (
              <Badge variant="secondary" className="text-xs">Verified</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-medium text-gray-600">
              {transformedReview.date}
            </div>
            <div className="flex items-center">
              <ConnectedRingsRating
                value={transformedReview.rating}
                size="xs"
                variant="badge"
                showValue={false}
                minimal={true}
                className="mr-1"
              />
              <span className="text-xs text-gray-500">
                {transformedReview.rating.toFixed(1)}
              </span>
            </div>
          </div>
          
          <p className="text-gray-700 text-sm leading-relaxed">{transformedReview.content}</p>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
