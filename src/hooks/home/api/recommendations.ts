
import { supabase } from '@/integrations/supabase/client';
import { HomeQueryParams, HomeItem } from '../types';
import { createMap } from './utils';

// Fetch recommendations for home feed
export const fetchRecommendations = async (
  { userId, page, itemsPerPage }: HomeQueryParams,
  followingIds?: string[]
) => {
  try {
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        entities(*)
      `)
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
      recommendations: data || [],
    };
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return {
      recommendations: [],
    };
  }
};

// Process recommendations with likes, saves, and user data
export const processRecommendations = async (recommendations: any[], userId: string | null) => {
  if (!recommendations || recommendations.length === 0) return [];
  
  try {
    // Get recommendation IDs
    const recommendationIds = recommendations.map((rec) => rec.id);
    
    // Fetch user profiles for recommendations
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', recommendations.map((rec) => rec.user_id));
    
    // Create map of user profiles
    const usersMap = createMap(usersData || [], 'id');
    
    // Get likes count for each recommendation
    const { data: likesData } = await supabase.rpc('get_recommendation_likes_by_ids', {
      p_recommendation_ids: recommendationIds
    });
    
    // Create map of likes counts
    const likesMap = new Map();
    if (likesData) {
      likesData.forEach((item: any) => {
        likesMap.set(item.recommendation_id, item.like_count);
      });
    }
    
    // Get comment counts for each recommendation
    const { data: commentCountsData } = await supabase.rpc('get_recommendation_comment_counts', {
      p_recommendation_ids: recommendationIds
    });
    
    // Create map of comment counts
    const commentCountsMap = new Map();
    if (commentCountsData) {
      commentCountsData.forEach((item: any) => {
        commentCountsMap.set(item.recommendation_id, item.comment_count);
      });
    }
    
    // Get user's likes for these recommendations
    let userLikes: Record<string, boolean> = {};
    if (userId) {
      const { data: userLikesData } = await supabase.rpc('get_user_recommendation_likes', {
        p_recommendation_ids: recommendationIds,
        p_user_id: userId
      });
      
      userLikes = (userLikesData || []).reduce((acc: Record<string, boolean>, like: any) => {
        acc[like.recommendation_id] = true;
        return acc;
      }, {});
    }
    
    // Get user's saves for these recommendations
    let userSaves: Record<string, boolean> = {};
    if (userId) {
      const { data: userSavesData } = await supabase
        .from('saved_recommendations')
        .select('recommendation_id')
        .eq('user_id', userId)
        .in('recommendation_id', recommendationIds);
      
      userSaves = (userSavesData || []).reduce((acc: Record<string, boolean>, save: any) => {
        acc[save.recommendation_id] = true;
        return acc;
      }, {});
    }
    
    // Process each recommendation with additional data
    return recommendations.map((rec) => {
      const user = usersMap.get(rec.user_id);
      const likeCount = likesMap.get(rec.id) || 0;
      const commentCount = commentCountsMap.get(rec.id) || 0;
      const isLiked = userLikes[rec.id] || false;
      const isSaved = userSaves[rec.id] || false;
      
      const processedRecommendation: HomeItem = {
        ...rec,
        username: user?.username || null,
        avatar_url: user?.avatar_url || null,
        likes: likeCount,
        is_liked: isLiked,
        is_saved: isSaved,
        comment_count: commentCount,
      };
      
      return processedRecommendation;
    });
  } catch (error) {
    console.error('Error processing recommendations:', error);
    return [];
  }
};
