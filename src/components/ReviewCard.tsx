
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ReviewWithUser } from '@/types/entities';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { YelpStyleMediaPreview } from '@/components/media/YelpStyleMediaPreview';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { MediaItem } from '@/types/media';

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
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onHelpfulClick }) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  // Filter and sort media
  const validMedia: MediaItem[] = (review.media || [])
    .filter(item => !(item as any).is_deleted)
    .map(item => ({
      id: (item as any).id || '',
      url: (item as any).url || '',
      type: (item as any).type || 'image',
      thumbnail_url: (item as any).thumbnail_url,
      order: (item as any).order || 0,
      caption: (item as any).caption,
      alt: (item as any).alt,
      is_deleted: (item as any).is_deleted,
      session_id: (item as any).session_id,
      width: (item as any).width,
      height: (item as any).height,
      orientation: (item as any).orientation,
      source: (item as any).source
    }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleMediaClick = (index: number) => {
    setSelectedMediaIndex(index);
    setIsLightboxOpen(true);
  };

  // Transform ReviewWithUser to match the expected UI format
  const transformedReview = 'user' in review ? {
    id: review.id,
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
            {getInitials(transformedReview.name)}
          </AvatarFallback>
        </Avatar>
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
          
          {/* Media Display */}
          {validMedia.length > 0 && (
            <div className="mt-3">
              <YelpStyleMediaPreview
                media={validMedia}
                onImageClick={handleMediaClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && validMedia.length > 0 && (
        <LightboxPreview
          media={validMedia}
          initialIndex={selectedMediaIndex}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default ReviewCard;
