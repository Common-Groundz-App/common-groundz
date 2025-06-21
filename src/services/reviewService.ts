import { supabase } from '@/integrations/supabase/client';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';

export interface Review {
  id: string;
  user_id: string;
  title: string;
  venue?: string;
  description?: string;
  rating: number;
  image_url?: string;
  category: string;
  created_at: string;
  updated_at: string;
  entity_id?: string;
  visibility: 'public' | 'private' | 'circle_only';
  status: string;
  is_converted: boolean;
  recommendation_id?: string;
  experience_date?: string;
  media?: any;
  metadata?: any;
  subtitle?: string;
  // New Dynamic Reviews fields
  trust_score?: number;
  is_recommended?: boolean;
  timeline_count?: number;
  has_timeline?: boolean;
  is_verified?: boolean;
  // AI summary fields for individual reviews
  ai_summary?: string;
  ai_summary_last_generated_at?: string;
  ai_summary_model_used?: string;
  // Interaction states
  isLiked?: boolean;
  isSaved?: boolean;
  likes?: number;
  // Additional fields for ReviewCard compatibility
  user?: {
    username?: string;
    avatar_url?: string;
  };
  entity?: {
    id: string;
    name: string;
    type: string;
    image_url?: string;
  };
  comment_count?: number;
  // Rating evolution field for timeline reviews
  latest_rating?: number;
}

export interface ReviewUpdate {
  id: string;
  review_id: string;
  user_id: string;
  rating?: number;
  comment: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  };
}

// Create a new review
export const createReview = async (reviewData: {
  title: string;
  subtitle?: string;
  venue?: string;
  description?: string;
  rating: number;
  image_url?: string;
  media?: any;
  category: string;
  visibility: 'public' | 'private' | 'circle_only';
  entity_id?: string;
  experience_date?: string;
  metadata?: any;
  user_id: string;
}): Promise<Review> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createReview:', error);
    throw error;
  }
};

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

    // Combine the data
    const combinedData = {
      ...reviewWithProfile,
      latest_rating: latestRating,
      user: {
        username: reviewWithProfile.user.displayName,
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

// Update an existing review
export const updateReview = async (reviewId: string, updates: {
  title?: string;
  subtitle?: string;
  venue?: string;
  description?: string;
  rating?: number;
  image_url?: string;
  media?: any;
  category?: string;
  visibility?: 'public' | 'private' | 'circle_only';
  entity_id?: string;
  experience_date?: string;
  metadata?: any;
}): Promise<Review> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Error updating review:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateReview:', error);
    throw error;
  }
};

// Delete a review
export const deleteReview = async (reviewId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return false;
  }
};

// Update review status (for admin actions)
export const updateReviewStatus = async (reviewId: string, status: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', reviewId);

    if (error) {
      console.error('Error updating review status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateReviewStatus:', error);
    return false;
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

    // Map reviews with interaction data and proper typing
    return reviewsWithProfiles.map(review => {
      const entity = entities.find(e => e.id === review.entity_id);

      return {
        ...review,
        user: {
          username: review.user.displayName,
          avatar_url: review.user.avatar_url
        },
        entity: entity ? {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          image_url: entity.image_url
        } : undefined,
        comment_count: 0, // Placeholder for future comment system
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

// Fetch reviews that are marked as recommendations (4+ stars) - Using enhanced unified service
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

    // Map reviews with interaction data and proper typing
    return reviewsWithProfiles.map(review => {
      const entity = entities.find(e => e.id === review.entity_id);

      return {
        ...review,
        user: {
          username: review.user.displayName,
          avatar_url: review.user.avatar_url
        },
        entity: entity ? {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          image_url: entity.image_url
        } : undefined,
        comment_count: 0, // Placeholder for future comment system
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

// Fetch review timeline updates
export const fetchReviewUpdates = async (reviewId: string): Promise<ReviewUpdate[]> => {
  try {
    // First get the review updates
    const { data: updates, error: updatesError } = await supabase
      .from('review_updates')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (updatesError) {
      console.error('Error fetching review updates:', updatesError);
      return [];
    }

    if (!updates?.length) return [];

    // Attach profiles using enhanced unified service
    const updatesWithProfiles = await attachProfilesToEntities(updates);

    // Map updates with their corresponding profiles
    return updatesWithProfiles.map(update => ({
      ...update,
      profiles: {
        username: update.user.displayName,
        avatar_url: update.user.avatar_url
      }
    }));

  } catch (error) {
    console.error('Error in fetchReviewUpdates:', error);
    return [];
  }
};

export const addReviewUpdate = async (reviewId: string, userId: string, rating: number | null, comment: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('review_updates')
      .insert({
        review_id: reviewId,
        user_id: userId,
        rating: rating,
        comment: comment
      });

    if (error) {
      console.error('Error adding review update:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in addReviewUpdate:', error);
    return false;
  }
};

export const toggleReviewLike = async (reviewId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('toggle_review_like', {
      p_review_id: reviewId,
      p_user_id: userId
    });

    if (error) {
      console.error('Error toggling review like:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Error in toggleReviewLike:', error);
    return false;
  }
};

export const toggleReviewSave = async (reviewId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('toggle_review_save', {
      p_review_id: reviewId,
      p_user_id: userId
    });

    if (error) {
      console.error('Error toggling review save:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Error in toggleReviewSave:', error);
    return false;
  }
};

export const convertReviewToRecommendation = async (reviewId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ 
        is_recommended: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Error converting review to recommendation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in convertReviewToRecommendation:', error);
    return false;
  }
};
