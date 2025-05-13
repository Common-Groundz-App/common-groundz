import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Bookmark, MoreVertical, Star, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import UsernameLink from '@/components/common/UsernameLink';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { toast } from '@/hooks/use-toast';
import { deleteRecommendation } from '@/services/recommendation/crudOperations';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { MediaItem } from '@/types/media';
import { ensureHttps } from '@/utils/urlUtils';

interface RecommendationCardProps {
  recommendation: any;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  highlightCommentId?: string | null;
  onDeleted?: () => void;
}

const RecommendationCard = ({ 
  recommendation, 
  onLike, 
  onSave, 
  highlightCommentId,
  onDeleted 
}: RecommendationCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(recommendation.isLiked || false);
  const [isSaved, setIsSaved] = useState(recommendation.isSaved || false);
  const [likes, setLikes] = useState(recommendation.likes || 0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.id === recommendation.user_id;

  // Get entity image URL if available, ensuring it uses HTTPS
  const entityImageUrl = recommendation.entity?.image_url 
    ? ensureHttps(recommendation.entity.image_url) 
    : null;

  // Process media items for proper fallback handling
  const mediaItems = React.useMemo(() => {
    console.log(`Processing media for recommendation ${recommendation.id}:`, {
      hasMedia: Boolean(recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0),
      hasImageUrl: Boolean(recommendation.image_url),
      hasEntityImage: Boolean(entityImageUrl),
      entityId: recommendation.entity?.id,
    });
    
    // If media array is already provided
    if (recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0) {
      console.log(`Using ${recommendation.media.length} media items from recommendation.media`);
      return recommendation.media as MediaItem[];
    }
    
    // If we have a legacy image_url, convert it to a media item
    if (recommendation.image_url) {
      console.log(`Using legacy image_url: ${recommendation.image_url}`);
      return [{
        url: recommendation.image_url,
        type: 'image',
        order: 0,
        id: recommendation.id
      }] as MediaItem[];
    }
    
    // If we have an entity with an image, use it as fallback
    if (entityImageUrl) {
      console.log(`Using entity image as fallback: ${entityImageUrl}`);
      return [{
        url: entityImageUrl,
        type: 'image',
        order: 0,
        id: `entity-${recommendation.entity.id}`,
        source: 'entity'
      }] as MediaItem[];
    }
    
    console.log(`No media found for recommendation ${recommendation.id}, using empty array`);
    return [] as MediaItem[];
  }, [recommendation, entityImageUrl]);

  // Get a category-specific fallback image URL
  const getCategoryFallbackImage = (category: string): string => {
    const fallbacks: Record<string, string> = {
      'Food': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1',
      'Drink': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
      'Movie': 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
      'Book': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
      'Place': 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'Product': 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
      'Activity': 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
      'Music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
      'Art': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
      'TV': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
      'Travel': 'https://images.unsplash.com/photo-1501554728187-ce583db33af7'
    };
    
    return fallbacks[category] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
  };
  
  // Get a fallback image with proper priority:
  // 1. Entity image if available
  // 2. Category image if no entity image
  const getFallbackImage = (): string => {
    if (entityImageUrl) {
      return entityImageUrl;
    }
    return recommendation.category ? getCategoryFallbackImage(recommendation.category) : 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
  };

  const handleLike = async () => {
    if (!user) return;
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
    if (onLike) {
      onLike(recommendation.id);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaved(!isSaved);
    if (onSave) {
      onSave(recommendation.id);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteRecommendation(recommendation.id);
      toast({
        title: 'Recommendation deleted',
        description: 'Your recommendation has been deleted successfully.',
      });
      setIsDeleteModalOpen(false);
      if (onDeleted) {
        onDeleted();
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

  const handleShare = () => {
    // Handle share logic here
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
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'Food': 'Food',
      'Drink': 'Drink',
      'Activity': 'Activity',
      'Product': 'Product',
      'Book': 'Book',
      'Movie': 'Movie',
      'TV': 'TV',
      'Music': 'Music',
      'Art': 'Art',
      'Place': 'Place',
      'Travel': 'Travel',
    };
    return labels[category] || category;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on buttons or links
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    
    navigate(`/recommendation/${recommendation.id}`);
  };

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow duration-200"
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        {/* Card Header with User Info */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <UsernameLink 
              userId={recommendation.user_id}
              className="hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={recommendation.avatar_url} alt={recommendation.username || 'User'} />
                <AvatarFallback>{(recommendation.username || 'U')[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </UsernameLink>
            <div>
              <UsernameLink userId={recommendation.user_id} username={recommendation.username} className="font-medium hover:underline" />
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <span>{format(new Date(recommendation.created_at), 'MMM d, yyyy')}</span>
                <span>·</span>
                <RatingDisplay rating={recommendation.rating} />
              </div>
            </div>
          </div>
          
          {/* Options Menu for own content */}
          {isOwner && (
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
        
        {/* Title and Category */}
        <div className="mt-4">
          <h3 className="font-semibold text-lg">{recommendation.title}</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {recommendation.category && (
              <Badge className={cn("font-normal", getCategoryColor(recommendation.category))} variant="outline">
                {getCategoryLabel(recommendation.category)}
              </Badge>
            )}
            
            {recommendation.entity && (
              <Badge variant="outline" className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                {recommendation.entity.name}
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
                alt={`${recommendation.title} - ${recommendation.category || 'Recommendation'}`}
                className="w-full h-full object-cover"
                fallbackSrc={recommendation.category ? getCategoryFallbackImage(recommendation.category) : undefined}
              />
            </div>
          )}
        </div>
        
        {/* Description */}
        {recommendation.description && (
          <div className="mt-3 text-sm text-muted-foreground">
            <p className="line-clamp-3">{recommendation.description}</p>
          </div>
        )}
        
        {/* Venue */}
        {recommendation.venue && (
          <div className="mt-3 text-sm">
            <span className="font-medium">Location: </span>
            <span>{recommendation.venue}</span>
          </div>
        )}
        
        {/* Social Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
                navigate(`/recommendation/${recommendation.id}?commentId=new`);
              }}
            >
              <MessageCircle className="h-5 w-5" />
              <span>{recommendation.comment_count || 0}</span>
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
              handleShare();
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
        title="Delete Recommendation"
        description="Are you sure you want to delete this recommendation? This action cannot be undone."
        isLoading={isDeleting}
      />
    </Card>
  );
};

// Helper component for displaying star ratings
const RatingDisplay = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star 
          key={i}
          className={cn(
            "h-3 w-3",
            i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
          )}
        />
      ))}
    </div>
  );
};

export default RecommendationCard;
