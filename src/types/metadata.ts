/**
 * Type-safe metadata structures for different entity types
 */

import { Entity } from '@/services/recommendation/types';

// Base stored photo structure (used by Google Places entities)
export interface StoredPhotoUrl {
  reference: string;        // Original Google photo_reference
  storedUrl: string;        // Permanent Supabase Storage URL
  width: number;            // Original image width
  height: number;           // Original image height
  uploadedAt?: string;      // ISO timestamp of when photo was stored
}

// Google Places-specific metadata
export interface GooglePlacesMetadata {
  place_id: string;
  photo_reference?: string;  // Legacy single photo reference
  photo_references?: Array<{
    photo_reference: string;
    width: number;
    height: number;
  }>;
  stored_photo_urls?: StoredPhotoUrl[];  // NEW: Permanent storage URLs
  location?: {
    lat: number;
    lng: number;
  };
  opening_hours?: any;
  types?: string[];
  geometry?: any;
  rating?: number;
  user_ratings_total?: number;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  last_refreshed_at?: string;  // ISO timestamp of last Google API call
}

// Book metadata
export interface BookMetadata {
  isbn?: string;
  authors?: string[];
  publication_year?: number;
  publisher?: string;
  page_count?: number;
  language?: string;
}

// Movie metadata
export interface MovieMetadata {
  release_date?: string;
  runtime?: number;
  director?: string;
  cast?: string[];
  genres?: string[];
  imdb_id?: string;
}

// Product metadata
export interface ProductMetadata {
  brand?: string;
  model?: string;
  price?: number;
  currency?: string;
  availability?: string;
  specifications?: Record<string, any>;
}

// Food metadata
export interface FoodMetadata {
  cuisine?: string;
  dietary_restrictions?: string[];
  ingredients?: string[];
  nutritional_info?: Record<string, any>;
}

// Union type for all metadata
export type EntityMetadata = 
  | GooglePlacesMetadata 
  | BookMetadata 
  | MovieMetadata 
  | ProductMetadata 
  | FoodMetadata 
  | Record<string, any>;  // Fallback for unknown types

/**
 * Type guard to check if entity has Google Places metadata with stored photos
 */
export function hasStoredPhotos(entity: Entity): entity is Entity & { 
  metadata: GooglePlacesMetadata & { stored_photo_urls: StoredPhotoUrl[] } 
} {
  return (
    entity.api_source === 'google_places' &&
    entity.metadata !== undefined &&
    'stored_photo_urls' in entity.metadata &&
    Array.isArray(entity.metadata.stored_photo_urls) &&
    entity.metadata.stored_photo_urls.length > 0
  );
}

/**
 * Type guard to check if entity has legacy photo references
 */
export function hasPhotoReferences(entity: Entity): entity is Entity & { 
  metadata: GooglePlacesMetadata & { photo_references: Array<{photo_reference: string}> } 
} {
  return (
    entity.api_source === 'google_places' &&
    entity.metadata !== undefined &&
    'photo_references' in entity.metadata &&
    Array.isArray(entity.metadata.photo_references)
  );
}
