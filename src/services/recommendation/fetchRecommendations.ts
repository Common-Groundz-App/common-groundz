
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, EntityType } from './types';
import { fetchProfiles } from '../profileService';

export const fetchUserRecommendations = async (
  userId: string | null = null, 
  profileUserId?: string,
  category?: EntityType,
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

    // Filter by category if provided with type safety
    if (category) {
      query = query.eq('category', category);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }

    // No recommendations found
    if (!data || data.length === 0) return [];

    // Extract recommendation IDs
    const recommendationIds = data.map(rec => rec.id);

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

    // Combine all the data
    const recommendations = data.map(rec => {
      const likeCount = likeCounts?.find(l => l.recommendation_id === rec.id)?.like_count || 0;
      const isLiked = userLikes?.some(like => like.recommendation_id === rec.id) || false;
      
      return {
        ...rec,
        likes: Number(likeCount),
        isLiked,
        entity: rec.entities,
        entities: undefined
      } as Recommendation;
    });

    return recommendations;
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    throw error;
  }
};
