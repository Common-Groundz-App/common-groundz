
import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import PostFeedItem from './PostFeedItem';
import RecommendationFeedItem from './RecommendationFeedItem';
import { isItemPost } from '@/hooks/feed/api/utils';

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
  if (isItemPost(item)) {
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
