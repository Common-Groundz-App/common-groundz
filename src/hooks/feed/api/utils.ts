import { CombinedFeedItem } from '../types';

// Sort items by date
export const sortItemsByDate = (items: CombinedFeedItem[]) => {
  return items.sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

// Type guard to check if an item is a post
export const isItemPost = (item: any): item is import('../types').PostFeedItem => {
  return 'is_post' in item && item.is_post === true;
};
