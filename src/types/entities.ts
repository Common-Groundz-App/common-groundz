
/**
 * Unified entity types with proper profile integration
 */

import { WithUserProfile, InteractionData, EntityReference, CommentMetadata, Timestamps, Visibility, MediaItem } from './common';
import { Entity } from '@/services/recommendation/types';
import { Database } from '@/integrations/supabase/types';

// Base recommendation with user profile
export interface RecommendationWithUser extends WithUserProfile, InteractionData, Timestamps {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category: Database["public"]["Enums"]["recommendation_category"];
  rating: number;
  venue?: string;
  entity_id?: string;
  entity?: Entity;
  visibility: Visibility;
  is_certified: boolean;
  view_count: number;
  comment_count: number;
  media?: MediaItem[];
}

// Base review with user profile
export interface ReviewWithUser extends WithUserProfile, InteractionData, Timestamps {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category: string;
  rating: number;
  venue?: string;
  entity_id?: string;
  entity?: Entity;
  visibility: Visibility;
  status: 'published' | 'draft' | 'deleted';
  experience_date?: string;
  has_timeline: boolean;
  timeline_count: number;
  trust_score: number;
  is_recommended: boolean;
  latest_rating?: number;
  media?: MediaItem[];
  ai_summary?: string;
}

// Base comment with user profile
export interface CommentWithUser extends WithUserProfile, CommentMetadata {
  // Specific fields for different comment types
  recommendation_id?: string;
  post_id?: string;
  review_id?: string;
}

// Base post with user profile  
export interface PostWithUser extends WithUserProfile, InteractionData, Timestamps {
  id: string;
  title?: string;
  content?: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: Visibility;
  view_count: number;
  comment_count: number;
  tagged_entities?: EntityReference[];
  media?: MediaItem[];
  status: 'draft' | 'published' | 'failed';
  tags?: string[];
  is_post: boolean; // Helper flag for feed differentiation
}

// Feed item union type
export type FeedItemWithUser = RecommendationWithUser | PostWithUser;

// Profile-specific entity lists
export interface UserEntitiesWithProfile {
  recommendations: RecommendationWithUser[];
  reviews: ReviewWithUser[];
  posts: PostWithUser[];
}

// Entity detail page data
export interface EntityDetailData {
  entity: Entity;
  recommendations: RecommendationWithUser[];
  reviews: ReviewWithUser[];
  stats: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}
