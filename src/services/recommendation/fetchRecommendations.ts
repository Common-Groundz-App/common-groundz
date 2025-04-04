
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './types';

export const fetchUserRecommendations = async (userId: string) => {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }

  return data;
};

export const fetchRecommendationWithLikesAndSaves = async (userId: string, profileId: string) => {
  // Get recommendations
  const { data: recommendations, error } = await supabase
    .from('recommendations')
    .select(`
      *,
      recommendation_likes(count),
      recommendation_saves(count)
    `)
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }

  // If logged in user, get likes and saves
  if (userId) {
    // Get user likes
    const { data: userLikes, error: likesError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .eq('user_id', userId);

    if (likesError) {
      console.error('Error fetching user likes:', likesError);
    }

    // Get user saves
    const { data: userSaves, error: savesError } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .eq('user_id', userId);

    if (savesError) {
      console.error('Error fetching user saves:', savesError);
    }

    // Process recommendations with likes count and user interaction
    return recommendations.map(rec => {
      const likesCount = rec.recommendation_likes?.[0]?.count || 0;
      const isLiked = userLikes ? userLikes.some(like => like.recommendation_id === rec.id) : false;
      const isSaved = userSaves ? userSaves.some(save => save.recommendation_id === rec.id) : false;
      
      return {
        ...rec,
        likes: likesCount,
        isLiked,
        isSaved,
        recommendation_likes: undefined,
        recommendation_saves: undefined
      };
    });
  }

  // If not logged in, just return recommendations with counts
  return recommendations.map(rec => ({
    ...rec,
    likes: rec.recommendation_likes?.[0]?.count || 0,
    isLiked: false,
    isSaved: false,
    recommendation_likes: undefined,
    recommendation_saves: undefined
  }));
};
