
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
import { SpoilerBarrier } from '@/components/reviews/SpoilerBarrier';
import { hasSpoilerFlag } from '@/utils/spoilers';
import { PrivateReviewBanner, PRIVATE_CARD_CLASSES } from '@/components/entity-v4/PrivateReviewBanner';
import CompactReviewSignals from '@/components/profile/reviews/questionnaire/CompactReviewSignals';

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
  /** Opens the shared review/timeline viewer (View Details, owner Add timeline update). */
  onTimelineClick?: (review: ReviewWithUser) => void;
  /** Called after the review is deleted (or found already deleted). */
  onDeleted?: (reviewId: string) => void;
  /** Owner's pinned private review: amber privacy banner. */
  isPrivateReview?: boolean;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onHelpfulClick, onTimelineClick, onDeleted, isPrivateReview = false }) => {
  const { user } = useAuth();
  const isOwner = 'user' in review && !!user && user.id === review.user_id;
  const [spoilerRevealed, setSpoilerRevealed] = React.useState(false);
  const spoilerHidden = 'user' in review && hasSpoilerFlag(review.metadata) && !spoilerRevealed;

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
    <div className={isPrivateReview ? `${PRIVATE_CARD_CLASSES} rounded-lg p-6` : "bg-white border rounded-lg p-6"}>
      {isPrivateReview && <PrivateReviewBanner />}
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
          
          {spoilerHidden ? (
            <SpoilerBarrier onReveal={() => setSpoilerRevealed(true)} />
          ) : (<>
          {/* Review Headline */}
          {transformedReview.title && (
            <h3 className="font-semibold text-gray-900 text-base mb-2">{transformedReview.title}</h3>
          )}
          
          <p className="text-gray-700 text-sm leading-relaxed">{transformedReview.content}</p>

          {'user' in review && (
            <CompactReviewSignals className="mt-3" metadata={review.metadata} category={review.category} />
          )}
          
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
          </>)}

          {'user' in review && onTimelineClick && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => onTimelineClick(review)}
                className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                aria-label={`View details of ${transformedReview.name}'s review`}
              >
                View Details →
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ReviewCard;
