
import React from 'react';
import { CombinedFeedItem } from '@/hooks/feed/types';
import PostFeedItem from './PostFeedItem';

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
  // The feed is posts-only; the legacy recommendations layer is frozen (Phase 4.3)
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
};

export default FeedItem;
