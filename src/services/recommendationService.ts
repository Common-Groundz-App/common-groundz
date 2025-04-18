
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './recommendation/types';

export const toggleLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
  const { data, error } = await supabase.rpc('toggle_recommendation_like', {
    p_recommendation_id: recommendationId,
    p_user_id: userId
  });

  if (error) {
    console.error('Error toggling like:', error);
    throw error;
  }

  return data;
};

export const fetchRecommendationById = async (recommendationId: string, userId: string): Promise<Recommendation | null> => {
  const { data, error } = await supabase
    .from('recommendations')
    .select(`
      *,
      entities(*)
    `)
    .eq('id', recommendationId)
    .single();

  if (error) {
    console.error('Error fetching recommendation:', error);
    return null;
  }

  // Fetch likes count
  const { data: likesData } = await supabase.rpc('get_recommendation_likes_by_ids', {
    p_recommendation_ids: [recommendationId]
  });

  // Check if user liked this recommendation
  const { data: userLikedData } = await supabase.rpc('get_user_recommendation_likes', {
    p_recommendation_ids: [recommendationId],
    p_user_id: userId
  });

  return {
    ...data,
    likes: likesData?.[0]?.like_count || 0,
    isLiked: userLikedData?.length > 0,
    entity: data.entities,
    entities: undefined
  } as Recommendation;
};
