
import { useState, useEffect } from 'react';
import { Entity } from '@/services/recommendation/types';
import { getEntityWithChildren, getParentEntity, EntityWithChildren } from '@/services/entityHierarchyService';

export const useEntityHierarchy = (entityId: string | null) => {
  const [entityWithChildren, setEntityWithChildren] = useState<EntityWithChildren | null>(null);
  const [parentEntity, setParentEntity] = useState<Entity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = async () => {
    if (!entityId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch entity with children and parent in parallel
      const [entityData, parent] = await Promise.all([
        getEntityWithChildren(entityId),
        getParentEntity(entityId)
      ]);
      
      setEntityWithChildren(entityData);
      setParentEntity(parent);
    } catch (err) {
      console.error('Error fetching hierarchy data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch hierarchy data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, [entityId]);

  const refresh = () => {
    fetchHierarchy();
  };

  return {
    entityWithChildren,
    parentEntity,
    isLoading,
    error,
    refresh,
    hasChildren: (entityWithChildren?.children?.length ?? 0) > 0,
    hasParent: parentEntity !== null
  };
};
