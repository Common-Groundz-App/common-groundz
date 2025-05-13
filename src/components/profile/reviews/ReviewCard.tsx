
import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Pencil, Flag, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Review } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { deleteReview, updateReviewStatus } from '@/services/reviewService';
import ReviewForm from './ReviewForm';
import { MediaItem } from '@/types/media';
import { ensureHttps } from '@/utils/urlUtils';
import { useCardStyles } from '@/utils/theme-utils';
import ReviewCardHeader from './ReviewCardHeader';
import ReviewCardBody from './ReviewCardBody';
import ReviewCardFooter from './ReviewCardFooter';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const cardStyles = useCardStyles();
  
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
  
  // Get a category-specific emoji
  const getCategoryEmoji = (category: string): string => {
    const emojis: Record<string, string> = {
      'food': '🍽️',
      'drink': '🥤',
      'movie': '🎬',
      'book': '📚',
      'place': '🏞️',
      'product': '🛍️',
      'activity': '🎯',
      'music': '🎵',
      'art': '🎨',
      'tv': '📺',
      'travel': '✈️'
    };
    
    return emojis[category.toLowerCase()] || '📝';
  };
  
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
  
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'food': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      'drink': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      'movie': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      'book': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      'place': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      'product': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      'activity': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      'music': 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
      'art': 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
      'tv': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
      'travel': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    };
    
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getCategoryLabel = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
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
        <Badge variant="outline" className="bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Flagged
        </Badge>
      );
    }
    if (review.status === 'deleted') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300">
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
          "overflow-hidden bg-white dark:bg-gray-900/50 rounded-xl",
          "shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.01]",
          "flex flex-col h-full",
          cardStyles.cardBorder,
          review.is_converted && "opacity-75",
          review.status === 'flagged' && "border-yellow-300",
          review.status === 'deleted' && "opacity-50 border-red-300"
        )}
      >
        {/* Card options dropdown */}
        {(isOwner || isAdmin) && (
          <div className="absolute top-3 right-3 z-10">
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
          </div>
        )}
        
        <div className="p-4 flex flex-col h-full">
          {/* Card Header */}
          <ReviewCardHeader 
            review={review}
            getStatusBadge={getStatusBadge}
            getCategoryColor={getCategoryColor}
            getCategoryEmoji={getCategoryEmoji}
            getCategoryLabel={getCategoryLabel}
          />
          
          {/* Card Body */}
          <div className="flex-grow">
            <ReviewCardBody 
              review={review}
              mediaItems={mediaItems}
              getFallbackImage={getFallbackImage}
              getCategoryFallbackImage={getCategoryFallbackImage}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
            />
          </div>
          
          {/* Card Footer */}
          <ReviewCardFooter 
            review={review}
            onLike={onLike}
            onSave={onSave}
            onConvert={onConvert}
          />
        </div>
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
