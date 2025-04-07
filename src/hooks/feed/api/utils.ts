
import { CombinedFeedItem } from '../types';
import { MediaItem } from '@/types/media';

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

// Create a map from an array for easy lookups
export const createMap = <T extends Record<string, any>, K extends keyof T>(
  items: T[] | null,
  key: K
): Map<T[K], T> => {
  const map = new Map<T[K], T>();
  if (items) {
    items.forEach(item => {
      map.set(item[key], item);
    });
  }
  return map;
};

// Process media items with type safety
export const processMediaItems = (mediaInput: any[]): MediaItem[] => {
  if (!Array.isArray(mediaInput)) return [];
  
  // Map each item in the media array to ensure it conforms to MediaItem structure
  return mediaInput.map((item: any): MediaItem => ({
    url: item.url || '',
    type: item.type || 'image',
    caption: item.caption,
    alt: item.alt,
    order: item.order || 0,
    thumbnail_url: item.thumbnail_url,
    is_deleted: item.is_deleted || false,
    session_id: item.session_id,
    id: item.id
  }));
};
