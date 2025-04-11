import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Star, MessageCircle, MapPin, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FeedItem } from '@/hooks/feed/types';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';

interface RecommendationFeedItemProps {
  recommendation: FeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
}

export const RecommendationFeedItem: React.FC<RecommendationFeedItemProps> = ({ 
  recommendation, 
  onLike, 
  onSave,
  onComment
}) => {
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);

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

  const displayCommentCount = localCommentCount !== null ? localCommentCount : recommendation.comment_count;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="h-10 w-10 border ring-2 ring-offset-2 ring-offset-background ring-brand-orange/20">
            <AvatarImage src={recommendation.avatar_url || undefined} alt={recommendation.username || 'User'} />
            <AvatarFallback className="bg-brand-orange/10 text-brand-orange font-medium">{getInitials(recommendation.username)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col justify-center">
            <UsernameLink 
              username={recommendation.username} 
              userId={recommendation.user_id}
              className="font-semibold text-sm md:text-base hover:text-brand-orange transition-colors"
            />
            <span className="text-xs text-muted-foreground">{formatDate(recommendation.created_at)}</span>
          </div>
          <div className="ml-auto">
            <Badge className="bg-brand-orange text-white hover:bg-brand-orange/90">{recommendation.category}</Badge>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-3 text-left">{recommendation.title}</h3>
        
        {recommendation.venue && (
          <div className="mb-3 text-sm text-muted-foreground flex items-center gap-1.5 text-left">
            <MapPin size={14} />
            <span>{recommendation.venue}</span>
          </div>
        )}
        
        <div className="flex items-center mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              className={cn(
                "mr-0.5",
                star <= recommendation.rating ? "fill-brand-orange text-brand-orange" : "text-gray-300"
              )}
            />
          ))}
          <span className="ml-1.5 text-sm font-medium">{recommendation.rating.toFixed(1)}</span>
        </div>
        
        {recommendation.description && (
          <p className="text-muted-foreground text-sm mb-4 text-left line-clamp-3">{recommendation.description}</p>
        )}
        
        {recommendation.image_url && (
          <div className="mt-4 rounded-lg overflow-hidden">
            <img 
              src={recommendation.image_url} 
              alt={recommendation.title}
              className="w-full h-56 object-cover transform hover:scale-105 transition-transform duration-500" 
            />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between py-3 px-5 bg-muted/20 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1.5 p-1.5",
              recommendation.is_liked && "text-red-500"
            )}
            onClick={() => onLike && onLike(recommendation.id)}
          >
            <Heart 
              size={18} 
              className={cn(recommendation.is_liked && "fill-red-500")} 
            />
            {recommendation.likes > 0 && (
              <span className="text-sm">{recommendation.likes}</span>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 p-1.5"
            onClick={handleCommentClick}
          >
            <MessageCircle size={18} />
            {displayCommentCount > 0 && (
              <span className="text-sm">{displayCommentCount}</span>
            )}
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1.5",
            recommendation.is_saved && "text-brand-orange"
          )}
          onClick={() => onSave && onSave(recommendation.id)}
        >
          <Bookmark 
            size={18} 
            className={cn(recommendation.is_saved && "fill-brand-orange")} 
          />
          <span className="text-sm">Save</span>
        </Button>
      </CardFooter>
      
      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)} 
        itemId={recommendation.id}
        itemType="recommendation" 
        onCommentAdded={handleCommentAdded}
      />
    </Card>
  );
};

export default RecommendationFeedItem;
