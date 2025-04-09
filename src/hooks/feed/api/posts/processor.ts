
import { PostFeedItem } from '../../types';
import { fetchProfiles } from '../profiles';
import { createMap, processMediaItems } from '../../api/utils';
import { fetchPostEntities } from './entities';
import { getPostLikeCounts, getUserPostLikes, getUserPostSaves } from './interactions';

// Process posts data with additional metadata
export const processPosts = async (
  postsData: any[], 
  userId: string
): Promise<PostFeedItem[]> => {
  if (!postsData.length) return [];
  
  try {
    // Get post IDs for fetching related data
    const postIds = postsData.map(post => post.id);
    
    // Fetch user profiles
    const userIds = postsData.map(post => post.user_id);
    const { data: profilesData } = await fetchProfiles(userIds);
    
    // Create lookup map for profiles
    const profilesMap = createMap(profilesData, 'id');
    
    // Get entities for posts
    const entitiesByPostId = await fetchPostEntities(postIds);
    
    // Get post likes count
    const likeCounts = await getPostLikeCounts(postIds);
    
    // Get user likes and saves for posts
    const userLikedPosts = await getUserPostLikes(postIds, userId);
    const userSavedPosts = await getUserPostSaves(postIds, userId);
    
    // Format the posts as feed items
    const processedPosts = postsData.map(post => {
      // Get profile data
      const profile = profilesMap.get(post.user_id);
      const username = profile?.username || null;
      const avatar_url = profile?.avatar_url || null;
      
      // Process media properly with type safety
      const mediaItems = processMediaItems(post.media || []);
      
      // Get post metadata
      const likes = likeCounts.get(post.id) || 0;
      const isLiked = userLikedPosts.has(post.id);
      const isSaved = userSavedPosts.has(post.id);
      
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
        tagged_entities: entitiesByPostId[post.id] || [],
        media: mediaItems,
        status: postStatus
      } as PostFeedItem;
    });
    
    return processedPosts;
  } catch (error) {
    console.error('Error processing posts:', error);
    throw error;
  }
};
