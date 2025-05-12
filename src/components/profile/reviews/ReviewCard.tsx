
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bookmark, MessageCircle, MoreVertical, Pencil, Trash2, UploadCloud, Calendar, Flag, AlertTriangle, ImageIcon } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Review } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { deleteReview, updateReviewStatus } from '@/services/reviewService';
import ReviewForm from './ReviewForm';
import RatingStars from '@/components/recommendations/RatingStars';
import { format } from 'date-fns';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { MediaItem } from '@/types/media';

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
  const isAdmin = user?.email?.includes('@lovable.dev') || false; // Simple admin check
  
  // Process media items for display
  const mediaItems = React.useMemo(() => {
    // If we have a media array already, use it
    if (review.media && Array.isArray(review.media) && review.media.length > 0) {
      return review.media as MediaItem[];
    }
    
    // If we have a legacy image_url, convert it to a media item
    if (review.image_url) {
      return [{
        url: review.image_url,
        type: 'image',
        order: 0,
        id: review.id
      }] as MediaItem[];
    }
    
    // If we have an entity with an image, use it as fallback
    if (review.entity?.image_url) {
      return [{
        url: review.entity.image_url,
        type: 'image',
        order: 0,
        id: `entity-${review.entity.id}`
      }] as MediaItem[];
    }
    
    return [] as MediaItem[];
  }, [review]);
  
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      'food': 'Food',
      'movie': 'Movie',
      'book': 'Book',
      'place': 'Place',
      'product': 'Product'
    };
    return labels[category] || category;
  };

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

  const getStatusBadge = () => {
    if (review.status === 'flagged') {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Flagged
        </Badge>
      );
    }
    if (review.status === 'deleted') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">
          <Trash2 className="h-3 w-3 mr-1" />
          Deleted
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      <Card 
        key={review.id} 
        className={cn(
          "overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200",
          review.is_converted && "opacity-75",
          review.status === 'flagged' && "border-yellow-300",
          review.status === 'deleted' && "opacity-50 border-red-300"
        )}
      >
        <div className="relative">
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="secondary" className="bg-black/70 hover:bg-black/80 text-white">
              {getCategoryLabel(review.category)}
            </Badge>
          </div>
          
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {getStatusBadge()}
            
            {review.is_converted && (
              <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
                <UploadCloud size={12} />
                <span>Converted to Recommendation</span>
              </Badge>
            )}
          </div>
          
          <div className="h-48 relative overflow-hidden group">
            {mediaItems.length > 0 ? (
              <PostMediaDisplay
                media={mediaItems}
                aspectRatio="maintain"
                objectFit="cover"
                enableBackground={true}
                className="w-full h-full"
                thumbnailDisplay={mediaItems.length > 1 ? "hover" : "none"}
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-gray-300" />
              </div>
            )}
          </div>
        </div>
        
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold line-clamp-1">{review.title}</h3>
            <div className="flex items-center">
              {(isOwner || isAdmin) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">More options</span>
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
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "h-8 w-8 transition-colors", 
                  review.isSaved 
                    ? "text-brand-orange" 
                    : "text-gray-500 hover:text-brand-orange"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSave(review.id);
                }}
              >
                <Bookmark size={18} className={review.isSaved ? "fill-brand-orange" : ""} />
              </Button>
            </div>
          </div>
          
          <p className="text-gray-600 mb-3 text-sm">{review.venue || 'Unknown venue'}</p>
          
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <RatingStars rating={review.rating} />
            
            {review.experience_date && (
              <div className="text-xs text-gray-500 flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                <span>Experienced: {format(new Date(review.experience_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
          
          {review.description && (
            <p className="mt-3 text-sm line-clamp-2">{review.description}</p>
          )}
          
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "transition-colors flex items-center gap-1 px-2",
                  review.isLiked 
                    ? "text-red-500" 
                    : "text-gray-500 hover:text-red-500"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onLike(review.id);
                }}
              >
                <Heart 
                  size={16} 
                  className={review.isLiked ? "fill-red-500" : ""} 
                />
                <span>{review.likes}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="transition-colors flex items-center gap-1 px-2 text-gray-500 hover:text-gray-700"
              >
                <MessageCircle size={16} />
                {review.comment_count > 0 && (
                  <span>{review.comment_count}</span>
                )}
              </Button>

              {mediaItems.length > 0 && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <ImageIcon size={12} />
                  {mediaItems.length}
                </span>
              )}
            </div>
            
            {!review.is_converted && isOwner && onConvert && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleConvertClick}
                className="text-xs flex items-center gap-1"
              >
                <UploadCloud size={14} /> Convert to Recommendation
              </Button>
            )}
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
