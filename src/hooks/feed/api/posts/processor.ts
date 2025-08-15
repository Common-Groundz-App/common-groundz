
import { PostFeedItem } from '../../types';
import { fetchProfilesBatch } from '@/services/enhancedUnifiedProfileService';
import { createMap, processMediaItems } from '../../api/utils';
import { fetchPostEntities } from './entities';
import { getPostLikeCounts, getUserPostLikes, getUserPostSaves } from './interactions';

// Process posts data with additional metadata
export const processPosts = async (
  postsData: any[], 
  userId: string
): Promise<PostFeedItem[]> => {
  console.log('🔄 [processPosts] Starting processing:', { postsCount: postsData.length, userId });
  
  if (!postsData.length) {
    console.log('⚠️ [processPosts] No posts to process');
    return [];
  }
  
  try {
    // Get post IDs for fetching related data
    const postIds = postsData.map(post => post.id);
    console.log('📋 [processPosts] Processing post IDs:', postIds.slice(0, 5), postIds.length > 5 ? `... and ${postIds.length - 5} more` : '');
    
    // Fetch user profiles using enhanced unified service
    console.log('👥 [processPosts] Fetching profiles...');
    const startTime = Date.now();
    const userIds = [...new Set(postsData.map(post => post.user_id))];
    const { profiles: profilesMap } = await fetchProfilesBatch(userIds);
    console.log('✅ [processPosts] Profiles fetched:', { duration: Date.now() - startTime, profileCount: Object.keys(profilesMap).length });
    
    // Get entities for posts with error handling
    console.log('🏷️ [processPosts] Fetching entities...');
    let entitiesByPostId = {};
    try {
      entitiesByPostId = await fetchPostEntities(postIds);
      console.log('✅ [processPosts] Entities fetched successfully');
    } catch (error) {
      console.warn('⚠️ [processPosts] Entities fetch failed, using fallback:', error.message);
      entitiesByPostId = {}; // fallback to empty
    }
    
    // Get post likes count with error handling
    console.log('❤️ [processPosts] Fetching like counts...');
    let likeCounts = new Map();
    try {
      likeCounts = await getPostLikeCounts(postIds);
      console.log('✅ [processPosts] Like counts fetched successfully');
    } catch (error) {
      console.warn('⚠️ [processPosts] Like counts fetch failed, using fallback:', error.message);
      likeCounts = new Map(); // fallback to empty
    }
    
    // Get user likes and saves for posts with error handling
    console.log('👤 [processPosts] Fetching user interactions...');
    let userLikedPosts = new Set();
    let userSavedPosts = new Set();
    try {
      [userLikedPosts, userSavedPosts] = await Promise.all([
        getUserPostLikes(postIds, userId),
        getUserPostSaves(postIds, userId)
      ]);
      console.log('✅ [processPosts] User interactions fetched successfully');
    } catch (error) {
      console.warn('⚠️ [processPosts] User interactions fetch failed, using fallback:', error.message);
      userLikedPosts = new Set(); // fallback to empty
      userSavedPosts = new Set(); // fallback to empty
    }
    
    // Format the posts as feed items
    console.log('🔄 [processPosts] Mapping posts to feed items...');
    const processedPosts = postsData.map(post => {
      // Get profile data from enhanced service
      const profile = profilesMap[post.user_id];
      const username = profile?.displayName || profile?.username || null;
      const avatar_url = profile?.avatar_url || null;
      
      // Process media properly with type safety
      const mediaItems = processMediaItems(post.media || []);
      
      // Get post metadata
      const likes = likeCounts.get(post.id) || 0;
      const isLiked = userLikedPosts.has(post.id);
      const isSaved = userSavedPosts.has(post.id);
      
      // Ensure the comment_count is set
      const comment_count = post.comment_count || 0;
      
      // Ensure status is one of the allowed values
      let postStatus: 'draft' | 'published' | 'failed' = 'published';
      if (post.status === 'draft' || post.status === 'failed') {
        postStatus = post.status as 'draft' | 'published' | 'failed';
      }
      
      return {
        ...post,
        username,
        avatar_url,
        is_post: true,
        likes,
        is_liked: isLiked,
        is_saved: isSaved,
        comment_count,
        tagged_entities: entitiesByPostId[post.id] || [],
        media: mediaItems,
        status: postStatus
      } as PostFeedItem;
    });
    
    console.log('✅ [processPosts] Processing completed successfully:', { processedCount: processedPosts.length });
    return processedPosts;
  } catch (error) {
    console.error('❌ [processPosts] Error processing posts:', error);
    
    // Return fallback data instead of throwing - don't block the UI
    console.log('🔄 [processPosts] Returning fallback posts without enrichment');
    return postsData.map(post => ({
      ...post,
      username: null,
      avatar_url: null,
      is_post: true,
      likes: 0,
      is_liked: false,
      is_saved: false,
      comment_count: post.comment_count || 0,
      tagged_entities: [],
      media: post.media || [],
      status: 'published' as const
    }));
  }
};
