
import { supabase } from '@/integrations/supabase/client';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';
import { Review } from './types';

// Fetch complete review data including AI summary fields and latest rating
export const fetchReviewWithSummary = async (reviewId: string): Promise<Review | null> => {
  try {
    console.log('📊 fetchReviewWithSummary called for reviewId:', reviewId);
    
    // First get the review data with explicit AI summary fields
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select(`
        *,
        ai_summary,
        ai_summary_last_generated_at,
        ai_summary_model_used,
        timeline_count,
        has_timeline
      `)
      .eq('id', reviewId)
      .maybeSingle();

    if (reviewError) {
      console.error('❌ Error fetching review:', reviewError);
      return null;
    }

    if (!reviewData) {
      console.log('❌ No review data found for ID:', reviewId);
      return null;
    }

    // Get the latest rating from timeline updates if review has timeline
    let latestRating = undefined;
    if (reviewData.has_timeline && reviewData.timeline_count && reviewData.timeline_count > 0) {
      const { data: latestUpdate } = await supabase
        .from('review_updates')
        .select('rating')
        .eq('review_id', reviewId)
        .not('rating', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestUpdate?.rating) {
        latestRating = latestUpdate.rating;
      }
    }

    // Attach profile using enhanced unified service
    const reviewsWithProfiles = await attachProfilesToEntities([reviewData]);
    const reviewWithProfile = reviewsWithProfiles[0];

    // Combine the data with enhanced profile service consistency
    const combinedData = {
      ...reviewWithProfile,
      latest_rating: latestRating,
      user: {
        username: reviewWithProfile.user.displayName, // Use displayName consistently
        avatar_url: reviewWithProfile.user.avatar_url
      }
    };

    console.log('🔄 Combined review data for timeline:', {
      id: combinedData.id,
      hasAiSummary: !!combinedData.ai_summary,
      aiSummaryLength: combinedData.ai_summary?.length || 0,
      timelineCount: combinedData.timeline_count,
      hasTimeline: combinedData.has_timeline,
      initialRating: combinedData.rating,
      latestRating: combinedData.latest_rating
    });

    return combinedData;
  } catch (error) {
    console.error('❌ Error in fetchReviewWithSummary:', error);
    return null;
  }
};

// Fetch user reviews with enhanced unified profile service
export const fetchUserReviews = async (currentUserId: string | null, profileUserId: string): Promise<Review[]> => {
  try {
    // First, get the reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', profileUserId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return [];
    }

    if (!reviews?.length) return [];

    // Attach profiles using enhanced unified service
    const reviewsWithProfiles = await attachProfilesToEntities(reviews);

    const reviewIds = reviews.map(r => r.id);
    const entityIds = reviews.filter(r => r.entity_id).map(r => r.entity_id);

    // Get entities if any exist
    let entities = [];
    if (entityIds.length > 0) {
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('id, name, type, image_url')
        .in('id', entityIds);

      if (entitiesError) {
        console.error('Error fetching entities:', entitiesError);
      } else {
        entities = entitiesData || [];
      }
    }

    // Get interaction data if user is logged in
    let likeData = [];
    let saveData = [];
    let likeCounts = [];

    if (currentUserId) {
      const [likesResponse, savesResponse, likeCountsResponse] = await Promise.all([
        supabase.rpc('get_user_review_likes', { 
          p_review_ids: reviewIds, 
          p_user_id: currentUserId 
        }),
        supabase.rpc('get_user_review_saves', { 
          p_review_ids: reviewIds, 
          p_user_id: currentUserId 
        }),
        supabase.rpc('get_review_likes_batch', { 
          p_review_ids: reviewIds 
        })
      ]);

      likeData = likesResponse.data || [];
      saveData = savesResponse.data || [];
      likeCounts = likeCountsResponse.data || [];
    }

    return reviewsWithProfiles.map(review => {
      const entity = entities.find(e => e.id === review.entity_id);

      return {
        ...review,
        user: {
          username: review.user.displayName, // Use displayName consistently
          avatar_url: review.user.avatar_url
        },
        entity: entity ? {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          image_url: entity.image_url
        } : undefined,
        comment_count: 0,
        isLiked: likeData.some(like => like.review_id === review.id),
        isSaved: saveData.some(save => save.review_id === review.id),
        likes: likeCounts.find(count => count.review_id === review.id)?.like_count || 0
      };
    });

  } catch (error) {
    console.error('Error in fetchUserReviews:', error);
    return [];
  }
};

// Fetch reviews that are marked as recommendations (4+ stars)
export const fetchUserRecommendations = async (currentUserId: string | null, profileUserId: string): Promise<Review[]> => {
  try {
    // First, get the reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', profileUserId)
      .eq('status', 'published')
      .eq('is_recommended', true)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching recommendations:', reviewsError);
      return [];
    }

    if (!reviews?.length) return [];

    // Attach profiles using enhanced unified service
    const reviewsWithProfiles = await attachProfilesToEntities(reviews);

    const reviewIds = reviews.map(r => r.id);
    const entityIds = reviews.filter(r => r.entity_id).map(r => r.entity_id);

    // Get entities if any exist
    let entities = [];
    if (entityIds.length > 0) {
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('id, name, type, image_url')
        .in('id', entityIds);

      if (entitiesError) {
        console.error('Error fetching entities:', entitiesError);
      } else {
        entities = entitiesData || [];
      }
    }

    // Get interaction data if user is logged in
    let likeData = [];
    let saveData = [];
    let likeCounts = [];

    if (currentUserId) {
      const [likesResponse, savesResponse, likeCountsResponse] = await Promise.all([
        supabase.rpc('get_user_review_likes', { 
          p_review_ids: reviewIds, 
          p_user_id: currentUserId 
        }),
        supabase.rpc('get_user_review_saves', { 
          p_review_ids: reviewIds, 
          p_user_id: currentUserId 
        }),
        supabase.rpc('get_review_likes_batch', { 
          p_review_ids: reviewIds 
        })
      ]);

      likeData = likesResponse.data || [];
      saveData = savesResponse.data || [];
      likeCounts = likeCountsResponse.data || [];
    }

    return reviewsWithProfiles.map(review => {
      const entity = entities.find(e => e.id === review.entity_id);

      return {
        ...review,
        user: {
          username: review.user.displayName, // Use displayName consistently
          avatar_url: review.user.avatar_url
        },
        entity: entity ? {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          image_url: entity.image_url
        } : undefined,
        comment_count: 0,
        isLiked: likeData.some(like => like.review_id === review.id),
        isSaved: saveData.some(save => save.review_id === review.id),
        likes: likeCounts.find(count => count.review_id === review.id)?.like_count || 0
      };
    });

  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    return [];
  }
};
