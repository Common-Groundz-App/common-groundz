
// Re-export the types from the parent directory
export * from '../types';

// Import the EntityType enum directly
import { EntityType } from '@/services/recommendation/types';

// Updated string literal compatibility types for new entity architecture (includes legacy during migration)
export type EntityTypeString = 'product' | 'place' | 'book' | 'movie' | 'tv_show' | 'course' | 'app' | 'game' | 'experience' | 'brand' | 'food' | 'tv' | 'music' | 'art' | 'activity' | 'drink' | 'travel' | 'people';

// Mapping functions to convert between string literals and enum values (with legacy support)
export function mapStringToEntityType(stringType: EntityTypeString): EntityType {
  switch (stringType) {
    // New types
    case 'product': return EntityType.Product;
    case 'place': return EntityType.Place;
    case 'book': return EntityType.Book;
    case 'movie': return EntityType.Movie;
    case 'tv_show': return EntityType.TvShow;
    case 'course': return EntityType.Course;
    case 'app': return EntityType.App;
    case 'game': return EntityType.Game;
    case 'experience': return EntityType.Experience;
    case 'brand': return EntityType.Brand;
    
    // Legacy types mapped to new types
    case 'food':
    case 'drink':
      return EntityType.Product;
    case 'tv':
      return EntityType.TvShow;
    case 'music':
    case 'art':
      return EntityType.Product;
    case 'activity':
    case 'travel':
      return EntityType.Experience;
    case 'people':
      return EntityType.Brand;
    
    default: return EntityType.Product;
  }
}

export function mapEntityTypeToString(enumType: EntityType): EntityTypeString {
  switch (enumType) {
    case EntityType.Product: return 'product';
    case EntityType.Place: return 'place';
    case EntityType.Book: return 'book';
    case EntityType.Movie: return 'movie';
    case EntityType.TvShow: return 'tv_show';
    case EntityType.Course: return 'course';
    case EntityType.App: return 'app';
    case EntityType.Game: return 'game';
    case EntityType.Experience: return 'experience';
    case EntityType.Brand: return 'brand';
    default: return 'product';
  }
}
