
import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Tag, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PostFeedItem } from '@/hooks/feed/types';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { CommentsList } from '@/components/comments/CommentsList';

interface PostItemProps {
  post: PostFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
}

export const PostItem: React.FC<PostItemProps> = ({ post, onLike, onSave }) => {
  const [showComments, setShowComments] = useState(false);
  
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
  
  const getEntityTypeColor = (type: string): string => {
    switch(type) {
      case 'book': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'movie': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'place': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'product': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'food': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return '';
    }
  };
  
  const renderTaggedEntities = () => {
    if (!post.tagged_entities || post.tagged_entities.length === 0) return null;
    
    return (
      <div className="mt-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
          <Tag size={14} />
          <span>Tagged:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {post.tagged_entities.map(entity => (
            <Badge
              key={entity.id}
              className={cn("font-normal", getEntityTypeColor(entity.type))}
              variant="outline"
            >
              {entity.name}
            </Badge>
          ))}
        </div>
      </div>
    );
  };
  
  // Toggle comments visibility
  const toggleComments = () => {
    setShowComments(!showComments);
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
        
        {renderTaggedEntities()}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 pb-4">
        <div className="flex gap-2">
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
            onClick={toggleComments}
          >
            <MessageCircle size={18} />
            <span>Comments</span>
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

      {/* Comments section */}
      {showComments && (
        <div className="border-t p-4">
          <CommentsList target={{ type: 'post', id: post.id }} />
        </div>
      )}
    </Card>
  );
};
