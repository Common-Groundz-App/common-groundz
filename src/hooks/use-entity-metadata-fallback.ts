
import { useMemo } from 'react';
import { Entity } from '@/services/recommendation/types';

interface EntityMetadataFallbackProps {
  entity: Entity;
  parentEntity?: Entity | null;
}

export const useEntityMetadataFallback = ({ entity, parentEntity }: EntityMetadataFallbackProps) => {
  const enhancedEntity = useMemo(() => {
    if (!parentEntity) {
      return entity;
    }

    return {
      ...entity,
      // Use parent image if child has no image
      image_url: entity.image_url || parentEntity.image_url,
      // Use parent description if child has no description
      description: entity.description || parentEntity.description,
      // Merge metadata, prioritizing child data
      metadata: {
        ...parentEntity.metadata,
        ...entity.metadata,
      },
    };
  }, [entity, parentEntity]);

  return enhancedEntity;
};
