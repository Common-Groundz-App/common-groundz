
import { Entity, EntityType } from '@/services/recommendation/types';
import { getEntityTypeFallbackImage, mapEntityTypeToDatabase } from '@/services/entityTypeMapping';

/**
 * Enhanced entity with fallback values from parent
 */
export interface EntityWithFallbacks extends Entity {
  // All properties are the same, but with fallback logic applied
}

/**
 * Apply fallback logic to child entity using parent entity data
 */
export const applyEntityFallbacks = (
  childEntity: Entity, 
  parentEntity?: Entity | null
): EntityWithFallbacks => {
  if (!parentEntity) {
    return childEntity;
  }

  return {
    ...childEntity,
    image_url: childEntity.image_url || parentEntity.image_url,
    description: childEntity.description || parentEntity.description,
    // Apply type mapping for consistency
    type: mapEntityTypeToDatabase(childEntity.type),
  };
};

/**
 * Get fallback image with parent entity support
 */
export const getEntityImageWithFallback = (
  entity: Entity, 
  parentEntity?: Entity | null
): string => {
  if (entity.image_url) {
    return entity.image_url;
  }
  
  if (parentEntity?.image_url) {
    return parentEntity.image_url;
  }
  
  return getEntityTypeFallbackImage(entity.type);
};

/**
 * Get entity description with parent fallback
 */
export const getEntityDescriptionWithFallback = (
  entity: Entity,
  parentEntity?: Entity | null
): string | null => {
  return entity.description || parentEntity?.description || null;
};

/**
 * Get top-rated child entities for featured display
 */
export const getTopRatedChildren = (
  children: Entity[],
  limit: number = 4
): Entity[] => {
  // For now, just return first few children since we don't have ratings data
  // In a real implementation, this would sort by rating/popularity
  return children
    .filter(child => child.image_url || child.description) // Prefer children with content
    .slice(0, limit);
};

/**
 * Get spec summary for display on cards
 */
export const getEntitySpecSummary = (entity: Entity): string | null => {
  if (!entity.specifications && !entity.price_info) {
    return null;
  }

  const specs: string[] = [];
  
  // Extract key specs from specifications
  if (entity.specifications) {
    const specObj = entity.specifications as any;
    if (specObj.brand) specs.push(specObj.brand);
    if (specObj.size) specs.push(specObj.size);
    if (specObj.volume) specs.push(specObj.volume);
    if (specObj.spf) specs.push(`SPF ${specObj.spf}`);
  }
  
  // Extract price from price_info
  if (entity.price_info) {
    const priceObj = entity.price_info as any;
    if (priceObj.amount && priceObj.currency) {
      specs.push(`${priceObj.currency}${priceObj.amount}`);
    }
  }
  
  return specs.length > 0 ? specs.join(', ') : null;
};

/**
 * Check if entity should show "Popular" badge
 */
export const isEntityPopular = (entity: Entity): boolean => {
  // Simple heuristic - can be enhanced with actual popularity metrics
  return (entity.metadata as any)?.popular === true || 
         (entity.metadata as any)?.editors_pick === true;
};
