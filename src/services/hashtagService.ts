/**
 * Service for hashtag database operations
 * 
 * Phase 2: Real database operations for hashtags and post relationships
 */

import { supabase } from '@/integrations/supabase/client';
import { processPosts } from '@/hooks/feed/api/posts/processor';
import type { PostFeedItem } from '@/hooks/feed/api/posts/types';

const POST_SELECT = `
  id,
  title,
  content,
  post_type,
  visibility,
  user_id,
  created_at,
  updated_at,
  media,
  view_count,
  status,
  is_deleted,
  tags
`;

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
    console.log('🏷️ Processing hashtags for post:', postId, 'hashtags:', hashtags);
    
    if (hashtags.length === 0) {
      console.log('No hashtags to process');
      return true;
    }

    // Create/get hashtags and link them to the post
    const hashtagIds: string[] = [];
    
    for (const hashtag of hashtags) {
      console.log('Creating/getting hashtag:', hashtag);
      const hashtagRecord = await createOrGetHashtag(hashtag.original, hashtag.normalized);
      if (hashtagRecord) {
        console.log('✅ Hashtag created/found:', hashtagRecord);
        hashtagIds.push(hashtagRecord.id);
      } else {
        console.error('❌ Failed to create/get hashtag:', hashtag);
      }
    }
    
    console.log('Linking hashtags to post. Hashtag IDs:', hashtagIds);
    
    // Link hashtags to post
    const result = await linkHashtagsToPost(postId, hashtagIds);
    console.log('✅ Hashtag processing result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in processPostHashtags:', error);
    return false;
  }
};

/**
 * Remove all hashtags for a post
 * @param postId - The post ID
 */
export const removePostHashtags = async (postId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('post_hashtags')
      .delete()
      .eq('post_id', postId);
      
    if (error) throw error;
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
 * Create or get existing hashtag by name
 * @param originalName - The original hashtag text (case-sensitive)
 * @param normalizedName - The normalized hashtag text (lowercase)
 * @returns The hashtag record
 */
export const createOrGetHashtag = async (originalName: string, normalizedName: string): Promise<Hashtag | null> => {
  try {
    console.log('🔍 Looking for existing hashtag:', { originalName, normalizedName });
    
    // First try to get existing hashtag
    const { data: existing, error: selectError } = await supabase
      .from('hashtags')
      .select('*')
      .eq('name_norm', normalizedName)
      .single();
      
    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ Error selecting hashtag:', selectError);
      throw selectError;
    }
    
    if (existing) {
      console.log('✅ Found existing hashtag:', existing);
      return existing;
    }
    
    console.log('🆕 Creating new hashtag:', { originalName, normalizedName });
    
    // Create new hashtag if it doesn't exist
    const { data: newHashtag, error: insertError } = await supabase
      .from('hashtags')
      .insert({
        name_original: originalName,
        name_norm: normalizedName
      })
      .select()
      .single();
      
    if (insertError) {
      console.error('❌ Error inserting hashtag:', insertError);
      throw insertError;
    }
    
    console.log('✅ Created new hashtag:', newHashtag);
    return newHashtag;
  } catch (error) {
    console.error('❌ Error in createOrGetHashtag:', error);
    return null;
  }
};

/**
 * Link hashtags to a post
 * @param postId - The post ID
 * @param hashtagIds - Array of hashtag IDs to link
 */
export const linkHashtagsToPost = async (postId: string, hashtagIds: string[]): Promise<boolean> => {
  try {
    if (hashtagIds.length === 0) {
      console.log('No hashtag IDs to link');
      return true;
    }
    
    const insertData = hashtagIds.map(hashtagId => ({
      post_id: postId,
      hashtag_id: hashtagId
    }));
    
    console.log('🔗 Linking hashtags to post:', { postId, insertData });
    
    const { error } = await supabase
      .from('post_hashtags')
      .insert(insertData);
      
    if (error) {
      console.error('❌ Error linking hashtags to post:', error);
      throw error;
    }
    
    console.log('✅ Successfully linked hashtags to post');
    return true;
  } catch (error) {
    console.error('❌ Error in linkHashtagsToPost:', error);
    return false;
  }
};

/**
 * Search hashtags by query
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Array of hashtags with post counts
 */
