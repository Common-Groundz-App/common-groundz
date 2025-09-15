import { supabase } from '@/integrations/supabase/client';
import { Entity, RecommendationCategory } from '@/services/recommendation/types';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';
import { RecommendationWithUser, ReviewWithUser } from '@/types/entities';
import { MediaItem } from '@/types/common';

/**
 * Fetch an entity by its slug or ID
 */
export const fetchEntityBySlug = async (slugOrId: string, userId?: string | null): Promise<Entity | null> => {
  console.log('🔍 fetchEntityBySlug called with:', slugOrId, userId ? 'with user context' : 'no user context');
  
  // Get current user from supabase auth if not provided
  const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  
  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(currentUserId);
  
  // Build query with approval status filtering
  let query = supabase
    .from('entities')
    .select('*')
    .eq('is_deleted', false);
    
  // Show all entities regardless of approval status to prevent duplicates
  // Users can see all entities to make informed decisions about duplicates
  console.log('👥 Showing all entities regardless of approval status for duplicate prevention');
  
  // First try to fetch by slug
  let { data, error } = await query
    .eq('slug', slugOrId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching entity by slug:', error);
  }

  // If not found by slug and the parameter looks like a UUID, try by ID
  if (!data && isValidUUID(slugOrId)) {
    console.log('🔄 Slug lookup failed, trying by ID:', slugOrId);
    const result = await query
      .eq('id', slugOrId)
      .maybeSingle();
    
    data = result.data;
    error = result.error;
    
    if (error) {
      console.error('Error fetching entity by ID:', error);
    }
  }

  if (data) {
    console.log('✅ Entity found:', data.name, 'with slug:', data.slug, 'approval status:', data.approval_status);
  } else {
    console.log('❌ Entity not found or not accessible for:', slugOrId);
  }

  return data as Entity;
};

