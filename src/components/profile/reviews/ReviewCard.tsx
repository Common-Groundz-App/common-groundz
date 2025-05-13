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
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ensureHttps } from '@/utils/urlUtils';

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
    
    if (entityImageUrl) {
      return [{
        url: entityImageUrl,
        type: 'image' as const,
        order: 0,
        id: `entity-${review.entity?.id}`,
        source: 'entity'
      }] as MediaItem[];
    }
    
    return [] as MediaItem[];
  }, [review, entityImageUrl]);
  
  // Get a category-specific fallback image URL for when no image is available
  const getCategoryFallbackImage = (category: string): string => {
    const fallbacks: Record<string, string> = {
      'food': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1',
      'drink': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
      'movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
      'book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
      'place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
      'activity': 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
      'music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4'
    };
    
    return fallbacks[category.toLowerCase()] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
  };
  
  // Get a fallback image with the proper priority
  const getFallbackImage = (): string => {
    if (entityImageUrl) {
      return entityImageUrl;
    }
    return getCategoryFallbackImage(review.category);
  };
  
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
          "overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200 flex flex-col h-full",
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
                <span>Converted</span>
              </Badge>
            )}
          </div>
          
          <div className="h-48 relative overflow-hidden">
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
              <div className="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden">
                <ImageWithFallback
                  src={getFallbackImage()}
                  alt={`${review.title} - ${review.category}`}
                  className="w-full h-full object-cover"
                  fallbackSrc={getCategoryFallbackImage(review.category)}
                />
              </div>
            )}
          </div>
        </div>
        
        <CardContent className="p-4 flex flex-col flex-grow">
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
          
          <p className="text-gray-600 mb-1 text-sm line-clamp-1">{review.venue || 'Unknown venue'}</p>
          
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <RatingStars rating={review.rating} size="sm" className="scale-90" />
              <span className="text-xs text-gray-600 font-medium">
                {review.rating.toFixed(1)}
              </span>
            </div>
            
            {review.experience_date && (
              <div className="text-xs text-gray-500 flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                <span>Experienced: {format(new Date(review.experience_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
          
          {review.description && (
            <p className="mt-1 text-sm line-clamp-2 text-gray-700">{review.description}</p>
          )}
          
          <div className="mt-auto pt-2 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-1">
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
                <span className="text-xs text-gray-500 flex items-center gap-1 ml-1">
                  <ImageIcon size={12} />
                  {mediaItems.length}
                </span>
              )}
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
