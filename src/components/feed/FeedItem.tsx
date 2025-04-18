import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import PostFeedItem from './PostFeedItem';
import RecommendationFeedItem from './RecommendationFeedItem';

interface FeedItemProps {
  item: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshFeed?: () => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ 
  item, 
  onLike, 
  onSave, 
  onComment,
  onDelete,
  refreshFeed
}) => {
  // Check if the item is a post based on is_post flag
  if (item.is_post) {
    return (
      <PostFeedItem 
        post={item} 
        onLike={onLike} 
        onSave={onSave} 
        onComment={onComment} 
        onDelete={onDelete}
        refreshFeed={refreshFeed}
      />
    );
  }
  
  // Otherwise, it's a recommendation feed item
  return (
    <RecommendationFeedItem 
      recommendation={item} 
      onLike={onLike} 
      onSave={onSave} 
      onComment={onComment}
      onDelete={onDelete}
      refreshFeed={refreshFeed}
    />
  );
};

export default FeedItem;
