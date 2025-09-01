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
 * Check if a string looks like a UUID
 * @param str - String to check
 * @returns true if the string looks like a UUID
 */
export const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};