
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';  // Added import for MediaItem
import { Database } from '@/integrations/supabase/types';
import { UserProfile } from '@/components/profile/circles/types';

export interface Review {
  id: string;
  title: string;
  entity_id: string | null;
  venue: string | null;
  description: string | null;
  rating: number;
  image_url: string | null;
  media?: MediaItem[] | null;  // New property for media items
  category: string;
  visibility: 'public' | 'private' | 'circle_only';
  user_id: string;
  created_at: string;
  updated_at: string;
  is_converted: boolean;
  recommendation_id: string | null;
  experience_date: string | null;
  status: 'published' | 'flagged' | 'deleted';
  likes?: number;
  comment_count?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  entity?: any | null;
  user?: UserProfile | null; // Add user property to fix the TypeScript error
  metadata?: {
    food_tags?: string[];
    [key: string]: any;
  };
}

// Fetch user reviews - optimized with batch operations
export const fetchUserReviews = async (currentUserId: string | null, profileUserId: string): Promise<Review[]> => {
  try {
    // Fetch reviews
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', profileUserId)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      throw reviewsError;
    }

    // No reviews found
    if (!reviewsData || reviewsData.length === 0) return [];

    // Get array of review IDs
    const reviewIds = reviewsData.map(rev => rev.id);

    // Get entity IDs from all reviews for batch fetching
    const entityIds = reviewsData
      .filter(review => review.entity_id !== null)
      .map(review => review.entity_id as string);

    // Fetch entities in batch if we have entity IDs
    const entitiesMap = new Map();
    
    if (entityIds.length > 0) {
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('*')
        .in('id', entityIds);
      
      if (!entitiesError && entitiesData) {
        entitiesData.forEach(entity => {
          entitiesMap.set(entity.id, entity);
        });
      }
    }

    // Fetch user profile data for the review creator
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', profileUserId)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
    }

    // Create the user profile object from the fetched data
    const userProfile = userData ? {
      id: userData.id,
      username: userData.username,
      avatar_url: userData.avatar_url
    } : null;

    // Use RPC functions for batch operations to get likes counts
    const { data: likesCountData } = await supabase
      .rpc('get_review_likes_batch', { p_review_ids: reviewIds });
    
    // Create a Map for quick lookup
    const likesCountMap = new Map();
    if (likesCountData) {
      likesCountData.forEach((item: { review_id: string; like_count: number }) => {
        likesCountMap.set(item.review_id, item.like_count);
      });
    }

    // If we have a logged-in user, get their likes and saves in batch
    let userLikes: Array<{review_id: string}> = [];
    let userSaves: Array<{review_id: string}> = [];
    
    if (currentUserId) {
      // Get user likes in batch
      const { data: likesData } = await supabase
        .rpc('get_user_review_likes', { 
          p_review_ids: reviewIds,
          p_user_id: currentUserId
        });
      
      userLikes = likesData || [];
      
      // Get user saves in batch
      const { data: savesData } = await supabase
        .rpc('get_user_review_saves', { 
          p_review_ids: reviewIds,
          p_user_id: currentUserId
        });
      
      userSaves = savesData || [];
    }

    // Map all data to reviews with optimized processing
    const reviews = reviewsData.map(review => {
      // Get likes count from our map
      const likes = likesCountMap.get(review.id) || 0;
      
      // Check if user liked or saved this review
      const isLiked = userLikes?.some(l => l.review_id === review.id) || false;
      const isSaved = userSaves?.some(s => s.review_id === review.id) || false;
      
      // Get the entity for this review from our map
      const entity = review.entity_id ? entitiesMap.get(review.entity_id) : null;

      // Process the media field coming from Supabase
      let processedMedia: MediaItem[] | null = null;
      if (review.media) {
        try {
          processedMedia = (review.media as any[]).map(item => ({
            url: item.url,
            type: item.type,
            order: item.order,
            id: item.id,
            caption: item.caption,
            thumbnail_url: item.thumbnail_url,
            width: item.width,
            height: item.height,
            orientation: item.orientation
          }));
        } catch (e) {
          console.error('Error processing media data:', e);
        }
      }

      return {
        ...review,
        likes: Number(likes),
        isLiked,
        isSaved,
        entity,
        user: userProfile,
        media: processedMedia
      } as Review;
    });

    return reviews;
  } catch (error) {
    console.error('Error in fetchUserReviews:', error);
    throw error;
  }
};

