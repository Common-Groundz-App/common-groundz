import React from 'react';
import { CombinedHomeItem } from '@/hooks/home/types';
import { isItemPost } from '@/hooks/home/api/utils';
import PostHomeItem from './PostHomeItem';
import RecommendationHomeItem from './RecommendationHomeItem';

interface HomeItemProps {
  item: CombinedHomeItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshHome?: () => void;
}

const HomeItem: React.FC<HomeItemProps> = ({ 
  item, 
  onLike, 
  onSave, 
  onComment,
  onDelete,
  refreshHome
}) => {
  // Use the isItemPost utility to check if the item is a post
  if (isItemPost(item)) {
    // If it's a post, we can safely cast it to PostHomeItem
    return (
      <PostHomeItem 
        post={item} 
        onLike={onLike} 
        onSave={onSave} 
        onComment={onComment} 
        onDelete={onDelete}
        refreshHome={refreshHome}
      />
    );
  }
  
  // Otherwise, it's a recommendation home item
  return (
    <RecommendationHomeItem 
      recommendation={item} 
      onLike={onLike} 
      onSave={onSave} 
      onComment={onComment}
      onDelete={onDelete}
      refreshHome={refreshHome}
    />
  );
};

export default HomeItem;
