
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Bookmark, MessageCircle, MoreVertical, Pencil, Trash2, UploadCloud, Calendar, Flag, AlertTriangle, Share2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Review } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { deleteReview, updateReviewStatus } from '@/services/reviewService';
import ReviewForm from './ReviewForm';
import { MediaItem } from '@/types/media';
import { ensureHttps } from '@/utils/urlUtils';
import { CompactRatingDisplay } from '@/components/ui/compact-rating-display';
import { EntityContextBar } from '@/components/entity/EntityContextBar';
import { MinimalAuthorInfo } from '@/components/common/MinimalAuthorInfo';
import { ContentMediaThumbnail } from '@/components/media/ContentMediaThumbnail';

interface ReviewCardProps {
  review: Review;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onConvert?: (id: string) => void;
  refreshReviews: () => Promise<void>;
}

const ReviewCard = ({ 
  review, 
  onLike, 
  onSave,
  onConvert,
  refreshReviews 
}: ReviewCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.id === review.user_id;
  const isAdmin = user?.email?.includes('@lovable.dev') || false;
  
  // Get entity image URL if available, ensuring it uses HTTPS
  const entityImageUrl = review.entity?.image_url ? ensureHttps(review.entity.image_url) : null;
  
  // Process media items for display with improved fallback handling
  const mediaItems = React.useMemo(() => {
    if (review.media && Array.isArray(review.media) && review.media.length > 0) {
      return review.media as MediaItem[];
    }
    
    if (review.image_url) {
      return [{
        url: review.image_url,
        type: 'image' as const,
        order: 0,
        id: review.id
      }] as MediaItem[];
    }
    
    return [] as MediaItem[];
  }, [review]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      await deleteReview(review.id);
      
      toast({
        title: "Review deleted",
        description: "Your review has been deleted successfully"
      });
      
      setIsDeleteDialogOpen(false);
      refreshReviews();
    } catch (error) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConvertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onConvert) {
      onConvert(review.id);
    }
  };

  const handleStatusChange = async (status: 'published' | 'flagged' | 'deleted') => {
    try {
      await updateReviewStatus(review.id, status);
      toast({
        title: 'Status Updated',
        description: `Review status changed to ${status}`
      });
      refreshReviews();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update review status',
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <Card 
        className="overflow-hidden hover:shadow-md transition-shadow duration-200"
      >
        <CardContent className="p-5">
          {/* Header: Rating + Title + Options */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CompactRatingDisplay rating={review.rating} size="md" />
                {(isOwner || isAdmin) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full h-6 w-6 p-0 ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                        <span className="sr-only">Menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isOwner && (
                        <DropdownMenuItem onClick={() => setIsEditing(true)} className="flex items-center gap-2">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      
                      {!review.is_converted && isOwner && onConvert && (
                        <DropdownMenuItem onClick={handleConvertClick} className="flex items-center gap-2">
                          <UploadCloud className="h-4 w-4" /> Convert to Recommendation
                        </DropdownMenuItem>
                      )}
                      
                      {isAdmin && review.status !== 'flagged' && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange('flagged')}
                          className="flex items-center gap-2"
                        >
                          <Flag className="h-4 w-4" /> Flag for Review
                        </DropdownMenuItem>
                      )}
                      
                      {isAdmin && review.status === 'flagged' && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange('published')}
                          className="flex items-center gap-2"
                        >
                          <Flag className="h-4 w-4" /> Remove Flag
                        </DropdownMenuItem>
                      )}
                      
                      {(isOwner || isAdmin) && (
                        <DropdownMenuItem 
                          onClick={handleDeleteClick} 
                          className="text-destructive focus:text-destructive flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {/* Title hierarchy: subtitle (review headline) then title (content name) */}
              {review.subtitle && (
                <h3 className="font-semibold text-lg leading-tight line-clamp-2 mb-1">{review.subtitle}</h3>
              )}
              <h4 className={`${review.subtitle ? "text-base text-muted-foreground" : "font-semibold text-lg"} leading-tight line-clamp-1`}>
                {review.title}
              </h4>
            </div>
          </div>
          
          {/* Entity Context */}
          <EntityContextBar 
            entity={review.entity}
            category={review.category}
            venue={review.venue}
            className="mb-3"
          />
          
          {/* Content Section */}
          <div className="flex gap-3 mb-4">
            {/* Media Thumbnail */}
            <ContentMediaThumbnail
              media={mediaItems}
              entityImageUrl={entityImageUrl}
              category={review.category}
              title={review.title}
              size="md"
            />
            
            {/* Description */}
            <div className="flex-1 min-w-0">
              {review.description && (
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {review.description}
                </p>
              )}
            </div>
          </div>
          
          {/* Experience Date */}
          {review.experience_date && (
            <div className="text-xs text-muted-foreground flex items-center mb-3">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Experienced: {format(new Date(review.experience_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          
          {/* Footer: Author + Social Actions */}
          <div className="flex items-center justify-between pt-3 border-t">
            <MinimalAuthorInfo 
              userId={review.user_id}
              createdAt={review.created_at}
            />
            
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "h-8 px-2 text-xs", 
                  review.isLiked && "text-red-500 hover:text-red-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onLike(review.id);
                }}
              >
                <Heart className={cn("h-4 w-4 mr-1", review.isLiked && "fill-current")} />
                {review.likes}
              </Button>
              
              <Button
                variant="ghost"
                size="sm" 
                className="h-8 px-2 text-xs"
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                {review.comment_count || 0}
              </Button>
              
              <Button
                variant="ghost"
                size="sm" 
                className={cn(
                  "h-8 px-2",
                  review.isSaved && "text-primary"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSave(review.id);
                }}
              >
                <Bookmark className={cn("h-4 w-4", review.isSaved && "fill-current")} />
              </Button>
              
              <Button
                variant="ghost"
                size="sm" 
                className="h-8 px-2"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Review"
        description="Are you sure you want to delete this review? This action cannot be undone."
        isLoading={isDeleting}
      />
      
      {/* Edit Form Dialog */}
      {isEditing && (
        <ReviewForm
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSubmit={refreshReviews}
          review={review}
          isEditMode={true}
        />
      )}
    </>
  );
};

export default ReviewCard;
