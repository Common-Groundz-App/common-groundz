
import { Database } from '@/integrations/supabase/types';

export type RecommendationCategory = Database['public']['Enums']['recommendation_category'];
export type RecommendationVisibility = Database['public']['Enums']['recommendation_visibility'];
export type EntityType = 'book' | 'movie' | 'place' | 'product' | 'food';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  venue: string | null;
  description: string | null;
  image_url: string | null;
  api_source: string | null;
  api_ref: string | null;
  metadata: any | null;
  created_by: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  is_verified?: boolean;
  website_url?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  venue: string | null;
  description: string | null;
  rating: number;
  image_url: string | null;
  category: RecommendationCategory;
  visibility: RecommendationVisibility;
  is_certified: boolean;
  view_count: number;
  user_id: string;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
  likes?: number;
  comment_count?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  entity?: Entity | null;
}
