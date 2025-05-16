
import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Star, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import UsernameLink from '@/components/common/UsernameLink';
import { Recommendation } from '@/services/recommendation/types';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import EntityBadge from './EntityBadge';

interface RecommendationFeedItemProps {
  recommendation: Recommendation;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void; 
  refreshFeed?: () => void;
}

const RecommendationFeedItem = ({ 
  recommendation, 
  onLike, 
  onSave,
  onComment,
  onDelete,
  refreshFeed 
}: RecommendationFeedItemProps) => {
  const {
    id,
    title,
    description,
    category,
    rating,
    image_url,
    created_at,
    venue,
    username,
    avatar_url,
    user_id,
    likes = 0,
    isLiked = false,
    isSaved = false,
    comment_count = 0,
    entity // This is the entity object
  } = recommendation;

  const handleLike = () => {
    if (onLike) onLike(id);
  };

  const handleSave = () => {
    if (onSave) onSave(id);
  };
  
  const handleComment = () => {
    if (onComment) onComment(id);
  };
  
  const handleDelete = () => {
    if (onDelete) onDelete(id);
  };

  const getFormattedTime = () => {
    try {
      return formatDistanceToNow(new Date(created_at), { addSuffix: true });
    } catch (err) {
      return 'recently';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* User info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatar_url || ''} alt={username || 'User'} />
              <AvatarFallback>{username?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <UsernameLink username={username || 'Anonymous'} userId={user_id} className="font-medium" />
              <p className="text-xs text-muted-foreground">{getFormattedTime()}</p>
            </div>
          </div>
          
          {/* Category badge */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal size={16} />
            </Button>
          </div>
        </div>

        {/* Entity Link (if available) */}
        {entity && entity.slug && (
          <Link to={`/entity/${entity.slug}`} className="block no-underline">
            <EntityBadge
              name={entity.name}
              type={entity.type}
              className="hover:bg-secondary/80 transition-colors"
            />
          </Link>
        )}

        {/* Content */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ConnectedRingsRating value={rating} variant="badge" minimal={true} size="sm" showValue />
            <Tag size={14} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{category}</span>
          </div>

          <h3 className="font-semibold text-lg">{title}</h3>
          
          {venue && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Where:</span> {venue}
            </p>
          )}
          
          {description && <p className="text-sm text-muted-foreground mt-2">{description}</p>}
          
          {image_url && (
            <div className="mt-3">
              <AspectRatio ratio={16/9} className="overflow-hidden rounded-md">
                <ImageWithFallback
                  src={image_url}
                  alt={title}
                  className="w-full h-full object-cover"
                  fallbackSrc="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=640"
                />
              </AspectRatio>
            </div>
          )}
        </div>

        {/* Interactions */}
        <CardFooter className="p-0 pt-2 flex justify-between items-center">
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn("gap-1", isLiked && "text-red-500")}
            >
              <Heart size={16} className={cn(isLiked && "fill-current")} />
              <span className="text-xs">{likes > 0 ? likes : ''}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleComment} className="gap-1">
              <MessageCircle size={16} />
              <span className="text-xs">{comment_count > 0 ? comment_count : ''}</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className={cn(isSaved && "text-blue-500")}
          >
            <Bookmark size={16} className={cn(isSaved && "fill-current")} />
          </Button>
        </CardFooter>
      </CardContent>
    </Card>
  );
};

export default RecommendationFeedItem;
