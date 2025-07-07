
import { Database } from '@/integrations/supabase/types';

// Use database types directly
export type EntityTypeString = Database["public"]["Enums"]["entity_type"];

export interface FeedParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
  category?: string;
  type?: string;
  query?: string;
  user_id?: string;
  visibility?: 'public' | 'private' | 'friends_only';
}

// Entity type mapping utilities
export const mapStringToEntityType = (str: string): EntityTypeString => {
  const validTypes: EntityTypeString[] = ['book', 'movie', 'place', 'product', 'food'];
  return validTypes.includes(str as EntityTypeString) ? str as EntityTypeString : 'place';
};

export const mapEntityTypeToString = (type: EntityTypeString): string => {
  return type;
};
