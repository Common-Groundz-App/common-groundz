
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
  
  // These fields will be populated by our API
  username?: string | null;
  avatar_url?: string | null;
  replies_count?: number;
  is_own_comment?: boolean;
}

export type CommentTarget = {
  type: 'post';
  id: string;
} | {
  type: 'recommendation';
  id: string;
};

export interface CreateCommentParams {
  content: string;
  target: CommentTarget;
  parent_id?: string;
}

export interface FetchCommentsParams {
  target: CommentTarget;
  parent_id?: string | null;
}