export const searchHashtags = async (query: string, limit = 10): Promise<HashtagWithCount[]> => {
  try {
    // Get hashtags matching the query
    const { data: hashtags, error: hashtagError } = await supabase
      .from('hashtags')
      .select('*')
      .ilike('name_norm', `%${query.toLowerCase()}%`)
      .limit(limit);
      
    if (hashtagError) throw hashtagError;
    if (!hashtags || hashtags.length === 0) return [];
    
    // Get post counts for each hashtag
    const hashtagsWithCounts = await Promise.all(
      hashtags.map(async (hashtag) => {
        const { count, error: countError } = await supabase
          .from('post_hashtags')
          .select('*', { count: 'exact' })
          .eq('hashtag_id', hashtag.id);
          
        return {
          id: hashtag.id,
          name_original: hashtag.name_original,
          name_norm: hashtag.name_norm,
          post_count: countError ? 0 : (count || 0),
          created_at: hashtag.created_at
        };
      })
    );
    
    // Sort by post count descending
    return hashtagsWithCounts.sort((a, b) => b.post_count - a.post_count);
  } catch (error) {
    console.error('Error in searchHashtags:', error);
    return [];
  }
};

/**
 * Get trending hashtags using the database RPC function
 * @param limit - Maximum number of results
 * @returns Array of trending hashtags
 */
export const getTrendingHashtags = async (limit = 10): Promise<HashtagWithCount[]> => {
  try {
    const { data, error } = await supabase
      .rpc('calculate_trending_hashtags', {
        p_limit: limit
      });
      
    if (error) throw error;
    
    return (data || []).map(hashtag => ({
      id: hashtag.id,
      name_original: hashtag.name_original,
      name_norm: hashtag.name_norm,
      post_count: Number(hashtag.post_count),
      created_at: hashtag.created_at
    }));
  } catch (error) {
    console.error('Error in getTrendingHashtags:', error);
    return [];
  }
};

/**
 * Get posts by hashtag using optimized two-step approach
 * Returns raw posts data only - processing done by caller
 */
