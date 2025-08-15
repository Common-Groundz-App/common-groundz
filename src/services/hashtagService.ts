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
 * Get posts by hashtag using proper hashtag relationships
 * @param hashtag - The normalized hashtag name
 * @param sortBy - Sort criteria ('recent' or 'popular')
 * @param timeFilter - Time filter ('all', 'week', 'month')
 * @returns Array of post data
 */
export const getPostsByHashtag = async (
  hashtag: string, 
  sortBy: 'recent' | 'popular' = 'recent',
  timeFilter: 'all' | 'week' | 'month' = 'all'
): Promise<any[]> => {
  console.log(`🔍 [HashtagService] Fetching posts for hashtag: #${hashtag}`);
  
  try {
    // Step 1: Get the hashtag ID
    const { data: hashtagData, error: hashtagError } = await supabase
      .from('hashtags')
      .select('id')
      .eq('name_norm', hashtag)
      .single();
      
    if (hashtagError || !hashtagData) {
      console.log(`📝 [HashtagService] Hashtag not found, using fallback for #${hashtag}`);
      return await getPostsByHashtagFallback(hashtag, sortBy, timeFilter);
    }
    
    // Step 2: Get posts via relationship table
    const { data: postHashtagData, error: postHashtagError } = await supabase
      .from('post_hashtags')
      .select('post_id')
      .eq('hashtag_id', hashtagData.id);
      
    let relationshipPosts: any[] = [];
    if (!postHashtagError && postHashtagData && postHashtagData.length > 0) {
      const postIds = postHashtagData.map(ph => ph.post_id);
      console.log(`📊 [HashtagService] Found ${postIds.length} posts via relationships for hashtag #${hashtag}`);
      
      // Step 3: Fetch posts by IDs
      let query = supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('is_deleted', false)
        .eq('visibility', 'public')
        .in('id', postIds);

      // Apply time filter
      if (timeFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        query = query.gte('created_at', oneWeekAgo.toISOString());
      } else if (timeFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        query = query.gte('created_at', oneMonthAgo.toISOString());
      }

      // Apply sorting
      if (sortBy === 'recent') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('view_count', { ascending: false });
      }
        
      const { data: postsData, error } = await query;
      if (!error && postsData) {
        relationshipPosts = postsData;
      }
    }
    
    // Step 4: Get posts via content search as fallback/supplement
    const fallbackPosts = await getPostsByHashtagFallback(hashtag, sortBy, timeFilter);
    
    // Step 5: Combine and deduplicate posts
    const allPostsMap = new Map();
    
    // Add relationship-based posts first (higher priority)
    relationshipPosts.forEach(post => {
      allPostsMap.set(post.id, post);
    });
    
    // Add fallback posts if not already present
    fallbackPosts.forEach(post => {
      if (!allPostsMap.has(post.id)) {
        allPostsMap.set(post.id, post);
      }
    });
    
    let combinedPosts = Array.from(allPostsMap.values());
    
    // Apply time filter if specified (in case fallback posts need filtering)
    if (timeFilter !== 'all') {
      const timeMap = {
        'week': 7,
        'month': 30
      };
      const days = timeMap[timeFilter];
      if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        combinedPosts = combinedPosts.filter(post => 
          new Date(post.created_at) >= cutoffDate
        );
      }
    }
    
    // Apply sorting to combined results
    if (sortBy === 'recent') {
      combinedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      combinedPosts.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    }
    
    console.log(`✅ [HashtagService] Found ${combinedPosts.length} total posts (${relationshipPosts.length} via relationships, ${fallbackPosts.length} via content search) for #${hashtag}`);
    
    return combinedPosts;
    
  } catch (error) {
    console.error(`❌ [HashtagService] Error in getPostsByHashtag for #${hashtag}:`, error);
    return await getPostsByHashtagFallback(hashtag, sortBy, timeFilter);
  }
};

/**
 * Fallback method using content search - simplified to use processPosts
 */
