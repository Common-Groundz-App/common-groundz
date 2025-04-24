
import { supabase } from '@/integrations/supabase/client';
import { HomeQueryParams, PostHomeItem } from '../types';
import { createMap } from './utils';

// Fetch posts for home feed
export const fetchPosts = async (
  { userId, page, itemsPerPage }: HomeQueryParams,
  followingIds?: string[]
) => {
  try {
    let query = supabase
      .from('posts')
      .select(`
        *,
        media:post_media(*)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(itemsPerPage)
      .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);
    
    // Filter by following users if provided
    if (followingIds && followingIds.length > 0) {
      query = query.in('user_id', followingIds);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      posts: data || [],
    };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return {
      posts: [],
    };
  }
};

// Process posts with likes, saves, and user data
export const processPosts = async (posts: any[], userId: string | null) => {
  if (!posts || posts.length === 0) return [];
  
  try {
    // Get post IDs
    const postIds = posts.map((post) => post.id);
    
    // Fetch user profiles for posts
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', posts.map((post) => post.user_id));
    
    // Create map of user profiles
    const usersMap = createMap(usersData || [], 'id');
    
    // Get likes count for each post
    const { data: likesData } = await supabase.rpc('get_post_likes_by_ids', {
      p_post_ids: postIds
    });
    
    // Create map of likes counts
    const likesMap = new Map();
    if (likesData) {
      likesData.forEach((item: any) => {
        likesMap.set(item.post_id, item.like_count);
      });
    }
    
    // Get comment counts for each post
    const { data: commentCountsData } = await supabase.rpc('get_post_comment_counts', {
      p_post_ids: postIds
    });
    
    // Create map of comment counts
    const commentCountsMap = new Map();
    if (commentCountsData) {
      commentCountsData.forEach((item: any) => {
        commentCountsMap.set(item.post_id, item.comment_count);
      });
    }
    
    // Get user's likes for these posts
    let userLikes: Record<string, boolean> = {};
    if (userId) {
      const { data: userLikesData } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);
      
      userLikes = (userLikesData || []).reduce((acc: Record<string, boolean>, like: any) => {
        acc[like.post_id] = true;
        return acc;
      }, {});
    }
    
    // Get user's saves for these posts
    let userSaves: Record<string, boolean> = {};
    if (userId) {
      const { data: userSavesData } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);
      
      userSaves = (userSavesData || []).reduce((acc: Record<string, boolean>, save: any) => {
        acc[save.post_id] = true;
        return acc;
      }, {});
    }
    
    // Fetch tagged entities for these posts
    const { data: postEntitiesData } = await supabase.rpc('get_post_entities', {
      p_post_ids: postIds
    });
    
    // Group entities by post_id
    const postEntitiesMap: Record<string, any[]> = {};
    if (postEntitiesData) {
      postEntitiesData.forEach((row: any) => {
        if (!postEntitiesMap[row.post_id]) {
          postEntitiesMap[row.post_id] = [];
        }
        postEntitiesMap[row.post_id].push(row.entity);
      });
    }
    
    // Process each post with additional data
    return posts.map((post) => {
      const user = usersMap.get(post.user_id);
      const likeCount = likesMap.get(post.id) || 0;
      const commentCount = commentCountsMap.get(post.id) || 0;
      const isLiked = userLikes[post.id] || false;
      const isSaved = userSaves[post.id] || false;
      const taggedEntities = postEntitiesMap[post.id] || [];
      
      const processedPost: PostHomeItem = {
        ...post,
        username: user?.username || null,
        avatar_url: user?.avatar_url || null,
        is_post: true,
        likes: likeCount,
        is_liked: isLiked,
        is_saved: isSaved,
        comment_count: commentCount,
        tagged_entities: taggedEntities,
      };
      
      return processedPost;
    });
  } catch (error) {
    console.error('Error processing posts:', error);
    return [];
  }
};
