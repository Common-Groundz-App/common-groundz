// TypeScript interfaces for entity type-specific metadata

export interface BookMetadata {
  publisher?: string;
  page_count?: number;
  format?: 'Hardcover' | 'Paperback' | 'eBook' | 'Audiobook';
}

export interface MovieMetadata {
  genres?: string[];
  content_rating?: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17' | 'Not Rated';
  imdb_id?: string;
}

export interface TVShowMetadata {
  genres?: string[];
  content_rating?: 'TV-Y' | 'TV-Y7' | 'TV-G' | 'TV-PG' | 'TV-14' | 'TV-MA';
  status?: 'Ongoing' | 'Ended' | 'Cancelled' | 'Upcoming';
}

export interface PlaceMetadata {
  location_type?: 'Indoor' | 'Outdoor' | 'Mixed';
  accessibility?: string[];
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  atmosphere?: string[];
}

export interface FoodMetadata {
  cuisines?: string[];
  dietary_tags?: string[];
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  meal_type?: string[];
}

export interface ProductMetadata {
  brand?: string;
  characteristics?: string[];
}

export interface AppMetadata {
  developer?: string;
  app_store_link?: string;
  play_store_link?: string;
}

export interface GameMetadata {
  genre?: string[];
  developer?: string;
  publisher?: string;
  esrb_rating?: 'E' | 'E10+' | 'T' | 'M' | 'AO' | 'RP';
}

export interface CourseMetadata {
  instructor: string;
  platform?: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  certificate?: 'Yes' | 'No' | 'Paid';
}

export interface ExperienceMetadata {
  location_type?: 'Indoor' | 'Outdoor' | 'Mixed';
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  accessibility?: string[];
}

export type EntityMetadata = 
  | BookMetadata 
  | MovieMetadata 
  | TVShowMetadata 
  | PlaceMetadata 
  | FoodMetadata 
  | ProductMetadata 
  | AppMetadata 
  | GameMetadata 
  | CourseMetadata 
  | ExperienceMetadata;
