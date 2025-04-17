
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './types';

// Fetch all user recommendations
export const fetchUserRecommendations = async (
  userId: string | null = null, 
  profileUserId?: string,
  category?: string,
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

    // Step 2: Get likes and saves for current user if logged in
    let userLikes: any[] = [];
    let userSaves: any[] = [];
    
    if (userId) {
      // Get likes by the current user for these recommendations
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id')
        .in('recommendation_id', recommendationIds)
        .eq('user_id', userId);

      userLikes = likesData || [];

      // Get saves by the current user for these recommendations
      const { data: savesData } = await supabase
        .from('recommendation_saves')
        .select('recommendation_id')
        .in('recommendation_id', recommendationIds)
        .eq('user_id', userId);

      userSaves = savesData || [];
    }

    // Step 3: Get like counts for each recommendation - without using group
    const likeCounts = new Map();
    for (const recId of recommendationIds) {
      const { count } = await supabase
        .from('recommendation_likes')
        .select('*', { count: 'exact', head: true })
        .eq('recommendation_id', recId);
      
      likeCounts.set(recId, count || 0);
    }

    // Step 4: Combine all the data
    const recommendations = data.map(rec => {
      const likeCount = likeCounts.get(rec.id) || 0;
      const isLiked = userLikes?.some(like => like.recommendation_id === rec.id) || false;
      const isSaved = userSaves?.some(save => save.recommendation_id === rec.id) || false;
      
      return {
        ...rec,
        likes: Number(likeCount),
        isLiked,
        isSaved,
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

// Fetch recommendations with likes and saves
export const fetchRecommendationWithLikesAndSaves = async (
  userId: string | null,
  profileUserId?: string,
  category?: string,
  sort: 'latest' | 'popular' = 'latest',
  limit = 10,
  offset = 0
): Promise<{ recommendations: Recommendation[]; totalCount: number }> => {
  try {
    // Building the base query
    let query = supabase
      .from('recommendations')
      .select(`
        *,
        entities(*)
      `, { count: 'exact' })
      .order(sort === 'latest' ? 'created_at' : 'view_count', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Filter by user profile if provided
    if (profileUserId) {
      query = query.eq('user_id', profileUserId);
    }
    
    // Filter by category if provided
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return { recommendations: [], totalCount: 0 };
    }

    // Extract recommendation IDs
    const recommendationIds = data.map(rec => rec.id);

    // Get likes and saves if user is logged in
    let userLikes: any[] = [];
    let userSaves: any[] = [];
    
    if (userId) {
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id')
        .in('recommendation_id', recommendationIds)
        .eq('user_id', userId);

      userLikes = likesData || [];

      const { data: savesData } = await supabase
        .from('recommendation_saves')
        .select('recommendation_id')
        .in('recommendation_id', recommendationIds)
        .eq('user_id', userId);

      userSaves = savesData || [];
    }

    // Get like counts for each recommendation
    const likeCounts = new Map();
    for (const recId of recommendationIds) {
      const { count } = await supabase
        .from('recommendation_likes')
        .select('*', { count: 'exact', head: true })
        .eq('recommendation_id', recId);
      
      likeCounts.set(recId, count || 0);
    }

    // Combine all data
    const recommendations = data.map(rec => ({
      ...rec,
      likes: likeCounts.get(rec.id) || 0,
      isLiked: userLikes?.some(like => like.recommendation_id === rec.id) || false,
      isSaved: userSaves?.some(save => save.recommendation_id === rec.id) || false,
      entity: rec.entities,
      entities: undefined
    })) as Recommendation[];

    return { 
      recommendations, 
      totalCount: count || 0 
    };
  } catch (error) {
    console.error('Error in fetchRecommendationsWithLikesAndSaves:', error);
    throw error;
  }
};

export { fetchRecommendationById } from './fetchRecommendationById';
