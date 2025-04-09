
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
  
  // Joined fields from profiles
  username?: string;
  avatar_url?: string;
  
  // Calculated fields
  like_count?: number;
  is_liked?: boolean;
  reply_count?: number;
}

export interface CommentInput {
  content: string;
  user_id: string; // Added required user_id
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string;
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentListParams {
  post_id?: string;
  recommendation_id?: string;
  parent_id?: string | null;
  limit?: number;
  offset?: number;
}
