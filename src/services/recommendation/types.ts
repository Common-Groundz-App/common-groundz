
export interface Entity {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  api_ref?: string;
  api_source?: string;
  metadata?: Record<string, any>;
  venue?: string;
  website_url?: string;
  type: EntityType;
  slug?: string;
  category_id?: string;
  popularity_score?: number;
  photo_reference?: string;
  created_at?: string;
  updated_at?: string;
  is_claimed?: boolean;
  parent_id?: string;
  
  // Enhanced metadata fields
  authors?: string[];
  publication_year?: number;
  isbn?: string;
  languages?: string[];
  external_ratings?: Record<string, any>;
  price_info?: Record<string, any>;
  specifications?: Record<string, any>;
  cast_crew?: Record<string, any>;
  ingredients?: string[];
  nutritional_info?: Record<string, any>;
  last_enriched_at?: string;
  enrichment_source?: string;
  data_quality_score?: number;
}

export enum EntityType {
  Movie = 'movie',
  Book = 'book',
  Food = 'food',
  Product = 'product',
  Place = 'place',
  Activity = 'activity',
  Music = 'music',
  Art = 'art',
  TV = 'tv',
  Drink = 'drink',
  Travel = 'travel',
  Brand = 'brand',
  Event = 'event',
  Service = 'service',
  Professional = 'professional',
  Others = 'others'
}

export enum RecommendationCategory {
  Food = 'Food',
  Drink = 'Drink',
  Movie = 'Movie',
  Book = 'Book',
  Place = 'Place',
  Product = 'Product',
  Activity = 'Activity',
  Music = 'Music',
  Art = 'Art',
  TV = 'TV',
  Travel = 'Travel',
  Brand = 'Brand'
}

export enum RecommendationVisibility {
  Public = 'public',
  Private = 'private',
  FriendsOnly = 'friends_only'
}

// Legacy recommendation interface for backward compatibility
// This will be replaced by RecommendationWithUser in Phase 4
export interface Recommendation {
  id: string;
  user_id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  category: RecommendationCategory;
  rating: number;
  venue?: string;
  entity_id?: string;
  entity?: Entity;
  visibility: RecommendationVisibility;
  is_certified: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  
  // Profile fields - these will be removed in Phase 4
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  media?: any[];
  username?: string | null;
  avatar_url?: string | null;
}
