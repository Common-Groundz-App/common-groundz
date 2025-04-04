
import { Database } from '@/integrations/supabase/types';

export type RecommendationCategory = Database['public']['Enums']['recommendation_category'];
export type RecommendationVisibility = Database['public']['Enums']['recommendation_visibility'];

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
  created_at: string;
  updated_at: string;
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}