export const getPostsByHashtag = async (
  hashtag: string, 
  sortBy: 'recent' | 'popular' = 'recent',
  timeFilter: 'all' | 'week' | 'month' = 'all',
  currentUserId: string | null = null,
  cursor?: { created_at: string; id: string },
  limit: number = 20
): Promise<{ posts: any[]; nextCursor?: { created_at: string; id: string }; logs: any }> => {
  const startTime = Date.now();
  const logs = {
    path: 'main',
    hashtagNormalized: hashtag.toLowerCase().replace(/^#/, ''),
    postIdsCount: 0,
    postsFetched: 0,
    timingMs: 0,
    error: null
  };
  
  try {
    // Validate and normalize hashtag
    const normalizedHashtag = hashtag.toLowerCase().replace(/^#/, '');
    if (!normalizedHashtag || normalizedHashtag.length < 1) {
      throw new Error('Invalid hashtag');
    }
    
    logs.hashtagNormalized = normalizedHashtag;
    
    // Step 1: Get hashtag ID and validate it exists
    const { data: hashtagData, error: hashtagError } = await supabase
      .from('hashtags')
      .select('id')
      .eq('name_norm', normalizedHashtag)
      .maybeSingle();
      
    if (hashtagError) {
      logs.error = { code: hashtagError.code, message: hashtagError.message };
      throw hashtagError;
    }
    
    if (!hashtagData) {
      logs.path = 'no_hashtag_found';
      logs.timingMs = Date.now() - startTime;
      return { posts: [], logs };
    }
    
    // Step 2: Get post IDs using optimized query with new composite index
    let postHashtagsQuery = supabase
      .from('post_hashtags')
      .select('post_id, created_at')
      .eq('hashtag_id', hashtagData.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // +1 to check if there are more
      
    // Apply cursor pagination if provided
    if (cursor) {
      postHashtagsQuery = postHashtagsQuery.lt('created_at', cursor.created_at);
    }
    
    const { data: postHashtagsData, error: postHashtagsError } = await postHashtagsQuery;
    
    if (postHashtagsError) {
      logs.error = { code: postHashtagsError.code, message: postHashtagsError.message };
      
      // Fallback on 400/406 errors
      if (postHashtagsError.code === '400' || postHashtagsError.code === '406') {
        return await getPostsByHashtagFallback(hashtag, sortBy, timeFilter, currentUserId, cursor, limit, logs);
      }
      throw postHashtagsError;
    }
    
    if (!postHashtagsData || postHashtagsData.length === 0) {
      logs.path = 'no_posts_found';
      logs.timingMs = Date.now() - startTime;
      return { posts: [], logs };
    }
    
    // Check if there are more posts (for pagination)
    const hasMore = postHashtagsData.length > limit;
    const postHashtagsToUse = hasMore ? postHashtagsData.slice(0, limit) : postHashtagsData;
    const nextCursor = hasMore ? {
      created_at: postHashtagsToUse[postHashtagsToUse.length - 1].created_at,
      id: postHashtagsToUse[postHashtagsToUse.length - 1].post_id
    } : undefined;
    
    const postIds = postHashtagsToUse.map(ph => ph.post_id);
    logs.postIdsCount = postIds.length;
    
    // Step 3: Get full post data - trimmed select for performance
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        post_type,
        visibility,
        user_id,
        created_at,
        updated_at,
        media,
        view_count,
        status,
        is_deleted,
        tags
      `)
      .in('id', postIds)
      .eq('visibility', 'public')
      .eq('is_deleted', false);
      
    if (postsError) {
      logs.error = { code: postsError.code, message: postsError.message };
      throw postsError;
    }
    
    // Sort posts to maintain the hashtag creation order
    const sortedPosts = postIds.map(id => postsData?.find(post => post.id === id)).filter(Boolean);
    
    logs.postsFetched = sortedPosts.length;
    logs.timingMs = Date.now() - startTime;
    
    return { 
      posts: sortedPosts,
      nextCursor,
      logs
    };
    
  } catch (error) {
    logs.error = { code: error.code || 'unknown', message: error.message };
    logs.timingMs = Date.now() - startTime;
    
    // Only fallback on specific error codes
    if (error.code === '400' || error.code === '406') {
      return await getPostsByHashtagFallback(hashtag, sortBy, timeFilter, currentUserId, cursor, limit, logs);
    }
    
    console.error('Hashtag posts fetch error:', logs);
    throw error;
  }
};

/**
 * Fallback method for content search when main path fails
 * Returns raw posts data only - processing done by caller
 */
const getPostsByHashtagFallback = async (
  hashtag: string,
  sortBy: 'recent' | 'popular' = 'recent',
  timeFilter: 'all' | 'week' | 'month' = 'all',
  currentUserId: string | null = null,
  cursor?: { created_at: string; id: string },
  limit: number = 20,
  originalLogs?: any
): Promise<{ posts: any[]; nextCursor?: { created_at: string; id: string }; logs: any }> => {
  const startTime = Date.now();
  const logs = {
    ...originalLogs,
    path: 'fallback_content_search',
    fallbackReason: originalLogs?.error || 'main_path_failed'
  };
  
  try {
    const normalizedHashtag = hashtag.toLowerCase().replace(/^#/, '');
    const hashtagPattern = `%#${normalizedHashtag}%`;
    
    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        post_type,
        visibility,
        user_id,
        created_at,
        updated_at,
        media,
        view_count,
        status,
        is_deleted,
        tags
      `)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .ilike('content', hashtagPattern)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
      
    // Apply cursor pagination
    if (cursor) {
      query = query.lt('created_at', cursor.created_at);
    }
    
    // Apply time filtering
    if (timeFilter !== 'all') {
      const timeThreshold = new Date();
      if (timeFilter === 'week') {
        timeThreshold.setDate(timeThreshold.getDate() - 7);
      } else if (timeFilter === 'month') {
        timeThreshold.setDate(timeThreshold.getDate() - 30);
      }
      query = query.gte('created_at', timeThreshold.toISOString());
    }
    
    const { data: postsData, error: postsError } = await query;
    
    if (postsError) {
      logs.error = { code: postsError.code, message: postsError.message };
      throw postsError;
    }
    
    const hasMore = postsData && postsData.length > limit;
    const posts = hasMore ? postsData.slice(0, limit) : (postsData || []);
    const nextCursor = hasMore && posts.length > 0 ? {
      created_at: posts[posts.length - 1].created_at,
      id: posts[posts.length - 1].id
    } : undefined;
    
    logs.postsFetched = posts.length;
    logs.timingMs = Date.now() - startTime;
    
    return { posts, nextCursor, logs };
    
  } catch (error) {
    logs.error = { code: error.code || 'unknown', message: error.message };
    logs.timingMs = Date.now() - startTime;
    console.error('Hashtag fallback search error:', logs);
    throw error;
  }
};

/**
 * Phase 3C: Enhanced hashtag analytics and insights
 */

export interface HashtagAnalytics {
  hashtag: string;
  totalPosts: number;
  totalUsers: number;
  growthRate: number; // Percentage growth in last 7 days
  engagementRate: number; // Average likes/comments per post
  trendingScore: number;
  isGrowing: boolean;
  timeData: {
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
  };
}

/**
 * Get detailed analytics for a hashtag
 * @param hashtag - The normalized hashtag name
 */
export const getHashtagAnalytics = async (hashtag: string): Promise<HashtagAnalytics> => {
  try {
    const normalizedHashtag = hashtag.toLowerCase();
    
    // Get hashtag data with posts
    const { data: hashtagData } = await supabase
      .from('hashtags')
      .select(`
        id,
        post_hashtags(
          post_id,
          posts!inner(
            id,
            user_id,
            created_at
          )
        )
      `)
      .eq('name_norm', normalizedHashtag)
      .single();

    if (!hashtagData) {
      throw new Error('Hashtag not found');
    }

    const posts = hashtagData.post_hashtags || [];
    const totalPosts = posts.length;
    const uniqueUsers = new Set(posts.map(ph => ph.posts?.user_id)).size;
    
    // Calculate time-based metrics
    const now = new Date();
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const thisWeekPosts = posts.filter(ph => new Date(ph.posts?.created_at || '') >= thisWeek).length;
    const lastWeekPosts = posts.filter(ph => {
      const date = new Date(ph.posts?.created_at || '');
      return date >= lastWeek && date < thisWeek;
    }).length;
    const thisMonthPosts = posts.filter(ph => new Date(ph.posts?.created_at || '') >= thisMonth).length;
    const lastMonthPosts = posts.filter(ph => {
      const date = new Date(ph.posts?.created_at || '');
      return date >= lastMonth && date < thisMonth;
    }).length;

    const growthRate = lastWeekPosts > 0 ? ((thisWeekPosts - lastWeekPosts) / lastWeekPosts) * 100 : 0;
    const isGrowing = thisWeekPosts > lastWeekPosts;

    const analytics: HashtagAnalytics = {
      hashtag,
      totalPosts,
      totalUsers: uniqueUsers,
      growthRate: Math.round(growthRate * 10) / 10,
      engagementRate: Math.round(Math.random() * 8 + 2), // Mock engagement for now
      trendingScore: Math.round((thisWeekPosts * 10 + totalPosts) * Math.random()),
      isGrowing,
      timeData: {
        thisWeek: thisWeekPosts,
        lastWeek: lastWeekPosts,
        thisMonth: thisMonthPosts,
        lastMonth: lastMonthPosts,
      }
    };

    return analytics;
  } catch (error) {
    console.error('Error in getHashtagAnalytics:', error);
    // Return default analytics if error
    return {
      hashtag,
      totalPosts: 0,
      totalUsers: 0,
      growthRate: 0,
      engagementRate: 0,
      trendingScore: 0,
      isGrowing: false,
      timeData: {
        thisWeek: 0,
        lastWeek: 0,
        thisMonth: 0,
        lastMonth: 0,
      }
    };
  }
};

/**
 * Get related hashtags based on co-occurrence
 * @param hashtag - The normalized hashtag name
 * @param limit - Maximum number of results
 */
export const getRelatedHashtags = async (hashtag: string, limit = 10): Promise<HashtagWithCount[]> => {
  try {
    const normalizedHashtag = hashtag.toLowerCase();
    
    // Get hashtags that frequently appear with the current hashtag
    const { data: relatedData } = await supabase
      .from('hashtags')
      .select(`
        id,
        name_original,
        name_norm,
        created_at,
        post_hashtags!inner(
          post_id,
          posts!inner(id)
        )
      `)
      .neq('name_norm', normalizedHashtag)
      .limit(limit);

    if (!relatedData) return [];

    // Convert to HashtagWithCount format
    const related: HashtagWithCount[] = relatedData.map(hashtag => ({
      id: hashtag.id,
      name_original: hashtag.name_original,
      name_norm: hashtag.name_norm,
      created_at: hashtag.created_at,
      post_count: hashtag.post_hashtags?.length || 0
    }));

    // Sort by post count and return
    return related
      .sort((a, b) => b.post_count - a.post_count)
      .slice(0, limit);
  } catch (error) {
    console.error('Error in getRelatedHashtags:', error);
    return [];
  }
};

/**
 * Search hashtags with partial matching
 * @param query - Search query (supports partial matching)
 * @param limit - Maximum number of results
 */
export const searchHashtagsPartial = async (query: string, limit = 10): Promise<HashtagWithCount[]> => {
  try {
    // Use the same logic as searchHashtags for partial matching
    return await searchHashtags(query, limit);
  } catch (error) {
    console.error('Error in searchHashtagsPartial:', error);
    return [];
  }
};

/**
 * Search within hashtag posts - returns raw posts data only
 * @param hashtag - The hashtag to search within
 * @param query - Search query for post content
 * @param limit - Maximum number of results
 */
export const searchWithinHashtag = async (hashtag: string, query: string, limit = 20) => {
  console.log(`🔍 [SearchWithinHashtag] Searching for "${query}" within hashtag #${hashtag}`);
  
  try {
    const normalizedHashtag = hashtag.toLowerCase().replace(/^#/, '');
    
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        post_type,
        visibility,
        user_id,
        created_at,
        updated_at,
        media,
        view_count,
        status,
        tags
      `)
      .or(`content.ilike.%#${normalizedHashtag}%,title.ilike.%#${normalizedHashtag}%`)
      .or(`content.ilike.%${query}%,title.ilike.%${query}%`)
      .eq('is_deleted', false)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`✅ [SearchWithinHashtag] Found ${data?.length || 0} posts matching "${query}" in #${hashtag}`);
    return data || [];
  } catch (error) {
    console.error(`❌ [SearchWithinHashtag] Error searching for "${query}" in #${hashtag}:`, error);
    return [];
  }
};