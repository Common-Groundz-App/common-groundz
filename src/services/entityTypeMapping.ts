
import { EntityType } from './recommendation/types';

// Map database entity types to application entity types safely
export const mapDatabaseEntityType = (dbType: string): EntityType => {
  const typeMap: Record<string, EntityType> = {
    'book': EntityType.Book,
    'movie': EntityType.Movie,
    'place': EntityType.Place,
    'product': EntityType.Product,
    'food': EntityType.Food,
    // Map unsupported types to supported ones
    'drink': EntityType.Food,
    'music': EntityType.Product,
    'art': EntityType.Product,
    'tv': EntityType.Movie,
    'travel': EntityType.Place,
    'activity': EntityType.Place
  };
  
  return typeMap[dbType.toLowerCase()] || EntityType.Product;
};

// Get display-friendly type name
export const getEntityTypeDisplayName = (type: EntityType): string => {
  const displayNames: Record<EntityType, string> = {
    [EntityType.Book]: 'Book',
    [EntityType.Movie]: 'Movie',
    [EntityType.Place]: 'Place',
    [EntityType.Product]: 'Product',
    [EntityType.Food]: 'Food',
    [EntityType.Drink]: 'Drink',
    [EntityType.Music]: 'Music',
    [EntityType.Art]: 'Art',
    [EntityType.TV]: 'TV Show',
    [EntityType.Travel]: 'Travel',
    [EntityType.Activity]: 'Activity'
  };
  
  return displayNames[type] || 'Item';
};

// Get fallback image for entity type
export const getEntityTypeFallbackImage = (type: EntityType): string => {
  const fallbacks: Record<EntityType, string> = {
    [EntityType.Movie]: 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
    [EntityType.Book]: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    [EntityType.Food]: 'https://images.unsplash.com/photo-1555939594-58d7698950b',
    [EntityType.Place]: 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
    [EntityType.Product]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    [EntityType.Activity]: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
    [EntityType.Music]: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    [EntityType.Art]: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
    [EntityType.TV]: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
    [EntityType.Drink]: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
    [EntityType.Travel]: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7'
  };
  
  return fallbacks[type] || 'https://images.unsplash.com/photo-1501854140801-50d01698950b';
};

// Safe switch statement helper
export const getEntityTypeAction = <T>(
  type: EntityType,
  actions: Partial<Record<EntityType, T>>,
  defaultAction: T
): T => {
  return actions[type] || defaultAction;
};
