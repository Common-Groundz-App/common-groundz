
import { EntityType } from '@/services/recommendation/types';

// Database-supported entity types (from the database schema)
const DATABASE_SUPPORTED_TYPES: EntityType[] = [
  EntityType.Book,
  EntityType.Movie, 
  EntityType.Food,
  EntityType.Product,
  EntityType.Place
];

// Mapping from unsupported types to database-supported types
const TYPE_MAPPING: Partial<Record<EntityType, EntityType>> = {
  // Supported types map to themselves
  [EntityType.Book]: EntityType.Book,
  [EntityType.Movie]: EntityType.Movie,
  [EntityType.Food]: EntityType.Food,
  [EntityType.Product]: EntityType.Product,
  [EntityType.Place]: EntityType.Place,
  
  // Unsupported types map to closest supported type
  [EntityType.TV]: EntityType.Movie,        // TV shows are similar to movies
  [EntityType.TVShow]: EntityType.Movie,    // TV shows are similar to movies
  [EntityType.Music]: EntityType.Product,   // Music albums/songs as products
  [EntityType.Art]: EntityType.Product,     // Art pieces as products
  [EntityType.Drink]: EntityType.Food,      // Drinks are food-related
  [EntityType.Travel]: EntityType.Place,    // Travel destinations are places
  [EntityType.Activity]: EntityType.Place,  // Activities happen at places
  [EntityType.Experience]: EntityType.Place, // Experiences happen at places
  [EntityType.Brand]: EntityType.Product,   // Brands are product-related
  [EntityType.Event]: EntityType.Place,     // Events happen at places
  [EntityType.Service]: EntityType.Product, // Services are product-like
  [EntityType.Professional]: EntityType.Product, // Professionals offer services/products
  [EntityType.Others]: EntityType.Product,   // Default fallback to product
  [EntityType.Course]: EntityType.Product,   // Courses as products
  [EntityType.App]: EntityType.Product,      // Apps as products
  [EntityType.Game]: EntityType.Product      // Games as products
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
      return 'Studio';
    case EntityType.Place:
      return 'Location';
    case EntityType.Product:
      return 'Brand';
    case EntityType.Food:
      return 'Venue';
    default:
      return 'Source';
  }
};

/**
 * Gets fallback image URL based on mapped type
 */
export const getEntityTypeFallbackImage = (type: EntityType): string => {
  const mappedType = mapEntityTypeToDatabase(type);
  
  const fallbacks: Partial<Record<EntityType, string>> = {
    [EntityType.Movie]: 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
    [EntityType.Book]: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    [EntityType.Food]: 'https://images.unsplash.com/photo-1555939594-58d7698950b',
    [EntityType.Place]: 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
    [EntityType.Product]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    // Fallback mappings for unsupported types (won't be used due to mapping above)
    [EntityType.Activity]: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
    [EntityType.Music]: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    [EntityType.Art]: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
    [EntityType.TV]: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
    [EntityType.Drink]: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
    [EntityType.Travel]: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7',
    [EntityType.Brand]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    [EntityType.Event]: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
    [EntityType.Service]: 'https://images.unsplash.com/photo-1556761175-b413da4baf72',
    [EntityType.Professional]: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf',
    [EntityType.Others]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86'
  };

  return fallbacks[mappedType] || fallbacks[EntityType.Product]!;
};
