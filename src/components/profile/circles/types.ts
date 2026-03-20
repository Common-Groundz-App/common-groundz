
export type UserProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  isFollowing?: boolean;
  first_name?: string | null;
  last_name?: string | null;
};

export interface EntityAdapter {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  type: string;
  venue?: string;
  api_ref?: string;
  api_source?: string;
  metadata?: Record<string, any>;
}
