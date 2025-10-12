/**
 * Canonical Entity Type Helpers
 * 
 * Centralized utilities for entity type handling across the application.
 * Supports both canonical (tv_show, experience, etc.) and legacy (tv, activity) types.
 */

import { EntityType } from './recommendation/types';
import { Database } from '@/integrations/supabase/types';

type DatabaseEntityType = Database['public']['Enums']['entity_type'];

/**
 * Map legacy type strings to canonical enum values
 */
export const getCanonicalType = (type: string): EntityType => {
  const lowerType = type.toLowerCase();
  
  // Priority 1: Collapse legacy types to canonical equivalents
  const legacyToCanonical: Record<string, EntityType> = {
    'tv': EntityType.TVShow,
    'activity': EntityType.Experience,
    'music': EntityType.Product,    // Semantic preservation via metadata.content_type
    'art': EntityType.Product,      // Semantic preservation via metadata.content_type
    'drink': EntityType.Food,       // Semantic preservation via metadata.subcategory
    'travel': EntityType.Place      // Semantic preservation via metadata.context
  };
  
  if (legacyToCanonical[lowerType]) {
    return legacyToCanonical[lowerType];
  }
  
  // Priority 2: Return canonical type if already valid
  const activeTypes = [
    'movie', 'book', 'tv_show', 'course', 'app', 'game', 'experience',
    'food', 'product', 'place', 'brand', 'event', 'service', 'professional', 'others'
  ];
  
  if (activeTypes.includes(lowerType)) {
    return lowerType as EntityType;
  }
  
  // Fallback
  return EntityType.Others;
};

/**
 * Get human-readable label for entity type
 */
export const getEntityTypeLabel = (type: string | EntityType): string => {
  const canonicalType = typeof type === 'string' ? getCanonicalType(type) : type;
  
  const labels: Record<EntityType, string> = {
    [EntityType.Movie]: 'Movie',
    [EntityType.Book]: 'Book',
    [EntityType.Food]: 'Food',
    [EntityType.Product]: 'Product',
    [EntityType.Place]: 'Place',
    [EntityType.Brand]: 'Brand',
    [EntityType.Event]: 'Event',
    [EntityType.Service]: 'Service',
    [EntityType.Professional]: 'Professional',
    [EntityType.Others]: 'Others',
    [EntityType.TVShow]: 'TV Show',
    [EntityType.Course]: 'Course',
    [EntityType.App]: 'App',
    [EntityType.Game]: 'Game',
    [EntityType.Experience]: 'Experience',
    // Legacy types
    [EntityType.TV]: 'TV Show',
    [EntityType.Activity]: 'Experience',
    [EntityType.Music]: 'Music',
    [EntityType.Art]: 'Art',
    [EntityType.Drink]: 'Drink',
    [EntityType.Travel]: 'Travel'
  };
  
  return labels[canonicalType] || 'Others';
};

/**
 * Get fallback image URL for entity type
 */
export const getEntityTypeFallbackImage = (type: string | EntityType): string => {
  const canonicalType = typeof type === 'string' ? getCanonicalType(type) : type;
  
  const fallbacks: Record<EntityType, string> = {
    [EntityType.Movie]: 'https://images.unsplash.com/photo-1485846234645-a62644f84728',
    [EntityType.Book]: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    [EntityType.Food]: 'https://images.unsplash.com/photo-1555939594-58d7698950b',
    [EntityType.Place]: 'https://images.unsplash.com/photo-1501854140801-50d01698950b',
    [EntityType.Product]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    [EntityType.Brand]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    [EntityType.Event]: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
    [EntityType.Service]: 'https://images.unsplash.com/photo-1556761175-b413da4baf72',
    [EntityType.Professional]: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf',
    [EntityType.Others]: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    [EntityType.TVShow]: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
    [EntityType.Course]: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1',
    [EntityType.App]: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
    [EntityType.Game]: 'https://images.unsplash.com/photo-1511512578047-dfb367046420',
    [EntityType.Experience]: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
    // Legacy types (map to canonical equivalents)
    [EntityType.TV]: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1',
    [EntityType.Activity]: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51',
    [EntityType.Music]: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    [EntityType.Art]: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b',
    [EntityType.Drink]: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87',
    [EntityType.Travel]: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7'
  };
  
  return fallbacks[canonicalType] || fallbacks[EntityType.Product];
};

/**
 * Get contextual field label based on entity type
 */
export const getContextualFieldLabel = (type: string | EntityType): string => {
  const canonicalType = typeof type === 'string' ? getCanonicalType(type) : type;
  
  const labels: Partial<Record<EntityType, string>> = {
    [EntityType.Book]: 'Author',
    [EntityType.Movie]: 'Studio',
    [EntityType.TVShow]: 'Network',
    [EntityType.Place]: 'Location',
    [EntityType.Product]: 'Brand',
    [EntityType.Food]: 'Venue',
    [EntityType.Course]: 'Instructor',
    [EntityType.App]: 'Developer',
    [EntityType.Game]: 'Studio',
    [EntityType.Experience]: 'Location'
  };
  
  return labels[canonicalType] || 'Source';
};

/**
 * Get icon name for entity type (compatible with Lucide icons)
 */
export const getEntityTypeIcon = (type: string | EntityType): string => {
  const canonicalType = typeof type === 'string' ? getCanonicalType(type) : type;
  
  const icons: Record<EntityType, string> = {
    [EntityType.Movie]: 'Film',
    [EntityType.Book]: 'BookOpen',
    [EntityType.Food]: 'UtensilsCrossed',
    [EntityType.Place]: 'MapPin',
    [EntityType.Product]: 'ShoppingBag',
    [EntityType.Brand]: 'Tag',
    [EntityType.Event]: 'Calendar',
    [EntityType.Service]: 'Wrench',
    [EntityType.Professional]: 'Briefcase',
    [EntityType.Others]: 'MoreHorizontal',
    [EntityType.TVShow]: 'Tv',
    [EntityType.Course]: 'GraduationCap',
    [EntityType.App]: 'Smartphone',
    [EntityType.Game]: 'Gamepad2',
    [EntityType.Experience]: 'Compass',
    // Legacy types
    [EntityType.TV]: 'Tv',
    [EntityType.Activity]: 'Compass',
    [EntityType.Music]: 'Music',
    [EntityType.Art]: 'Palette',
    [EntityType.Drink]: 'Coffee',
    [EntityType.Travel]: 'Plane'
  };
  
  return icons[canonicalType] || 'Circle';
};

/**
 * Check if a type string is valid against Supabase enum
 */
export const isValidEntityType = (type: string): boolean => {
  const validTypes = [
    'movie', 'book', 'tv_show', 'course', 'app', 'game', 'experience',
    'food', 'product', 'place', 'brand', 'event', 'service', 'professional', 'others',
    // Legacy types still in DB
    'tv', 'activity', 'music', 'art', 'drink', 'travel'
  ];
  
  return validTypes.includes(type);
};

/**
 * Get all non-deprecated entity types for UI display
 */
export const getActiveEntityTypes = (): EntityType[] => {
  return [
    EntityType.Movie,
    EntityType.Book,
    EntityType.TVShow,
    EntityType.Course,
    EntityType.App,
    EntityType.Game,
    EntityType.Experience,
    EntityType.Food,
    EntityType.Product,
    EntityType.Place,
    EntityType.Brand,
    EntityType.Event,
    EntityType.Service,
    EntityType.Professional,
    EntityType.Others
  ];
};
