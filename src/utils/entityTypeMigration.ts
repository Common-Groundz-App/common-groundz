/**
 * Migration utilities to handle the transition from old entity types to new ones
 * This file helps bridge the gap during Phase 1 migration
 */

import { EntityType } from '@/services/recommendation/types';

// Legacy entity type strings that need migration
export type LegacyEntityTypeString = 'food' | 'tv' | 'music' | 'art' | 'activity' | 'drink' | 'travel' | 'people';

// Complete entity type string including both new and legacy
export type AllEntityTypeString = 'product' | 'place' | 'book' | 'movie' | 'tv_show' | 'course' | 'app' | 'game' | 'experience' | 'brand' | LegacyEntityTypeString;

/**
 * Migrate legacy entity type strings to new entity types
 */
export function migrateLegacyEntityType(legacyType: string): EntityType {
  switch (legacyType) {
    // Legacy mappings to new types
    case 'food':
    case 'drink':
      return EntityType.Product; // Food/drink items become products
    case 'tv':
      return EntityType.TvShow;
    case 'music':
    case 'art':
      return EntityType.Product; // Music/art become products
    case 'activity':
    case 'travel':
      return EntityType.Experience; // Activities/travel become experiences
    case 'people':
      return EntityType.Brand; // People become brands/organizations
    
    // New types map directly
    case 'product':
      return EntityType.Product;
    case 'place':
      return EntityType.Place;
    case 'book':
      return EntityType.Book;
    case 'movie':
      return EntityType.Movie;
    case 'tv_show':
      return EntityType.TvShow;
    case 'course':
      return EntityType.Course;
    case 'app':
      return EntityType.App;
    case 'game':
      return EntityType.Game;
    case 'experience':
      return EntityType.Experience;
    case 'brand':
      return EntityType.Brand;
    
    default:
      return EntityType.Product; // Default fallback
  }
}

/**
 * Convert entity type enum to string for backward compatibility
 */
export function entityTypeToString(type: EntityType): string {
  switch (type) {
    case EntityType.Product:
      return 'product';
    case EntityType.Place:
      return 'place';
    case EntityType.Book:
      return 'book';
    case EntityType.Movie:
      return 'movie';
    case EntityType.TvShow:
      return 'tv_show';
    case EntityType.Course:
      return 'course';
    case EntityType.App:
      return 'app';
    case EntityType.Game:
      return 'game';
    case EntityType.Experience:
      return 'experience';
    case EntityType.Brand:
      return 'brand';
    default:
      return 'product';
  }
}

/**
 * Check if a string is a legacy entity type
 */
export function isLegacyEntityType(type: string): type is LegacyEntityTypeString {
  return ['food', 'tv', 'music', 'art', 'activity', 'drink', 'travel', 'people'].includes(type);
}

/**
 * Get display name for entity type (both legacy and new)
 */
export function getEntityTypeDisplayName(type: string | EntityType): string {
  if (typeof type === 'string') {
    type = migrateLegacyEntityType(type);
  }
  
  switch (type) {
    case EntityType.Product:
      return 'Product';
    case EntityType.Place:
      return 'Place';
    case EntityType.Book:
      return 'Book';
    case EntityType.Movie:
      return 'Movie';
    case EntityType.TvShow:
      return 'TV Show';
    case EntityType.Course:
      return 'Course';
    case EntityType.App:
      return 'App';
    case EntityType.Game:
      return 'Game';
    case EntityType.Experience:
      return 'Experience';
    case EntityType.Brand:
      return 'Brand';
    default:
      return 'Product';
  }
}