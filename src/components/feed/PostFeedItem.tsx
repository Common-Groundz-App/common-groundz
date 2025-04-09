
import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Tag, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { Entity } from '@/services/recommendation/types';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { EntityBadge } from '@/components/feed/EntityBadge';

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
      <div className="mt-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
          <Tag size={14} />
          <span>Tagged:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {entities.map(entity => (
            <EntityBadge key={entity.id} entity={entity} />
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-4 mb-4">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={post.avatar_url || undefined} alt={post.username || 'User'} />
            <AvatarFallback>{getInitials(post.username)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{post.username || 'Anonymous'}</div>
            <div className="text-sm text-muted-foreground">{formatDate(post.created_at)}</div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline">{getPostTypeLabel(post.post_type)}</Badge>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-2">{post.title}</h3>
        
        <div className="mb-4">
          <RichTextDisplay content={post.content} />
        </div>
        
        {post.media && post.media.length > 0 && (
          <div className="mt-4 mb-4">
            <PostMediaDisplay 
              media={post.media} 
              displayType={post.media.length > 1 ? 'carousel' : 'grid'} 
            />
          </div>
        )}
        
        {post.tagged_entities && renderTaggedEntities(post.tagged_entities)}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 pb-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1",
              post.is_liked && "text-red-500"
            )}
            onClick={() => onLike && onLike(post.id)}
          >
            <Heart 
              size={18} 
              className={cn(post.is_liked && "fill-red-500")} 
            />
            {post.likes > 0 && (
              <span>{post.likes}</span>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
            onClick={() => onComment && onComment(post.id)}
          >
            <MessageCircle size={18} />
            {post.comment_count > 0 && (
              <span>{post.comment_count}</span>
            )}
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1",
            post.is_saved && "text-brand-orange"
          )}
          onClick={() => onSave && onSave(post.id)}
        >
          <Bookmark 
            size={18} 
            className={cn(post.is_saved && "fill-brand-orange")} 
          />
          Save
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PostFeedItem;
