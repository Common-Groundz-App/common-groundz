import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType, Recommendation, RecommendationCategory, RecommendationVisibility } from './recommendation/types';

export type { 
  Entity,
  EntityType,
  Recommendation,
  RecommendationCategory,
  RecommendationVisibility 
};

export const uploadRecommendationImage = async (userId: string, file: File): Promise<string | null> => {
  try {
    // Create a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('recommendation_images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    // Get the public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('recommendation_images')
      .getPublicUrl(filePath);

    console.log('Image uploaded to:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error in uploadRecommendationImage:', error);
    return null;
  }
};

export { 
  createRecommendation,
  updateRecommendation,
  deleteRecommendation 
} from './recommendation/crudOperations';

export { 
  findOrCreateEntity,
  getEntitiesByType 
} from './recommendation/entityOperations';

export { 
  toggleSave
} from './recommendation/interactionOperations';

export { 
  fetchRecommendationById 
} from './recommendation/fetchRecommendationById';

export { 
  fetchUserRecommendations 
} from './recommendation/fetchRecommendations';

export const toggleLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
  try {
    // Direct approach to add or remove the like based on current state
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
      
      return false; // Indicate like was removed
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
      
      return true; // Indicate like was added
    }
  } catch (error) {
    console.error('Error in toggleLike:', error);
    throw error;
  }
};
