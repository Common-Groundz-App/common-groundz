
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from "@/components/ui/button";
import { Eye, Clock, Users, MoreVertical } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ReviewWithUser } from '@/types/entities';
import { ReviewUpdate } from '@/services/review/types';
import { fetchReviewUpdates } from '@/services/review/timeline';
import { transformReviewForUI } from '@/utils/reviewDataUtils';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { YelpStyleMediaPreview } from '@/components/media/YelpStyleMediaPreview';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { MediaItem } from '@/types/media';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { deleteReview } from '@/services/review/core';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  const isOwner = user?.id === review.user_id;

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  // Filter and sort media
  const validMedia: MediaItem[] = (review.media || [])
    .filter(item => !(item as any).is_deleted)
    .map(item => ({
      id: item.id || '',
      url: item.url,
      type: item.type,
      thumbnail_url: item.thumbnail_url,
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
      media: validMedia
    });

    // Add timeline updates
    timelineData.forEach((update, index) => {
      entries.push({
        period: formatRelativeDate(update.created_at),
        content: update.comment,
        rating: update.rating || undefined,
        isLatest: index === timelineData.length - 1, // Mark latest update
        date: update.created_at,
        media: update.media || []
      });
    });

    // Sort by date (oldest first)
    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const timelineEntries = generateTimelineEntries();
  const transformedReview = transformReviewForUI(review);

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteReview(review.id);
      toast({
        title: 'Review deleted',
        description: 'Your timeline review has been deleted successfully.',
      });
      setIsDeleteModalOpen(false);
      if (onDeleted) {
        onDeleted();
      }
    } catch (error: any) {
      toast({
        title: 'Something went wrong',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
              {getInitials(transformedReview.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{transformedReview.name}</h4>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full p-0 h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteModalOpen(true);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                       <YelpStyleMediaPreview
                         media={entry.media}
                         onImageClick={handleMediaClick}
                         className="max-w-xs"
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
        {isLightboxOpen && (
          <LightboxPreview
            media={validMedia}
            initialIndex={selectedMediaIndex}
            onClose={() => setIsLightboxOpen(false)}
          />
        )}

        {/* Delete confirmation dialog */}
        <DeleteConfirmationDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          title="Delete Timeline Review"
          description="Are you sure you want to delete this timeline review? This action cannot be undone."
          isLoading={isDeleting}
        />
      </CardContent>
    </Card>
  );
};
