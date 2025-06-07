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

// Fetch user reviews with enhanced fields - Fixed foreign key references
export const fetchUserReviews = async (currentUserId: string | null, profileUserId: string): Promise<Review[]> => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles!reviews_user_id_fkey(username, avatar_url),
        entities(id, name, type, image_url)
      `)
      .eq('user_id', profileUserId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }

    if (!reviews?.length) return [];

    const reviewIds = reviews.map(r => r.id);

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
    return reviews.map(review => ({
      ...review,
      user: review.profiles ? {
        username: review.profiles.username,
        avatar_url: review.profiles.avatar_url
      } : undefined,
      entity: review.entities ? {
        id: review.entities.id,
        name: review.entities.name,
        type: review.entities.type,
        image_url: review.entities.image_url
      } : undefined,
      comment_count: 0, // Placeholder for future comment system
      isLiked: likeData.some(like => like.review_id === review.id),
      isSaved: saveData.some(save => save.review_id === review.id),
      likes: likeCounts.find(count => count.review_id === review.id)?.like_count || 0
    }));

  } catch (error) {
    console.error('Error in fetchUserReviews:', error);
    return [];
  }
};

// Fetch reviews that are marked as recommendations (4+ stars) - Fixed foreign key references
export const fetchUserRecommendations = async (currentUserId: string | null, profileUserId: string): Promise<Review[]> => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles!reviews_user_id_fkey(username, avatar_url),
        entities(id, name, type, image_url)
      `)
      .eq('user_id', profileUserId)
      .eq('status', 'published')
      .eq('is_recommended', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recommendations:', error);
      return [];
    }

    if (!reviews?.length) return [];

    const reviewIds = reviews.map(r => r.id);

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
    return reviews.map(review => ({
      ...review,
      user: review.profiles ? {
        username: review.profiles.username,
        avatar_url: review.profiles.avatar_url
      } : undefined,
      entity: review.entities ? {
        id: review.entities.id,
        name: review.entities.name,
        type: review.entities.type,
        image_url: review.entities.image_url
      } : undefined,
      comment_count: 0, // Placeholder for future comment system
      isLiked: likeData.some(like => like.review_id === review.id),
      isSaved: saveData.some(save => save.review_id === review.id),
      likes: likeCounts.find(count => count.review_id === review.id)?.like_count || 0
    }));

  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    return [];
  }
};

// Fetch review timeline updates
export const fetchReviewUpdates = async (reviewId: string): Promise<ReviewUpdate[]> => {
  try {
    const { data, error } = await supabase
      .from('review_updates')
      .select(`
        *,
        profiles!review_updates_user_id_fkey(username, avatar_url)
      `)
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching review updates:', error);
      return [];
    }

    return data || [];
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
