
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Star, MessageSquare, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RecommendationFeedItem as RecommendationType } from '@/hooks/feed/types';
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
import { formatDistanceToNow } from 'date-fns';

const resetBodyPointerEvents = () => {
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
};

interface RecommendationFeedItemProps {
  recommendation: RecommendationType;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshFeed?: () => void;
}

export default function RecommendationFeedItem({ 
  recommendation, 
  onLike, 
  onSave,
  onComment,
  onDelete,
  refreshFeed
}: RecommendationFeedItemProps) {
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
  
  const formatTimeAgo = (dateString: string) => {
    return `${formatDistanceToNow(new Date(dateString))} ago`;
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

  return (
    <div className="border rounded-lg bg-card p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={recommendation.avatar_url || undefined} alt="User" />
            <AvatarFallback>{recommendation.username?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{recommendation.username || recommendation.user_id}</div>
            <div className="text-sm text-muted-foreground">
              {formatTimeAgo(recommendation.created_at)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {recommendation.category && <Badge>{recommendation.category}</Badge>}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={handleEdit}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {recommendation.title && <h3 className="text-lg font-semibold">{recommendation.title}</h3>}
      
      {recommendation.venue && (
        <div className="text-sm text-muted-foreground">
          Venue: {recommendation.venue}
        </div>
      )}
      
      {recommendation.rating && (
        <div className="flex items-center">
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
        </div>
      )}
      
      {recommendation.description && (
        <p className="text-sm">{recommendation.description}</p>
      )}
      
      {recommendation.image_url && (
        <div className="rounded-md overflow-hidden">
          <img 
            src={recommendation.image_url} 
            alt={recommendation.title || 'Recommendation'}
            className="w-full h-48 object-cover" 
          />
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 flex items-center gap-1"
            onClick={() => onLike && onLike(recommendation.id)}
          >
            <Heart 
              className={`h-5 w-5 ${recommendation.is_liked ? "fill-red-500 text-red-500" : ""}`} 
            />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="px-2 flex items-center gap-1"
            onClick={handleCommentClick}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="px-2 flex items-center gap-1"
          onClick={() => onSave && onSave(recommendation.id)}
        >
          <Bookmark 
            className={`h-5 w-5 ${recommendation.is_saved ? "fill-current" : ""}`} 
          />
        </Button>
      </div>
      
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
    </div>
  );
}
