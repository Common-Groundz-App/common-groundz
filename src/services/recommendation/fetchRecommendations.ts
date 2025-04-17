
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './types';

// Fetch user recommendations
export const fetchUserRecommendations = async (
  currentUserId: string | null, 
  profileUserId: string
) => {
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        entities(*)
      `)
      .eq('user_id', profileUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }

    // No recommendations found
    if (!data || data.length === 0) return [];

    // Get array of recommendation IDs
    const recommendationIds = data.map(rec => rec.id);

    // Get likes for each recommendation
    const { data: likesData, error: likesError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds)
      .eq('user_id', currentUserId || '');

    // Get saves for each recommendation
    const { data: savesData, error: savesError } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds)
      .eq('user_id', currentUserId || '');

    // Get like counts
    const { data: likeCountData, error: likeCountError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id, count')
      .in('recommendation_id', recommendationIds)
      .group('recommendation_id');

    if (likesError || savesError || likeCountError) {
      console.error('Error fetching interactions:', likesError || savesError || likeCountError);
    }

    // Map likes and saves to recommendations
    return data.map(rec => {
      const isLiked = likesData?.some(like => like.recommendation_id === rec.id) || false;
      const isSaved = savesData?.some(save => save.recommendation_id === rec.id) || false;
      const likeCount = likeCountData?.find(item => item.recommendation_id === rec.id)?.count || 0;

      return {
        ...rec,
        likes: Number(likeCount),
        isLiked,
        isSaved,
        entity: rec.entities,
        entities: undefined
      };
    });
  } catch (error) {
    console.error('Error in fetchRecommendations:', error);
    throw error;
  }
};

// Fetch a single recommendation with likes and saves
export const fetchRecommendationWithLikesAndSaves = async (
  currentUserId: string, 
  profileUserId: string
) => {
  try {
    // Make sure the user ID is provided
    if (!profileUserId) return [];

    // Get all recommendations for the user
    const { data, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        entities(*)
      `)
      .eq('user_id', profileUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }

    // No recommendations found
    if (!data || data.length === 0) return [];

    // Get array of recommendation IDs
    const recommendationIds = data.map(rec => rec.id);

    // Get all likes by the current user for these recommendations
    const { data: likedByUser, error: likedError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds)
      .eq('user_id', currentUserId);

    // Get all saves by the current user for these recommendations
    const { data: savedByUser, error: savedError } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds)
      .eq('user_id', currentUserId);

    // Get like counts for all recommendations
    const { data: likeCounts, error: likeCountsError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id, count(*)')
      .in('recommendation_id', recommendationIds)
      .group('recommendation_id');

    if (likedError || savedError || likeCountsError) {
      console.error('Error fetching interactions:', likedError || savedError || likeCountsError);
    }

    // Enhanced recommendations with additional fields
    return data.map(recommendation => {
      const likes = likeCounts?.find(c => c.recommendation_id === recommendation.id)?.count || 0;
      const isLiked = likedByUser?.some(l => l.recommendation_id === recommendation.id) || false;
      const isSaved = savedByUser?.some(s => s.recommendation_id === recommendation.id) || false;

      return {
        ...recommendation,
        likes: Number(likes),
        isLiked,
        isSaved,
        entity: recommendation.entities,
        entities: undefined
      };
    });
  } catch (error) {
    console.error('Error in fetchRecommendationWithLikesAndSaves:', error);
    throw error;
  }
};

// Fetch recommendation by ID
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
