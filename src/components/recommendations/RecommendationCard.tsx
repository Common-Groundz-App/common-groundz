
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Bookmark, MoreVertical, Share2 } from 'lucide-react';
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
import { MediaItem } from '@/types/media';
import { ensureHttps } from '@/utils/urlUtils';
import { CompactRatingDisplay } from '@/components/ui/compact-rating-display';
import { EntityContextBar } from '@/components/entity/EntityContextBar';
import { MinimalAuthorInfo } from '@/components/common/MinimalAuthorInfo';
import { ContentMediaThumbnail } from '@/components/media/ContentMediaThumbnail';

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
    if (recommendation.media && Array.isArray(recommendation.media) && recommendation.media.length > 0) {
      return recommendation.media as MediaItem[];
    }
    
    if (recommendation.image_url) {
      return [{
        url: recommendation.image_url,
        type: 'image' as const,
        order: 0,
        id: recommendation.id
      }] as MediaItem[];
    }
    
    return [] as MediaItem[];
  }, [recommendation]);

  // Helper function to get entity route based on type and slug
  const getEntityRoute = (entity: any) => {
    if (!entity || !entity.slug) {
      return null;
    }

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

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <CardContent className="p-5">
        {/* Header: Rating + Title + Options */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CompactRatingDisplay rating={recommendation.rating} size="md" />
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-6 w-6 p-0 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                      <span className="sr-only">Menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteModalOpen(true);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <h3 className="font-semibold text-lg leading-tight line-clamp-2">{recommendation.title}</h3>
          </div>
        </div>
        
        {/* Entity Context */}
        <EntityContextBar 
          entity={recommendation.entity}
          category={recommendation.category}
          venue={recommendation.venue}
          className="mb-3"
        />
        
        {/* Content Section */}
        <div className="flex gap-3 mb-4">
          {/* Media Thumbnail */}
          <ContentMediaThumbnail
            media={mediaItems}
            entityImageUrl={entityImageUrl}
            category={recommendation.category}
            title={recommendation.title}
            size="md"
          />
          
          {/* Description */}
          <div className="flex-1 min-w-0">
            {recommendation.description && (
              <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {recommendation.description}
              </p>
            )}
          </div>
        </div>
        
        {/* Footer: Author + Social Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <MinimalAuthorInfo 
            userId={recommendation.user_id}
            createdAt={recommendation.created_at}
          />
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-8 px-2 text-xs", 
                isLiked && "text-red-500 hover:text-red-600"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
            >
              <Heart className={cn("h-4 w-4 mr-1", isLiked && "fill-current")} />
              {likes}
            </Button>
            
            <Button
              variant="ghost"
              size="sm" 
              className="h-8 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/recommendations/${recommendation.id}?commentId=new`);
              }}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {recommendation.comment_count || 0}
            </Button>
            
            <Button
              variant="ghost"
              size="sm" 
              className={cn(
                "h-8 px-2",
                isSaved && "text-primary"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
            >
              <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm" 
              className="h-8 px-2"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
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

export default RecommendationCard;
