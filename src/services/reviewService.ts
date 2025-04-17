
import { supabase } from '@/integrations/supabase/client';

export interface Review {
  id: string;
  title: string;
  entity_id: string | null;
  venue: string | null;
  description: string | null;
  rating: number;
  image_url: string | null;
  category: string;
  visibility: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_converted: boolean;
  recommendation_id: string | null;
  likes?: number;
  comment_count?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  entity?: any | null;
}

// Fetch user reviews
export const fetchUserReviews = async (currentUserId: string | null, profileUserId: string): Promise<Review[]> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        entities(*)
      `)
      .eq('user_id', profileUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }

    // No reviews found
    if (!data || data.length === 0) return [];

    // Get array of review IDs
    const reviewIds = data.map(rev => rev.id);

    // Get likes for each review
    let userLikes: any[] = [];
    let userSaves: any[] = [];
    
    if (currentUserId) {
      const { data: likesData } = await supabase
        .from('review_likes')
        .select('review_id')
        .in('review_id', reviewIds)
        .eq('user_id', currentUserId);
        
      userLikes = likesData || [];
        
      const { data: savesData } = await supabase
        .from('review_saves')
        .select('review_id')
        .in('review_id', reviewIds)
        .eq('user_id', currentUserId);
        
      userSaves = savesData || [];
    }

    // Get like counts
    const { data: likeCounts, error: likeCountsError } = await supabase
      .from('review_likes')
      .select('review_id, count(*)')
      .in('review_id', reviewIds)
      .group('review_id');

    if (likeCountsError) {
      console.error('Error fetching like counts:', likeCountsError);
    }

    // Map likes and saves to reviews
    return data.map(review => {
      const likes = likeCounts?.find(c => c.review_id === review.id)?.count || 0;
      const isLiked = userLikes?.some(l => l.review_id === review.id) || false;
      const isSaved = userSaves?.some(s => s.review_id === review.id) || false;

      return {
        ...review,
        likes: Number(likes),
        isLiked,
        isSaved,
        entity: review.entities,
        entities: undefined
      };
    });
  } catch (error) {
    console.error('Error in fetchUserReviews:', error);
    throw error;
  }
};

// Toggle like on review
export const toggleReviewLike = async (reviewId: string, userId: string, isLiked: boolean) => {
  if (isLiked) {
    // Remove like
    const { error } = await supabase
      .from('review_likes')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing like:', error);
      throw error;
    }
  } else {
    // Add like
    const { error } = await supabase
      .from('review_likes')
      .insert({
        review_id: reviewId,
        user_id: userId
      });

    if (error) {
      console.error('Error adding like:', error);
      throw error;
    }
  }

  return !isLiked;
};

// Toggle save on review
export const toggleReviewSave = async (reviewId: string, userId: string, isSaved: boolean) => {
  if (isSaved) {
    // Remove save
    const { error } = await supabase
      .from('review_saves')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing save:', error);
      throw error;
    }
  } else {
    // Add save
    const { error } = await supabase
      .from('review_saves')
      .insert({
        review_id: reviewId,
        user_id: userId
      });

    if (error) {
      console.error('Error adding save:', error);
      throw error;
    }
  }

  return !isSaved;
};

// Create review
export const createReview = async (review: Omit<Review, 'id' | 'created_at' | 'updated_at' | 'is_converted' | 'recommendation_id'>) => {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      ...review,
      is_converted: false,
      recommendation_id: null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating review:', error);
    throw error;
  }

  return data;
};

// Convert review to recommendation
export const convertReviewToRecommendation = async (reviewId: string, userId: string) => {
  try {
    // First, get the review details
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .eq('user_id', userId) // Ensure the user owns this review
      .single();

    if (reviewError || !review) {
      console.error('Error fetching review:', reviewError);
      throw reviewError || new Error('Review not found');
    }

    // Create a recommendation based on the review
    const { data: recommendation, error: recommendationError } = await supabase
      .from('recommendations')
      .insert({
        title: review.title,
        description: review.description,
        venue: review.venue,
        rating: review.rating,
        image_url: review.image_url,
        category: review.category,
        visibility: review.visibility,
        entity_id: review.entity_id,
        user_id: userId
      })
      .select()
      .single();

    if (recommendationError) {
      console.error('Error creating recommendation:', recommendationError);
      throw recommendationError;
    }

    // Update the review to mark it as converted
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        is_converted: true,
        recommendation_id: recommendation.id
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Error updating review:', updateError);
      throw updateError;
    }

    return recommendation;
  } catch (error) {
    console.error('Error in convertReviewToRecommendation:', error);
    throw error;
  }
};

// Fetch review by ID
export const fetchReviewById = async (id: string, userId: string | null = null): Promise<Review | null> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        entities(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching review:', error);
      throw error;
    }

    if (!data) return null;

    // Get likes count
    const { count: likesCount, error: likesError } = await supabase
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', id);

    if (likesError) {
      console.error('Error fetching likes count:', likesError);
    }

    // Check if user liked this review
    let isLiked = false;
    let isSaved = false;

    if (userId) {
      const { data: likeData } = await supabase
        .from('review_likes')
        .select('id')
        .eq('review_id', id)
        .eq('user_id', userId)
        .single();

      isLiked = !!likeData;

      const { data: saveData } = await supabase
        .from('review_saves')
        .select('id')
        .eq('review_id', id)
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
    } as Review;
  } catch (error) {
    console.error('Error in fetchReviewById:', error);
    throw error;
  }
};

// Update review
export const updateReview = async (id: string, updates: Partial<Review>) => {
  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating review:', error);
    throw error;
  }

  return data;
};

// Delete review
export const deleteReview = async (id: string) => {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting review:', error);
    throw error;
  }

  return true;
};
