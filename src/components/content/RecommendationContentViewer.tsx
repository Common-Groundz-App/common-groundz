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
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
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
        const recommendation = await fetchRecommendationById(recommendationId);
        setRecommendation(recommendation);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching recommendation:', error);
        setIsLoading(false);
      }
    };

    const fetchCommentCount = async () => {
      try {
        const count = await fetchCommentCount(recommendationId);
        setCommentCount(count);
      } catch (error) {
        console.error('Error fetching comment count:', error);
      }
    };

    fetchRecommendation();
    fetchCommentCount();
  }, [recommendationId]);

  const handleLike = async () => {
    try {
      setIsLiking(true);
      const success = await toggleRecommendationLike(recommendationId);
      if (success) {
        toast({
          title: 'Like toggled',
          description: 'Your like has been updated.',
        });
      }
      setIsLiking(false);
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const success = await toggleRecommendationSave(recommendationId);
      if (success) {
        toast({
          title: 'Save toggled',
          description: 'Your save has been updated.',
        });
      }
      setIsSaving(false);
    } catch (error) {
      console.error('Error toggling save:', error);
      setIsSaving(false);
    }
  };

  const handleCommentClick = () => {
    setIsCommentDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarImage src={recommendation?.user.avatar_url} />
              <AvatarFallback>{recommendation?.user.username[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold">{recommendation?.title}</h1>
              <p className="text-sm text-gray-500">{recommendation?.user.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {recommendation?.category}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {formatDistanceToNow(new Date(recommendation?.created_at))}
            </Badge>
          </div>
          <RichTextDisplay content={recommendation?.content} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleLike}>
              {isLiking ? <Heart className="animate-spin" /> : <Heart />}
            </Button>
            <Button variant="outline" onClick={handleSave}>
              {isSaving ? <Bookmark className="animate-spin" /> : <Bookmark />}
            </Button>
            <Button variant="outline" onClick={handleCommentClick}>
              <MessageCircle />
            </Button>
            {recommendation?.external_url && (
              <Button variant="outline" onClick={() => navigate(recommendation?.external_url)}>
                <ExternalLink />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {commentCount} comments
            </Badge>
          </div>
        </div>
      )}
      {isCommentDialogOpen && (
        <CommentDialog
          recommendationId={recommendationId}
          onClose={() => setIsCommentDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default RecommendationContentViewer;
