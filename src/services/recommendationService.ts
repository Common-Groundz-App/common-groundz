
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type RecommendationCategory = Database['public']['Enums']['recommendation_category'];
export type RecommendationVisibility = Database['public']['Enums']['recommendation_visibility'];

export interface Recommendation {
  id: string;
  title: string;
  venue: string | null;
  description: string | null;
  rating: number;
  image_url: string | null;
  category: RecommendationCategory;
  visibility: RecommendationVisibility;
  is_certified: boolean;
  view_count: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export const fetchUserRecommendations = async (userId: string) => {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }

  return data;
};

export const fetchRecommendationWithLikesAndSaves = async (userId: string, profileId: string) => {
  // Get recommendations
  const { data: recommendations, error } = await supabase
    .from('recommendations')
    .select(`
      *,
      recommendation_likes(count),
      recommendation_saves(count)
    `)
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }

  // If logged in user, get likes and saves
  if (userId) {
    // Get user likes
    const { data: userLikes, error: likesError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .eq('user_id', userId);

    if (likesError) {
      console.error('Error fetching user likes:', likesError);
    }

    // Get user saves
    const { data: userSaves, error: savesError } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .eq('user_id', userId);

    if (savesError) {
      console.error('Error fetching user saves:', savesError);
    }

    // Process recommendations with likes count and user interaction
    return recommendations.map(rec => {
      const likesCount = rec.recommendation_likes?.[0]?.count || 0;
      const isLiked = userLikes ? userLikes.some(like => like.recommendation_id === rec.id) : false;
      const isSaved = userSaves ? userSaves.some(save => save.recommendation_id === rec.id) : false;
      
      return {
        ...rec,
        likes: likesCount,
        isLiked,
        isSaved,
        recommendation_likes: undefined,
        recommendation_saves: undefined
      };
    });
  }

  // If not logged in, just return recommendations with counts
  return recommendations.map(rec => ({
    ...rec,
    likes: rec.recommendation_likes?.[0]?.count || 0,
    isLiked: false,
    isSaved: false,
    recommendation_likes: undefined,
    recommendation_saves: undefined
  }));
};

export const createRecommendation = async (recommendation: Omit<Recommendation, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('recommendations')
    .insert(recommendation)
    .select()
    .single();

  if (error) {
    console.error('Error creating recommendation:', error);
    throw error;
  }

  return data;
};

export const updateRecommendation = async (id: string, updates: Partial<Recommendation>) => {
  const { data, error } = await supabase
    .from('recommendations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recommendation:', error);
    throw error;
  }

  return data;
};

export const deleteRecommendation = async (id: string) => {
  const { error } = await supabase
    .from('recommendations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting recommendation:', error);
    throw error;
  }

  return true;
};

export const incrementViewCount = async (id: string, viewerId: string | null) => {
  try {
    await supabase.rpc('increment_recommendation_view', {
      rec_id: id,
      viewer_id: viewerId
    });
    return true;
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return false;
  }
};

export const toggleLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
  if (isLiked) {
    // Remove like
    const { error } = await supabase
      .from('recommendation_likes')
      .delete()
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing like:', error);
      throw error;
    }
  } else {
    // Add like
    const { error } = await supabase
      .from('recommendation_likes')
      .insert({
        recommendation_id: recommendationId,
        user_id: userId
      });

    if (error) {
      console.error('Error adding like:', error);
      throw error;
    }
  }

  return !isLiked;
};

export const toggleSave = async (recommendationId: string, userId: string, isSaved: boolean) => {
  if (isSaved) {
    // Remove save
    const { error } = await supabase
      .from('recommendation_saves')
      .delete()
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing save:', error);
      throw error;
    }
  } else {
    // Add save
    const { error } = await supabase
      .from('recommendation_saves')
      .insert({
        recommendation_id: recommendationId,
        user_id: userId
      });

    if (error) {
      console.error('Error adding save:', error);
      throw error;
    }
  }

  return !isSaved;
};

// Image upload helper function
export const uploadRecommendationImage = async (userId: string, file: File) => {
  // Create path with user ID for better organization
  const path = `${userId}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('recommendation_images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }

  // Get public URL for the uploaded image
  const { data: { publicUrl } } = supabase.storage
    .from('recommendation_images')
    .getPublicUrl(data.path);

  return publicUrl;
};
