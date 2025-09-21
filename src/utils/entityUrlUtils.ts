/**
 * Utility functions for generating consistent entity URLs
 */

export interface EntityUrlCompatible {
  slug?: string;
  id: string;
}

/**
 * Generate a consistent entity URL, prioritizing slug over ID
 * For entities with parents, this automatically generates hierarchical URLs
 * @param entity - Entity with slug and id properties
 * @param parentEntity - Optional parent entity for hierarchical URLs
 * @returns URL path for the entity
 */
export const getEntityUrl = (entity: EntityUrlCompatible, parentEntity?: EntityUrlCompatible): string => {
  if (parentEntity) {
    return getHierarchicalEntityUrl(parentEntity, entity);
  }
  return `/entity/${entity.slug || entity.id}`;
};

/**
 * Generate entity URL with automatic parent detection from entity data
 * @param entity - Entity that might have parent_id and parent info
 * @returns URL path for the entity
 */
export const getEntityUrlWithParent = (entity: any): string => {
  // If entity has parent information, create hierarchical URL
  if (entity.parent_id && entity.parent_slug) {
    return `/entity/${entity.parent_slug}/${entity.slug || entity.id}`;
  }
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
 * Generate a hierarchical path for display purposes
 * @param name - Child entity name
 * @param parentSlug - Parent entity slug
 * @returns Hierarchical path for display (not storage)
 */
export const generateHierarchicalPath = (name: string, parentSlug?: string): string => {
  const baseSlug = generateSlug(name);
  return parentSlug ? `${parentSlug}/${baseSlug}` : baseSlug;
};

/**
 * Check if an entity needs a slug update for hierarchical display
 * @param entity - Entity to check
 * @param parentEntity - Parent entity (if any)
 * @returns true if slug needs updating
 */
export const needsSlugUpdate = (entity: EntityUrlCompatible, parentEntity?: EntityUrlCompatible): boolean => {
  // For hierarchical entities, we just check if the child has a simple slug
  // The URL construction will handle the hierarchy
  if (!parentEntity) {
    return false; // No parent, current slug is fine
  }
  
  const expectedSlug = generateSlug(entity.slug || entity.id);
  return entity.slug !== expectedSlug;
};