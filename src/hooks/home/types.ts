
import { 
  Recommendation,
  RecommendationCategory, 
  RecommendationVisibility,
  Entity
} from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

export type HomeVisibility = 'for_you' | 'following';

export interface HomeItem extends Recommendation {
  likes: number;
  is_liked: boolean;
  is_saved: boolean;
  username: string | null;
  avatar_url: string | null;
  comment_count: number;
}

// Export this explicitly to fix the import error
export type RecommendationHomeItem = HomeItem;

export interface PostHomeItem {
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
}

export type CombinedHomeItem = HomeItem | PostHomeItem;

export interface HomeState {
  items: CombinedHomeItem[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  page: number;
  isLoadingMore: boolean;
}

export interface HomeQueryParams {
  userId: string;
  page: number;
  itemsPerPage: number;
}
