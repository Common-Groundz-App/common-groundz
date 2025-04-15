
import { 
  Recommendation,
  RecommendationCategory, 
  RecommendationVisibility,
  Entity
} from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

export type FeedVisibility = 'for_you' | 'following';

export interface FeedItem {
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
  is_liked?: boolean;
  is_saved?: boolean;
  username?: string | null;
  avatar_url?: string | null;
  entity?: Entity | null;
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
  comment_count: number; // Add this property explicitly
  // Add property for tagged entities
  tagged_entities?: Entity[];
  // Media for posts
  media?: MediaItem[];
  // Status field
  status?: 'draft' | 'published' | 'failed';
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