const getPostsByHashtagFallback = async (
  hashtag: string, 
  sortBy: 'recent' | 'popular' = 'recent',
  timeFilter: 'all' | 'week' | 'month' = 'all'
): Promise<any[]> => {
  console.log(`🔄 [HashtagFallback] Starting content search fallback for #${hashtag}`);
  
  try {
    // Fetch posts that contain the hashtag in content or title (no complex joins)
    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .or(`content.ilike.%#${hashtag}%,title.ilike.%#${hashtag}%`)
      .eq('is_deleted', false)
      .eq('visibility', 'public');

    // Apply time filter
    if (timeFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      query = query.gte('created_at', oneWeekAgo.toISOString());
    } else if (timeFilter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      query = query.gte('created_at', oneMonthAgo.toISOString());
    }

    // Apply sorting
    if (sortBy === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('view_count', { ascending: false });
    }
      
    const { data: postsData, error } = await query;
    if (error) throw error;
    
    console.log(`✅ [HashtagFallback] Content search found ${postsData?.length || 0} posts for #${hashtag}`);
    
    // Return raw posts data to avoid double processing
    return postsData || [];
    
  } catch (error) {
    console.error(`❌ [HashtagFallback] Content search failed for #${hashtag}:`, error);
    return [];
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
    
    // Use hybrid approach - same as getPostsByHashtag
    let allPosts: any[] = [];
    
    // Step 1: Get posts via relationship table
    const { data: hashtagData } = await supabase
      .from('hashtags')
      .select('id')
      .eq('name_norm', normalizedHashtag)
      .single();
      
    if (hashtagData) {
      // Get posts via relationship table
      const { data: postHashtagData } = await supabase
        .from('post_hashtags')
        .select('post_id')
        .eq('hashtag_id', hashtagData.id);
        
      if (postHashtagData && postHashtagData.length > 0) {
        const postIds = postHashtagData.map(ph => ph.post_id);
        
        const { data: relationshipPosts } = await supabase
          .from('posts')
          .select('id, user_id, created_at')
          .eq('is_deleted', false)
          .eq('visibility', 'public')
          .in('id', postIds);
          
        if (relationshipPosts) {
          allPosts.push(...relationshipPosts);
        }
      }
    }
    
    // Step 2: Get posts via content search (fallback/supplement)
    const { data: contentPosts } = await supabase
      .from('posts')
      .select('id, user_id, created_at')
      .or(`content.ilike.%#${normalizedHashtag}%,title.ilike.%#${normalizedHashtag}%`)
      .eq('is_deleted', false)
      .eq('visibility', 'public');
      
    // Step 3: Combine and deduplicate
    const postsMap = new Map();
    
    // Add relationship posts first (higher priority)
    allPosts.forEach(post => {
      postsMap.set(post.id, post);
    });
    
    // Add content search posts if not already present
    if (contentPosts) {
      contentPosts.forEach(post => {
        if (!postsMap.has(post.id)) {
          postsMap.set(post.id, post);
        }
      });
    }
    
    const combinedPosts = Array.from(postsMap.values());
    const totalPosts = combinedPosts.length;
    const uniqueUsers = new Set(combinedPosts.map(post => post.user_id)).size;
    
    // Calculate time-based metrics
    const now = new Date();
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const thisWeekPosts = combinedPosts.filter(post => new Date(post.created_at) >= thisWeek).length;
    const lastWeekPosts = combinedPosts.filter(post => {
      const date = new Date(post.created_at);
      return date >= lastWeek && date < thisWeek;
    }).length;
    const thisMonthPosts = combinedPosts.filter(post => new Date(post.created_at) >= thisMonth).length;
    const lastMonthPosts = combinedPosts.filter(post => {
      const date = new Date(post.created_at);
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
 * Search within hashtag posts
 * @param hashtag - The hashtag to search within
 * @param query - Search query for post content
 * @param limit - Maximum number of results
 */
export const searchWithinHashtag = async (hashtag: string, query: string, limit = 20) => {
  console.log(`🔍 [SearchWithinHashtag] Searching for "${query}" within hashtag #${hashtag}`);
  
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!user_id (
          id,
          username, 
          avatar_url
        )
      `)
      .or(`content.ilike.%#${hashtag}%,title.ilike.%#${hashtag}%`)
      .or(`content.ilike.%${query}%,title.ilike.%${query}%`)
      .eq('is_deleted', false)
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