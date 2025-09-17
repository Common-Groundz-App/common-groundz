/**
 * Utility functions for generating consistent entity URLs
 */

export interface EntityUrlCompatible {
  slug?: string;
  id: string;
}

/**
 * Generate a consistent entity URL, prioritizing slug over ID
 * @param entity - Entity with slug and id properties
 * @returns URL path for the entity
 */
export const getEntityUrl = (entity: EntityUrlCompatible): string => {
  return `/entity/${entity.slug || entity.id}`;
};

/**
 * Generate a hierarchical URL for a child entity with its parent
 * @param parentEntity - Parent entity with slug and id properties
 * @param childEntity - Child entity with slug and id properties
 * @returns Hierarchical URL path for the child entity
 */
export const getHierarchicalEntityUrl = (parentEntity: EntityUrlCompatible, childEntity: EntityUrlCompatible): string => {
  const parentSlug = parentEntity.slug || parentEntity.id;
  const childSlug = childEntity.slug || childEntity.id;
  return `/entity/${parentSlug}/${childSlug}`;
};

/**
 * Parse hierarchical URL parameters to get parent and child slugs
 * @param parentSlug - Parent entity slug from URL
 * @param childSlug - Child entity slug from URL
 * @returns Object with parent and child slug information
 */
export const parseHierarchicalUrl = (parentSlug: string, childSlug: string) => {
  return {
    parentSlug,
    childSlug,
    isHierarchical: true
  };
};

/**
 * Check if a string looks like a UUID
 * @param str - String to check
 * @returns true if the string looks like a UUID
 */
export const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Generate a slug from a string
 * @param name - String to convert to slug
 * @returns URL-safe slug
 */
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate a hierarchical slug for a child entity
 * @param name - Child entity name
 * @param parentSlug - Parent entity slug
 * @returns Hierarchical slug
 */
export const generateHierarchicalSlug = (name: string, parentSlug?: string): string => {
  const baseSlug = generateSlug(name);
  return parentSlug ? `${parentSlug}-${baseSlug}` : baseSlug;
};

/**
 * Check if an entity needs a hierarchical slug update
 * @param entity - Entity to check
 * @param parentEntity - Parent entity (if any)
 * @returns true if slug needs updating
 */
export const needsSlugUpdate = (entity: EntityUrlCompatible, parentEntity?: EntityUrlCompatible): boolean => {
  if (!parentEntity) {
    return false; // No parent, current slug is fine
  }
  
  const expectedSlug = generateHierarchicalSlug(entity.slug || entity.id, parentEntity.slug || parentEntity.id);
  return entity.slug !== expectedSlug;
};