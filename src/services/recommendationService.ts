
// Phase 4.3 — the legacy recommendations layer is frozen. This module now only
// re-exports the shared types and the entity/image helpers that are still used
// by entity flows. All legacy record CRUD, fetches and like writes are gone.

// Export types that are used across multiple files
export type {
  Recommendation,
  Entity,
  EntityType,
  RecommendationCategory,
  RecommendationVisibility
} from './recommendation/types';

export {
  uploadRecommendationImage
} from './recommendation/imageUpload';

export {
  findOrCreateEntity,
  getEntitiesByType
} from './recommendation/entityOperations';

// toggleSave removed — saving is only supported for posts and entities
