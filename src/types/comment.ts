
export interface Comment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  post_id: string | null;
  recommendation_id: string | null;
  parent_id: string | null;
  is_deleted: boolean;
}

export interface CommentWithUser extends Comment {
  username: string | null;
  avatar_url: string | null;
}

export interface CommentWithReplies extends CommentWithUser {
  replies?: CommentWithUser[];
  replyCount?: number;
  loadingReplies?: boolean;
  showReplies?: boolean;
}
