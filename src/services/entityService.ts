import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';

/**
 * Fetch an entity by its slug
 */
export const fetchEntityBySlug = async (slug: string): Promise<Entity | null> => {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slug)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error fetching entity by slug:', error);
    return null;
  }

  return data as Entity;
};

/**
 * Fetch all recommendations related to an entity
 */
export const fetchEntityRecommendations = async (entityId: string, userId: string | null = null) => {
  let query = supabase
    .from('recommendations')
    .select(`
      *,
      profiles:user_id (username, avatar_url)
    `)
    .eq('entity_id', entityId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  const { data: recommendations, error } = await query;

  if (error) {
    console.error('Error fetching entity recommendations:', error);
    return [];
  }

  // If we have a logged-in user, fetch likes and saves
  if (userId && recommendations && recommendations.length > 0) {
    const recommendationIds = recommendations.map(rec => rec.id);
    
    // Get user likes for these recommendations
    const { data: likesData } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .eq('user_id', userId)
      .in('recommendation_id', recommendationIds);
    
    const likedIds = new Set((likesData || []).map(like => like.recommendation_id));
    
    // Get user saves for these recommendations
    const { data: savesData } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .eq('user_id', userId)
      .in('recommendation_id', recommendationIds);
    
    const savedIds = new Set((savesData || []).map(save => save.recommendation_id));
    
    // Get like counts
    const { data: likeCounts } = await supabase.rpc('get_recommendation_likes_by_ids', {
      p_recommendation_ids: recommendationIds
    });
    
    const likeCountMap = new Map(
      (likeCounts || []).map(item => [item.recommendation_id, item.like_count])
    );

    // Enhance recommendations with likes and saves info
    return recommendations.map(rec => ({
      ...rec,
      username: rec.profiles?.username || null,
      avatar_url: rec.profiles?.avatar_url || null,
      isLiked: likedIds.has(rec.id),
      isSaved: savedIds.has(rec.id),
      likes: likeCountMap.get(rec.id) || 0
    }));
  }

  // Format the results
  return recommendations.map(rec => ({
    ...rec,
    username: rec.profiles?.username || null,
    avatar_url: rec.profiles?.avatar_url || null,
    likes: 0
  }));
};

/**
 * Fetch all reviews related to an entity
 */
export const fetchEntityReviews = async (entityId: string, userId: string | null = null) => {
  let query = supabase
    .from('reviews')
    .select(`
      *,
      profiles:user_id (username, avatar_url)
    `)
    .eq('entity_id', entityId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  const { data: reviews, error } = await query;

  if (error) {
    console.error('Error fetching entity reviews:', error);
    return [];
  }

  // If we have a logged-in user, fetch likes and saves
  if (userId && reviews && reviews.length > 0) {
    const reviewIds = reviews.map(rev => rev.id);
    
    // Get user likes for these reviews
    const { data: likesData } = await supabase.rpc('get_user_review_likes', {
      p_review_ids: reviewIds,
      p_user_id: userId
    });
    
    const likedIds = new Set((likesData || []).map(like => like.review_id));
    
    // Get user saves for these reviews
    const { data: savesData } = await supabase.rpc('get_user_review_saves', {
      p_review_ids: reviewIds,
      p_user_id: userId
    });
    
    const savedIds = new Set((savesData || []).map(save => save.review_id));
    
    // Get like counts
    const { data: likeCounts } = await supabase.rpc('get_review_likes_batch', {
      p_review_ids: reviewIds
    });
    
    const likeCountMap = new Map(
      (likeCounts || []).map(item => [item.review_id, item.like_count])
    );

    // Enhance reviews with likes and saves info
    return reviews.map(rev => ({
      ...rev,
      username: rev.profiles?.username || null,
      avatar_url: rev.profiles?.avatar_url || null,
      isLiked: likedIds.has(rev.id),
      isSaved: savedIds.has(rev.id),
      likes: likeCountMap.get(rev.id) || 0
    }));
  }

  // Format the results
  return reviews.map(rev => ({
    ...rev,
    username: rev.profiles?.username || null,
    avatar_url: rev.profiles?.avatar_url || null,
    likes: 0
  }));
};

/**
 * Calculate average rating for an entity from recommendations and reviews
 */
export const calculateEntityRating = async (entityId: string): Promise<number | null> => {
  // Get all recommendations for this entity with their ratings
  const { data: recommendations, error: recError } = await supabase
    .from('recommendations')
    .select('rating')
    .eq('entity_id', entityId)
    .eq('visibility', 'public');

  if (recError) {
    console.error('Error fetching recommendation ratings:', recError);
    return null;
  }

  // Get all reviews for this entity with their ratings
  const { data: reviews, error: revError } = await supabase
    .from('reviews')
    .select('rating')
    .eq('entity_id', entityId)
    .eq('visibility', 'public');

  if (revError) {
    console.error('Error fetching review ratings:', revError);
    return null;
  }

  // Combine all ratings
  const allRatings = [
    ...(recommendations || []).map(rec => Number(rec.rating)),
    ...(reviews || []).map(rev => Number(rev.rating))
  ].filter(rating => !isNaN(rating));

  // If no ratings, return null
  if (allRatings.length === 0) {
    return null;
  }

  // Calculate average
  const sum = allRatings.reduce((total, rating) => total + rating, 0);
  return parseFloat((sum / allRatings.length).toFixed(1));
};

/**
 * Get entity stats
 */
export const getEntityStats = async (entityId: string): Promise<{
  recommendationCount: number;
  reviewCount: number;
  averageRating: number | null;
}> => {
  // Count recommendations
  const { count: recommendationCount, error: recError } = await supabase
    .from('recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entityId)
    .eq('visibility', 'public');

  if (recError) {
    console.error('Error counting recommendations:', recError);
  }

  // Count reviews
  const { count: reviewCount, error: revError } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entityId)
    .eq('visibility', 'public');

  if (revError) {
    console.error('Error counting reviews:', revError);
  }

  // Get average rating
  const averageRating = await calculateEntityRating(entityId);

  return {
    recommendationCount: recommendationCount || 0,
    reviewCount: reviewCount || 0,
    averageRating
  };
};
