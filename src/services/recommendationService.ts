
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, EntityType, RecommendationCategory } from './recommendation/types';

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

/**
 * Toggle like for a recommendation
 * @param recommendationId The ID of the recommendation to toggle like for
 * @param userId The ID of the user doing the liking
 * @param isLiked Optional parameter indicating the current like state to invert
 * @returns Boolean indicating if the recommendation is now liked (true) or unliked (false)
 */
export const toggleLike = async (
  recommendationId: string, 
  userId: string, 
  isLiked: boolean = false
): Promise<boolean> => {
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
