import React from 'react';
import { CombinedFeedItem } from '@/hooks/home/types';
import { isItemPost } from '@/hooks/home/api/utils';
import PostFeedItem from '../feed/PostFeedItem';
import RecommendationFeedItem from '../feed/RecommendationFeedItem';

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
  // Use the isItemPost utility to check if the item is a post
  if (isItemPost(item)) {
    // If it's a post, we can safely cast it to PostFeedItem
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
