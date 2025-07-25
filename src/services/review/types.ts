
import { MediaItem } from '@/types/media';

// Base review interface
export interface Review {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category: string;
  rating: number;
  venue?: string;
  entity_id?: string;
  visibility: 'public' | 'private' | 'circle_only';
  status: string;
  experience_date?: string;
  has_timeline: boolean;
  timeline_count: number;
  trust_score: number;
  is_recommended: boolean;
  is_verified?: boolean;
  latest_rating?: number;
  ai_summary?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Data for creating a new review
export interface ReviewCreateData {
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category: string;
  rating: number;
  venue?: string;
  entity_id?: string;
  visibility: 'public' | 'private' | 'circle_only';
  experience_date?: string;
  user_id: string;
}

// Data for updating an existing review
export interface ReviewUpdateData {
  title?: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category?: string;
  rating?: number;
  venue?: string;
  visibility?: 'public' | 'private' | 'circle_only';
  experience_date?: string;
  status?: string;
}

// Review update/timeline entry
export interface ReviewUpdate {
  id: string;
  review_id: string;
  user_id: string;
  rating: number | null;
  comment: string;
  media?: MediaItem[];
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
  user: {
    displayName: string;
    avatar_url: string | null;
  };
}
