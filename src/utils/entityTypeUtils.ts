
import { Entity, EntityType } from '@/services/recommendation/types';

/**
 * Safely converts Supabase Json type to Record<string, any>
 */
export const parseMetadata = (metadata: any): Record<string, any> => {
  if (!metadata) return {};
  
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  
  if (typeof metadata === 'object' && metadata !== null) {
    return metadata as Record<string, any>;
  }
  
  return {};
};

/**
 * Converts a raw database entity to our Entity interface
 */
export const convertToEntity = (rawEntity: any): Entity => {
  return {
    ...rawEntity,
    metadata: parseMetadata(rawEntity.metadata),
    type: rawEntity.type as EntityType,
    is_deleted: rawEntity.is_deleted ?? false,
  };
};

/**
 * Converts an array of raw database entities to Entity array
 */
export const convertToEntities = (rawEntities: any[]): Entity[] => {
  return rawEntities.map(convertToEntity);
};

/**
 * Safely converts string type to EntityType enum
 */
export const stringToEntityType = (type: string): EntityType => {
  const typeMap: Record<string, EntityType> = {
    'movie': EntityType.Movie,
    'book': EntityType.Book,
    'food': EntityType.Food,
    'product': EntityType.Product,
    'place': EntityType.Place,
    'activity': EntityType.Activity,
    'music': EntityType.Music,
    'art': EntityType.Art,
    'tv': EntityType.TV,
    'drink': EntityType.Drink,
    'travel': EntityType.Travel,
  };
  
  return typeMap[type.toLowerCase()] || EntityType.Product;
};

// Valid database entity types (matches Supabase entity_type enum)
type DatabaseEntityType = "movie" | "book" | "food" | "product" | "place";

/**
 * Converts EntityType enum to database string format
 * Only returns the 5 types supported by the database schema
 */
export const entityTypeToString = (type: EntityType): DatabaseEntityType => {
  const typeMap: Record<EntityType, DatabaseEntityType> = {
    [EntityType.Movie]: 'movie',
    [EntityType.Book]: 'book',
    [EntityType.Food]: 'food',
    [EntityType.Product]: 'product',
    [EntityType.Place]: 'place',
    // Map unsupported types to 'product' as fallback
    [EntityType.Activity]: 'product',
    [EntityType.Music]: 'product',
    [EntityType.Art]: 'product',
    [EntityType.TV]: 'movie', // TV shows map to movie category
    [EntityType.Drink]: 'food', // Drinks map to food category
    [EntityType.Travel]: 'place', // Travel maps to place category
  };
  
  return typeMap[type] || 'product';
};

/**
 * Gets the list of EntityTypes that are directly supported by the database
 */
export const getSupportedEntityTypes = (): EntityType[] => {
  return [
    EntityType.Movie,
    EntityType.Book,
    EntityType.Food,
    EntityType.Product,
    EntityType.Place
  ];
};
