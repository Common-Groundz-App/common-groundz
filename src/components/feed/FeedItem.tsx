
import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import { PostItem } from '@/components/feed/PostItem';
import { RecommendationItem } from '@/components/feed/RecommendationItem';
import { isItemPost } from '@/hooks/feed/api';

interface FeedItemProps {
  item: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, onLike, onSave }) => {
  // Use the utility function to check if the item is a post
  if (isItemPost(item)) {
    return <PostItem post={item} onLike={onLike} onSave={onSave} />;
  }
  
  return <RecommendationItem recommendation={item} onLike={onLike} onSave={onSave} />;
};

export default FeedItem;
