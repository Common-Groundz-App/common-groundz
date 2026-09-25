/**
 * Entity Type UI Helpers
 *
 * UI-facing configuration (labels, icons, fallback images) keyed by canonical
 * entity type. The canonical list and the strict parser live in
 * `src/services/entityType.ts` — this module never redefines them.
 */

import { EntityType } from './recommendation/types';
import {
  CANONICAL_ENTITY_TYPES,
  parseEntityType,
  parseEntityTypeAtBoundary,
} from './entityType';
import { Database } from '@/integrations/supabase/types';

type DatabaseEntityType = Database['public']['Enums']['entity_type'];

/**
 * DISPLAY-ONLY normalization.
 *
 * Resolves canonical values and legacy aliases. When the value is not
 * recognisable it returns `EntityType.Others` so rendering stays safe — this
 * value must NEVER be written back to the database. For persistence use
 * `parseEntityType` (strict, returns `null`) from `entityType.ts`.
 */
export const getCanonicalType = (type: string): EntityType => {
  const canonical = parseEntityTypeAtBoundary(type);
  return canonical ? (canonical as unknown as EntityType) : EntityType.Others;
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
    [EntityType.Experience]: 'Experience'
  };
  
  return labels[canonicalType] || 'Others';
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
    [EntityType.Experience]: 'Compass'
  };
  
  return icons[canonicalType] || 'Circle';
};

/**
 * Check if a type string is one of the 15 canonical Supabase enum values.
 * Legacy aliases are intentionally NOT valid here.
 */
export const isValidEntityType = (type: string): boolean => parseEntityType(type) !== null;


/**
 * All canonical entity types for UI display, derived from the canonical list.
 */
export const getActiveEntityTypes = (): EntityType[] =>
  CANONICAL_ENTITY_TYPES.map((t) => t as unknown as EntityType);
