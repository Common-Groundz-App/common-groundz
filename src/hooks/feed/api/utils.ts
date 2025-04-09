
import { CombinedFeedItem } from '../types';
import { MediaItem } from '@/types/media';

// Helper function to determine if a feed item is a post
export const isItemPost = (item: any): boolean => {
  return 'is_post' in item && item.is_post === true;
};

// Create a lookup map from an array of objects
export const createMap = <T extends Record<string, any>>(
  items: T[],
  keyField: keyof T
): Map<string, T> => {
  const map = new Map<string, T>();
  if (items) {
    items.forEach((item) => {
      const key = String(item[keyField]);
      map.set(key, item);
    });
  }
  return map;
};

// Process media items with proper typing
export const processMediaItems = (media: any[]): MediaItem[] => {
  if (!media || !Array.isArray(media)) return [];
  
  return media.map((item) => {
    // Ensure each media item has the correct properties including 'order'
    return {
      id: item.id || '',
      url: item.url || '',
      type: item.type || 'image',
      thumbnail_url: item.thumbnail_url || item.url || '',
      metadata: item.metadata || {},
      order: item.order || 0, // Add the required 'order' property
      caption: item.caption,
      alt: item.alt,
      is_deleted: item.is_deleted,
      session_id: item.session_id
    } as MediaItem;
  });
};

// Sort feed items by date (most recent first)
export const sortItemsByDate = (items: CombinedFeedItem[]): CombinedFeedItem[] => {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return dateB.getTime() - dateA.getTime();
  });
};
