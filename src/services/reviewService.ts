import { supabase } from '@/integrations/supabase/client';

export interface Review {
  id: string;
  title: string;
  description?: string;
  rating: number;
  image_url?: string;
  venue?: string;
  category: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  entity_id?: string;
  visibility: 'public' | 'private' | 'friends';
  experience_date?: string;
  subtitle?: string;
  media?: any[];
  metadata?: any;
  status: string;
  is_recommended?: boolean;
  recommendation_id?: string;
  is_converted: boolean;
  // Timeline fields
  has_timeline?: boolean;
  timeline_count?: number;
  trust_score?: number;
  is_verified?: boolean;
  // AI summary fields
  ai_summary?: string;
  ai_summary_last_generated_at?: string;
  ai_summary_model_used?: string;
  // Interaction fields (populated by queries)
  isLiked?: boolean;
  isSaved?: boolean;
  likes?: number;
  // Entity information (for edit mode)
  entity?: any;
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
    username: string;
    avatar_url?: string;
  };
}

export async function fetchReviews(profileUserId: string, currentUserId?: string): Promise<Review[]> {
  let query = supabase
    .from('reviews')
    .select(`
      *,
      likes_count: review_likes(count),
      isLiked: review_likes(
        user_id,
        count
      ),
      isSaved: review_saves(
        user_id,
        count
      )
    `)
    .eq('user_id', profileUserId)
    .order('created_at', { ascending: false });

  if (currentUserId) {
    query = query.or(`user_id.eq.${currentUserId},visibility.eq.public,visibility.eq.friends`);
  } else {
    query = query.eq('visibility', 'public');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }

  return data?.map(review => ({
    ...review,
    // Map database visibility values to interface values
    visibility: review.visibility === 'circle_only' ? 'friends' : review.visibility,
    isLiked: review.isLiked?.length > 0,
    isSaved: review.isSaved?.length > 0,
    likes: review.likes_count?.length > 0 ? review.likes_count[0].count : 0,
    // Ensure media is always an array
    media: Array.isArray(review.media) ? review.media : (review.media ? [review.media] : []),
  })) || [];
}

// Alias for compatibility
export const fetchUserReviews = fetchReviews;

export async function fetchReviewById(id: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching review by ID:', error);
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    // Map database visibility values to interface values
    visibility: data.visibility === 'circle_only' ? 'friends' : data.visibility,
    // Ensure media is always an array
    media: Array.isArray(data.media) ? data.media : (data.media ? [data.media] : []),
  };
}

export async function deleteReview(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting review:', error);
    return false;
  }

  return true;
}

export async function createReview(reviewData: {
  title: string;
  description: string;
  rating: number;
  image_url?: string;
  venue?: string;
  category: string;
  visibility: 'public' | 'private' | 'friends';
  experience_date?: string;
  subtitle?: string;
  media?: any[];
  metadata?: any;
  entity_id?: string;
  status?: string;
  user_id: string;
}): Promise<Review | null> {
  // Map interface visibility to database visibility
  const dbVisibility = reviewData.visibility === 'friends' ? 'circle_only' : reviewData.visibility;
  
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      title: reviewData.title,
      description: reviewData.description,
      rating: reviewData.rating,
      image_url: reviewData.image_url,
      venue: reviewData.venue,
      category: reviewData.category,
      visibility: dbVisibility,
      experience_date: reviewData.experience_date,
      subtitle: reviewData.subtitle,
      media: reviewData.media,
      metadata: reviewData.metadata,
      entity_id: reviewData.entity_id,
      status: reviewData.status || 'published',
      user_id: reviewData.user_id
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating review:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    // Map database visibility back to interface visibility
    visibility: data.visibility === 'circle_only' ? 'friends' : data.visibility,
    // Ensure media is always an array
    media: Array.isArray(data.media) ? data.media : (data.media ? [data.media] : []),
  };
}

export async function updateReview(
  id: string,
  updateData: {
    title?: string;
    subtitle?: string;
    venue?: string;
    description?: string;
    rating?: number;
    image_url?: string;
    media?: any[];
    category?: string;
    visibility?: 'public' | 'private' | 'friends';
    entity_id?: string;
    experience_date?: string;
    metadata?: any;
  }
): Promise<Review | null> {
  // Map interface visibility to database visibility if provided
  const dbData = {
    ...updateData,
    visibility: updateData.visibility === 'friends' ? 'circle_only' as const : updateData.visibility as 'public' | 'private' | 'circle_only',
  };

  const { data, error } = await supabase
    .from('reviews')
    .update(dbData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating review:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    // Map database visibility back to interface visibility
    visibility: data.visibility === 'circle_only' ? 'friends' : data.visibility,
    // Ensure media is always an array
    media: Array.isArray(data.media) ? data.media : (data.media ? [data.media] : []),
  };
}

export async function fetchReviewUpdates(reviewId: string): Promise<ReviewUpdate[]> {
  const { data, error } = await supabase
    .from('review_updates')
    .select(`
      id,
      review_id,
      user_id,
      rating,
      comment,
      created_at,
      updated_at
    `)
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching review updates:', error);
    throw error;
  }

  // Fetch profiles separately to avoid join issues
  const userIds = [...new Set(data?.map(update => update.user_id) || [])];
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap = profiles?.reduce((acc, profile) => {
      acc[profile.id] = { username: profile.username, avatar_url: profile.avatar_url };
      return acc;
    }, {} as Record<string, { username: string; avatar_url?: string }>) || {};

    return data?.map(update => ({
      ...update,
      profiles: profileMap[update.user_id] || { username: 'Unknown User' }
    })) || [];
  }

  return data?.map(update => ({
    ...update,
    profiles: { username: 'Unknown User' }
  })) || [];
}

export async function addReviewUpdate(
  reviewId: string,
  userId: string,
  rating: number | null,
  comment: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('review_updates')
      .insert({
        review_id: reviewId,
        user_id: userId,
        rating,
        comment
      });

    if (error) {
      console.error('Error adding review update:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error adding review update:', error);
    return false;
  }
}

export async function toggleReviewLike(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('toggle_review_like', {
    p_review_id: reviewId,
    p_user_id: userId
  });

  if (error) {
    console.error('Error toggling review like:', error);
    throw error;
  }
}

export async function toggleReviewSave(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('toggle_review_save', {
    p_review_id: reviewId,
    p_user_id: userId
  });

  if (error) {
    console.error('Error toggling review save:', error);
    throw error;
  }
}

export async function convertReviewToRecommendation(reviewId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ is_converted: true })
      .eq('id', reviewId);

    if (error) {
      console.error('Error converting review to recommendation:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error converting review to recommendation:', error);
    return false;
  }
}

export async function generateReviewAISummary(reviewId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-ai-summary', {
      body: { reviewId }
    });

    if (error) {
      console.error('Error generating AI summary:', error);
      throw error;
    }

    return data?.success || false;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return false;
  }
}

// Add placeholder exports for compatibility
export async function fetchUserRecommendations(): Promise<any[]> {
  // Placeholder - implement if needed
  return [];
}
