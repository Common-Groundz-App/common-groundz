
import { MediaItem } from '@/types/media';
import { CombinedFeedItem } from '../types';

// Create a lookup map from an array of objects
export function createMap<T>(
  arr: T[], 
  key: keyof T
): Map<string | number, T> {
  const map = new Map<string | number, T>();
  
  if (!arr) return map;
  
  for (const item of arr) {
    const keyValue = item[key];
    
    if (keyValue !== undefined && (typeof keyValue === 'string' || typeof keyValue === 'number')) {
      map.set(keyValue, item);
    }
  }
  
  return map;
}

// Sort feed items by date with newest first
export function sortItemsByDate<T extends { created_at: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Process media items ensuring they have proper types
export function processMediaItems(media: any[]): MediaItem[] {
  if (!media || !Array.isArray(media)) return [];
  
  return media.map(item => {
    if (typeof item === 'string') {
      // If it's just a string URL
      return { url: item, type: 'image' };
    } else if (typeof item === 'object' && item) {
      // Use existing type or default to 'image'
      return {
        url: item.url,
        type: item.type || 'image',
        thumbnail_url: item.thumbnail_url,
        caption: item.caption
      };
    }
    return { url: '', type: 'image' };
  });
}

// Type guard to check if a feed item is a post
export const isItemPost = (item: CombinedFeedItem): item is CombinedFeedItem & { is_post: true } => {
  return item.is_post === true;
};
