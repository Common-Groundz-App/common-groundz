
// Re-export the types from the parent directory
export * from '../types';

// Import the EntityType enum directly
import { EntityType } from '@/services/recommendation/types';

// Add string literal compatibility types for existing components - expanded to include all entity types
export type EntityTypeString = 
  | 'movie'
  | 'book'
  | 'food'
  | 'product'
  | 'place'
  | 'brand'
  | 'event'
  | 'service'
  | 'professional'
  | 'others'
  // New canonical types
  | 'tv_show'
  | 'course'
  | 'app'
  | 'game'
  | 'experience'
  // Legacy types (for backward compatibility)
  | 'music'
  | 'tv'
  | 'art'
  | 'activity'
  | 'drink'
  | 'travel'
  | 'people';

// Mapping functions to convert between string literals and enum values
export function mapStringToEntityType(stringType: EntityTypeString): EntityType {
  switch (stringType) {
    // Canonical types
    case 'movie': return EntityType.Movie;
    case 'book': return EntityType.Book;
    case 'food': return EntityType.Food;
    case 'product': return EntityType.Product;
    case 'place': return EntityType.Place;
    case 'brand': return EntityType.Brand;
    case 'event': return EntityType.Event;
    case 'service': return EntityType.Service;
    case 'professional': return EntityType.Professional;
    case 'others': return EntityType.Others;
    // New canonical types
    case 'tv_show': return EntityType.TVShow;
    case 'course': return EntityType.Course;
    case 'app': return EntityType.App;
    case 'game': return EntityType.Game;
    case 'experience': return EntityType.Experience;
    // Legacy types (kept for backward compatibility)
    case 'tv': return EntityType.TV;
    case 'activity': return EntityType.Activity;
    case 'music': return EntityType.Music;
    case 'art': return EntityType.Art;
    case 'drink': return EntityType.Drink;
    case 'travel': return EntityType.Travel;
    case 'people': return EntityType.Professional;
    default: return EntityType.Product;
  }
}

export function mapEntityTypeToString(enumType: EntityType): EntityTypeString {
  switch (enumType) {
    // Canonical types
    case EntityType.Movie: return 'movie';
    case EntityType.Book: return 'book';
    case EntityType.Food: return 'food';
    case EntityType.Product: return 'product';
    case EntityType.Place: return 'place';
    case EntityType.Brand: return 'brand';
    case EntityType.Event: return 'event';
    case EntityType.Service: return 'service';
    case EntityType.Professional: return 'professional';
    case EntityType.Others: return 'others';
    // New canonical types
    case EntityType.TVShow: return 'tv_show';
    case EntityType.Course: return 'course';
    case EntityType.App: return 'app';
    case EntityType.Game: return 'game';
    case EntityType.Experience: return 'experience';
    // Legacy types (collapse to canonical equivalents)
    case EntityType.TV: return 'tv_show';
    case EntityType.Activity: return 'experience';
    case EntityType.Music: return 'product';
    case EntityType.Art: return 'product';
    case EntityType.Drink: return 'food';
    case EntityType.Travel: return 'place';
    default: return 'product';
  }
}
