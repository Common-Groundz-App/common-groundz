
import { 
  Recommendation,
  RecommendationCategory, 
  RecommendationVisibility,
  Entity
} from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { RecommendationWithUser, PostWithUser } from '@/types/entities';

export type FeedVisibility = 'for_you' | 'following';

// Legacy types for backward compatibility - will be replaced in Phase 4
export interface FeedItem extends Recommendation {
  likes: number;
  is_liked: boolean;
  is_saved: boolean;
  username: string | null;
  avatar_url: string | null;
  comment_count: number;
}

export type RecommendationFeedItem = FeedItem;

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
  likes: number;
  is_liked: boolean;
  is_saved: boolean;
  comment_count: number;
  tagged_entities?: Entity[];
  media?: MediaItem[];
  status?: 'draft' | 'published' | 'failed';
  tags?: string[];
}

// Current combined feed item type (legacy)
export type CombinedFeedItem = FeedItem | PostFeedItem;

// New unified feed item type (will replace CombinedFeedItem in Phase 4)
export type UnifiedFeedItem = RecommendationWithUser | PostWithUser;

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
