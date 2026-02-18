import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { fetchEntityBySlugSimple } from '@/services/entityService';
import { isUUID } from '@/utils/entityUrlUtils';

/**
 * Service to handle hierarchical entity resolution
 */

export interface HierarchicalEntityResult {
  entity: Entity | null;
  parentEntity: Entity | null;
  isHierarchical: boolean;
}

/**
 * Resolve entity from hierarchical URL parameters
 * @param parentSlug - Parent entity slug or ID
 * @param childSlug - Child entity slug or ID
 * @returns Promise resolving to entity and parent information
 */
export const resolveHierarchicalEntity = async (
  parentSlug: string, 
  childSlug: string
): Promise<HierarchicalEntityResult> => {
  try {
    // Fetch both entities in parallel
    const [parentEntity, childEntity] = await Promise.all([
      fetchEntityBySlugSimple(parentSlug),
      fetchEntityBySlugSimple(childSlug)
    ]);

    if (!childEntity) {
      return {
        entity: null,
        parentEntity: null,
        isHierarchical: true
      };
    }

    // Verify the parent-child relationship if both entities exist
    if (parentEntity && childEntity) {
      // Check if the child's parent_id matches the parent's id
      const isValidRelationship = childEntity.parent_id === parentEntity.id;
      
      if (!isValidRelationship) {
        console.warn(
          `Invalid parent-child relationship: ${childSlug} is not a child of ${parentSlug}`
        );
        // Still return the child entity but without parent verification
      }
    }

    return {
      entity: childEntity,
      parentEntity: parentEntity || null,
      isHierarchical: true
    };
  } catch (error) {
    console.error('Error resolving hierarchical entity:', error);
    return {
      entity: null,
      parentEntity: null,
      isHierarchical: true
    };
  }
};

/**
 * Resolve entity from single slug (non-hierarchical URL)
 * @param slug - Entity slug or ID
 * @returns Promise resolving to entity information
 */
export const resolveSingleEntity = async (slug: string): Promise<HierarchicalEntityResult> => {
  try {
    const entity = await fetchEntityBySlugSimple(slug);
    
    return {
      entity,
      parentEntity: null,
      isHierarchical: false
    };
  } catch (error) {
    console.error('Error resolving single entity:', error);
    return {
      entity: null,
      parentEntity: null,
      isHierarchical: false
    };
  }
};