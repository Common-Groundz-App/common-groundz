
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
  // Comments count
  comment_count?: number;
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

// Comment types
export interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id: string | null;
  recommendation_id: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  // Added profile information
  username?: string | null;
  avatar_url?: string | null;
  // UI state properties
  isEditing?: boolean;
  replyCount?: number;
  showReplies?: boolean;
}

export interface AddCommentData {
  content: string;
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string | null;
}

export interface UpdateCommentData {
  id: string;
  content: string;
}
