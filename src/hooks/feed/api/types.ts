
// Re-export the types from the parent directory
export * from '../types';

// Import the EntityType enum directly
import { EntityType } from '@/services/recommendation/types';

// Add string literal compatibility types for existing components - expanded to include all entity types
export type EntityTypeString = 'movie' | 'book' | 'food' | 'product' | 'place' | 'music' | 'tv' | 'art' | 'activity' | 'drink' | 'travel' | 'people' | 'brand';

// Mapping functions to convert between string literals and enum values
export function mapStringToEntityType(stringType: EntityTypeString): EntityType {
  switch (stringType) {
    case 'movie': return EntityType.Movie;
    case 'book': return EntityType.Book;
    case 'food': return EntityType.Food;
    case 'product': return EntityType.Product;
    case 'place': return EntityType.Place;
    case 'music': return EntityType.Music;
    case 'tv': return EntityType.TV;
    case 'art': return EntityType.Art;
    case 'activity': return EntityType.Activity;
    case 'drink': return EntityType.Drink;
    case 'travel': return EntityType.Travel;
    case 'brand': return EntityType.Brand;
    case 'people': return EntityType.Place; // Map people to Place enum since it's not a true entity type
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
    case EntityType.Music: return 'music';
    case EntityType.TV: return 'tv';
    case EntityType.Art: return 'art';
    case EntityType.Activity: return 'activity';
    case EntityType.Drink: return 'drink';
    case EntityType.Travel: return 'travel';
    case EntityType.Brand: return 'brand';
    default: return 'place';
  }
}
