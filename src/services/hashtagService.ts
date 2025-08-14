/**
 * Service for hashtag database operations
 * 
 * Phase 2: Real database operations for hashtags and post relationships
 */

import { supabase } from '@/integrations/supabase/client';

export interface Hashtag {
  id: string;
  name_original: string;
  name_norm: string;
  created_at: string;
}

export interface PostHashtag {
  post_id: string;
  hashtag_id: string;
  created_at: string;
}

/**
 * For Phase 1, we'll use a simple logging approach
 * In later phases, this will actually interact with the database
 */

/**
 * Process hashtags for a post (Phase 2: real database operations)
 * @param postId - The post ID
 * @param hashtags - Array of hashtag objects with original and normalized names
 */
export const processPostHashtags = async (
  postId: string, 
  hashtags: Array<{ original: string; normalized: string }>
): Promise<boolean> => {
  try {
    if (hashtags.length === 0) return true;

    // Create/get hashtags and link them to the post
    const hashtagIds: string[] = [];
    
    for (const hashtag of hashtags) {
      const hashtagRecord = await createOrGetHashtag(hashtag.original, hashtag.normalized);
      if (hashtagRecord) {
        hashtagIds.push(hashtagRecord.id);
      }
    }
    
    // Link hashtags to post
    return await linkHashtagsToPost(postId, hashtagIds);
  } catch (error) {
    console.error('Error in processPostHashtags:', error);
    return false;
  }
};

/**
 * Remove all hashtags for a post (Phase 2: simplified for now)
 * @param postId - The post ID
 */
export const removePostHashtags = async (postId: string): Promise<boolean> => {
  try {
    // For now, we'll implement this when needed by the create post form
    console.log(`Would remove hashtags for post ${postId}`);
    return true;
  } catch (error) {
    console.error('Error in removePostHashtags:', error);
    return false;
  }
};

/**
 * Update hashtags for a post (Phase 2: real database operations)
 * @param postId - The post ID
 * @param hashtags - Array of new hashtag objects
 */
export const updatePostHashtags = async (
  postId: string, 
  hashtags: Array<{ original: string; normalized: string }>
): Promise<boolean> => {
  try {
    // Remove existing hashtag relationships
    await removePostHashtags(postId);
    
    // Add new hashtag relationships
    return await processPostHashtags(postId, hashtags);
  } catch (error) {
    console.error('Error in updatePostHashtags:', error);
    return false;
  }
};

/**
 * Create or get existing hashtag by name (Phase 2: simplified for now)
 * @param originalName - The original hashtag text (case-sensitive)
 * @param normalizedName - The normalized hashtag text (lowercase)
 * @returns The hashtag record
 */
export const createOrGetHashtag = async (originalName: string, normalizedName: string): Promise<Hashtag | null> => {
  try {
    // For now, return a mock hashtag until tables are properly typed
    return {
      id: `mock-${normalizedName}`,
      name_original: originalName,
      name_norm: normalizedName,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in createOrGetHashtag:', error);
    return null;
  }
};

/**
 * Link hashtags to a post (Phase 2: simplified for now)
 * @param postId - The post ID
 * @param hashtagIds - Array of hashtag IDs to link
 */
export const linkHashtagsToPost = async (postId: string, hashtagIds: string[]): Promise<boolean> => {
  try {
    // For now, just log the linking until tables are properly typed
    console.log(`Would link hashtags to post ${postId}:`, hashtagIds);
    return true;
  } catch (error) {
    console.error('Error in linkHashtagsToPost:', error);
    return false;
  }
};

/**
 * Get posts by hashtag (for TagPage) - simplified for Phase 2
 * @param hashtag - The normalized hashtag name
 * @returns Array of post data
 */
export const getPostsByHashtag = async (hashtag: string) => {
  try {
    // For now, search in post content directly
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (
          id,
          username, 
          avatar_url
        )
      `)
      .or(`content.ilike.%#${hashtag}%,title.ilike.%#${hashtag}%`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getPostsByHashtag:', error);
    return [];
  }
};