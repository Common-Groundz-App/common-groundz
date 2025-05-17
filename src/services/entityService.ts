
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
  console.log('Fetching entity recommendations for entityId:', entityId, 'userId:', userId);
  
  try {
    // Modified query to use explicit join with profiles table instead of relying on foreign key relationships
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('entity_id', entityId)
      .eq('visibility', 'public');
    
    if (error) {
      console.error('Error fetching entity recommendations:', error);
      return [];
    }

    console.log('Raw recommendations data:', recommendations);
    
    // If we have a logged-in user, fetch likes and saves
    if (userId && recommendations && recommendations.length > 0) {
      const recommendationIds = recommendations.map(rec => rec.id);
      
      // Get user likes for these recommendations
      const { data: likesData } = await supabase
        .from('recommendation_likes')
        .select('recommendation_id')
        .eq('user_id', userId)
        .in('recommendation_id', recommendationIds);
      
      const likedIds = new Set(((likesData || []) as any[]).map(like => like.recommendation_id));
      
      // Get user saves for these recommendations
      const { data: savesData } = await supabase
        .from('recommendation_saves')
        .select('recommendation_id')
        .eq('user_id', userId)
        .in('recommendation_id', recommendationIds);
      
      const savedIds = new Set(((savesData || []) as any[]).map(save => save.recommendation_id));
      
      // Get like counts
      const { data: likeCounts } = await supabase.rpc('get_recommendation_likes_by_ids', {
        p_recommendation_ids: recommendationIds
      });
      
      const likeCountMap = new Map(
        ((likeCounts || []) as any[]).map(item => [item.recommendation_id, item.like_count])
      );
      
      // Process the recommendations with user interaction data
      const processedRecommendations = (recommendations as any[]).map(rec => ({
        ...rec,
        username: rec.profiles ? rec.profiles.username : null,
        avatar_url: rec.profiles ? rec.profiles.avatar_url : null,
        isLiked: likedIds.has(rec.id),
        isSaved: savedIds.has(rec.id),
        likes: likeCountMap.get(rec.id) || 0
      }));
      
      console.log('Processed recommendations with user data:', processedRecommendations);
      return processedRecommendations;
    }
    
    // Format the results (no user data)
    const processedRecommendations = ((recommendations || []) as any[]).map(rec => ({
      ...rec,
      username: rec.profiles ? rec.profiles.username : null,
      avatar_url: rec.profiles ? rec.profiles.avatar_url : null,
      likes: 0
    }));
    
    console.log('Processed recommendations without user data:', processedRecommendations);
    return processedRecommendations;
  } catch (err) {
    console.error('Exception in fetchEntityRecommendations:', err);
    return [];
  }
};

/**
 * Fetch all reviews related to an entity
 */
export const fetchEntityReviews = async (entityId: string, userId: string | null = null) => {
  console.log('Fetching entity reviews for entityId:', entityId, 'userId:', userId);
  
  try {
    // Modified query to use explicit join with profiles table instead of relying on foreign key relationships
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('entity_id', entityId)
      .eq('visibility', 'public');
    
    if (error) {
      console.error('Error fetching entity reviews:', error);
      return [];
    }
    
    console.log('Raw reviews data:', reviews);

    // If we have a logged-in user, fetch likes and saves
    if (userId && reviews && reviews.length > 0) {
      const reviewIds = reviews.map(rev => rev.id);
      
      // Get user likes for these reviews
      const { data: likesData } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', userId)
        .in('review_id', reviewIds);
      
      const likedIds = new Set(((likesData || []) as any[]).map(like => like.review_id));
      
      // Get user saves for these reviews
      const { data: savesData } = await supabase
        .from('review_saves')
        .select('review_id')
        .eq('user_id', userId)
        .in('review_id', reviewIds);
      
      const savedIds = new Set(((savesData || []) as any[]).map(save => save.review_id));
      
      // Get like counts
      const { data: likeCounts } = await supabase.rpc('get_review_likes_batch', {
        p_review_ids: reviewIds
      });
      
      const likeCountMap = new Map(
        ((likeCounts || []) as any[]).map(item => [item.review_id, item.like_count])
      );
      
      // Process the reviews with user interaction data
      const processedReviews = (reviews as any[]).map(rev => ({
        ...rev,
        username: rev.profiles ? rev.profiles.username : null,
        avatar_url: rev.profiles ? rev.profiles.avatar_url : null,
        isLiked: likedIds.has(rev.id),
        isSaved: savedIds.has(rev.id),
        likes: likeCountMap.get(rev.id) || 0
      }));
      
      console.log('Processed reviews with user data:', processedReviews);
      return processedReviews;
    }

    // Format the results (no user data)
    const processedReviews = ((reviews || []) as any[]).map(rev => ({
      ...rev,
      username: rev.profiles ? rev.profiles.username : null,
      avatar_url: rev.profiles ? rev.profiles.avatar_url : null,
      likes: 0
    }));
    
    console.log('Processed reviews without user data:', processedReviews);
    return processedReviews;
  } catch (err) {
    console.error('Exception in fetchEntityReviews:', err);
    return [];
  }
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
