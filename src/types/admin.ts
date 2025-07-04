
import { Entity } from '@/services/recommendation/types';

// Admin-specific entity type that extends the base Entity with all admin fields
export interface AdminEntity extends Entity {
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
