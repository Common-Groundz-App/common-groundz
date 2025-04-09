
import { PostFeedItem } from '../../types';
import { Entity } from '@/services/recommendation/types';

// Re-export PostFeedItem for convenient import
export type { PostFeedItem };

// Key data return types
export interface PostsQueryResult {
  posts: any[];
  userIds: string[];
}

export interface EntitiesByPostId {
  [postId: string]: Entity[];
}
