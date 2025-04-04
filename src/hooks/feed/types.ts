
import { 
  Recommendation,
  RecommendationCategory, 
  RecommendationVisibility 
} from '@/services/recommendationService';

export type FeedVisibility = 'for_you' | 'following';

export interface FeedItem extends Recommendation {
  likes: number;
  is_liked: boolean;
  is_saved: boolean;
  username: string | null;
  avatar_url: string | null;
}

export interface FeedState {
  items: FeedItem[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  page: number;
  isLoadingMore: boolean;
}
