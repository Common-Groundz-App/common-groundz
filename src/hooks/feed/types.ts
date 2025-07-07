
import { Database } from '@/integrations/supabase/types';
import { Entity } from '@/services/recommendation/types';
import { RecommendationCategory, RecommendationVisibility } from '@/services/recommendation/types';

// Use database types directly
export type EntityTypeString = Database["public"]["Enums"]["entity_type"];

export interface FeedItem {
  id: string;
  created_at: string;
  type: 'recommendation' | 'review' | 'post';
  title: string;
  description?: string;
  image_url?: string;
  entity?: Entity;
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  comment_count?: number;
}

// Feed query parameters
export interface FeedQueryParams {
  userId: string;
  page: number;
  itemsPerPage: number;
}

// Enhanced feed item interfaces
export interface RecommendationFeedItem extends FeedItem {
  type: 'recommendation';
  category: RecommendationCategory;
  rating: number;
  venue?: string;
  visibility: RecommendationVisibility;
  is_certified: boolean;
  view_count: number;
  is_liked: boolean;
  is_saved: boolean;
  is_post: false;
}

export interface PostFeedItem extends FeedItem {
  type: 'post';
  post_type: 'story' | 'routine' | 'project' | 'note';
  content?: string;
  visibility: 'public' | 'private' | 'circle_only';
  view_count: number;
  tagged_entities?: Entity[];
  media?: any[];
  status: 'draft' | 'published' | 'failed';
  tags?: string[];
  is_post: true;
  is_liked: boolean;
  is_saved: boolean;
}

// Combined feed item union type
export type CombinedFeedItem = RecommendationFeedItem | PostFeedItem;

// Feed state management
export interface FeedState {
  items: CombinedFeedItem[];
  loading: boolean;
  hasMore: boolean;
  page: number;
  error: string | null;
}

// Feed visibility options
export type FeedVisibility = 'public' | 'private' | 'circle_only';
