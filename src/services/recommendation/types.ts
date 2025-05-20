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
  photo_reference?: string; // Added this missing property
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
  Travel = 'travel'
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
  Travel = 'Travel'
}

export enum RecommendationVisibility {
  Public = 'public',
  Private = 'private',
  FriendsOnly = 'friends_only'
}

export interface Recommendation {
  id: string;
  user_id: string;
  title: string;
  subtitle?: string; // Added subtitle field for review headlines/titles
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
  
  // Additional fields that can be populated
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  media?: any[];
  username?: string | null;
  avatar_url?: string | null;
}
