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
    isLiked: review.isLiked?.length > 0,
    isSaved: review.isSaved?.length > 0,
    likes: review.likes_count?.length > 0 ? review.likes_count[0].count : 0,
  })) || [];
}

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

  return data;
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

export async function createReview(
  title: string,
  description: string,
  rating: number,
  image_url: string | undefined,
  venue: string | undefined,
  category: string,
  visibility: 'public' | 'private' | 'friends',
  experience_date: string | undefined,
  subtitle: string | undefined,
  media: any[] | undefined,
  metadata: any | undefined,
  entity_id: string | undefined,
  status: string | undefined,
): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .insert([
      {
        title,
        description,
        rating,
        image_url,
        venue,
        category,
        visibility,
        experience_date,
        subtitle,
        media,
        metadata,
        entity_id,
        status
      }
    ])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating review:', error);
    return null;
  }

  return data;
}

export async function fetchReviewUpdates(reviewId: string): Promise<ReviewUpdate[]> {
  const { data, error } = await supabase
    .from('review_updates')
    .select(`
      *,
      profiles:user_id (
        username,
        avatar_url
      )
    `)
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching review updates:', error);
    throw error;
  }

  return data || [];
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
