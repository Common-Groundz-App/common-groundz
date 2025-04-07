
import { MediaItem } from '@/types/media';
import { supabase } from '@/integrations/supabase/client';
import { CombinedFeedItem } from '../types';

// Format date for display in the feed
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

// Helper to process media items with type safety
export const processMediaItems = (media: any[]): MediaItem[] => {
  if (!Array.isArray(media)) return [];
  
  return media.map((item: any): MediaItem => ({
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

// Sort feed items by date
export const sortItemsByDate = (items: CombinedFeedItem[]): CombinedFeedItem[] => {
  return [...items].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

// Check if an item exists in a posts table
export const isItemPost = async (itemId: string): Promise<boolean> => {
  // Check if item exists in posts table
  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('id', itemId)
    .single();
    
  return Boolean(post);
};

// Create a map from an array of objects based on a key
export const createMap = <T extends Record<string, any>>(
  array: T[] | null | undefined,
  key: keyof T
): Map<string, T> => {
  const map = new Map<string, T>();
  
  if (array) {
    array.forEach(item => {
      const keyValue = String(item[key]);
      map.set(keyValue, item);
    });
  }
  
  return map;
};
