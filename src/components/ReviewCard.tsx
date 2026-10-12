
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ReviewWithUser } from '@/types/entities';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ReviewMediaBlock } from '@/components/media/ReviewMediaBlock';
import { canEditReview } from '@/utils/reviewEditPolicy';
import { MediaItem } from '@/types/media';
import { getInitialsFromName } from '@/utils/profileUtils';
import UsernameLink from '@/components/common/UsernameLink';
import { formatDateLong } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewOwnerMenu } from '@/components/reviews/ReviewOwnerMenu';
import type { Review } from '@/services/reviewService';

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
    media?: MediaItem[];
  };
  onHelpfulClick?: (reviewId: string) => void;
  /** Opens the timeline viewer for this review (owner's Add timeline update). */
  onTimelineClick?: (review: ReviewWithUser) => void;
  /** Called after the review is deleted (or found already deleted). */
  onDeleted?: (reviewId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onHelpfulClick, onTimelineClick, onDeleted }) => {
  const { user } = useAuth();
  const isOwner = 'user' in review && !!user && user.id === review.user_id;

  // Using shared getInitialsFromName from profileUtils

  // Filter and sort media
  // Review video Phase 3: keep every field (incl. Mux) so the shared
  // display rule and player see the real item.
  const validMedia: MediaItem[] = ((review.media || []) as any[]).map(item => ({
    ...item,
    id: item.id || '',
    url: item.url || '',
    type: item.type || 'image',
    order: item.order || 0,
  }));
  const canEditThis = 'user' in review && canEditReview(review as any, user?.id);

  // Transform ReviewWithUser to match the expected UI format
  const transformedReview = 'user' in review ? {
    id: review.id,
    name: review.user.displayName || review.user.username || 'Unknown User',
    avatar: review.user.avatar_url || '',
    rating: review.rating,
    date: formatDateLong(review.created_at),
    title: review.subtitle,
    content: review.description || '',
    verified: review.is_verified || false,
    helpful: review.likes || 0
  } : {
    id: review.id.toString(),
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
        <Avatar className="w-12 h-12 flex-shrink-0">
          <AvatarImage src={transformedReview.avatar || undefined} alt={transformedReview.name} />
          <AvatarFallback className="bg-brand-orange text-white">
            {getInitialsFromName(transformedReview.name)}
          </AvatarFallback>
        </Avatar>
          <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {'user' in review ? (
              <UsernameLink
                userId={review.user_id}
                username={review.user?.username}
                displayName={review.user?.displayName || null}
                showHandle={true}
                className="text-sm"
              />
            ) : (
              <h4 className="font-semibold text-gray-900">{transformedReview.name}</h4>
            )}
            {transformedReview.verified && (
              <Badge variant="secondary" className="text-xs">Verified</Badge>
            )}
            {isOwner && 'user' in review && (
              <div className="ml-auto">
                <ReviewOwnerMenu
                  review={review}
                  onAddTimelineUpdate={onTimelineClick ? () => onTimelineClick(review) : undefined}
                  editableReview={review as unknown as Review}
                  onDeleted={onDeleted ? () => onDeleted(review.id) : undefined}
                />
              </div>
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
          
          {/* Review Headline */}
          {transformedReview.title && (
            <h3 className="font-semibold text-gray-900 text-base mb-2">{transformedReview.title}</h3>
          )}
          
          <p className="text-gray-700 text-sm leading-relaxed">{transformedReview.content}</p>
          
          {/* Media Display */}
          {validMedia.length > 0 && (
            <ReviewMediaBlock
              className="mt-3"
              media={validMedia}
              kind="review"
              ownerId={String(review.id)}
              isOwner={isOwner}
              canEdit={canEditThis}
            />
          )}
        </div>
      </div>

    </div>
  );
};

export default ReviewCard;
