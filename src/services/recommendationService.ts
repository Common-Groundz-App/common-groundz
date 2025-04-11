
// Export all recommendation service functions from their respective files
export type { 
  Recommendation, 
  RecommendationCategory, 
  RecommendationVisibility,
  Entity,
  EntityType
} from './recommendation/types';

export { 
  fetchUserRecommendations,
  fetchRecommendationWithLikesAndSaves,
  fetchRecommendationById
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
