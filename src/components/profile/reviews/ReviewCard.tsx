
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Bookmark, MoreVertical, Share2, Calendar, MapPin, Edit3, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { toast } from '@/hooks/use-toast';
import { deleteReview } from '@/services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ProfileDisplay } from '@/components/common/ProfileDisplay';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { TimelineBadge } from './TimelineBadge';
import { TimelinePreview } from './TimelinePreview';
import { DynamicRatingDisplay } from './DynamicRatingDisplay';

interface ReviewCardProps {
  review: any;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onConvert?: (reviewId: string) => Promise<void>;
  refreshReviews?: () => void;
  hideEntityFallbacks?: boolean;
  compact?: boolean;
  showTimelineFeatures?: boolean;
  showDynamicRating?: boolean;
}

const ReviewCard = ({
  review,
  onLike,
  onSave,
  refreshReviews,
  hideEntityFallbacks = false,
  compact = false,
  showTimelineFeatures = false,
  showDynamicRating = false
}: ReviewCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(review.isLiked || false);
  const [isSaved, setIsSaved] = useState(review.isSaved || false);
  const [likes, setLikes] = useState(review.likes || 0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === review.user_id;

  const handleLike = async () => {
    if (!user) return;
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
    if (onLike) {
      onLike(review.id);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaved(!isSaved);
    if (onSave) {
      onSave(review.id);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteReview(review.id);
      toast({
        title: 'Review deleted',
        description: 'Your review has been deleted successfully.',
      });
      setIsDeleteModalOpen(false);
      if (refreshReviews) {
        refreshReviews();
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
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    
    if (review.entity && review.entity.slug) {
      const entityRoute = getEntityRoute(review.entity);
      if (entityRoute) {
        navigate(entityRoute);
      }
    }
  };

  const getEntityRoute = (entity: any) => {
    if (!entity || !entity.slug) return null;
    
    const typeToRoute: Record<string, string> = {
      'place': '/place',
      'food': '/place',
      'drink': '/place',
      'movie': '/movie',
      'book': '/book',
      'product': '/product',
      'tv': '/entity',
      'music': '/entity',
      'art': '/entity',
      'activity': '/entity',
      'travel': '/entity'
    };

    const routePrefix = typeToRoute[entity.type?.toLowerCase()] || '/entity';
    return `${routePrefix}/${entity.slug}`;
  };

  if (compact) {
    return (
      <Card 
        className="overflow-hidden hover:shadow-md transition-shadow duration-200"
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          {/* Enhanced Compact Layout - Rating First */}
          <div className="flex items-start justify-between mb-3">
            {/* Rating and Title Section */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {/* Dynamic Rating Display or Regular Rating */}
                {showDynamicRating ? (
                  <DynamicRatingDisplay
                    reviewId={review.id}
                    initialRating={review.rating}
                    hasTimeline={review.has_timeline}
                    timelineCount={review.timeline_count}
                    size="sm"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <ConnectedRingsRating
                      value={review.rating}
                      size="sm"
                      variant="badge"
                      showValue={false}
                      minimal={true}
                    />
                    <span className="text-lg font-bold" style={{ 
                      color: review.rating < 2 ? "#ea384c" : 
                             review.rating < 3 ? "#F97316" : 
                             review.rating < 4 ? "#FEC006" : 
                             review.rating < 4.5 ? "#84cc16" : "#22c55e" 
                    }}>
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-lg leading-tight mb-1">{review.title}</h3>
            </div>
            
            {/* Timeline Badge and Options Menu */}
            <div className="flex items-center gap-2">
              {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
                <TimelineBadge 
                  updateCount={review.timeline_count} 
                  size="sm"
                />
              )}
              
              {/* Options Menu for own content */}
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full p-0 h-6 w-6"
                    >
                      <MoreVertical className="h-3 w-3" />
                      <span className="sr-only">Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => setIsDeleteModalOpen(true)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {/* Ultra-Compact User Info */}
          <div className="flex items-center gap-2 mb-3">
            <ProfileDisplay
              userId={review.user_id}
              size="xs"
              showUsername={true}
              showLink={true}
              className="hover:opacity-80 transition-opacity"
            />
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(review.created_at)}
            </span>
          </div>
          
          {/* Description */}
          {review.content && (
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              <p className="line-clamp-3">{review.content}</p>
            </div>
          )}

          {/* Entity Badge - Only show if entity exists and we're not hiding fallbacks */}
          {review.entity && !hideEntityFallbacks && (
            <div className="mb-3">
              <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                {review.entity.name}
              </Badge>
            </div>
          )}

          {/* Timeline Preview for Dynamic Reviews */}
          {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
            <div className="mb-3">
              <TimelinePreview 
                reviewId={review.id}
                compact={true}
              />
            </div>
          )}

          {/* Compact Social Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                className={cn(
                  "flex items-center gap-1 py-0 px-1 text-xs h-6", 
                  isLiked && "text-red-500 hover:text-red-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
              >
                <Heart className={cn("h-3 w-3", isLiked && "fill-current")} />
                <span>{likes}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 py-0 px-1 text-xs h-6"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MessageCircle className="h-3 w-3" />
                <span>0</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex items-center gap-1 py-0 px-1 text-xs h-6",
                  isSaved && "text-primary"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
              >
                <Bookmark className={cn("h-3 w-3", isSaved && "fill-current")} />
              </Button>
            </div>
            
            {/* Share button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 py-0 px-1 text-xs h-6"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Share2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
        
        {/* Delete confirmation dialog */}
        <DeleteConfirmationDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          title="Delete Review"
          description="Are you sure you want to delete this review? This action cannot be undone."
          isLoading={isDeleting}
        />
      </Card>
    );
  }

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow duration-200"
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        {/* Card Header with User Info */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <ProfileDisplay
              userId={review.user_id}
              size="md"
              showUsername={true}
              showLink={true}
              className="hover:opacity-80 transition-opacity"
            />
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <span>{formatRelativeDate(review.created_at)}</span>
              <span>·</span>
              {showDynamicRating ? (
                <DynamicRatingDisplay
                  reviewId={review.id}
                  initialRating={review.rating}
                  hasTimeline={review.has_timeline}
                  timelineCount={review.timeline_count}
                  size="xs"
                />
              ) : (
                <ConnectedRingsRating
                  value={review.rating}
                  size="badge"
                  variant="badge"
                  showValue={false}
                  minimal={true}
                />
              )}
            </div>
          </div>
          
          {/* Timeline Badge and Options Menu */}
          <div className="flex items-center gap-2">
            {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
              <TimelineBadge 
                updateCount={review.timeline_count} 
                size="sm"
              />
            )}
            
            {/* Options Menu for own content */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full p-0 h-8 w-8"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        {/* Title and Category */}
        <div className="mt-4">
          <h3 className="font-semibold text-lg">{review.title}</h3>
          
          {review.entity && !hideEntityFallbacks && (
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                {review.entity.name}
              </Badge>
            </div>
          )}
        </div>
        
        {/* Description */}
        {review.content && (
          <div className="text-sm text-muted-foreground mt-3">
            <p className="line-clamp-3">{review.content}</p>
          </div>
        )}

        {/* Timeline Preview for Dynamic Reviews */}
        {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
          <div className="mt-4">
            <TimelinePreview 
              reviewId={review.id}
              compact={false}
            />
          </div>
        )}
        
        {/* Social Actions */}
        <div className="flex items-center justify-between border-t mt-4 pt-4">
          <div className="flex items-center gap-3 sm:gap-6">
            <Button 
              variant="ghost" 
              size="sm"
              className={cn(
                "flex items-center gap-1 py-0 px-2 sm:px-4",
                isLiked && "text-red-500 hover:text-red-600"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
            >
              <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
              <span>{likes}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 py-0 px-2 sm:px-4"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <MessageCircle className="h-5 w-5" />
              <span>0</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "flex items-center gap-1 py-0 px-2 sm:px-4",
                isSaved && "text-primary"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
            >
              <Bookmark className={cn("h-5 w-5", isSaved && "fill-current")} />
            </Button>
          </div>
          
          {/* Share button */}
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 py-0 px-2 sm:px-4"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
      
      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Review"
        description="Are you sure you want to delete this review? This action cannot be undone."
        isLoading={isDeleting}
      />
    </Card>
  );
};

export default ReviewCard;
