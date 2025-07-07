import { Database } from '@/integrations/supabase/types';
import { Entity } from '@/services/recommendation/types';

// Use database types directly
export type EntityTypeString = Database["public"]["Enums"]["entity_type"];

export interface FeedItem {
  id: string;
  created_at: string;
  type: 'recommendation' | 'review' | 'post';
  title: string;
  description?: string;
  image_url?: string;
  entity?: Entity;
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  comment_count?: number;
}
