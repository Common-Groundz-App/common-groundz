
export interface ReviewUpdate {
  id: string;
  review_id: string;
  user_id: string;
  rating: number | null;
  comment: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
  user: {
    displayName: string;
    avatar_url: string | null;
  };
}
