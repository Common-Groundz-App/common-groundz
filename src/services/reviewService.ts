import { supabase } from '@/integrations/supabase/client';

export interface Review {
  id: string;
  title: string;
  description?: string;
  rating: number;
  user_id: string;
  created_at: string;
  category: string;
  venue?: string;
  entity_id?: string;
  entity?: any;
  image_url?: string;
  visibility: 'public' | 'private' | 'circle_only';
  experience_date?: string;
  status?: 'published' | 'flagged' | 'deleted';
  is_converted?: boolean;
  metadata?: {
    food_tags?: string[];
    [key: string]: any;
  };
  likes?: number;
  view_count?: number;
  comment_count?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  user?: {
    username?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

export const fetchUserReviews = async (userId: string, viewerId?: string) => {
  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        user:user_id (username, first_name, last_name, avatar_url),
        entity:entity_id (*)
      `)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (viewerId !== userId) {
      // Only show public reviews to other users
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query;

    if (error) throw error;

    // If there's a viewer, fetch like and save status for each review
    if (viewerId) {
      const enhancedReviews = await Promise.all(data.map(async (review) => {
        const [likeStatus, saveStatus] = await Promise.all([
          checkLikeStatus(review.id, viewerId),
          checkSaveStatus(review.id, viewerId)
        ]);
        
        return {
          ...review,
          isLiked: likeStatus,
          isSaved: saveStatus
        };
      }));
      
      return enhancedReviews;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    throw error;
  }
};

export const createReview = async (reviewData: Partial<Review>): Promise<Review> => {
  try {
    // Log the image URL to verify it's being passed correctly
    console.log('Creating review with image URL:', reviewData.image_url);
    
    const { data, error } = await supabase
      .from('reviews')
      .insert([reviewData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating review:', error);
    throw error;
  }
};

export const updateReview = async (reviewId: string, reviewData: Partial<Review>): Promise<Review> => {
  try {
    // Log the image URL to verify it's being updated correctly
    console.log('Updating review with image URL:', reviewData.image_url);
    console.log('Updating review with metadata:', reviewData.metadata);
    
    const { data, error } = await supabase
      .from('reviews')
      .update(reviewData)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating review:', error);
    throw error;
  }
};

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
        category: review.category as "food" | "movie" | "book" | "place" | "product", // Type cast
        visibility: review.visibility,
        entity_id: review.entity_id,
        user_id: userId,
        is_certified: false,
        view_count: 0
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

export const fetchReviewById = async (id: string, userId: string | null = null): Promise<Review | null> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching review:', error);
      throw error;
    }

    if (!data) return null;

    // Get entity data if there's an entity_id
    let entity = null;
    if (data.entity_id) {
      const { data: entityData } = await supabase
        .from('entities')
        .select('*')
        .eq('id', data.entity_id)
        .single();
      
      entity = entityData;
    }

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
      entity
    } as Review;
  } catch (error) {
    console.error('Error in fetchReviewById:', error);
    throw error;
  }
};

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

export const updateReviewStatus = async (id: string, status: 'published' | 'flagged' | 'deleted') => {
  const { data, error } = await supabase
    .from('reviews')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating review status:', error);
    throw error;
  }

  return data;
};

async function checkLikeStatus(reviewId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('review_likes')
    .select('id')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .single();

  return !!data;
}

async function checkSaveStatus(reviewId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('review_saves')
    .select('id')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .single();

  return !!data;
}
