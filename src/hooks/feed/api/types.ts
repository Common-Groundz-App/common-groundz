
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

// Mapping functions to convert between string literals and enum values.
//
// `mapStringToEntityType` is an EXTERNAL BOUNDARY parser: it accepts legacy
// aliases on the way in (old rows/URLs) but never produces a legacy value.
// Unknown input returns `null` — there is no silent fallback to `product`.
export function mapStringToEntityType(stringType: string): EntityType | null {
  const canonical = parseEntityTypeAtBoundary(stringType);
  return canonical ? (canonical as unknown as EntityType) : null;
}

// Canonical enum -> canonical string. Total function: every EntityType member is
// already a canonical string value.
export function mapEntityTypeToString(enumType: EntityType): EntityTypeString {
  return enumType as unknown as EntityTypeString;
}

