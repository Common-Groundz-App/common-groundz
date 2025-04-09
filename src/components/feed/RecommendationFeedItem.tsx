
import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FeedItem } from '@/hooks/feed/types';

interface RecommendationFeedItemProps {
  recommendation: FeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
}

export const RecommendationFeedItem: React.FC<RecommendationFeedItemProps> = ({ 
  recommendation, 
  onLike, 
  onSave
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
        <div className="flex items-center">
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
    </Card>
  );
};

export default RecommendationFeedItem;
