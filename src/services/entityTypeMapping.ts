
import { EntityType } from '@/services/recommendation/types';

// Database-supported entity types (from the database schema) - updated for Phase 1
const DATABASE_SUPPORTED_TYPES: EntityType[] = [
  EntityType.Product,
  EntityType.Place, 
  EntityType.Book,
  EntityType.Movie,
  EntityType.TvShow,
  EntityType.Course,
  EntityType.App,
  EntityType.Game,
  EntityType.Experience,
  EntityType.Brand
];

// Type mapping for all entity types - all are now supported
const TYPE_MAPPING: Record<EntityType, EntityType> = {
  [EntityType.Product]: EntityType.Product,
  [EntityType.Place]: EntityType.Place,
  [EntityType.Book]: EntityType.Book,
  [EntityType.Movie]: EntityType.Movie,
  [EntityType.TvShow]: EntityType.TvShow,
  [EntityType.Course]: EntityType.Course,
  [EntityType.App]: EntityType.App,
  [EntityType.Game]: EntityType.Game,
  [EntityType.Experience]: EntityType.Experience,
  [EntityType.Brand]: EntityType.Brand
};

/**
 * Maps any EntityType to a database-supported EntityType
 */
export const mapEntityTypeToDatabase = (type: EntityType): EntityType => {
  return TYPE_MAPPING[type] || EntityType.Product; // Default fallback
};

/**
 * Checks if an entity type is directly supported by the database
 */
export const isDatabaseSupportedType = (type: EntityType): boolean => {
  return DATABASE_SUPPORTED_TYPES.includes(type);
};

/**
 * Gets the display label for contextual field based on mapped type
 */
export const getContextualFieldLabel = (type: EntityType): string => {
  const mappedType = mapEntityTypeToDatabase(type);
  
  switch (mappedType) {
    case EntityType.Book:
      return 'Author';
    case EntityType.Movie:
    case EntityType.TvShow:
      return 'Studio';
    case EntityType.Place:
      return 'Location';
    case EntityType.Product:
      return 'Brand';
    case EntityType.Course:
      return 'Instructor';
    case EntityType.App:
      return 'Developer';
    case EntityType.Game:
      return 'Developer';
    case EntityType.Experience:
      return 'Organizer';
    case EntityType.Brand:
      return 'Parent Company';
    default:
      return 'Source';
  }
};

/**
 * Gets fallback image URL based on mapped type
 */
export const getEntityTypeFallbackImage = (type: EntityType): string => {
  const mappedType = mapEntityTypeToDatabase(type);
  
  const fallbacks: Record<EntityType, string> = {
    [EntityType.Product]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    [EntityType.Place]: 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
    [EntityType.Book]: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    [EntityType.Movie]: 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
    [EntityType.TvShow]: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
    [EntityType.Course]: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8',
    [EntityType.App]: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
    [EntityType.Game]: 'https://images.unsplash.com/photo-1511512578047-dfb367046420',
    [EntityType.Experience]: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
    [EntityType.Brand]: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43'
  };

  return fallbacks[mappedType] || fallbacks[EntityType.Product];
};
