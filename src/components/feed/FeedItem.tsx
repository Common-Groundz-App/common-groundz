
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bookmark, Star, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from "@/lib/utils";
import RatingStars from '@/components/recommendations/RatingStars';
import { FeedItem } from '@/hooks/feed/types';
import { getCategoryLabel } from '@/components/recommendations/RecommendationFilters';
import { formatDistanceToNow } from 'date-fns';

interface FeedItemProps {
  item: FeedItem;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
}

const FeedItemCard = ({ item, onLike, onSave }: FeedItemProps) => {
  const getInitials = (username: string) => {
    return username ? username.substring(0, 2).toUpperCase() : 'UN';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${item.user_id}`}>
            <Avatar>
              <AvatarImage src={item.avatar_url || undefined} alt={item.username || 'User'} />
              <AvatarFallback>{getInitials(item.username || '')}</AvatarFallback>
            </Avatar>
          </Link>
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <div>
                <Link to={`/profile/${item.user_id}`} className="font-medium hover:underline">
                  {item.username || 'Anonymous'}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
              
              <Badge variant="outline" className="text-xs">
                {getCategoryLabel(item.category)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <h3 className="text-lg font-medium mb-1">{item.title}</h3>
        {item.venue && <p className="text-sm text-muted-foreground mb-2">{item.venue}</p>}
        
        <div className="flex items-center gap-2 mb-3">
          <RatingStars rating={item.rating} />
          <span className="text-sm">{item.rating.toFixed(1)}</span>
        </div>
        
        {item.description && (
          <p className="text-sm line-clamp-3 mb-3">{item.description}</p>
        )}
        
        {item.image_url && (
          <div className="relative h-48 rounded-md overflow-hidden mb-2">
            <img 
              src={item.image_url} 
              alt={item.title} 
              className="w-full h-full object-cover" 
            />
            
            {item.is_certified && (
              <Badge className="absolute top-2 right-2 bg-brand-orange text-white">
                <Star className="mr-1 h-3 w-3" /> Certified
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onLike(item.id)}
            className={cn(
              "flex items-center gap-1", 
              item.is_liked ? "text-red-500" : "text-muted-foreground"
            )}
          >
            <Heart className={cn("h-4 w-4", item.is_liked && "fill-red-500")} />
            <span>{item.likes}</span>
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            disabled
            className="text-muted-foreground flex items-center gap-1"
          >
            <MessageCircle className="h-4 w-4" />
            <span>0</span>
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onSave(item.id)}
          className={cn(
            item.is_saved ? "text-brand-orange" : "text-muted-foreground"
          )}
        >
          <Bookmark className={cn("h-4 w-4", item.is_saved && "fill-brand-orange")} />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default FeedItemCard;