// Helper function to check if user is admin
const checkIfUserIsAdmin = async (userId?: string | null): Promise<boolean> => {
  if (!userId) return false;
  
  try {
    const { data, error } = await supabase.rpc('is_current_user_admin');
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Helper function to check if a string is a valid UUID
 */
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Fetch all recommendations related to an entity with enhanced unified profile service
 */
export const fetchEntityRecommendations = async (
  entityId: string, 
  userId: string | null = null
): Promise<RecommendationWithUser[]> => {
  console.log('Fetching entity recommendations for entityId:', entityId, 'userId:', userId);
  
  try {
    // Fetch recommendations with only existing fields
    const { data: recommendationsData, error } = await supabase
      .from('recommendations')
      .select('*')
      .eq('entity_id', entityId)
      .eq('visibility', 'public');
    
    if (error) {
      console.error('Error fetching entity recommendations:', error);
      return [];
    }

    if (!recommendationsData || recommendationsData.length === 0) {
      return [];
    }
    
    console.log('Found recommendations:', recommendationsData.length);
    
    // Attach profiles using enhanced unified service
    const recommendationsWithProfiles = await attachProfilesToEntities(recommendationsData);
    
    // Get recommendation IDs for interaction data
    const recommendationIds = recommendationsData.map(rec => rec.id);
    
    // Fetch interaction data if user is logged in
    let likedIds = new Set<string>();
    let savedIds = new Set<string>();
    let likeCountMap = new Map<string, number>();
    
    if (userId && recommendationIds.length > 0) {
      const [likesData, savesData, likeCountsData] = await Promise.all([
        supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .eq('user_id', userId)
          .in('recommendation_id', recommendationIds),
        
        supabase
          .from('recommendation_saves')
          .select('recommendation_id')
          .eq('user_id', userId)
          .in('recommendation_id', recommendationIds),
        
        supabase.rpc('get_recommendation_likes_by_ids', {
          p_recommendation_ids: recommendationIds
        })
      ]);
      
      likedIds = new Set((likesData.data || []).map(like => like.recommendation_id));
      savedIds = new Set((savesData.data || []).map(save => save.recommendation_id));
      likeCountMap = new Map(
        (likeCountsData.data || []).map(item => [item.recommendation_id, item.like_count])
      );
    }
    
    // Transform to final format with interaction data
    const finalRecommendations: RecommendationWithUser[] = recommendationsWithProfiles.map(rec => {
      // Map string category to RecommendationCategory enum
      const categoryMap: Record<string, RecommendationCategory> = {
        'food': RecommendationCategory.Food,
        'drink': RecommendationCategory.Drink,
        'movie': RecommendationCategory.Movie,
        'book': RecommendationCategory.Book,
        'place': RecommendationCategory.Place,
        'product': RecommendationCategory.Product,
        'activity': RecommendationCategory.Activity,
        'music': RecommendationCategory.Music,
        'art': RecommendationCategory.Art,
        'tv': RecommendationCategory.TV,
        'travel': RecommendationCategory.Travel,
      };
      
      return {
        id: rec.id,
        title: rec.title,
        subtitle: undefined,
        description: rec.description,
        image_url: rec.image_url,
        rating: rec.rating,
        venue: rec.venue,
        entity_id: rec.entity_id,
        entity: undefined, // Entity not included in select
        is_certified: rec.is_certified,
        user_id: rec.user_id,
        user: rec.user,
        category: categoryMap[rec.category as string] || RecommendationCategory.Product,
        likes: likeCountMap.get(rec.id) || 0,
        isLiked: likedIds.has(rec.id),
        isSaved: savedIds.has(rec.id),
        comment_count: rec.comment_count || 0,
        view_count: rec.view_count || 0,
        visibility: rec.visibility as any,
        media: [] as MediaItem[], // Recommendations don't have media field in DB
        created_at: rec.created_at,
        updated_at: rec.updated_at
      };
    });
    
    console.log('Processed recommendations with enhanced unified profiles:', finalRecommendations.length);
    return finalRecommendations;
  } catch (err) {
    console.error('Exception in fetchEntityRecommendations:', err);
    return [];
  }
};

/**
 * Fetch all reviews related to an entity with enhanced unified profile service
 */
export const fetchEntityReviews = async (
  entityId: string, 
  userId: string | null = null
): Promise<ReviewWithUser[]> => {
  console.log('Fetching entity reviews for entityId:', entityId, 'userId:', userId);
  
  try {
    // Fetch reviews with aggregated timeline comments for comprehensive search
    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select(`
        *,
        review_updates(comment)
      `)
      .eq('entity_id', entityId)
      .eq('visibility', 'public');
    
    if (error) {
      console.error('Error fetching entity reviews:', error);
      return [];
    }
    
    if (!reviewsData || reviewsData.length === 0) {
      return [];
    }

    console.log('Found reviews:', reviewsData.length);
    
    // Attach profiles using enhanced unified service
    const reviewsWithProfiles = await attachProfilesToEntities(reviewsData);
    
    // Get reviews with timeline for latest ratings
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
        timelineUpdates.forEach(update => {
          if (!latestRatingsMap.has(update.review_id)) {
            latestRatingsMap.set(update.review_id, update.rating);
          }
        });
      }
    }
    
    // Get review IDs for interaction data
    const reviewIds = reviewsData.map(rev => rev.id);
    
    // Fetch interaction data if user is logged in
    let likedIds = new Set<string>();
    let savedIds = new Set<string>();
    let likeCountMap = new Map<string, number>();
    
    if (userId && reviewIds.length > 0) {
      const [likesData, savesData, likeCountsData] = await Promise.all([
        supabase
          .from('review_likes')
          .select('review_id')
          .eq('user_id', userId)
          .in('review_id', reviewIds),
        
        supabase
          .from('review_saves')
          .select('review_id')
          .eq('user_id', userId)
          .in('review_id', reviewIds),
        
        supabase.rpc('get_review_likes_batch', {
          p_review_ids: reviewIds
        })
      ]);
      
      likedIds = new Set((likesData.data || []).map(like => like.review_id));
      savedIds = new Set((savesData.data || []).map(save => save.review_id));
      likeCountMap = new Map(
        (likeCountsData.data || []).map(item => [item.review_id, item.like_count])
      );
    }
    
    // Transform to final format with interaction data and aggregated timeline content
    const finalReviews: ReviewWithUser[] = reviewsWithProfiles.map(rev => {
      // Ensure proper status type
      const validStatus = rev.status as 'published' | 'draft' | 'deleted';
      
      // Aggregate all timeline comments for comprehensive search
      const timelineComments = rev.review_updates?.map((update: any) => update.comment).filter(Boolean) || [];
      const allContent = [
        rev.title || '',
        rev.description || '',
        ...timelineComments
      ].filter(Boolean).join(' ');
      
      return {
        id: rev.id,
        title: rev.title,
        subtitle: rev.subtitle,
        description: rev.description,
        image_url: rev.image_url,
        category: rev.category,
        rating: rev.rating,
        venue: rev.venue,
        entity_id: rev.entity_id,
        entity: undefined, // Entity not included in select
        experience_date: rev.experience_date,
        has_timeline: rev.has_timeline,
        timeline_count: rev.timeline_count,
        trust_score: rev.trust_score,
        is_recommended: rev.is_recommended,
        user_id: rev.user_id,
        user: rev.user,
        status: validStatus === 'published' || validStatus === 'draft' || validStatus === 'deleted' 
          ? validStatus 
          : 'published',
        latest_rating: latestRatingsMap.get(rev.id),
        likes: likeCountMap.get(rev.id) || 0,
        isLiked: likedIds.has(rev.id),
        isSaved: savedIds.has(rev.id),
        comment_count: 0, // Default value since field doesn't exist in DB
        view_count: 0, // Default value since field doesn't exist in DB
        visibility: rev.visibility as any,
        media: rev.media ? (rev.media as unknown as MediaItem[]) : [],
        ai_summary: rev.ai_summary,
        all_content: allContent, // Aggregated searchable content including timeline updates
        created_at: rev.created_at,
        updated_at: rev.updated_at
      } as ReviewWithUser & { all_content: string };
    });
    
    console.log('Processed reviews with enhanced unified profiles:', finalReviews.length);
    return finalReviews;
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
 * Get entity stats including timeline-aware recommendation counts
 */
export const getEntityStats = async (entityId: string, userId: string | null = null): Promise<{
  recommendationCount: number;
  reviewCount: number;
  averageRating: number | null;
  circleRecommendationCount: number;
}> => {
  // Count recommendations (from old recommendations table)
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

  // Get timeline-aware recommendation count using database function
  let timelineRecommendationCount = 0;
  const { data: recCountData, error: recCountError } = await supabase
    .rpc('get_recommendation_count', { p_entity_id: entityId });
  
  if (!recCountError && recCountData !== null) {
    timelineRecommendationCount = recCountData;
  }

  // Get circle recommendation count if user is logged in
  let circleRecommendationCount = 0;
  if (userId) {
    const { data: circleCountData, error: circleCountError } = await supabase
      .rpc('get_circle_recommendation_count', { 
        p_entity_id: entityId, 
        p_user_id: userId 
      });
    
    if (!circleCountError && circleCountData !== null) {
      circleRecommendationCount = circleCountData;
    }
  }

  // Get average rating
  const averageRating = await calculateEntityRating(entityId);

  return {
    recommendationCount: (recommendationCount || 0) + timelineRecommendationCount,
    reviewCount: reviewCount || 0,
    averageRating,
    circleRecommendationCount
  };
};
