
/**
 * Common utility types shared across the application
 */

import { SafeUserProfile } from './profile';

// Generic type to add user profile data to any entity
export interface WithUserProfile<T = {}> {
  user_id: string;
  user: SafeUserProfile;
}

// Standard interaction data for likes, saves, etc.
export interface InteractionData {
  likes: number;
  isLiked: boolean;
  isSaved: boolean;
}

// Entity reference structure
export interface EntityReference {
  id: string;
  name: string;
  type: string;
  slug?: string;
  image_url?: string;
}

// Comment metadata
export interface CommentMetadata {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  is_deleted: boolean;
}

// Standard timestamps
export interface Timestamps {
  created_at: string;
  updated_at: string;
}

// Visibility options
export type Visibility = 'public' | 'private' | 'friends_only';

// Media item structure
export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  thumbnail_url?: string;
  alt_text?: string;
}
