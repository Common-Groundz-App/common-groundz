
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from "@/components/ui/button";
import { Eye, Clock, Users } from 'lucide-react';
import { ReviewWithUser } from '@/types/entities';
import { ReviewUpdate } from '@/services/review/types';
import { fetchReviewUpdates } from '@/services/review/timeline';
import { transformReviewForUI } from '@/utils/reviewDataUtils';
import { getInitialsFromName } from '@/utils/profileUtils';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ReviewMediaBlock } from '@/components/media/ReviewMediaBlock';
import { canEditReview, canEditTimelineUpdate } from '@/utils/reviewEditPolicy';
import { MediaItem } from '@/types/media';
import { ReviewOwnerMenu } from '@/components/reviews/ReviewOwnerMenu';
import type { Review } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';
import UsernameLink from '@/components/common/UsernameLink';

interface TimelineReviewCardProps {
  review: ReviewWithUser;
  onTimelineClick: (review: ReviewWithUser) => void;
  isCircleReview?: boolean;
  circleUserName?: string;
  onDeleted?: () => void;
}

interface TimelineEntry {
  period: string;
  title?: string;
  content: string;
  rating?: number;
  isLatest?: boolean;
  date: string;
  media?: MediaItem[];
  /** Review video Phase 3 — identity + entry-specific edit eligibility. */
  mediaKind: 'review' | 'review_update';
  mediaOwnerId: string;
  canEditMedia: boolean;
}

export const TimelineReviewCard: React.FC<TimelineReviewCardProps> = ({
  review,
  onTimelineClick,
  isCircleReview = false,
  circleUserName,
  onDeleted
}) => {
  const [timelineData, setTimelineData] = useState<ReviewUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user } = useAuth();
  
  const isOwner = user?.id === review.user_id;

  // Using shared getInitialsFromName from profileUtils

  // Filter and sort media
  // Review video Phase 3: keep every field (incl. Mux) for the shared display rule.
  const validMedia: MediaItem[] = ((review.media || []) as any[]).map(item => ({
    ...item,
    order: item.order || 0,
  }));

  useEffect(() => {
    const loadTimelineData = async () => {
      if (review.has_timeline && review.timeline_count && review.timeline_count > 0) {
        try {
          const updates = await fetchReviewUpdates(review.id);
          setTimelineData(updates);
        } catch (error) {
          console.error('Error loading timeline data:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    loadTimelineData();
  }, [review.id, review.has_timeline, review.timeline_count]);

  // Generate timeline entries combining initial review and updates
  const generateTimelineEntries = (): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];

    // Add initial review as first entry with its media
    entries.push({
      period: formatRelativeDate(review.created_at),
      title: review.subtitle,
      content: review.description || `Initial impressions.`,
      rating: review.rating,
      isLatest: false,
      date: review.created_at,
      media: validMedia,
      mediaKind: 'review',
      mediaOwnerId: review.id,
      canEditMedia: canEditReview(review as any, user?.id),
    });

    // Add timeline updates
    const latestUpdateId = [...timelineData]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.id;
    timelineData.forEach((update) => {
      entries.push({
        mediaKind: 'review_update',
        mediaOwnerId: update.id,
        // Update's own hour + latest-update rule, never the parent review's window.
        canEditMedia: canEditTimelineUpdate(update as any, user?.id, update.id === latestUpdateId),
        period: formatRelativeDate(update.created_at),
        content: update.comment,
        rating: update.rating || undefined,
        isLatest: false, // Will be set after sorting
        date: update.created_at,
        media: update.media || []
      });
    });

    // Sort by date (oldest first)
    const sortedEntries = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Mark the last entry (most recent chronologically) as latest
    if (sortedEntries.length > 1) {
      sortedEntries[sortedEntries.length - 1].isLatest = true;
    }

    return sortedEntries;
  };

  const timelineEntries = generateTimelineEntries();
  const transformedReview = transformReviewForUI(review);


  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on buttons or dropdown menu
    if ((e.target as HTMLElement).closest('button, [role="menuitem"]')) {
      return;
    }
    onTimelineClick(review);
  };

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-blue-500 animate-pulse">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow ${
        isCircleReview ? 'border-2 border-blue-200 bg-blue-50/30' : ''
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        {/* Circle Review Badge - Show at top if this is a circle review */}
        {isCircleReview && (
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-blue-600 text-white">
              <Users className="w-3 h-3 mr-1" />
              From Your Circle
            </Badge>
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-600 font-medium">
              {circleUserName || transformedReview.name} you follow reviewed this
            </span>
          </div>
        )}
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 flex-shrink-0">
            <AvatarImage src={transformedReview.avatar || undefined} alt="Timeline reviewer" />
            <AvatarFallback className="bg-brand-orange text-white">
              {getInitialsFromName(transformedReview.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UsernameLink
                  userId={review.user_id}
                  username={review.user?.username}
                  displayName={review.user?.displayName || null}
                  showHandle={true}
                  className="text-sm"
                />
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  <Clock className="w-3 h-3 mr-1" />
                  Timeline Review
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {review.timeline_count} update{review.timeline_count !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              {/* Options Menu for own content */}
              {isOwner && (
                <ReviewOwnerMenu
                  review={review}
                  onAddTimelineUpdate={() => onTimelineClick(review)}
                  editableReview={review as unknown as Review}
                  onDeleted={onDeleted}
                />
              )}
            </div>
            
            {/* Timeline Entries */}
            <div className="space-y-4">
              {timelineEntries.slice(0, 4).map((entry, index) => (
                <div 
                  key={index} 
                  className={`border-l-2 pl-4 ${
                    entry.isLatest 
                      ? 'border-blue-400 bg-blue-50/30 -ml-2 pl-6 py-2 rounded-r-md' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm font-medium text-gray-600">
                      {entry.period}
                    </div>
                    {entry.isLatest && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        Latest
                      </Badge>
                    )}
                    {entry.rating && (
                      <div className="flex items-center">
                        <ConnectedRingsRating
                          value={entry.rating}
                          size="xs"
                          variant="badge"
                          showValue={false}
                          minimal={true}
                          className="mr-1"
                        />
                        <span className="text-xs text-gray-500">
                          {entry.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                   {entry.title && (
                     <h5 className="font-medium text-gray-900 text-sm mb-1">
                       {entry.title}
                     </h5>
                   )}
                   <p className="text-gray-700 text-sm leading-relaxed">
                     {entry.content}
                   </p>
                  
                   {/* Media for this timeline entry */}
                   {entry.media && entry.media.length > 0 && (
                     <div className="mt-2">
                       <ReviewMediaBlock
                         media={entry.media}
                         kind={entry.mediaKind}
                         ownerId={entry.mediaOwnerId}
                         isOwner={isOwner}
                         canEdit={entry.canEditMedia}
                         gridClassName="max-w-xs"
                       />
                     </div>
                   )}
                </div>
              ))}
              
              {timelineEntries.length > 4 && (
                <div className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                  View all {timelineEntries.length} timeline entries →
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lightbox */}

      </CardContent>
    </Card>
  );
};
