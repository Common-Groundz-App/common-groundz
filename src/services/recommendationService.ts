
import { supabase } from '@/integrations/supabase/client';
import { fetchRecommendationById as fetchRecommendationByIdFromTypes } from './recommendation/fetchRecommendationById';

// Export all recommendation service types
export { 
  Recommendation, 
  RecommendationCategory, 
  RecommendationVisibility,
  Entity,
  EntityType
} from './recommendation/types';

// Export the recommendation service functions
export { 
  fetchUserRecommendations,
  fetchRecommendationWithLikesAndSaves
} from './recommendation/fetchRecommendations';

export {
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  incrementViewCount
} from './recommendation/crudOperations';

export {
  toggleLike,
  toggleSave
} from './recommendation/interactionOperations';

export { 
  uploadRecommendationImage 
} from './recommendation/imageUpload';

export {
  fetchEntityById,
  findEntityByApiRef,
  createEntity,
  findOrCreateEntity,
  getEntitiesByType
} from './recommendation/entityOperations';

// Wrapper function for fetchRecommendationById with proper parameter handling
export const fetchRecommendationById = async (id: string, userId: string | null = null): Promise<Recommendation | null> => {
  return fetchRecommendationByIdFromTypes(id, userId);
};
