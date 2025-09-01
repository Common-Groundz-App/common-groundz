import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, MessageCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FeedItem } from '@/hooks/feed/types';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/components/ui/use-toast';
import { deleteRecommendation } from '@/services/recommendation/crudOperations';
import { useNavigate } from 'react-router-dom';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { getRecommendationFallbackImage } from '@/utils/fallbackImageUtils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { MediaItem } from '@/types/media';
import { formatRelativeDate } from '@/utils/dateUtils';
import { feedbackActions } from '@/services/feedbackService';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { getEntityUrl } from '@/utils/entityUrlUtils';

const resetBodyPointerEvents = () => {
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
};

interface RecommendationFeedItemProps {
  recommendation: FeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshFeed?: () => void;
}

export const RecommendationFeedItem: React.FC<RecommendationFeedItemProps> = ({ 
  recommendation, 
  onLike, 
  onSave,
  onComment,
  onDelete,
  refreshFeed
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Add state for lightbox control
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const isOwner = user?.id === recommendation.user_id;

  // Determine the best image to display
  const imageUrl = getRecommendationFallbackImage(recommendation);
  
  // Create a media item for the lightbox
  const mediaItem: MediaItem = {
    id: recommendation.id,
    type: 'image',
    url: imageUrl,
    alt: recommendation.title,
    caption: recommendation.title,
    width: 1200,  // Default width
    height: 675,  // Default height for 16:9 aspect ratio
    orientation: 'landscape',
    order: 0      // Add the required 'order' property
  };
  
  // Create media array for lightbox (single item)
  const media: MediaItem[] = [mediaItem];
  
  // Log entity data for debugging
  useEffect(() => {
    if (recommendation.entity) {
      console.log("Recommendation has entity data:", recommendation.entity);
    } else {
      console.log("Recommendation has no entity data:", recommendation.id);
    }
  }, [recommendation]);

  useEffect(() => {
    const getInitialCommentCount = async () => {
      try {
        const count = await fetchCommentCount(recommendation.id, 'recommendation');
        setLocalCommentCount(count);
      } catch (error) {
        console.error("Error fetching comment count:", error);
        setLocalCommentCount(recommendation.comment_count || 0);
      }
    };
    
    getInitialCommentCount();
  }, [recommendation.id, recommendation.comment_count]);
  
  useEffect(() => {
    const handleCommentCountUpdate = async (event: CustomEvent) => {
      if (event.detail.itemId === recommendation.id) {
        const updatedCount = await fetchCommentCount(recommendation.id, 'recommendation');
        setLocalCommentCount(updatedCount);
      }
    };
    
    window.addEventListener('refresh-recommendation-comment-count', handleCommentCountUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refresh-recommendation-comment-count', handleCommentCountUpdate as EventListener);
    };
  }, [recommendation.id]);
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const handleCommentClick = () => {
    setIsCommentDialogOpen(true);
    if (onComment) onComment(recommendation.id);
  };

  const handleCommentAdded = () => {
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const handleEdit = () => {
    navigate(`/recommendations/edit/${recommendation.id}`);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  // Handle navigation to entity detail page
  const handleEntityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (recommendation.entity) {
      navigate(getEntityUrl(recommendation.entity));
    } else {
      toast({
        title: "Error",
        description: "Entity information is not available",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      await deleteRecommendation(recommendation.id);
      
      toast({
        title: "Recommendation deleted",
        description: "Your recommendation has been deleted successfully"
      });
      
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      
      resetBodyPointerEvents();
      
      if (onDelete) {
        onDelete(recommendation.id);
      }
      
      setTimeout(() => {
        resetBodyPointerEvents();
        
        if (refreshFeed) {
          refreshFeed();
        }
        
        window.dispatchEvent(new CustomEvent('refresh-feed'));
      }, 100);
    } catch (error) {
      console.error("Error deleting recommendation:", error);
      toast({
        title: "Error",
        description: "Failed to delete recommendation",
        variant: "destructive"
      });
      setIsDeleting(false);
      resetBodyPointerEvents();
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onLike) {
      onLike(recommendation.id);
      
      // Provide haptic + sound feedback
      try {
        feedbackActions.like();
      } catch (error) {
        console.error('Feedback error:', error);
      }
    }
  };
  
  // Add handler to open lightbox when image is clicked
  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLightboxOpen(true);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onSave) {
      onSave(recommendation.id);
      
      // Provide haptic + sound feedback
      try {
        feedbackActions.save();
      } catch (error) {
        console.error('Feedback error:', error);
      }
    }
  };
  
  const displayCommentCount = localCommentCount !== null ? localCommentCount : recommendation.comment_count;
  
  // Log the image URL being used
  useEffect(() => {
    console.log("RecommendationFeedItem: Using image URL:", imageUrl, "for recommendation:", recommendation.id);
  }, [imageUrl, recommendation.id]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-4 mb-4">
          <ProfileAvatar userId={recommendation.user_id} size="md" className="border" />
          <div className="flex-grow">
            <UsernameLink 
              username={recommendation.username} 
              userId={recommendation.user_id}
              className="font-medium"
              isCurrentUser={isOwner}
            />
            <div className="text-sm text-muted-foreground">{formatRelativeDate(recommendation.created_at)}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge>{recommendation.category}</Badge>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDeleteClick} 
                    className="text-destructive focus:text-destructive flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-2">{recommendation.title}</h3>
        
        {recommendation.venue && (
          <div className="mb-2 text-sm text-muted-foreground">
            Venue: {recommendation.venue}
          </div>
        )}
        
        <div className="flex items-center mb-4">
          <ConnectedRingsRating
            value={recommendation.rating}
            variant="badge"
            minimal={true}
            showValue={true}
            size="md"
            className="flex-shrink-0"
          />
        </div>
        
        {recommendation.description && (
          <p className="text-muted-foreground mb-4">{recommendation.description}</p>
        )}
        
        {/* Add entity badge if an entity is linked */}
        {recommendation.entity && (
          <div className="mb-4">
            <Badge 
              variant="outline" 
              className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300 cursor-pointer hover:bg-violet-200"
              onClick={handleEntityClick}
            >
              {recommendation.entity.name}
            </Badge>
          </div>
        )}
        
        {/* Updated image display with onClick handler to open lightbox */}
        <div 
          className="mt-2 rounded-md overflow-hidden cursor-pointer" 
          onClick={handleImageClick}
        >
          <AspectRatio ratio={16/9} className="bg-muted/20">
            <ImageWithFallback 
              src={imageUrl} 
              alt={recommendation.title}
              className="w-full h-full object-cover transition-all hover:scale-105 duration-300" 
              fallbackSrc={getRecommendationFallbackImage({ category: recommendation.category })}
            />
          </AspectRatio>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 pb-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1",
              recommendation.is_liked && "text-red-500"
            )}
            onClick={handleLike}
          >
            <Heart 
              size={18} 
              className={cn(recommendation.is_liked && "fill-red-500")} 
            />
            {recommendation.likes > 0 && (
              <span>{recommendation.likes}</span>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleCommentClick}
          >
            <MessageCircle size={18} />
            {displayCommentCount > 0 && (
              <span>{displayCommentCount}</span>
            )}
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1",
            recommendation.is_saved && "text-brand-orange"
          )}
          onClick={handleSave}
        >
          <Bookmark 
            size={18} 
            className={cn(recommendation.is_saved && "fill-brand-orange")} 
          />
          Save
        </Button>
      </CardFooter>
      
      {/* Add Lightbox component */}
      {isLightboxOpen && (
        <LightboxPreview 
          media={media}
          initialIndex={0}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
      
      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)} 
        itemId={recommendation.id}
        itemType="recommendation" 
        onCommentAdded={handleCommentAdded}
      />
      
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setIsDeleting(false);
          resetBodyPointerEvents();
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Recommendation"
        description="Are you sure you want to delete this recommendation? This action cannot be undone."
        isLoading={isDeleting}
      />
    </Card>
  );
};

export default RecommendationFeedItem;