// Toggle like on review
export const toggleReviewLike = async (reviewId: string, userId: string, isLiked: boolean) => {
  // Use the Supabase RPC function that handles toggle in a single operation
  const { data, error } = await supabase
    .rpc('toggle_review_like', {
      p_review_id: reviewId,
      p_user_id: userId
    });

  if (error) {
    console.error('Error toggling review like:', error);
    throw error;
  }

  return data; // Will return true if liked, false if unliked
};

// Toggle save on review
export const toggleReviewSave = async (reviewId: string, userId: string, isSaved: boolean) => {
  // Use the Supabase RPC function that handles toggle in a single operation
  const { data, error } = await supabase
    .rpc('toggle_review_save', {
      p_review_id: reviewId,
      p_user_id: userId
    });

  if (error) {
    console.error('Error toggling review save:', error);
    throw error;
  }

  return data; // Will return true if saved, false if unsaved
};

// Create review
export const createReview = async (review: Omit<Review, 'id' | 'created_at' | 'updated_at' | 'is_converted' | 'recommendation_id' | 'status'>) => {
  console.log("Creating review with entity_id:", review.entity_id);
  console.log("Review metadata:", review.metadata);
  
  // Convert MediaItem[] to a format that Supabase can handle
  const mediaForStorage = review.media ? JSON.parse(JSON.stringify(review.media)) : null;
  
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      title: review.title,
      venue: review.venue,
      description: review.description,
      rating: review.rating,
      image_url: review.image_url,
      media: mediaForStorage as any,
      category: review.category,
      visibility: review.visibility,
      user_id: review.user_id,
      experience_date: review.experience_date,
      metadata: review.metadata,
      entity_id: review.entity_id, // Ensure entity_id is saved properly
      is_converted: false,
      recommendation_id: null,
      status: 'published'
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

// Fetch review by ID
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

    // Get user profile data for the review creator
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', data.user_id)
      .single();
    
    if (userError) {
      console.error('Error fetching user profile:', userError);
    }
    
    // Create the user profile object
    const userProfile = userData ? {
      id: userData.id,
      username: userData.username,
      avatar_url: userData.avatar_url
    } : null;

    // Get entity data if there's an entity_id
    let entity = null;
    if (data.entity_id) {
      console.log(`Fetching entity data for review ${id}, entity_id: ${data.entity_id}`);
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', data.entity_id)
        .single();
      
      if (entityError) {
        console.error(`Error fetching entity for review ${id}:`, entityError);
      }
      
      if (entityData) {
        console.log(`Found entity for review ${id}:`, {
          name: entityData.name, 
          image_url: entityData.image_url
        });
        entity = entityData;
      } else {
        console.log(`No entity found for review ${id} with entity_id ${data.entity_id}`);
      }
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

    // Process the media field coming from Supabase
    let processedMedia: MediaItem[] | null = null;
    if (data.media) {
      try {
        // If it's already an array of objects, process it
        processedMedia = (data.media as any[]).map(item => ({
          url: item.url,
          type: item.type,
          order: item.order,
          id: item.id,
          caption: item.caption,
          thumbnail_url: item.thumbnail_url,
          width: item.width, 
          height: item.height,
          orientation: item.orientation
        }));
      } catch (e) {
        console.error('Error processing media data:', e);
      }
    }

    return {
      ...data,
      likes: likesCount || 0,
      isLiked,
      isSaved,
      entity,
      user: userProfile,
      media: processedMedia
    } as Review;
  } catch (error) {
    console.error('Error in fetchReviewById:', error);
    throw error;
  }
};

// Update review
export const updateReview = async (id: string, updates: Partial<Review>) => {
  console.log("Updating review entity_id:", updates.entity_id);
  console.log("Updating review with metadata:", updates.metadata);
  
  // Convert MediaItem[] to a format that Supabase can handle
  const mediaForStorage = updates.media ? JSON.parse(JSON.stringify(updates.media)) : undefined;
  
  // Create a new object with only the supported fields
  const validUpdates = {
    title: updates.title,
    venue: updates.venue,
    description: updates.description,
    rating: updates.rating,
    image_url: updates.image_url,
    media: mediaForStorage as any,
    category: updates.category,
    visibility: updates.visibility as 'public' | 'private' | 'circle_only',
    experience_date: updates.experience_date,
    entity_id: updates.entity_id, // Make sure entity_id is included in updates
    metadata: updates.metadata
    // No need to include updated_at as our DB trigger handles that now
  };
  
  const { data, error } = await supabase
    .from('reviews')
    .update(validUpdates)
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

// Update review status (for moderation)
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
