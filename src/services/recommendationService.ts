
// Export all recommendation service functions from their respective files
export type { Recommendation, RecommendationCategory, RecommendationVisibility } from './recommendation/types';

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

export { uploadRecommendationImage } from './recommendation/imageUpload';
