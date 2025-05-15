
// Re-export the types from the parent directory
export * from '../types';

// Add string literal compatibility types for existing components
export type EntityTypeString = 'movie' | 'book' | 'food' | 'product' | 'place';

// Mapping function to convert between string literals and enum values
export function mapStringToEntityType(stringType: EntityTypeString): import('@/services/recommendation/types').EntityType {
  switch (stringType) {
    case 'movie': return import('@/services/recommendation/types').EntityType.Movie;
    case 'book': return import('@/services/recommendation/types').EntityType.Book;
    case 'food': return import('@/services/recommendation/types').EntityType.Food;
    case 'product': return import('@/services/recommendation/types').EntityType.Product;
    case 'place': return import('@/services/recommendation/types').EntityType.Place;
    default: return import('@/services/recommendation/types').EntityType.Place;
  }
}

export function mapEntityTypeToString(enumType: import('@/services/recommendation/types').EntityType): EntityTypeString {
  switch (enumType) {
    case import('@/services/recommendation/types').EntityType.Movie: return 'movie';
    case import('@/services/recommendation/types').EntityType.Book: return 'book';
    case import('@/services/recommendation/types').EntityType.Food: return 'food';
    case import('@/services/recommendation/types').EntityType.Product: return 'product';
    case import('@/services/recommendation/types').EntityType.Place: return 'place';
    default: return 'place';
  }
}
