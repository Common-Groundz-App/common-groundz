import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bookmark, MessageCircle, MoreVertical, Pencil, Trash2, UploadCloud, Calendar, Flag, AlertTriangle, ImageIcon, Share2, Clock, Plus } from 'lucide-react';
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
import { formatRelativeDate } from '@/utils/dateUtils';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { MediaItem } from '@/types/media';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ensureHttps } from '@/utils/urlUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UsernameLink from '@/components/common/UsernameLink';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Separator } from "@/components/ui/separator";
import { TimelineBadge } from './TimelineBadge';
import { ReviewTimelineViewer } from './ReviewTimelineViewer';
import { getSentimentColor } from '@/utils/ratingColorUtils';

interface ReviewCardProps {
  review: Review;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onConvert?: (id: string) => void;
  refreshReviews: () => Promise<void>;
  hideEntityFallbacks?: boolean;
  compact?: boolean;
  showTimelineFeatures?: boolean; // New prop to control timeline features display
  onStartTimeline?: (reviewId: string) => void; // New prop for starting timeline
}

const ReviewCard = ({ 
  review, 
  onLike, 
  onSave,
  onConvert,
  refreshReviews,
  hideEntityFallbacks = false,
  compact = false,
  showTimelineFeatures = false, // Default to false to maintain existing behavior
  onStartTimeline
}: ReviewCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  
  const isOwner = user?.id === review.user_id;
  const isAdmin = user?.email?.includes('@lovable.dev') || false; // Simple admin check
  
  // Check if user can start timeline (owns review and has no timeline)
  const canStartTimeline = isOwner && (!review.has_timeline || !review.timeline_count || review.timeline_count === 0);
  
  // Get entity image URL if available, ensuring it uses HTTPS
  const entityImageUrl = review.entity?.image_url ? ensureHttps(review.entity.image_url) : null;
  
  // Process media items for display with improved fallback handling
  const mediaItems = React.useMemo(() => {
    // If media array is already provided (user uploads)
    if (review.media && Array.isArray(review.media) && review.media.length > 0) {
      return review.media as MediaItem[];
    }
    
    // If we have a legacy image_url (user upload)
    if (review.image_url) {
      return [{
        url: review.image_url,
        type: 'image' as const,
        order: 0,
        id: review.id
      }] as MediaItem[];
    }
    
    // If we have an entity with an image, use it as fallback
    if (entityImageUrl) {
      return [{
        url: entityImageUrl,
        type: 'image' as const,
        order: 0,
        id: `entity-${review.entity?.id}`,
        source: 'entity' // Mark as entity fallback
      }] as MediaItem[];
    }
    
    return [] as MediaItem[];
  }, [review, entityImageUrl]);

  // Determine if media should be shown based on hideEntityFallbacks setting
  const shouldShowMedia = React.useMemo(() => {
    if (!hideEntityFallbacks) {
      return mediaItems.length > 0; // Show everything normally (profile/feed pages)
    }
    
    // On entity pages: only show if there's actual user content in media array
    const hasUserMediaArray = review.media && Array.isArray(review.media) && review.media.length > 0;
    return hasUserMediaArray;
  }, [review.media, hideEntityFallbacks, mediaItems.length]);
  
  // Get a category-specific fallback image URL for when no image is available
  const getCategoryFallbackImage = (category: string): string => {
    const fallbacks: Record<string, string> = {
      'food': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1',
      'drink': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
      'activity': 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
      'movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
      'book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
      'place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
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

  const handleTimelineViewerClose = () => {
    setIsTimelineViewerOpen(false);
  };

  const handleTimelineUpdate = async () => {
    await refreshReviews();
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

  const handleStartTimelineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onStartTimeline) {
      onStartTimeline(review.id);
    } else {
      // Fallback: open timeline viewer which can handle starting a timeline
      setIsTimelineViewerOpen(true);
    }
  };

  if (compact) {
    return (
      <>
        <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-2">
            {/* Enhanced Compact Layout - Rating First */}
            <div className="flex items-start justify-between mb-2">
              {/* Rating and Title Section */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-fit">
                    <RatingDisplay rating={review.rating} />
                  </div>
                  <span 
                    className="text-lg font-bold"
                    style={{ color: getSentimentColor(review.rating) }}
                  >
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                {/* Display Review Headline/Title (subtitle) if available */}
                {review.subtitle && (
                  <h3 className="font-bold text-lg leading-tight mb-1">{review.subtitle}</h3>
                )}
                {/* Content name (title) - less prominent if subtitle exists */}
                <h4 className={cn(review.subtitle ? "text-sm text-muted-foreground" : "font-bold text-lg leading-tight")}>
                  {review.title}
                </h4>
              </div>
              
              {/* Right section with Timeline Badge and Options Menu */}
              <div className="flex items-center gap-2 ml-2">
                {/* Timeline Badge for Dynamic Reviews */}
                {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
                  <TimelineBadge 
                    updateCount={review.timeline_count} 
                    variant="secondary"
                  />
                )}
                
                {/* Options Menu for own content */}
                {(isOwner || isAdmin) && (
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
            
            {/* Ultra-Compact User Info */}
            <div className="flex items-center gap-2 mb-2">
              <UsernameLink 
                userId={review.user_id}
                className="hover:opacity-80 transition-opacity"
              >
                <Avatar className="border h-5 w-5">
                  <AvatarImage src={review.user?.avatar_url || undefined} alt={review.user?.username || 'User'} />
                  <AvatarFallback className="text-xs">{getInitials(review.user?.username)}</AvatarFallback>
                </Avatar>
              </UsernameLink>
              <UsernameLink userId={review.user_id} username={review.user?.username} className="font-medium hover:underline text-xs" />
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(review.created_at)}
              </span>
            </div>
            
            {/* Description - More prominent and longer */}
            {review.description && (
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                <p className="line-clamp-6">{review.description}</p>
              </div>
            )}
            
            {/* Timeline Features for Dynamic Reviews */}
            {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
              <div className="mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTimelineViewerOpen(true)}
                  className="text-xs h-6 px-2"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  View Timeline
                </Button>
              </div>
            )}
            
            {/* Media - smaller and less prominent */}
            {shouldShowMedia && (
              <div className="mb-3">
                <PostMediaDisplay 
                  media={mediaItems} 
                  className="mb-2"
                  aspectRatio="maintain"
                  objectFit="contain"
                  enableBackground={true}
                  thumbnailDisplay="none"
                />
              </div>
            )}
            
            {/* Compact Category Badge - Only show if different from entity type */}
            {review.category && (
              <div className="mb-2">
                <Badge 
                  className="text-xs py-0 px-2 h-5 font-normal" 
                  variant="outline"
                >
                  {getCategoryLabel(review.category)}
                </Badge>
              </div>
            )}
            
            {/* Minimal Social Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={cn(
                    "flex items-center gap-1 py-0 px-1 text-xs h-6", 
                    review.isLiked && "text-red-500 hover:text-red-600"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onLike(review.id);
                  }}
                >
                  <Heart className={cn("h-3 w-3", review.isLiked && "fill-current")} />
                  <span>{review.likes}</span>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 py-0 px-1 text-xs h-6"
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>{review.comment_count || 0}</span>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex items-center gap-1 py-0 px-1 text-xs h-6",
                    review.isSaved && "text-primary"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSave(review.id);
                  }}
                >
                  <Bookmark className={cn("h-3 w-3", review.isSaved && "fill-current")} />
                </Button>
              </div>
              
              {/* Share button */}
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 py-0 px-1 text-xs h-6"
              >
                <Share2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Viewer Modal */}
        {showTimelineFeatures && (
          <ReviewTimelineViewer
            isOpen={isTimelineViewerOpen}
            onClose={handleTimelineViewerClose}
            reviewId={review.id}
            reviewOwnerId={review.user_id}
            reviewTitle={review.title}
            initialRating={review.rating}
            onTimelineUpdate={handleTimelineUpdate}
          />
        )}

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
  }

  return (
    <>
      <Card 
        className="overflow-hidden hover:shadow-md transition-shadow duration-200"
      >
        <CardContent className="p-6">
          {/* Card Header with User Info */}
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <UsernameLink 
                userId={review.user_id}
                className="hover:opacity-80 transition-opacity"
              >
                <Avatar className="border h-10 w-10">
                  <AvatarImage src={review.user?.avatar_url || undefined} alt={review.user?.username || 'User'} />
                  <AvatarFallback>{getInitials(review.user?.username)}</AvatarFallback>
                </Avatar>
              </UsernameLink>
              <div>
                <div className="flex items-center flex-col items-start">
                  <UsernameLink userId={review.user_id} username={review.user?.username} className="font-medium hover:underline" />
                  <div className="text-muted-foreground text-xs mt-0.5">
                    <span>{formatRelativeDate(review.created_at)}</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <RatingDisplay rating={review.rating} />
                  {/* Timeline Badge for Dynamic Reviews */}
                  {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
                    <TimelineBadge 
                      updateCount={review.timeline_count} 
                      variant="secondary"
                    />
                  )}
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
                    className="rounded-full p-0 h-8 w-8"
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
            {/* Display Review Headline/Title (subtitle) if available */}
            {review.subtitle && (
              <h3 className="font-semibold text-lg">{review.subtitle}</h3>
            )}
            
            {/* Always display the content name (title) */}
            <h3 className={cn(review.subtitle ? "text-base mt-1" : "font-semibold text-lg")}>
              {review.title}
            </h3>
            
            <div className="flex flex-wrap gap-2 mt-1">
              {review.category && (
                <Badge className="font-normal" variant="outline">
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

          {/* Timeline Features for Dynamic Reviews */}
          {showTimelineFeatures && review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTimelineViewerOpen(true)}
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                View Timeline ({review.timeline_count} updates)
              </Button>
            </div>
          )}
          
          {/* Start Timeline Button for Static Reviews */}
          {showTimelineFeatures && canStartTimeline && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartTimelineClick}
                className="gap-2 border-dashed"
              >
                <Plus className="h-4 w-4" />
                Start Timeline
              </Button>
            </div>
          )}
          
          {/* Media - conditionally rendered based on shouldShowMedia */}
          {shouldShowMedia && (
            <div className="mt-3">
              <PostMediaDisplay 
                media={mediaItems} 
                className="mt-2 mb-3"
                aspectRatio="maintain"
                objectFit="contain"
                enableBackground={true}
                thumbnailDisplay="none"
              />
            </div>
          )}
          
          {/* Fallback when no media should be shown */}
          {!shouldShowMedia && !hideEntityFallbacks && mediaItems.length === 0 && (
            <div className="mt-3">
              <div className="rounded-md overflow-hidden relative bg-gray-50 mt-2 mb-3 h-48">
                <ImageWithFallback
                  src={getFallbackImage()}
                  alt={`${review.title} - ${review.category || 'Review'}`}
                  className="w-full h-full object-cover"
                  fallbackSrc={review.category ? getCategoryFallbackImage(review.category) : undefined}
                />
              </div>
            </div>
          )}
          
          {/* Description */}
          {review.description && (
            <div className="text-sm text-muted-foreground mt-3">
              <p className="line-clamp-3">{review.description}</p>
            </div>
          )}
          
          {/* Venue */}
          {review.venue && (
            <div className="text-sm mt-3">
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
          
          {/* Social Actions */}
          <div className="flex items-center justify-between border-t mt-4 pt-4">
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

      {/* Timeline Viewer Modal */}
      {showTimelineFeatures && (
        <ReviewTimelineViewer
          isOpen={isTimelineViewerOpen}
          onClose={() => setIsTimelineViewerOpen(false)}
          reviewId={review.id}
          reviewOwnerId={review.user_id}
          reviewTitle={review.title}
          initialRating={review.rating}
          onTimelineUpdate={refreshReviews}
        />
      )}

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

// Updated RatingDisplay component - now on its own row below the date
const RatingDisplay = ({ rating }: { rating: number }) => {
  return (
    <ConnectedRingsRating
      value={rating}
      size="badge"
      variant="badge"
      showValue={false}
      isInteractive={false}
      showLabel={false}
      minimal={true}
    />
  );
};

export default ReviewCard;
