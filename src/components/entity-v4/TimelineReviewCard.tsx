
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Clock } from 'lucide-react';
import { ReviewWithUser } from '@/types/entities';
import { ReviewUpdate } from '@/services/review/types';
import { fetchReviewUpdates } from '@/services/review/timeline';
import { transformReviewForUI } from '@/utils/reviewDataUtils';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';

interface TimelineReviewCardProps {
  review: ReviewWithUser;
  onTimelineClick: (review: ReviewWithUser) => void;
}

interface TimelineEntry {
  period: string;
  content: string;
  rating?: number;
  isLatest?: boolean;
  date: string;
}

export const TimelineReviewCard: React.FC<TimelineReviewCardProps> = ({
  review,
  onTimelineClick
}) => {
  const [timelineData, setTimelineData] = useState<ReviewUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    // Add initial review as first entry
    entries.push({
      period: formatRelativeDate(review.created_at),
      content: review.description || `Started using ${review.title}. Initial impressions.`,
      rating: review.rating,
      isLatest: false,
      date: review.created_at
    });

    // Add timeline updates
    timelineData.forEach((update, index) => {
      entries.push({
        period: formatRelativeDate(update.created_at),
        content: update.comment,
        rating: update.rating || undefined,
        isLatest: index === timelineData.length - 1, // Mark latest update
        date: update.created_at
      });
    });

    // Sort by date (oldest first)
    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const timelineEntries = generateTimelineEntries();
  const transformedReview = transformReviewForUI(review);

  const handleCardClick = () => {
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
      className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <ProfileAvatar
            userId={review.user_id}
            size="lg"
            className="flex-shrink-0"
            fallbackUsername={review.user.username}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-semibold text-gray-900">{transformedReview.name}</h4>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                <Clock className="w-3 h-3 mr-1" />
                Timeline Review
              </Badge>
              <Badge variant="outline" className="text-xs">
                {review.timeline_count} update{review.timeline_count !== 1 ? 's' : ''}
              </Badge>
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
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {entry.content}
                  </p>
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
      </CardContent>
    </Card>
  );
};
