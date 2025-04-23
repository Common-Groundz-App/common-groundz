
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRecommendationById } from '@/services/recommendationService';
import { Recommendation } from '@/services/recommendation/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, MessageCircle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';
import { toggleRecommendationLike, toggleRecommendationSave } from '@/services/interactionService';

interface RecommendationContentViewerProps {
  recommendationId: string;
  highlightCommentId?: string | null;
  isInModal?: boolean;
  onInteractionStateChange?: (interacting: boolean) => void;
}

// Extended recommendation type with user info for display
interface ExtendedRecommendation extends Recommendation {
  user: {
    username: string;
    avatar_url: string | null;
    id: string;
  };
  content: string;
  external_url?: string;
  isLiked?: boolean;
  isSaved?: boolean;
  likes?: number;
}

const RecommendationContentViewer = ({ 
  recommendationId, 
  highlightCommentId = null,
  isInModal = false,
  onInteractionStateChange
}: RecommendationContentViewerProps) => {
  const [recommendation, setRecommendation] = useState<ExtendedRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        const recommendationData = await fetchRecommendationById(recommendationId);
        setRecommendation(recommendationData as ExtendedRecommendation);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching recommendation:', error);
        setIsLoading(false);
      }
    };

    const getCommentCount = async () => {
      try {
        const count = await fetchCommentCount(recommendationId);
        setCommentCount(count);
      } catch (error) {
        console.error('Error fetching comment count:', error);
      }
    };

    fetchRecommendation();
    getCommentCount();
  }, [recommendationId]);

  const handleLike = async () => {
    if (!user || !recommendation) return;
    
    try {
      setIsLiking(true);
      const success = await toggleRecommendationLike(
        recommendationId, 
        user.id, 
        !!recommendation.isLiked
      );
      
      if (success) {
        toast({
          title: 'Like toggled',
          description: 'Your like has been updated.',
        });
        
        // Update local state
        setRecommendation(prev => {
          if (!prev) return prev;
          const newLikeState = !prev.isLiked;
          const likesCount = (prev.likes || 0) + (newLikeState ? 1 : -1);
          return {
            ...prev,
            isLiked: newLikeState,
            likes: likesCount < 0 ? 0 : likesCount
          };
        });
      }
      setIsLiking(false);
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!user || !recommendation) return;
    
    try {
      setIsSaving(true);
      const success = await toggleRecommendationSave(
        recommendationId, 
        user.id,
        !!recommendation.isSaved
      );
      
      if (success) {
        toast({
          title: 'Save toggled',
          description: 'Your save has been updated.',
        });
        
        // Update local state
        setRecommendation(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            isSaved: !prev.isSaved
          };
        });
      }
      setIsSaving(false);
    } catch (error) {
      console.error('Error toggling save:', error);
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

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          {recommendation && (
            <>
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={recommendation.user?.avatar_url} />
                  <AvatarFallback>{recommendation.user?.username?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold">{recommendation.title}</h1>
                  <p className="text-sm text-gray-500">{recommendation.user?.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {recommendation.category}
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {formatDistanceToNow(new Date(recommendation.created_at))}
                </Badge>
              </div>
              <RichTextDisplay content={recommendation.content || ""} />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}>
                  {isLiking ? <Heart className="animate-spin" /> : <Heart />}
                </Button>
                <Button variant="outline" onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}>
                  {isSaving ? <Bookmark className="animate-spin" /> : <Bookmark />}
                </Button>
                <Button variant="outline" onClick={handleCommentClick}>
                  <MessageCircle />
                </Button>
                {recommendation.external_url && (
                  <Button variant="outline" onClick={(e) => {
                    e.stopPropagation();
                    navigate(recommendation.external_url || "");
                  }}>
                    <ExternalLink />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {commentCount} comments
                </Badge>
              </div>
            </>
          )}
        </div>
      )}
      {isCommentDialogOpen && (
        <CommentDialog
          isOpen={isCommentDialogOpen}
          onClose={() => {
            setIsCommentDialogOpen(false);
            if (onInteractionStateChange) {
              onInteractionStateChange(false);
            }
          }}
          itemId={recommendationId}
          itemType="recommendation"
        />
      )}
    </div>
  );
};

export default RecommendationContentViewer;
