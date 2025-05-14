
// Re-export the types from the parent directory
export * from '../types';

// Additional types for better entity handling
export interface EntityMetadata {
  formatted_address?: string;
  place_id?: string;
  rating?: number;
  price_level?: number;
  types?: string[];
  total_ratings?: number;
  website?: string;
  phone?: string;
  opening_hours?: {
    open_now?: boolean;
    periods?: any[];
    weekday_text?: string[];
  };
  [key: string]: any;
}

export interface EntityData {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  venue?: string;
  api_source?: string;
  metadata?: EntityMetadata;
  source_id?: string;
  created_at?: string;
}

export interface ReviewEntityRelation {
  entity_id: string;
  review_id: string;
  entity?: EntityData;
}
