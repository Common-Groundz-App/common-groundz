
import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import { PostItem } from '@/components/feed/PostItem';
import { RecommendationItem } from '@/components/feed/RecommendationItem';

interface FeedItemProps {
  item: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, onLike, onSave }) => {
  const isPost = 'is_post' in item && item.is_post === true;
  
  if (isPost) {
    return <PostItem post={item} onLike={onLike} onSave={onSave} />;
  }
  
  return <RecommendationItem recommendation={item} onLike={onLike} onSave={onSave} />;
};

export default FeedItem;
