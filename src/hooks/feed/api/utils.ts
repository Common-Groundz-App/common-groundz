
import { CombinedFeedItem } from '../types';
import { MediaItem } from '@/types/media';
import { PostFeedItem } from '../types';

// Type guard to check if a feed item is a post
export const isItemPost = (item: CombinedFeedItem): item is PostFeedItem => {
  return item.type === 'post' || 'is_post' in item;
};

// Sort items by date
export const sortItemsByDate = (items: CombinedFeedItem[]): CombinedFeedItem[] => {
  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// Create a map from array for efficient lookups
export const createMap = <T extends { id: string }>(items: T[]): Map<string, T> => {
  return new Map(items.map(item => [item.id, item]));
};

// Process media items with type safety
export const processMediaItems = (media: any[]): MediaItem[] => {
  if (!Array.isArray(media)) return [];
  
  return media.map((item, index) => ({
    id: item.id || `media-${index}`,
    type: item.type || 'image',
    url: item.url || '',
    alt: item.alt || '',
    caption: item.caption || '',
    width: item.width || 1200,
    height: item.height || 675,
    orientation: item.orientation || 'landscape',
    order: item.order || index
  }));
};
