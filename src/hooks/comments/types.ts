
import { Profile } from '@/services/profileService';

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id?: string | null;
  recommendation_id?: string | null;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  
  // Joined fields
  username?: string | null;
  avatar_url?: string | null;
  is_liked?: boolean;
  like_count?: number;
  reply_count?: number;
}

export interface CommentWithUser extends Comment {
  profile?: Profile;
}

export interface CreateCommentPayload {
  content: string;
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string;
}

export interface UpdateCommentPayload {
  content: string;
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentQueryParams {
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string | null;
  limit?: number;
  offset?: number;
}
