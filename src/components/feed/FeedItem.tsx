
import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import { isItemPost } from '@/hooks/feed/api';
import PostFeedItem from './PostFeedItem';
import RecommendationFeedItem from './RecommendationFeedItem';

interface FeedItemProps {
  item: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, onLike, onSave }) => {
  // Use the isItemPost utility to check if the item is a post
  if (isItemPost(item)) {
    return <PostFeedItem post={item} onLike={onLike} onSave={onSave} />;
  }
  
  return <RecommendationFeedItem recommendation={item} onLike={onLike} onSave={onSave} />;
};

export default FeedItem;
