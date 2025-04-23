import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRecommendationById } from '@/services/recommendationService';
import { RecommendationData } from '@/services/recommendation/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, MessageCircle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toggleRecommendationLike, toggleRecommendationSave } from '@/services/interactionService';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';

interface RecommendationContentViewerProps {
  recommendationId: string;
  highlightCommentId?: string | null;
  isInModal?: boolean;
  onInteractionStateChange?: (interacting: boolean) => void;
}

const RecommendationContentViewer = ({ 
  recommendationId, 
  highlightCommentId = null,
  isInModal = false,
  onInteractionStateChange
}: RecommendationContentViewerProps) => {
  const [recommendation, setRecommendation] = useState<RecommendationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadRecommendation = async () => {
      setIsLoading(true);
      try {
        const data = await fetchRecommendationById(recommendationId);
        setRecommendation(data);
        
        // Get comment count
        const count = await fetchCommentCount(recommendationId, 'recommendation');
        setCommentCount(count);
      } catch (error) {
        console.error('Error loading recommendation:', error);
        toast({
          title: 'Error',
          description: 'Failed to load recommendation',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRecommendation();
  }, [recommendationId, toast]);
  
  useEffect(() => {
    if (highlightCommentId) {
      setIsCommentDialogOpen(true);
    }
  }, [highlightCommentId]);
  
  useEffect(() => {
    const handleCommentCountUpdate = async (event: CustomEvent) => {
      if (event.detail.itemId === recommendationId) {
        const updatedCount = await fetchCommentCount(recommendationId, 'recommendation');
        setCommentCount(updatedCount);
      }
    };
    
    window.addEventListener('refresh-recommendation-comment-count', handleCommentCountUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refresh-recommendation-comment-count', handleCommentCountUpdate as EventListener);
    };
  }, [recommendationId]);
  
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like recommendations',
        variant: 'destructive',
      });
      return;
    }
    
    if (!recommendation) return;
    
    setIsLiking(true);
    try {
      const success = await toggleRecommendationLike(recommendation.id);
      
      if (success) {
        setRecommendation(prev => {
          if (!prev) return null;
          
          const newLikeStatus = !prev.is_liked;
          const likeDelta = newLikeStatus ? 1 : -1;
          
          return {
            ...prev,
            is_liked: newLikeStatus,
            likes: prev.likes + likeDelta
          };
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like status',
        variant: 'destructive',
      });
    } finally {
      setIsLiking(false);
    }
  };
  
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save recommendations',
        variant: 'destructive',
      });
      return;
    }
    
    if (!recommendation) return;
    
    setIsSaving(true);
    try {
      const success = await toggleRecommendationSave(recommendation.id);
      
      if (success) {
        setRecommendation(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            is_saved: !prev.is_saved
          };
        });
        
        toast({
          title: recommendation.is_saved ? 'Removed from saved' : 'Added to saved',
          description: recommendation.is_saved 
            ? 'Recommendation removed from your saved items' 
            : 'Recommendation added to your saved items',
        });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: 'Error',
        description: 'Failed to update save status',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCommentDialogOpen(true);
    
    if (onInteractionStateChange) {
      onInteractionStateChange(true);
    }
  };
  
  const handleCommentDialogClose = () => {
    setIsCommentDialogOpen(false);
    
    if (onInteractionStateChange) {
      onInteractionStateChange(false);
    }
  };
  
  const handleCommentAdded = () => {
    setCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };
  
  const handleVisitLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!recommendation?.url) return;
    
    window.open(recommendation.url, '_blank', 'noopener,noreferrer');
  };
  
  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };
  
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    );
  }
  
  if (!recommendation) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Recommendation not found</p>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "flex flex-col",
        isInModal ? "p-4" : "p-6 max-w-2xl mx-auto"
      )}
      onClick={(e) => e.stopPropagation()}
    >
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
          />
          <div className="text-sm text-muted-foreground">
            {formatRelativeTime(recommendation.created_at)}
          </div>
        </div>
        <Badge variant="outline" className="capitalize">
          {recommendation.entity_type}
        </Badge>
      </div>
      
      <h1 className="text-2xl font-bold mb-2">{recommendation.title}</h1>
      
      <ScrollArea className={cn(
        "pr-4 -mr-4",
        isInModal ? "max-h-[50vh]" : "max-h-none"
      )}>
        <div className="mb-6">
          <RichTextDisplay content={recommendation.content} />
        </div>
        
        {recommendation.url && (
          <Button
            variant="outline"
            size="sm"
            className="mb-6 flex items-center gap-2"
            onClick={handleVisitLink}
          >
            <ExternalLink size={16} />
            Visit Link
          </Button>
        )}
      </ScrollArea>
      
      <div className="flex justify-between items-center mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1",
              recommendation.is_liked && "text-red-500"
            )}
            onClick={handleLike}
            disabled={isLiking}
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
            {commentCount !== null && commentCount > 0 && (
              <span>{commentCount}</span>
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
          disabled={isSaving}
        >
          <Bookmark 
            size={18} 
            className={cn(recommendation.is_saved && "fill-brand-orange")} 
          />
          Save
        </Button>
      </div>
      
      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={handleCommentDialogClose} 
        itemId={recommendation.id}
        itemType="recommendation" 
        onCommentAdded={handleCommentAdded}
        highlightCommentId={highlightCommentId}
      />
    </div>
  );
};

export default RecommendationContentViewer;
