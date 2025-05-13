
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bookmark, MessageCircle, MoreVertical, Pencil, Trash2, UploadCloud, Calendar, Flag, AlertTriangle, ImageIcon, ChevronDown } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { deleteReview, updateReviewStatus } from '@/services/reviewService';
import ReviewForm from './ReviewForm';
import { format } from 'date-fns';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { MediaItem } from '@/types/media';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ensureHttps } from '@/utils/urlUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';
import { useCardStyles, useThemedClass } from '@/utils/theme-utils';

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
  const CONTENT_LIMIT = 150;
  
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
          "overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1",
          cardStyles.cardBorder,
          review.is_converted && "opacity-75",
          review.status === 'flagged' && "border-yellow-300",
          review.status === 'deleted' && "opacity-50 border-red-300"
        )}
      >
        {/* Media Section at the top */}
        <div className="relative">
          {/* Category Badge with Emoji */}
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <Badge className={cn("font-medium", getCategoryColor(review.category))}>
              <span className="mr-1">{getCategoryEmoji(review.category)}</span>
              {getCategoryLabel(review.category)}
            </Badge>
          </div>
          
          {/* Status Badges */}
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {getStatusBadge()}
            
            {review.is_converted && (
              <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
                <UploadCloud size={12} />
                <span>Converted to Recommendation</span>
              </Badge>
            )}
          </div>
          
          {/* Media Display */}
          <div className="h-48 sm:h-56 relative overflow-hidden group">
            {mediaItems.length > 0 ? (
              <PostMediaDisplay
                media={mediaItems}
                aspectRatio="16:9"
                objectFit="cover"
                enableBackground={true}
                className="w-full h-full"
                thumbnailDisplay="hover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                <ImageWithFallback
                  src={getFallbackImage()}
                  alt={`${review.title} - ${review.category}`}
                  className="w-full h-full object-cover"
                  fallbackSrc={getCategoryFallbackImage(review.category)}
                />
              </div>
            )}
            
            {/* Media Counter Badge */}
            {mediaItems.length > 1 && (
              <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center">
                <ImageIcon size={14} className="mr-1" />
                +{mediaItems.length - 1} more
              </div>
            )}
          </div>
        </div>
        
        <CardContent className="p-4">
          {/* Header with avatar and user info */}
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={review.avatar_url || undefined} alt={review.username || 'User'} />
              <AvatarFallback>{(review.username || 'U')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-medium text-sm">{review.username || 'User'}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(review.created_at), 'MMM d, yyyy')}
              </div>
            </div>
            
            {/* Rating Display */}
            <div className="flex items-center">
              <ConnectedRingsRating 
                value={review.rating} 
                size="sm" 
                showLabel={true}
                className="mr-2"
              />
            </div>
          </div>
          
          {/* Review Title and Content */}
          <div>
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
            
            {/* Venue and Experience Date */}
            <div className="flex flex-wrap gap-2 items-center mb-3 text-sm text-muted-foreground">
              {review.venue && (
                <span className="flex items-center gap-1">
                  <span>📍</span>
                  {review.venue}
                </span>
              )}
              
              {review.experience_date && (
                <span className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(review.experience_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
            
            {/* Review description with expandable text */}
            {review.description && (
              <div className="mt-3">
                <div className={cn(
                  "text-sm relative",
                  isExpanded ? "" : "max-h-[80px] overflow-hidden"
                )}>
                  <p>{review.description}</p>
                  
                  {(!isExpanded && review.description && review.description.length > CONTENT_LIMIT) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent h-8" />
                  )}
                </div>
                
                {review.description && review.description.length > CONTENT_LIMIT && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto font-normal text-muted-foreground"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? "Show less" : "Show more"}
                    <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", isExpanded && "rotate-180")} />
                  </Button>
                )}
              </div>
            )}
            
            {/* Tags */}
            {review.tags && review.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {review.tags.map((tag, index) => (
                  <Badge 
                    key={index}
                    variant="outline" 
                    className="text-xs bg-gray-50 dark:bg-gray-800 hover:bg-gray-100"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Interaction Bar */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
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
                  <span>{review.likes || 0}</span>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleConvertClick}
                      className="text-xs flex items-center gap-1"
                    >
                      <UploadCloud size={14} /> Convert
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Convert this review to a recommendation</p>
                  </TooltipContent>
                </Tooltip>
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
