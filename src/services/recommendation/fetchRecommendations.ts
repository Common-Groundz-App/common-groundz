
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
    // Base query using a different approach for joining
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        entities (*)
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
    
    // Get user profiles for these recommendations
    const userIds = data.map(rec => rec.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
      
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      // Continue without profiles rather than failing completely
    }
    
    // Create a map of user_id -> profile data for faster lookups
    const profilesMap = new Map();
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, {
          username: profile.username,
          avatar_url: profile.avatar_url
        });
      });
    }

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
      
      // Get profile data from our map
      const profile = profilesMap.get(rec.user_id) || {};
      
      return {
        ...rec,
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
        likes: Number(likeCount),
        isLiked,
        entity: rec.entities,
        entities: undefined,  // Remove this from the final object to avoid confusion
      } as Recommendation;
    });

    console.log('Recommendations to return:', recommendations.length);
    return recommendations;
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    throw error;
  }
};
