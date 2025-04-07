
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, FeedItem, PostFeedItem } from './types';
import { MediaItem } from '@/types/media';

export const fetchForYouFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    // Fetch recommendations
    const recFrom = page * itemsPerPage;
    const recTo = recFrom + itemsPerPage - 1;
    
    const { data: recsData, error: recsError } = await supabase
      .from('recommendations')
      .select(`
        *,
        profiles(username, avatar_url),
        recommendation_likes!inner(user_id)
      `)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (recsError) throw recsError;
    
    // Fetch posts for the feed
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (postsError) throw postsError;
    
    // Process recommendations
    const processedRecs = recsData.map(rec => {
      return {
        ...rec,
        username: rec.profiles?.username,
        avatar_url: rec.profiles?.avatar_url,
        likes: 0, // We'll update this with a count query
        is_liked: false,
        is_saved: false
      };
    });
    
    // Get likes and saves for recommendations
    const recIds = processedRecs.map(rec => rec.id);
    
    if (recIds.length > 0) {
      // Get likes
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id, count')
        .in('recommendation_id', recIds)
        .eq('user_id', userId);
        
      // Get saves  
      const { data: savesData } = await supabase
        .from('recommendation_saves')
        .select('recommendation_id')
        .in('recommendation_id', recIds)
        .eq('user_id', userId);
        
      // Update recommendations with like and save status
      if (likesData) {
        likesData.forEach((like: any) => {
          const rec = processedRecs.find(r => r.id === like.recommendation_id);
          if (rec) {
            rec.is_liked = true;
            rec.likes = like.count || 1;
          }
        });
      }
      
      if (savesData) {
        savesData.forEach((save: any) => {
          const rec = processedRecs.find(r => r.id === save.recommendation_id);
          if (rec) rec.is_saved = true;
        });
      }
    }
    
    // Process posts
    let processedPosts: PostFeedItem[] = [];
    
    if (postsData && postsData.length > 0) {
      // Get post IDs for fetching entities
      const postIds = postsData.map(post => post.id);
      
      // Fetch post entities
      const supabaseAny = supabase as any;
      const { data: entityData } = await supabaseAny.rpc('get_post_entities', {
        post_ids: postIds
      });
      
      // Organize entities by post
      const entitiesByPostId: Record<string, any[]> = {};
      if (entityData) {
        entityData.forEach((item: any) => {
          if (!entitiesByPostId[item.post_id]) {
            entitiesByPostId[item.post_id] = [];
          }
          entitiesByPostId[item.post_id].push(item.entity);
        });
      }
      
      // Get likes for posts (using a custom likes table or count of likes)
      const { data: postLikes } = await supabase
        .from('post_likes')
        .select('post_id, count')
        .in('post_id', postIds);
      
      // Get saves for posts
      const { data: postSaves } = await supabase
        .from('post_saves')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      
      // Format the posts as feed items
      processedPosts = postsData.map(post => {
        // Process media properly with type safety
        let mediaItems: MediaItem[] | undefined;
        
        if (post.media && Array.isArray(post.media)) {
          // Map each item in the media array to ensure it conforms to MediaItem structure
          mediaItems = post.media.map((item: any): MediaItem => ({
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
        }
        
        // Find likes for this post
        const likeRecord = postLikes?.find((like: any) => like.post_id === post.id);
        const isLiked = Boolean(likeRecord);
        const likes = likeRecord?.count || 0;
        
        // Find if post is saved
        const isSaved = Boolean(postSaves?.find((save: any) => save.post_id === post.id));
        
        return {
          ...post,
          username: post.profiles?.username,
          avatar_url: post.profiles?.avatar_url,
          is_post: true,
          likes: likes,
          is_liked: isLiked,
          is_saved: isSaved,
          tagged_entities: entitiesByPostId[post.id] || [],
          media: mediaItems
        };
      });
    }
    
    // Combine and sort all feed items
    const allItems = [...processedRecs, ...processedPosts];
    allItems.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    // Pagination calculation
    const hasMore = allItems.length >= itemsPerPage;
    
    return {
      items: allItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching for you feed:', error);
    throw error;
  }
};

export const fetchFollowingFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    // Get user's following list
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
      
    if (followingError) throw followingError;
    
    // If not following anyone, return empty feed
    if (!followingData || followingData.length === 0) {
      return { items: [], hasMore: false };
    }
    
    const followingIds = followingData.map(f => f.following_id);
    
    // Fetch recommendations from followed users
    const recFrom = page * itemsPerPage;
    const recTo = recFrom + itemsPerPage - 1;
    
    const { data: recsData, error: recsError } = await supabase
      .from('recommendations')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .in('user_id', followingIds)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (recsError) throw recsError;
    
    // Fetch posts from followed users
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .in('user_id', followingIds)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (postsError) throw postsError;
    
    // Process recommendations
    const processedRecs = recsData.map(rec => {
      return {
        ...rec,
        username: rec.profiles?.username,
        avatar_url: rec.profiles?.avatar_url,
        likes: 0,
        is_liked: false,
        is_saved: false
      };
    });
    
    // Get likes and saves for recommendations
    const recIds = processedRecs.map(rec => rec.id);
    
    if (recIds.length > 0) {
      // Get likes
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id, count')
        .in('recommendation_id', recIds);
        
      // Get user's likes  
      const { data: userLikes } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id')
        .in('recommendation_id', recIds)
        .eq('user_id', userId);
        
      // Get saves  
      const { data: savesData } = await supabase
        .from('recommendation_saves')
        .select('recommendation_id')
        .in('recommendation_id', recIds)
        .eq('user_id', userId);
        
      // Update recommendations with like and save status
      if (likesData) {
        likesData.forEach((like: any) => {
          const rec = processedRecs.find(r => r.id === like.recommendation_id);
          if (rec) {
            rec.likes = like.count || 0;
          }
        });
      }
      
      if (userLikes) {
        userLikes.forEach((like: any) => {
          const rec = processedRecs.find(r => r.id === like.recommendation_id);
          if (rec) rec.is_liked = true;
        });
      }
      
      if (savesData) {
        savesData.forEach((save: any) => {
          const rec = processedRecs.find(r => r.id === save.recommendation_id);
          if (rec) rec.is_saved = true;
        });
      }
    }
    
    // Process posts
    let processedPosts: PostFeedItem[] = [];
    
    if (postsData && postsData.length > 0) {
      // Get post IDs for fetching entities
      const postIds = postsData.map(post => post.id);
      
      // Fetch post entities
      const supabaseAny = supabase as any;
      const { data: entityData } = await supabaseAny.rpc('get_post_entities', {
        post_ids: postIds
      });
      
      // Organize entities by post
      const entitiesByPostId: Record<string, any[]> = {};
      if (entityData) {
        entityData.forEach((item: any) => {
          if (!entitiesByPostId[item.post_id]) {
            entitiesByPostId[item.post_id] = [];
          }
          entitiesByPostId[item.post_id].push(item.entity);
        });
      }
      
      // Get likes for posts (using a custom likes table or count of likes)
      const { data: postLikes } = await supabase
        .from('post_likes')
        .select('post_id, count')
        .in('post_id', postIds);
      
      // Get saves for posts
      const { data: postSaves } = await supabase
        .from('post_saves')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      
      // Format the posts as feed items
      processedPosts = postsData.map(post => {
        // Process media properly with type safety
        let mediaItems: MediaItem[] | undefined;
        
        if (post.media && Array.isArray(post.media)) {
          // Map each item in the media array to ensure it conforms to MediaItem structure
          mediaItems = post.media.map((item: any): MediaItem => ({
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
        }
        
        // Find likes for this post
        const likeRecord = postLikes?.find((like: any) => like.post_id === post.id);
        const isLiked = Boolean(likeRecord);
        const likes = likeRecord?.count || 0;
        
        // Find if post is saved
        const isSaved = Boolean(postSaves?.find((save: any) => save.post_id === post.id));
        
        return {
          ...post,
          username: post.profiles?.username,
          avatar_url: post.profiles?.avatar_url,
          is_post: true,
          likes: likes,
          is_liked: isLiked,
          is_saved: isSaved,
          tagged_entities: entitiesByPostId[post.id] || [],
          media: mediaItems
        };
      });
    }
    
    // Combine and sort all feed items
    const allItems = [...processedRecs, ...processedPosts];
    allItems.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    // Pagination calculation
    const hasMore = allItems.length >= itemsPerPage;
    
    return {
      items: allItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching following feed:', error);
    throw error;
  }
};
