
import { 
  Recommendation,
  RecommendationCategory, 
  RecommendationVisibility,
  Entity
} from '@/services/recommendationService';
import { MediaItem } from '@/types/media';

export type FeedVisibility = 'for_you' | 'following';

export interface FeedItem extends Recommendation {
  likes: number;
  is_liked: boolean;
  is_saved: boolean;
  username: string | null;
  avatar_url: string | null;
  comment_count: number; // Ensure comment_count is included
}

export interface PostFeedItem {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  user_id: string;
  created_at: string;
  updated_at: string;
  username: string | null;
  avatar_url: string | null;
  is_post: boolean;
  // Add these properties to match FeedItem interface for consistent handling
  likes: number;
  is_liked: boolean;
  is_saved: boolean;
  // Add property for tagged entities
  tagged_entities?: Entity[];
  // Media for posts
  media?: MediaItem[];
  // Status field
  status?: 'draft' | 'published' | 'failed';
  // Comment count
  comment_count: number;
}

export type CombinedFeedItem = FeedItem | PostFeedItem;

export interface FeedState {
  items: CombinedFeedItem[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  page: number;
  isLoadingMore: boolean;
}

export interface FeedQueryParams {
  userId: string;
  page: number;
  itemsPerPage: number;
}
