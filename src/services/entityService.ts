import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';

/**
 * Fetch an entity by its slug or ID
 */
export const fetchEntityBySlug = async (slugOrId: string): Promise<Entity | null> => {
  console.log('🔍 fetchEntityBySlug called with:', slugOrId);
  
  // First try to fetch by slug
  let { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slugOrId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) {
    console.error('Error fetching entity by slug:', error);
  }

  // If not found by slug and the parameter looks like a UUID, try by ID
  if (!data && isValidUUID(slugOrId)) {
    console.log('🔄 Slug lookup failed, trying by ID:', slugOrId);
    const result = await supabase
      .from('entities')
      .select('*')
      .eq('id', slugOrId)
      .eq('is_deleted', false)
      .maybeSingle();
    
    data = result.data;
    error = result.error;
    
    if (error) {
      console.error('Error fetching entity by ID:', error);
    }
  }

  if (data) {
    console.log('✅ Entity found:', data.name, 'with slug:', data.slug);
  } else {
    console.log('❌ Entity not found for:', slugOrId);
  }

  return data as Entity;
};

/**
 * Helper function to check if a string is a valid UUID
 */
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Fetch all recommendations related to an entity
 */
export const fetchEntityRecommendations = async (entityId: string, userId: string | null = null) => {
  console.log('Fetching entity recommendations for entityId:', entityId, 'userId:', userId);
  
  try {
    // First fetch recommendations
    const { data: recommendationsData, error } = await supabase
      .from('recommendations')
      .select('*')
      .eq('entity_id', entityId)
      .eq('visibility', 'public');
    
    if (error) {
      console.error('Error fetching entity recommendations:', error);
      return [];
    }

    console.log('Raw recommendations data:', recommendationsData);
    
    if (!recommendationsData || recommendationsData.length === 0) {
      return [];
    }
    
    // Get user IDs from recommendations to fetch profiles
    const userIds = recommendationsData.map(rec => rec.user_id);
    
    // Fetch profile data separately
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profilesError) {
      console.error('Error fetching profiles for recommendations:', profilesError);
    }
    
    // Create a map of user profiles for easy lookup
    const profilesMap = new Map();
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
    }
    
    // Combine recommendation data with profile data
    let recommendations = recommendationsData.map(rec => {
      const profile = profilesMap.get(rec.user_id);
      return {
        ...rec,
        username: profile ? profile.username : null,
        avatar_url: profile ? profile.avatar_url : null,
      };
    });
    
    // If we have a logged-in user, fetch likes and saves
    if (userId && recommendations.length > 0) {
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
      recommendations = recommendations.map(rec => ({
        ...rec,
        isLiked: likedIds.has(rec.id),
        isSaved: savedIds.has(rec.id),
        likes: likeCountMap.get(rec.id) || 0
      }));
      
      console.log('Processed recommendations with user data:', recommendations);
      return recommendations;
    }
    
    // Format the results (no user data)
    recommendations = recommendations.map(rec => ({
      ...rec,
      likes: 0
    }));
    
    console.log('Processed recommendations without user data:', recommendations);
    return recommendations;
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
    // First fetch reviews 
    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('entity_id', entityId)
      .eq('visibility', 'public');
    
    if (error) {
      console.error('Error fetching entity reviews:', error);
      return [];
    }
    
    console.log('Raw reviews data:', reviewsData);

    if (!reviewsData || reviewsData.length === 0) {
      return [];
    }
    
    // Get user IDs from reviews to fetch profiles
    const userIds = reviewsData.map(rev => rev.user_id);
    
    // Fetch profile data separately
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    
    if (profilesError) {
      console.error('Error fetching profiles for reviews:', profilesError);
    }
    
    // Create a map of user profiles for easy lookup
    const profilesMap = new Map();
    if (profilesData) {
      profilesData.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
    }

    // Get latest ratings for reviews with timelines
    const reviewsWithTimeline = reviewsData.filter(r => r.has_timeline);
    const timelineReviewIds = reviewsWithTimeline.map(r => r.id);
    
    let latestRatingsMap = new Map();
    if (timelineReviewIds.length > 0) {
      const { data: timelineUpdates } = await supabase
        .from('review_updates')
        .select('review_id, rating, created_at')
        .in('review_id', timelineReviewIds)
        .not('rating', 'is', null)
        .order('created_at', { ascending: false });
      
      if (timelineUpdates) {
        // Get the latest rating for each review
        timelineUpdates.forEach(update => {
          if (!latestRatingsMap.has(update.review_id)) {
            latestRatingsMap.set(update.review_id, update.rating);
          }
        });
      }
    }
    
    // Combine review data with profile data and latest ratings
    let reviews = reviewsData.map(rev => {
      const profile = profilesMap.get(rev.user_id);
      const latestRating = latestRatingsMap.get(rev.id);
      
      return {
        ...rev,
        // Add both direct properties for backward compatibility
        username: profile ? profile.username : null,
        avatar_url: profile ? profile.avatar_url : null,
        // AND add a nested user object to match what ReviewCard expects
        user: {
          id: rev.user_id,
          username: profile ? profile.username : null,
          avatar_url: profile ? profile.avatar_url : null
        },
        // Add latest rating for timeline reviews
        latest_rating: latestRating
      };
    });

    // If we have a logged-in user, fetch likes and saves
    if (userId && reviews.length > 0) {
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
      reviews = reviews.map(rev => ({
        ...rev,
        isLiked: likedIds.has(rev.id),
        isSaved: savedIds.has(rev.id),
        likes: likeCountMap.get(rev.id) || 0
      }));
      
      console.log('Processed reviews with user data:', reviews);
      return reviews;
    }

    // Format the results (no user data)
    reviews = reviews.map(rev => ({
      ...rev,
      likes: 0
    }));
    
    console.log('Processed reviews without user data:', reviews);
    return reviews;
  } catch (err) {
    console.error('Exception in fetchEntityReviews:', err);
    return [];
  }
};

