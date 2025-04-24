
import { supabase } from '@/integrations/supabase/client';

// Get post like counts for a list of post IDs
export const getPostLikeCounts = async (postIds: string[]): Promise<Map<string, number>> => {
  if (!postIds.length) return new Map<string, number>();
  
  try {
    const { data: postLikesData } = await supabase
      .from('post_likes')
      .select('post_id');
      
    const likeCounts = new Map<string, number>();
    
    if (postLikesData) {
      postLikesData.forEach((item: any) => {
        const count = likeCounts.get(item.post_id) || 0;
        likeCounts.set(item.post_id, count + 1);
      });
    }
    
    return likeCounts;
  } catch (error) {
    console.error('Error counting post likes:', error);
    return new Map<string, number>();
  }
};

// Get user likes for posts
export const getUserPostLikes = async (postIds: string[], userId: string): Promise<Set<string>> => {
  if (!postIds.length) return new Set<string>();
  
  try {
    const { data: userLikesData } = await supabase
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', userId);
    
    const userLikedPosts = new Set<string>();
    
    if (userLikesData) {
      userLikesData.forEach((item: any) => {
        userLikedPosts.add(item.post_id);
      });
    }
    
    return userLikedPosts;
  } catch (error) {
    console.error('Error fetching user post likes:', error);
    return new Set<string>();
  }
};

// Get user saves for posts
export const getUserPostSaves = async (postIds: string[], userId: string): Promise<Set<string>> => {
  if (!postIds.length) return new Set<string>();
  
  try {
    const { data: userSavesData } = await supabase
      .from('post_saves')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', userId);
    
    const userSavedPosts = new Set<string>();
    
    if (userSavesData) {
      userSavesData.forEach((item: any) => {
        userSavedPosts.add(item.post_id);
      });
    }
    
    return userSavedPosts;
  } catch (error) {
    console.error('Error fetching user post saves:', error);
    return new Set<string>();
  }
};
