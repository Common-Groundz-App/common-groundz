import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import { isItemPost } from '@/hooks/feed/api';
import PostFeedItem from './PostFeedItem';
import RecommendationFeedItem from './RecommendationFeedItem';

interface FeedItemProps {
  item: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, onLike, onSave, onComment }) => {
  // Use the isItemPost utility to check if the item is a post
  if (isItemPost(item)) {
    // If it's a post, we can safely cast it to PostFeedItem
    return <PostFeedItem post={item} onLike={onLike} onSave={onSave} onComment={onComment} />;
  }
  
  // Otherwise, it's a recommendation feed item
  return <RecommendationFeedItem recommendation={item} onLike={onLike} onSave={onSave} onComment={onComment} />;
};

export default FeedItem;
