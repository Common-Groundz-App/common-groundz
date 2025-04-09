
export interface Comment {
  id: string;
  user_id: string;
  post_id: string | null;
  recommendation_id: string | null;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface CommentWithUser extends Comment {
  username: string | null;
  avatar_url: string | null;
  likes_count: number;
  is_liked: boolean;
  replies_count: number;
}

export interface FetchCommentsParams {
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string | null;
  limit?: number;
  offset?: number;
}

export interface CreateCommentParams {
  content: string;
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string | null;
}

export interface UpdateCommentParams {
  id: string;
  content: string;
}
