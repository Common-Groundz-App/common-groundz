
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';

// Helper function to check if an item is a post
export const isItemPost = async (itemId: string): Promise<boolean> => {
  try {
    // Check if the ID exists in posts table
    const { data, error } = await supabase
      .from('posts')
      .select('id')
      .eq('id', itemId)
      .maybeSingle();
      
    if (error) throw error;
    return data !== null;
  } catch (err) {
    console.error('Error checking item type:', err);
    return false;
  }
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

// Helper to sort feed items by date
export const sortItemsByDate = (items: any[]) => {
  return [...items].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};
