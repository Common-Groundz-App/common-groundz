
import { MediaItem } from '@/types/media';
import { Entity } from '@/services/recommendation/types';

// Feed visibility options
export type FeedVisibility = 'for_you' | 'following';

// Feed state for managing UI state
export interface FeedState {
  items: CombinedFeedItem[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  page: number;
  isLoadingMore: boolean;
}

// Base interface for feed items
export interface FeedItem {
  id: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  is_liked?: boolean;
  is_saved?: boolean;
  likes?: number;
  comment_count?: number;
  // Used for determining the type of feed item
  is_post: boolean;
}

// Interface for post feed items
export interface PostFeedItem extends FeedItem {
  is_post: true;
  title?: string;
  content: string;
  media?: MediaItem[];
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  status: 'draft' | 'published' | 'failed';
  view_count?: number;
}

// Interface for recommendation feed items
export interface RecommendationFeedItem extends FeedItem {
  is_post: false;
  title: string;
  description?: string;
  entity_id: string;
  entity?: Entity;
  rating: number;
  category: string;
  image_url?: string;
  venue?: string;
}

// Combined type for feed items
export type CombinedFeedItem = PostFeedItem | RecommendationFeedItem;

// Feed query parameters
export interface FeedQueryParams {
  userId: string;
  page: number;
  itemsPerPage: number;
}
