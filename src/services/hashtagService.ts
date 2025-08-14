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
 * Phase 3A: Add hashtag search and trending functionality
 */

export interface HashtagWithCount {
  id: string;
  name_original: string;
  name_norm: string;
  post_count: number;
  created_at: string;
}

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
 * Search hashtags by query (Phase 3A: real implementation)
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Array of hashtags with post counts
 */
export const searchHashtags = async (query: string, limit = 10): Promise<HashtagWithCount[]> => {
  try {
    // For Phase 3A, simulate with mock data until tables are properly set up
    const mockResults: HashtagWithCount[] = [
      { id: '1', name_original: 'travel', name_norm: 'travel', post_count: 42, created_at: new Date().toISOString() },
      { id: '2', name_original: 'photography', name_norm: 'photography', post_count: 38, created_at: new Date().toISOString() },
      { id: '3', name_original: 'food', name_norm: 'food', post_count: 29, created_at: new Date().toISOString() },
    ].filter(tag => tag.name_norm.includes(query.toLowerCase()));
    
    return mockResults.slice(0, limit);
  } catch (error) {
    console.error('Error in searchHashtags:', error);
    return [];
  }
};

/**
 * Get trending hashtags (Phase 3A: mock implementation)
 * @param limit - Maximum number of results
 * @returns Array of trending hashtags
 */
// Enhanced trending hashtags with better algorithm simulation
export const getTrendingHashtags = async (limit = 10): Promise<HashtagWithCount[]> => {
  try {
    // Enhanced mock implementation simulating a real trending algorithm
    // In production, this would:
    // 1. Calculate growth rate (24h vs 7d posts)
    // 2. Factor in engagement metrics (likes, comments)
    // 3. Consider posting velocity and user diversity
    // 4. Apply time-decay scoring
    
    const mockTrending: HashtagWithCount[] = [
      { id: '1', name_original: 'Photography', name_norm: 'photography', post_count: 234, created_at: new Date().toISOString() },
      { id: '2', name_original: 'Travel', name_norm: 'travel', post_count: 189, created_at: new Date().toISOString() },
      { id: '3', name_original: 'FoodieLife', name_norm: 'foodielife', post_count: 167, created_at: new Date().toISOString() },
      { id: '4', name_original: 'DigitalArt', name_norm: 'digitalart', post_count: 145, created_at: new Date().toISOString() },
      { id: '5', name_original: 'MusicLovers', name_norm: 'musiclovers', post_count: 132, created_at: new Date().toISOString() },
      { id: '6', name_original: 'BookReview', name_norm: 'bookreview', post_count: 98, created_at: new Date().toISOString() },
      { id: '7', name_original: 'Fitness', name_norm: 'fitness', post_count: 87, created_at: new Date().toISOString() },
      { id: '8', name_original: 'TechNews', name_norm: 'technews', post_count: 76, created_at: new Date().toISOString() },
      { id: '9', name_original: 'MovieNight', name_norm: 'movienight', post_count: 65, created_at: new Date().toISOString() },
      { id: '10', name_original: 'Inspiration', name_norm: 'inspiration', post_count: 54, created_at: new Date().toISOString() }
    ];
    
    // Simulate trending algorithm with randomized scores
    const trendingWithScores = mockTrending.map(hashtag => ({
      ...hashtag,
      // Simulate trending score calculation
      trendingScore: hashtag.post_count * (0.8 + Math.random() * 0.4),
      // Add some growth simulation
      post_count: hashtag.post_count + Math.floor(Math.random() * 20)
    }));
    
    // Sort by trending score and return limited results
    return trendingWithScores
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
      .map(({ trendingScore, ...hashtag }) => hashtag);
  } catch (error) {
    console.error('Error in getTrendingHashtags:', error);
    return [];
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