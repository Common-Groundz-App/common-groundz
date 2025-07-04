
import { Entity } from '@/services/recommendation/types';

// Database entity types (what actually exists in the database)
export type DatabaseEntityType = 'book' | 'movie' | 'place' | 'product' | 'food';

// All possible entity types from the application
export type EntityType = 'movie' | 'book' | 'food' | 'product' | 'place' | 'activity' | 'music' | 'art' | 'tv' | 'drink' | 'travel';

// Conversion utility to map database types to application types
export const mapDatabaseToEntityType = (dbType: DatabaseEntityType): EntityType => {
  // Direct mapping for types that exist in both
  const typeMap: Record<DatabaseEntityType, EntityType> = {
    'book': 'book',
    'movie': 'movie', 
    'place': 'place',
    'product': 'product',
    'food': 'food'
  };
  
  return typeMap[dbType];
};

// Check if a string is a valid database entity type
export const isDatabaseEntityType = (type: string): type is DatabaseEntityType => {
  return ['book', 'movie', 'place', 'product', 'food'].includes(type);
};

// Admin-specific entity type that extends the base Entity with all admin fields
export interface AdminEntity extends Omit<Entity, 'type'> {
  // Use the broader EntityType for compatibility
  type: EntityType;
  
  // Admin lifecycle fields
  is_deleted: boolean;
  is_verified: boolean;
  verification_date?: string;
  created_by?: string;
  
  // AI summary fields
  ai_dynamic_review_summary?: string;
  ai_dynamic_review_summary_last_generated_at?: string;
  ai_dynamic_review_summary_model_used?: string;
  
  // Dynamic review count (computed field)
  dynamic_review_count: number;
  
  // Trending and analytics fields
  trending_score?: number;
  last_trending_update?: string;
  view_velocity?: number;
  recent_views_24h?: number;
  recent_likes_24h?: number;
  recent_recommendations_24h?: number;
  geographic_boost?: number;
  seasonal_boost?: number;
  
  // Quality and enrichment
  data_quality_score?: number;
  last_enriched_at?: string;
  enrichment_source?: string;
  
  // Override metadata to handle Json type properly
  metadata: Record<string, any>;
}

// Hook return type for admin entities management
export interface UseAdminEntitiesReturn {
  entities: AdminEntity[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// Hook return type for admin entities panel (AI summaries)
export interface UseAdminEntitiesPanelReturn {
  entities: AdminEntity[];
  isLoading: boolean;
  isGenerating: Record<string, boolean>;
  isBulkGenerating: boolean;
  generateEntitySummary: (entityId: string) => Promise<void>;
  generateBulkEntitySummaries: () => Promise<void>;
  refetch: () => Promise<void>;
}
