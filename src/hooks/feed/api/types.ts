
// Re-export the types from the parent directory
export * from '../types';

// Import the EntityType enum directly
import { EntityType } from '@/services/recommendation/types';

// Add string literal compatibility types for existing components
export type EntityTypeString = 'movie' | 'book' | 'food' | 'product' | 'place' | 'tv' | 'activity';

// Mapping functions to convert between string literals and enum values
export function mapStringToEntityType(stringType: EntityTypeString): EntityType {
  switch (stringType) {
    case 'movie': return EntityType.Movie;
    case 'book': return EntityType.Book;
    case 'food': return EntityType.Food;
    case 'product': return EntityType.Product;
    case 'place': return EntityType.Place;
    case 'tv': return EntityType.TV;
    case 'activity': return EntityType.Activity;
    default: return EntityType.Place;
  }
}

export function mapEntityTypeToString(enumType: EntityType): EntityTypeString {
  switch (enumType) {
    case EntityType.Movie: return 'movie';
    case EntityType.Book: return 'book';
    case EntityType.Food: return 'food';
    case EntityType.Product: return 'product';
    case EntityType.Place: return 'place';
    case EntityType.TV: return 'tv';
    case EntityType.Activity: return 'activity';
    default: return 'place';
  }
}
