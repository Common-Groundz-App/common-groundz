
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

export const toggleLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
  const { data, error } = await supabase.rpc('toggle_recommendation_like', {
    p_recommendation_id: recommendationId,
    p_user_id: userId
  });

  if (error) {
    console.error('Error toggling like:', error);
    throw error;
  }

  return data;
};

