
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, FeedItem, PostFeedItem, CombinedFeedItem } from './types';
import { MediaItem } from '@/types/media';

export const fetchForYouFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    // Fetch recommendations
    const recFrom = page * itemsPerPage;
    const recTo = recFrom + itemsPerPage - 1;
    
    // Get recommendations data first
    const { data: recsData, error: recsError } = await supabase
      .from('recommendations')
      .select(`*`)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (recsError) throw recsError;
    
    // Fetch user profiles for the recommendations separately
    const userIds = recsData.map(rec => rec.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profilesError) throw profilesError;
    
    // Create lookup map for profiles
    const profilesMap = new Map();
    profilesData?.forEach(profile => {
      profilesMap.set(profile.id, profile);
    });
    
    // Fetch posts for the feed
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`*`)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (postsError) throw postsError;
    
    // Get user profiles for the posts
    const postUserIds = postsData.map(post => post.user_id);
    const { data: postProfilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', postUserIds);
    
    // Create lookup map for post profiles
    const postProfilesMap = new Map();
    postProfilesData?.forEach(profile => {
      postProfilesMap.set(profile.id, profile);
    });
    
    // Process recommendations
    const processedRecs = recsData.map(rec => {
      const profile = profilesMap.get(rec.user_id);
      return {
        ...rec,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
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
        .select('recommendation_id')
        .in('recommendation_id', recIds);
        
      // Count likes for each recommendation
      const likesCount = new Map();
      likesData?.forEach((like: any) => {
        const count = likesCount.get(like.recommendation_id) || 0;
        likesCount.set(like.recommendation_id, count + 1);
      });
      
      // Get user likes
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
      processedRecs.forEach(rec => {
        rec.likes = likesCount.get(rec.id) || 0;
      });
      
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
      
      // Handle entities - with proper error checking
      let entitiesByPostId: Record<string, any[]> = {};
      try {
        // Use the RPC function for fetching post entities
        const { data: entityData, error: entityError } = await supabase
          .rpc('get_post_entities', { post_ids: postIds });
          
        if (entityError) {
          console.error('Error fetching post entities:', entityError);
        } else if (entityData) {
          // Group entities by post_id
          entityData.forEach((item: any) => {
            if (!entitiesByPostId[item.post_id]) {
              entitiesByPostId[item.post_id] = [];
            }
            if (item.entity) {
              entitiesByPostId[item.post_id].push(item.entity);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching post entities:', error);
      }
      
      // Get post likes count
      const likeCounts = new Map<string, number>();
      try {
        const { data: postLikesData } = await supabase
          .from('post_likes')
          .select('post_id');
          
        if (postLikesData) {
          postLikesData.forEach((item: any) => {
            const count = likeCounts.get(item.post_id) || 0;
            likeCounts.set(item.post_id, count + 1);
          });
        }
      } catch (error) {
        console.error('Error counting post likes:', error);
      }
      
      // Get user likes for posts
      const userLikedPosts = new Set<string>();
      const { data: userLikesData } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      
      if (userLikesData) {
        userLikesData.forEach((item: any) => {
          userLikedPosts.add(item.post_id);
        });
      }
      
      // Get saves for posts
      const userSavedPosts = new Set<string>();
      const { data: userSavesData } = await supabase
        .from('post_saves')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      
      if (userSavesData) {
        userSavesData.forEach((item: any) => {
          userSavedPosts.add(item.post_id);
        });
      }
      
      // Format the posts as feed items
      processedPosts = postsData.map(post => {
        // Get profile data
        const profile = postProfilesMap.get(post.user_id);
        const username = profile?.username || null;
        const avatar_url = profile?.avatar_url || null;
        
        // Process media properly with type safety
        let mediaItems: MediaItem[] = [];
        
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
          likes: likes,
          is_liked: isLiked,
          is_saved: isSaved,
          tagged_entities: entitiesByPostId[post.id] || [],
          media: mediaItems,
          status: postStatus
        } as PostFeedItem;
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
      .select(`*`)
      .in('user_id', followingIds)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (recsError) throw recsError;
    
    // Fetch user profiles for the recommendations separately
    const userIds = recsData.map(rec => rec.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profilesError) throw profilesError;
    
    // Create lookup map for profiles
    const profilesMap = new Map();
    profilesData?.forEach(profile => {
      profilesMap.set(profile.id, profile);
    });
    
    // Fetch posts from followed users
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`*`)
      .in('user_id', followingIds)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(recFrom, recTo);
      
    if (postsError) throw postsError;
    
    // Get user profiles for the posts
    const postUserIds = postsData.map(post => post.user_id);
    const { data: postProfilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', postUserIds);
    
    // Create lookup map for post profiles
    const postProfilesMap = new Map();
    postProfilesData?.forEach(profile => {
      postProfilesMap.set(profile.id, profile);
    });
    
    // Process recommendations
    const processedRecs = recsData.map(rec => {
      const profile = profilesMap.get(rec.user_id);
      return {
        ...rec,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        likes: 0,
        is_liked: false,
        is_saved: false
      };
    });
    
    // Get likes and saves for recommendations
    const recIds = processedRecs.map(rec => rec.id);
    
    if (recIds.length > 0) {
      // Get likes count
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id');
        
      // Count likes for each recommendation
      const likesCount = new Map();
      likesData?.forEach((like: any) => {
        const count = likesCount.get(like.recommendation_id) || 0;
        likesCount.set(like.recommendation_id, count + 1);
      });
      
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
      processedRecs.forEach(rec => {
        rec.likes = likesCount.get(rec.id) || 0;
      });
      
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
      
      // Handle entities - with proper error checking
      let entitiesByPostId: Record<string, any[]> = {};
      try {
        // Use the RPC function for fetching post entities
        const { data: entityData, error: entityError } = await supabase
          .rpc('get_post_entities', { post_ids: postIds });
          
        if (entityError) {
          console.error('Error fetching post entities:', entityError);
        } else if (entityData) {
          // Group entities by post_id
          entityData.forEach((item: any) => {
            if (!entitiesByPostId[item.post_id]) {
              entitiesByPostId[item.post_id] = [];
            }
            if (item.entity) {
              entitiesByPostId[item.post_id].push(item.entity);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching post entities:', error);
      }
      
      // Get post likes count
      const likeCounts = new Map<string, number>();
      try {
        const { data: postLikesData } = await supabase
          .from('post_likes')
          .select('post_id');
          
        if (postLikesData) {
          postLikesData.forEach((item: any) => {
            const count = likeCounts.get(item.post_id) || 0;
            likeCounts.set(item.post_id, count + 1);
          });
        }
      } catch (error) {
        console.error('Error counting post likes:', error);
      }
      
      // Get user likes for posts
      const userLikedPosts = new Set<string>();
      const { data: userLikesData } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      
      if (userLikesData) {
        userLikesData.forEach((item: any) => {
          userLikedPosts.add(item.post_id);
        });
      }
      
      // Get saves for posts
      const userSavedPosts = new Set<string>();
      const { data: userSavesData } = await supabase
        .from('post_saves')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', userId);
      
      if (userSavesData) {
        userSavesData.forEach((item: any) => {
          userSavedPosts.add(item.post_id);
        });
      }
      
      // Format the posts as feed items
      processedPosts = postsData.map(post => {
        // Get profile data
        const profile = postProfilesMap.get(post.user_id);
        const username = profile?.username || null;
        const avatar_url = profile?.avatar_url || null;
        
        // Process media properly with type safety
        let mediaItems: MediaItem[] = [];
        
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
          likes: likes,
          is_liked: isLiked,
          is_saved: isSaved,
          tagged_entities: entitiesByPostId[post.id] || [],
          media: mediaItems,
          status: postStatus
        } as PostFeedItem;
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
