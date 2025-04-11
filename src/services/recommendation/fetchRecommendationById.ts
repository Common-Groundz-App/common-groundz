
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './types';

export const fetchRecommendationById = async (id: string, userId: string | null = null): Promise<Recommendation | null> => {
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        entities(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching recommendation:', error);
      throw error;
    }

    if (!data) return null;

    // Get likes count
    const { count: likesCount, error: likesError } = await supabase
      .from('recommendation_likes')
      .select('*', { count: 'exact', head: true })
      .eq('recommendation_id', id);

    if (likesError) {
      console.error('Error fetching likes count:', likesError);
    }

    // Check if user liked this recommendation
    let isLiked = false;
    let isSaved = false;

    if (userId) {
      const { data: likeData } = await supabase
        .from('recommendation_likes')
        .select('id')
        .eq('recommendation_id', id)
        .eq('user_id', userId)
        .single();

      isLiked = !!likeData;

      const { data: saveData } = await supabase
        .from('recommendation_saves')
        .select('id')
        .eq('recommendation_id', id)
        .eq('user_id', userId)
        .single();

      isSaved = !!saveData;
    }

    return {
      ...data,
      likes: likesCount || 0,
      isLiked,
      isSaved,
      entity: data.entities,
      entities: undefined
    } as Recommendation;
  } catch (error) {
    console.error('Error in fetchRecommendationById:', error);
    throw error;
  }
};
