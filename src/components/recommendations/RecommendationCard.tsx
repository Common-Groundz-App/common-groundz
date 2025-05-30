
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Bookmark, MoreVertical, Share2 } from 'lucide-react';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
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
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ProfileDisplay } from '@/components/common/ProfileDisplay';

interface RecommendationCardProps {
  recommendation: any;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  highlightCommentId?: string | null;
  onDeleted?: () => void;
  hideEntityFallbacks?: boolean;
  compact?: boolean;
}

const RecommendationCard = ({ 
  recommendation, 
  onLike, 
  onSave, 
  highlightCommentId,
  onDeleted,
  hideEntityFallbacks = false,
  compact = false
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

  console.log(`RecommendationCard - Recommendation ${recommendation.id} entity data:`, {
    hasEntity: !!recommendation.entity,
    entityId: recommendation.entity?.id,
    entityName: recommendation.entity?.name,
    entityImageUrl: entityImageUrl
  });

  // Helper function to get entity route based on type and slug
  const getEntityRoute = (entity: any) => {
    if (!entity || !entity.slug) {
      return null;
    }

    // Map entity types to route prefixes
    const typeToRoute: Record<string, string> = {
      'place': '/place',
      'food': '/place',
      'drink': '/place',
      'movie': '/movie',
      'book': '/book',
      'product': '/product',
      'tv': '/entity',
      'music': '/entity',
      'art': '/entity',
      'activity': '/entity',
      'travel': '/entity'
    };

    const routePrefix = typeToRoute[entity.type?.toLowerCase()] || '/entity';
    return `${routePrefix}/${entity.slug}`;
  };

  // Process media items for proper fallback handling
  const mediaItems = React.useMemo(() => {
    console.log(`Processing media for recommendation ${recommendation.id}:`, {
      hasMedia: Boolean(recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0),
      hasImageUrl: Boolean(recommendation.image_url),
      hasEntityImage: Boolean(entityImageUrl),
      entityId: recommendation.entity?.id,
    });
    
    // If media array is already provided (user uploads)
    if (recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0) {
      console.log(`Using ${recommendation.media.length} media items from recommendation.media`);
      return recommendation.media as MediaItem[];
    }
    
    // If we have a legacy image_url (user upload)
    if (recommendation.image_url) {
      console.log(`Using legacy image_url: ${recommendation.image_url}`);
      return [{
        url: recommendation.image_url,
        type: 'image' as const,
        order: 0,
        id: recommendation.id
      }] as MediaItem[];
    }
    
    // If we have an entity with an image, use it as fallback
    if (entityImageUrl) {
      console.log(`Using entity image as fallback: ${entityImageUrl}`);
      return [{
        url: entityImageUrl,
        type: 'image' as const,
        order: 0,
        id: `entity-${recommendation.entity?.id}`,
        source: 'entity' // Mark as entity fallback
      }] as MediaItem[];
    }
    
    console.log(`No media found for recommendation ${recommendation.id}, using empty array`);
    return [] as MediaItem[];
  }, [recommendation, entityImageUrl]);

  // Determine if media should be shown based on hideEntityFallbacks setting
  const shouldShowMedia = React.useMemo(() => {
    if (!hideEntityFallbacks) {
      return mediaItems.length > 0; // Show everything normally (profile/feed pages)
    }
    
    // On entity pages: only show if there's actual user content in media array
    const hasUserMediaArray = recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0;
    return hasUserMediaArray;
  }, [recommendation.media, hideEntityFallbacks, mediaItems.length]);

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
    
    // Try to navigate to entity page if entity exists
    const entityRoute = getEntityRoute(recommendation.entity);
    if (entityRoute) {
      navigate(entityRoute);
    } else {
      // Fallback to recommendation detail page if no entity
      navigate(`/recommendations/${recommendation.id}`);
    }
  };

  if (compact) {
    return (
      <Card 
        className="overflow-hidden hover:shadow-md transition-shadow duration-200"
        onClick={handleCardClick}
      >
        <CardContent className="p-2">
          {/* Enhanced Compact Layout - Rating First */}
          <div className="flex items-start justify-between mb-2">
            {/* Rating and Title Section */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <RatingDisplay rating={recommendation.rating} />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {recommendation.rating.toFixed(1)}
                </span>
              </div>
              <h3 className="font-bold text-lg leading-tight mb-1">{recommendation.title}</h3>
            </div>
            
            {/* Options Menu for own content */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full p-0 h-6 w-6 ml-2"
                  >
                    <MoreVertical className="h-3 w-3" />
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
          
          {/* Ultra-Compact User Info */}
          <div className="flex items-center gap-2 mb-2">
            <ProfileDisplay
              userId={recommendation.user_id}
              size="xs"
              showUsername={true}
              showLink={true}
              className="hover:opacity-80 transition-opacity"
            />
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(recommendation.created_at)}
            </span>
          </div>
          
          {/* Description - More prominent and longer */}
          {recommendation.description && (
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              <p className="line-clamp-6">{recommendation.description}</p>
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
          {recommendation.category && (
            <div className="mb-2">
              <Badge 
                className={cn("text-xs py-0 px-2 h-5", getCategoryColor(recommendation.category))} 
                variant="outline"
              >
                {getCategoryLabel(recommendation.category)}
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
                  isLiked && "text-red-500 hover:text-red-600"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
              >
                <Heart className={cn("h-3 w-3", isLiked && "fill-current")} />
                <span>{likes}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 py-0 px-1 text-xs h-6"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/recommendations/${recommendation.id}?commentId=new`);
                }}
              >
                <MessageCircle className="h-3 w-3" />
                <span>{recommendation.comment_count || 0}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex items-center gap-1 py-0 px-1 text-xs h-6",
                  isSaved && "text-primary"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
              >
                <Bookmark className={cn("h-3 w-3", isSaved && "fill-current")} />
              </Button>
            </div>
            
            {/* Share button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 py-0 px-1 text-xs h-6"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
            >
              <Share2 className="h-3 w-3" />
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
  }

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow duration-200"
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        {/* Card Header with User Info using ProfileDisplay */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <ProfileDisplay
              userId={recommendation.user_id}
              size="md"
              showUsername={true}
              showLink={true}
              className="hover:opacity-80 transition-opacity"
            />
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <span>{formatRelativeDate(recommendation.created_at)}</span>
              <span>·</span>
              <RatingDisplay rating={recommendation.rating} />
            </div>
          </div>
          
          {/* Options Menu for own content */}
          {isOwner && (
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
                alt={`${recommendation.title} - ${recommendation.category || 'Recommendation'}`}
                className="w-full h-full object-cover"
                fallbackSrc={recommendation.category ? getCategoryFallbackImage(recommendation.category) : undefined}
              />
            </div>
          </div>
        )}
        
        {/* Description */}
        {recommendation.description && (
          <div className="text-sm text-muted-foreground mt-3">
            <p className="line-clamp-3">{recommendation.description}</p>
          </div>
        )}
        
        {/* Venue */}
        {recommendation.venue && (
          <div className="text-sm mt-3">
            <span className="font-medium">Location: </span>
            <span>{recommendation.venue}</span>
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
                navigate(`/recommendations/${recommendation.id}?commentId=new`);
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

export default RecommendationCard;
