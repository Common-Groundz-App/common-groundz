
import { SafeUserProfile } from '@/types/profile';

export interface Review {
  id: string;
  user_id: string;
  title: string;
  venue?: string;
  description?: string;
  rating: number;
  image_url?: string;
  category: string;
  created_at: string;
  updated_at: string;
  entity_id?: string;
  visibility: 'public' | 'private' | 'circle_only';
  status: string;
  is_converted: boolean;
  recommendation_id?: string;
  experience_date?: string;
  media?: any;
  metadata?: any;
  subtitle?: string;
  // New Dynamic Reviews fields
  trust_score?: number;
  is_recommended?: boolean;
  timeline_count?: number;
  has_timeline?: boolean;
  is_verified?: boolean;
  // AI summary fields for individual reviews
  ai_summary?: string;
  ai_summary_last_generated_at?: string;
  ai_summary_model_used?: string;
  // Interaction states
  isLiked?: boolean;
  isSaved?: boolean;
  likes?: number;
  // Additional fields for ReviewCard compatibility
  user?: {
    username?: string;
    avatar_url?: string;
  };
  entity?: {
    id: string;
    name: string;
    type: string;
    image_url?: string;
  };
  comment_count?: number;
  // Rating evolution field for timeline reviews
  latest_rating?: number;
}

export interface ReviewUpdate {
  id: string;
  review_id: string;
  user_id: string;
  rating?: number;
  comment: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    username?: string;
    avatar_url?: string;
  };
}

export interface ReviewCreateData {
  title: string;
  subtitle?: string;
  venue?: string;
  description?: string;
  rating: number;
  image_url?: string;
  media?: any;
  category: string;
  visibility: 'public' | 'private' | 'circle_only';
  entity_id?: string;
  experience_date?: string;
  metadata?: any;
  user_id: string;
}

export interface ReviewUpdateData {
  title?: string;
  subtitle?: string;
  venue?: string;
  description?: string;
  rating?: number;
  image_url?: string;
  media?: any;
  category?: string;
  visibility?: 'public' | 'private' | 'circle_only';
  entity_id?: string;
  experience_date?: string;
  metadata?: any;
}
