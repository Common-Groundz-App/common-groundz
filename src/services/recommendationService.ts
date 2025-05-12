import { supabase } from '@/integrations/supabase/client';
import { Recommendation, EntityType } from './recommendation/types';

// Export types that are used across multiple files
export type { 
  Recommendation, 
  Entity, 
  EntityType,
  RecommendationCategory,
  RecommendationVisibility 
} from './recommendation/types';

// Re-export functions from other files
export { 
  uploadRecommendationImage 
} from './recommendation/imageUpload';

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

// Export the fetchRecommendationById function
export { fetchRecommendationById } from './recommendation/fetchRecommendationById';

// Export fetchUserRecommendations function from fetchRecommendations.ts
export { fetchUserRecommendations } from './recommendation/fetchRecommendations';

// Fix the toggleLike function to properly handle the response and errors
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

// Add a function to handle entity image URLs in recommendations
export const saveRecommendation = async (data: any, userId: string) => {
  try {
    // For proper typing, you would define a type for the data parameter
    // Extract image handling data
    const { image_url, is_entity_image, ...recommendationData } = data;
    
    // Prepare the recommendation object to save
    const recommendation = {
      ...recommendationData,
      user_id: userId,
      // If it's an entity image, use it directly without uploading
      // This prevents duplicate image uploads
      image_url: image_url || null
    };
    
    // Save to database
    const { data: savedRecommendation, error } = await supabase
      .from('recommendations')
      .insert(recommendation)
      .select()
      .single();
    
    if (error) throw error;
    
    return savedRecommendation;
  } catch (error) {
    console.error('Error saving recommendation:', error);
    throw error;
  }
};
