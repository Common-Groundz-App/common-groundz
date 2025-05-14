
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
    // Base query using standard SQL join
    let query = supabase
      .from('recommendations')
      .select(`
        recommendations.*, 
        entities (*),
        profiles:profiles (username, avatar_url)
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
      
      // Process profile data considering possible response formats
      let username = null;
      let avatar_url = null;
      
      if (rec.profiles) {
        // Handle both array and object formats that Supabase might return
        if (Array.isArray(rec.profiles) && rec.profiles.length > 0) {
          username = rec.profiles[0].username;
          avatar_url = rec.profiles[0].avatar_url;
        } else if (!Array.isArray(rec.profiles)) {
          username = rec.profiles.username;
          avatar_url = rec.profiles.avatar_url;
        }
      }
      
      return {
        ...rec,
        username,
        avatar_url,
        likes: Number(likeCount),
        isLiked,
        entity: rec.entities,
        entities: undefined,
        profiles: undefined
      } as Recommendation;
    });

    return recommendations;
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    throw error;
  }
};
