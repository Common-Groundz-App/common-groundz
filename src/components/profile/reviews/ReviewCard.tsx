
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bookmark, MessageCircle, MoreVertical, Pencil, Trash2, UploadCloud, Calendar, Flag, AlertTriangle, ImageIcon, Share2 } from 'lucide-react';
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
import { format } from 'date-fns';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { MediaItem } from '@/types/media';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ensureHttps } from '@/utils/urlUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UsernameLink from '@/components/common/UsernameLink';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';

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
      'music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
      'Art': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
      'TV': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
      'Travel': 'https://images.unsplash.com/photo-1501554728187-ce583db33af7'
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
      'drink': 'Drink',
      'activity': 'Activity',
      'movie': 'Movie',
      'book': 'Book',
      'place': 'Place', 
      'product': 'Product',
      'music': 'Music',
      'art': 'Art',
      'tv': 'TV',
      'travel': 'Travel'
    };
    return labels[category.toLowerCase()] || category;
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
  
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Food': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      'Drink': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'Activity': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'Product': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Book': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Movie': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'TV': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      'Music': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'Art': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
      'Place': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
      'Travel': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
    };
    return colors[getCategoryLabel(category)] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  return (
    <>
      <Card 
        className="overflow-hidden hover:shadow-md transition-shadow duration-200"
      >
        <CardContent className="p-6">
          {/* Card Header with User Info - Matching RecommendationCard structure */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <UsernameLink 
                userId={review.user_id}
                className="hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={review.user?.avatar_url || undefined} alt={review.user?.username || 'User'} />
                  <AvatarFallback>{getInitials(review.user?.username)}</AvatarFallback>
                </Avatar>
              </UsernameLink>
              <div>
                <UsernameLink userId={review.user_id} username={review.user?.username} className="font-medium hover:underline" />
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <span>{formatDate(review.created_at)}</span>
                  <span>·</span>
                  <RatingDisplay rating={review.rating} />
                </div>
              </div>
            </div>
            
            {/* Options Menu for own content */}
            {(isOwner || isAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-4 w-4" />
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
          
          {/* Title and Category */}
          <div className="mt-4">
            <h3 className="font-semibold text-lg">{review.title}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {review.category && (
                <Badge className={cn("font-normal", getCategoryColor(review.category))} variant="outline">
                  {getCategoryLabel(review.category)}
                </Badge>
              )}
              
              {review.entity && (
                <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                  {review.entity.name}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Media - Using enhanced PostMediaDisplay with improved fallback */}
          <div className="mt-3">
            {mediaItems.length > 0 ? (
              <PostMediaDisplay 
                media={mediaItems} 
                className="mt-2 mb-3"
                aspectRatio="maintain"
                objectFit="contain"
                enableBackground={true}
                thumbnailDisplay="none"
              />
            ) : (
              <div className="mt-2 mb-3 rounded-md overflow-hidden relative h-48 bg-gray-50">
                <ImageWithFallback
                  src={getFallbackImage()}
                  alt={`${review.title} - ${review.category || 'Review'}`}
                  className="w-full h-full object-cover"
                  fallbackSrc={review.category ? getCategoryFallbackImage(review.category) : undefined}
                />
              </div>
            )}
          </div>
          
          {/* Description */}
          {review.description && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p className="line-clamp-3">{review.description}</p>
            </div>
          )}
          
          {/* Venue */}
          {review.venue && (
            <div className="mt-3 text-sm">
              <span className="font-medium">Location: </span>
              <span>{review.venue}</span>
            </div>
          )}
          
          {/* Experience date */}
          {review.experience_date && (
            <div className="text-xs text-gray-500 flex items-center mt-3">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Experienced: {format(new Date(review.experience_date), 'MMM d, yyyy')}</span>
            </div>
          )}
          
          {/* Social Actions - Match layout with RecommendationCard */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-3 sm:gap-6">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "flex items-center gap-1 py-0 px-2 sm:px-4", 
                  review.isLiked && "text-red-500 hover:text-red-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onLike(review.id);
                }}
              >
                <Heart className={cn("h-5 w-5", review.isLiked && "fill-current")} />
                <span>{review.likes}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm" 
                className="flex items-center gap-1 py-0 px-2 sm:px-4"
              >
                <MessageCircle className="h-5 w-5" />
                <span>{review.comment_count || 0}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm" 
                className={cn(
                  "flex items-center gap-1 py-0 px-2 sm:px-4",
                  review.isSaved && "text-primary"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSave(review.id);
                }}
              >
                <Bookmark className={cn("h-5 w-5", review.isSaved && "fill-current")} />
              </Button>
            </div>
            
            {/* Share button */}
            <Button
              variant="ghost"
              size="sm" 
              className="flex items-center gap-1 py-0 px-2 sm:px-4"
            >
              <Share2 className="h-5 w-5" />
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

// Replace the star-based RatingDisplay with ConnectedRingsRating
const RatingDisplay = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      <ConnectedRingsRating
        value={rating}
        size="xs"
        showValue={false}
        isInteractive={false}
        showLabel={false}
        className="scale-[0.5] origin-left transform -ml-1.5 -my-1"
      />
    </div>
  );
};

export default ReviewCard;
