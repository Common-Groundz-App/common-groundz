
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Tag, MessageCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { Entity } from '@/services/recommendation/types';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { EntityBadge } from '@/components/feed/EntityBadge';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';

interface PostFeedItemProps {
  post: PostItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
}

export const PostFeedItem: React.FC<PostFeedItemProps> = ({ 
  post, 
  onLike, 
  onSave,
  onComment
}) => {
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  
  useEffect(() => {
    const getInitialCommentCount = async () => {
      try {
        const count = await fetchCommentCount(post.id, 'post');
        setLocalCommentCount(count);
      } catch (error) {
        console.error("Error fetching comment count:", error);
        setLocalCommentCount(post.comment_count || 0);
      }
    };
    
    getInitialCommentCount();
  }, [post.id, post.comment_count]);
  
  useEffect(() => {
    const handleCommentCountUpdate = async (event: CustomEvent) => {
      if (event.detail.itemId === post.id) {
        const updatedCount = await fetchCommentCount(post.id, 'post');
        setLocalCommentCount(updatedCount);
      }
    };
    
    window.addEventListener('refresh-post-comment-count', handleCommentCountUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refresh-post-comment-count', handleCommentCountUpdate as EventListener);
    };
  }, [post.id]);
  
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

  const getPostTypeLabel = (type: string) => {
    switch(type) {
      case 'story': return 'Story';
      case 'routine': return 'Routine';
      case 'project': return 'Project';
      case 'note': return 'Note';
      default: return type;
    }
  };

  const renderTaggedEntities = (entities: Entity[]) => {
    if (!entities || entities.length === 0) return null;
    
    return (
      <div className="mt-4 bg-muted/10 p-3 rounded-md border border-muted/30">
        <div className="flex items-center gap-1.5 text-sm font-medium mb-2 text-left">
          <Tag size={14} className="text-muted-foreground" />
          <span>Tagged items</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entities.map(entity => (
            <EntityBadge key={entity.id} entity={entity} />
          ))}
        </div>
      </div>
    );
  };
  
  const handleCommentClick = () => {
    setIsCommentDialogOpen(true);
    if (onComment) onComment(post.id);
  };
  
  const handleCommentAdded = () => {
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : post.comment_count;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="h-10 w-10 border ring-2 ring-offset-2 ring-offset-background ring-brand-orange/20">
            <AvatarImage src={post.avatar_url || undefined} alt={post.username || 'User'} />
            <AvatarFallback className="bg-brand-orange/10 text-brand-orange font-medium">{getInitials(post.username)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col justify-center">
            <UsernameLink 
              username={post.username} 
              userId={post.user_id}
              className="font-semibold text-sm md:text-base hover:text-brand-orange transition-colors"
            />
            <div className="flex items-center text-xs text-muted-foreground gap-1">
              <Calendar size={12} />
              <span>{formatDate(post.created_at)}</span>
            </div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="border-brand-orange text-brand-orange">{getPostTypeLabel(post.post_type)}</Badge>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-3 text-left">{post.title}</h3>
        
        <div className="mb-4 text-left">
          <RichTextDisplay content={post.content} />
        </div>
        
        {post.media && post.media.length > 0 && (
          <div className="my-4 rounded-lg overflow-hidden">
            <PostMediaDisplay 
              media={post.media} 
              displayType={post.media.length > 1 ? 'carousel' : 'grid'} 
              className="rounded-lg"
            />
          </div>
        )}
        
        {post.tagged_entities && renderTaggedEntities(post.tagged_entities)}
      </CardContent>
      
      <CardFooter className="flex justify-between py-3 px-5 bg-muted/20 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1.5 p-1.5",
              post.is_liked && "text-red-500"
            )}
            onClick={() => onLike && onLike(post.id)}
          >
            <Heart 
              size={18} 
              className={cn(post.is_liked && "fill-red-500")} 
            />
            {post.likes > 0 && (
              <span className="text-sm">{post.likes}</span>
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
            post.is_saved && "text-brand-orange"
          )}
          onClick={() => onSave && onSave(post.id)}
        >
          <Bookmark 
            size={18} 
            className={cn(post.is_saved && "fill-brand-orange")} 
          />
          <span className="text-sm">Save</span>
        </Button>
      </CardFooter>
      
      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)} 
        itemId={post.id} 
        itemType="post" 
        onCommentAdded={handleCommentAdded}
      />
    </Card>
  );
};

export default PostFeedItem;
