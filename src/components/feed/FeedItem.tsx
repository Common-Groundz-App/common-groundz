
import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Star, Tag, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CombinedFeedItem } from '@/hooks/feed/types';
import { Entity } from '@/services/recommendation/types';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import CommentsList from '@/components/comments/CommentsList';

interface FeedItemProps {
  item: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, onLike, onSave }) => {
  const isPost = 'is_post' in item && item.is_post === true;
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

  const toggleComments = () => {
    setShowComments(!showComments);
  };
  
  if (isPost) {
    const post = item as any;
    
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
          <div className="flex items-center gap-2">
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
              className={cn(
                "flex items-center gap-1"
              )}
              onClick={toggleComments}
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

        {showComments && (
          <div className="px-6 pb-6 pt-2 border-t">
            <CommentsList 
              itemId={post.id}
              itemType="post"
            />
          </div>
        )}
      </Card>
    );
  }
  
  const recommendation = item as any;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-4 mb-4">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={recommendation.avatar_url || undefined} alt={recommendation.username || 'User'} />
            <AvatarFallback>{getInitials(recommendation.username)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{recommendation.username || 'Anonymous'}</div>
            <div className="text-sm text-muted-foreground">{formatDate(recommendation.created_at)}</div>
          </div>
          <div className="ml-auto">
            <Badge>{recommendation.category}</Badge>
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1",
              recommendation.is_liked && "text-red-500"
            )}
            onClick={() => onLike && onLike(recommendation.id)}
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
            className={cn("flex items-center gap-1")}
            onClick={toggleComments}
          >
            <MessageCircle size={18} />
            {recommendation.comment_count > 0 && (
              <span>{recommendation.comment_count}</span>
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

      {showComments && (
        <div className="px-6 pb-6 pt-2 border-t">
          <CommentsList 
            itemId={recommendation.id}
            itemType="recommendation"
          />
        </div>
      )}
    </Card>
  );
};

export default FeedItem;
