import { supabase } from '@/integrations/supabase/client';

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

// Fetch complete review data including AI summary fields
export const fetchReviewWithSummary = async (reviewId: string): Promise<Review | null> => {
  try {
    // First get the review data
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (reviewError) {
      console.error('Error fetching review:', reviewError);
      return null;
    }

    if (!reviewData) {
      return null;
    }

    // Then get the profile data separately
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', reviewData.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Combine the data
    return {
      ...reviewData,
      user: profileData ? {
        username: profileData.username,
        avatar_url: profileData.avatar_url
      } : undefined
    };
  } catch (error) {
    console.error('Error in fetchReviewWithSummary:', error);
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

// Fetch user reviews with enhanced fields - Using manual joins to avoid foreign key issues
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

    const reviewIds = reviews.map(r => r.id);
    const userIds = reviews.map(r => r.user_id);
    const entityIds = reviews.filter(r => r.entity_id).map(r => r.entity_id);

    // Get user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

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
    return reviews.map(review => {
      const userProfile = profiles?.find(p => p.id === review.user_id);
      const entity = entities.find(e => e.id === review.entity_id);

      return {
        ...review,
        user: userProfile ? {
          username: userProfile.username,
          avatar_url: userProfile.avatar_url
        } : undefined,
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

// Fetch reviews that are marked as recommendations (4+ stars) - Using manual joins
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

    const reviewIds = reviews.map(r => r.id);
    const userIds = reviews.map(r => r.user_id);
    const entityIds = reviews.filter(r => r.entity_id).map(r => r.entity_id);

    // Get user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

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
    return reviews.map(review => {
      const userProfile = profiles?.find(p => p.id === review.user_id);
      const entity = entities.find(e => e.id === review.entity_id);

      return {
        ...review,
        user: userProfile ? {
          username: userProfile.username,
          avatar_url: userProfile.avatar_url
        } : undefined,
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

    // Get unique user IDs from the updates
    const userIds = [...new Set(updates.map(update => update.user_id))];

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Map updates with their corresponding profiles
    return updates.map(update => ({
      ...update,
      profiles: profiles?.find(profile => profile.id === update.user_id) ? {
        username: profiles.find(profile => profile.id === update.user_id)?.username,
        avatar_url: profiles.find(profile => profile.id === update.user_id)?.avatar_url
      } : undefined
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
