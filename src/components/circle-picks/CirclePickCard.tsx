
import React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { formatRelativeDate } from '@/utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { ensureHttps } from '@/utils/urlUtils';

interface CirclePickCardProps {
  item: any;
  type: 'recommendation' | 'review';
}

export const CirclePickCard = ({ item, type }: CirclePickCardProps) => {
  const navigate = useNavigate();

  const getImageUrl = () => {
    if (type === 'recommendation') {
      // For recommendations, try media first, then image_url, then entity image
      if (item.media && item.media.length > 0) {
        return item.media[0].url;
      }
      if (item.image_url) {
        return item.image_url;
      }
      if (item.entity?.image_url) {
        return ensureHttps(item.entity.image_url);
      }
    } else {
      // For reviews, try media first, then image_url
      if (item.media && item.media.length > 0) {
        return item.media[0].url;
      }
      if (item.image_url) {
        return item.image_url;
      }
    }
    return null;
  };

  const getTitle = () => {
    if (type === 'recommendation') {
      return item.entity?.name || item.title;
    }
    return item.title || item.venue || 'Review';
  };

  const getQuote = () => {
    if (item.description) {
      return item.description.length > 80 
        ? item.description.substring(0, 80) + '...'
        : item.description;
    }
    return null;
  };

  const handleClick = () => {
    if (type === 'recommendation') {
      navigate(`/recommendations/${item.id}`);
    } else {
      // For reviews, navigate to the review detail or user profile
      navigate(`/profile/${item.user_id}`);
    }
  };

  const imageUrl = getImageUrl();
  const title = getTitle();
  const quote = getQuote();

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer group"
      onClick={handleClick}
    >
      <div className="relative aspect-square">
        {imageUrl ? (
          <ImageWithFallback
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-2xl opacity-50">
              {type === 'recommendation' ? '📝' : '⭐'}
            </span>
          </div>
        )}
        
        {/* Rating overlay */}
        <div className="absolute top-2 right-2">
          <ConnectedRingsRating
            value={item.rating || 0}
            size="badge"
            variant="badge"
            showValue={false}
            isInteractive={false}
            showLabel={false}
            minimal={true}
            className="bg-black/60 rounded-full p-1"
          />
        </div>
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-1">{title}</h3>
        
        {quote && (
          <p className="text-xs text-muted-foreground line-clamp-2">{quote}</p>
        )}

        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={item.avatar_url} alt={item.username} />
            <AvatarFallback className="text-[10px]">
              {(item.username || 'U')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              @{item.username} • {formatRelativeDate(item.created_at)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
