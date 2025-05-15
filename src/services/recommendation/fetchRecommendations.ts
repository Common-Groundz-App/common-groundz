
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, EntityType, RecommendationCategory } from './types';
import { fetchUserProfile } from '../profileService';

export const fetchUserRecommendations = async (
  userId: string | null = null, 
  profileUserId?: string,
  category?: RecommendationCategory | string,
  sortBy: 'latest' | 'top' = 'latest',
  limit = 50
): Promise<Recommendation[]> => {
  try {
    // Base query
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        entities(*)
      `)
      .order(sortBy === 'latest' ? 'created_at' : 'view_count', { ascending: false })
      .limit(limit);

    // Filter by specific user profile if provided
    if (profileUserId) {
      query = query.eq('user_id', profileUserId);
    }

    // Filter by category if provided
    if (category) {
      // Type assertion to handle both string and enum types
      // This tells TypeScript that we know what we're doing with the category value
      query = query.eq('category', category as RecommendationCategory);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }

    // No recommendations found
    if (!data || data.length === 0) return [];

    // Extract recommendation IDs and user IDs
    const recommendationIds = data.map(rec => rec.id);
    const userIds = [...new Set(data.map(rec => rec.user_id))];

    // Get likes count
    const { data: likeCounts } = await supabase.rpc('get_recommendation_likes_by_ids', {
      p_recommendation_ids: recommendationIds
    });

    // Get user likes
    let userLikes: any[] = [];
    if (userId) {
      const { data: likesData } = await supabase.rpc('get_user_recommendation_likes', {
        p_recommendation_ids: recommendationIds,
        p_user_id: userId
      });
      userLikes = likesData || [];
    }
    
    // Get user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    // Create a map of user IDs to profiles for quick lookup
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
    }

    // Combine all the data
    const recommendations = data.map(rec => {
      const likeCount = likeCounts?.find(l => l.recommendation_id === rec.id)?.like_count || 0;
      const isLiked = userLikes?.some(like => like.recommendation_id === rec.id) || false;
      const profile = profileMap.get(rec.user_id) || {};
      
      return {
        ...rec,
        likes: Number(likeCount),
        isLiked,
        entity: rec.entities,
        entities: undefined,
        username: profile.username || null,
        avatar_url: profile.avatar_url || null
      } as Recommendation;
    });

    return recommendations;
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    throw error;
  }
};
