import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Star, MessageCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { deleteRecommendation } from '@/services/recommendation/crudOperations';
import { useNavigate } from 'react-router-dom';

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
  
  const isOwner = user?.id === recommendation.user_id;

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
    if (onLike) onLike(recommendation.id);
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : recommendation.comment_count;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-4 mb-4">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={recommendation.avatar_url || undefined} alt={recommendation.username || 'User'} />
            <AvatarFallback>{getInitials(recommendation.username)}</AvatarFallback>
          </Avatar>
          <div className="flex-grow">
            <UsernameLink 
              username={recommendation.username} 
              userId={recommendation.user_id}
              className="font-medium"
              isCurrentUser={isOwner}
            />
            <div className="text-sm text-muted-foreground">{formatDate(recommendation.created_at)}</div>
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
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={18}
              className={cn(
                "mr-1",
                star <= recommendation.rating ? "fill-brand-orange text-brand-orange" : "text-gray-300"
              )}
            />
          ))}
          <span className="ml-1 text-sm font-medium">{recommendation.rating.toFixed(1)}</span>
        </div>
        
        {recommendation.description && (
          <p className="text-muted-foreground">{recommendation.description}</p>
        )}
        
        {recommendation.image_url && (
          <div className="mt-4 rounded-md overflow-hidden">
            <img 
              src={recommendation.image_url} 
              alt={recommendation.title}
              className="w-full h-48 object-cover" 
            />
          </div>
        )}
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
          onClick={() => onSave && onSave(recommendation.id)}
        >
          <Bookmark 
            size={18} 
            className={cn(recommendation.is_saved && "fill-brand-orange")} 
          />
          Save
        </Button>
      </CardFooter>
      
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