/**
 * Calculate average rating for an entity from recommendations and reviews
 * Now considers latest timeline updates for dynamic reviews
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

  // Get all reviews for this entity
  const { data: reviews, error: revError } = await supabase
    .from('reviews')
    .select('id, rating, has_timeline')
    .eq('entity_id', entityId)
    .eq('visibility', 'public');

  if (revError) {
    console.error('Error fetching review ratings:', revError);
    return null;
  }

  if (!reviews || reviews.length === 0) {
    if (!recommendations || recommendations.length === 0) {
      return null;
    }
    // Only recommendations exist
    const recRatings = recommendations.map(rec => Number(rec.rating)).filter(rating => !isNaN(rating));
    if (recRatings.length === 0) return null;
    const sum = recRatings.reduce((total, rating) => total + rating, 0);
    return parseFloat((sum / recRatings.length).toFixed(1));
  }

  // Get timeline updates for reviews that have them
  const reviewsWithTimeline = reviews.filter(r => r.has_timeline);
  const timelineReviewIds = reviewsWithTimeline.map(r => r.id);
  
  let timelineUpdates: any[] = [];
  if (timelineReviewIds.length > 0) {
    const { data: updatesData } = await supabase
      .from('review_updates')
      .select('review_id, rating, created_at')
      .in('review_id', timelineReviewIds)
      .not('rating', 'is', null)
      .order('created_at', { ascending: false });
    
    timelineUpdates = updatesData || [];
  }

  // Calculate effective ratings for reviews
  const effectiveReviewRatings = reviews.map(review => {
    if (!review.has_timeline) {
      return Number(review.rating);
    }
    
    // Find the latest timeline update with a rating for this review
    const latestUpdate = timelineUpdates.find(update => update.review_id === review.id);
    if (latestUpdate && latestUpdate.rating !== null) {
      return Number(latestUpdate.rating);
    }
    
    // Fallback to original rating if no timeline updates with ratings
    return Number(review.rating);
  }).filter(rating => !isNaN(rating));

  // Combine all ratings
  const allRatings = [
    ...(recommendations || []).map(rec => Number(rec.rating)),
    ...effectiveReviewRatings
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
