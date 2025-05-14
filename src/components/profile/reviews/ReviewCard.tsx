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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UsernameLink from '@/components/common/UsernameLink';

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
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
        <CardContent className="p-4 flex flex-col flex-grow">
          {/* New header section based on recommendation card */}
          <div className="flex items-center space-x-4 mb-4">
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={review.user?.avatar_url || undefined} alt={review.user?.username || 'User'} />
              <AvatarFallback>{getInitials(review.user?.username)}</AvatarFallback>
            </Avatar>
            
            <div className="flex-grow">
              <UsernameLink 
                username={review.user?.username} 
                userId={review.user_id}
                className="font-medium"
                isCurrentUser={isOwner}
              />
              <div className="text-sm text-muted-foreground">{formatDate(review.created_at)}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge>{getCategoryLabel(review.category)}</Badge>
              
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
            </div>
          </div>
          
          {/* Rating displayed as part of header */}
          <div className="flex items-center mb-3">
            <RatingStars rating={review.rating} size="xs" className="scale-95" />
            <span className="ml-2 text-sm font-medium">{review.rating.toFixed(1)}</span>
          </div>

          {/* Review content section */}
          <h3 className="text-lg font-bold line-clamp-1 mb-1">{review.title}</h3>
          <p className="text-gray-600 mb-2 text-sm line-clamp-1">{review.venue || 'Unknown venue'}</p>
          
          {review.description && (
            <p className="mt-1 text-sm line-clamp-2 text-gray-700 mb-3">{review.description}</p>
          )}
          
          {review.experience_date && (
            <div className="text-xs text-gray-500 flex items-center mb-3">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Experienced: {format(new Date(review.experience_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          
          {/* Media display */}
          {mediaItems.length > 0 && (
            <div className="mb-3 rounded-md overflow-hidden">
              <PostMediaDisplay
                media={mediaItems}
                aspectRatio="maintain"
                objectFit="cover"
                enableBackground={true}
                className="w-full h-36"
                thumbnailDisplay={mediaItems.length > 1 ? "hover" : "none"}
              />
            </div>
          )}
          
          {/* Card footer */}
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
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "transition-colors", 
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
