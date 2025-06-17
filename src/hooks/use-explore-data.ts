
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  getPersonalizedEntities,
  getTrendingEntities,
  getEntityCollections,
  getCollectionEntities,
  getHiddenGems,
  getNewEntities,
  trackEntityView,
  updateUserInterests,
  type PersonalizedEntity,
  type EntityCollection
} from '@/services/exploreService';

export const useExploreData = (category: string = 'all') => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<EntityCollection[]>([]);

  // Fetch personalized entities for logged-in users
  const { data: personalizedEntities } = useQuery({
    queryKey: ['personalized-entities', user?.id],
    queryFn: () => user ? getPersonalizedEntities(user.id, 8) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch trending entities
  const { data: trendingEntities } = useQuery({
    queryKey: ['trending-entities', category],
    queryFn: () => getTrendingEntities(category, 8),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch hidden gems
  const { data: hiddenGems } = useQuery({
    queryKey: ['hidden-gems', category],
    queryFn: () => getHiddenGems(category, 6),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  // Fetch new entities
  const { data: newEntities } = useQuery({
    queryKey: ['new-entities', category],
    queryFn: () => getNewEntities(category, 6),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch entity collections
  const { data: entityCollections } = useQuery({
    queryKey: ['entity-collections'],
    queryFn: getEntityCollections,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Load collection entities
  useEffect(() => {
    const loadCollectionEntities = async () => {
      if (entityCollections) {
        const collectionsWithEntities = await Promise.all(
          entityCollections
            .filter(collection => collection.category === category || collection.category === 'all')
            .map(async (collection) => {
              const entities = await getCollectionEntities(collection.id, 6);
              return { ...collection, entities };
            })
        );
        setCollections(collectionsWithEntities);
      }
    };

    loadCollectionEntities();
  }, [entityCollections, category]);

  // Track entity view function
  const handleEntityView = async (entityId: string, entityType: string, viewDuration?: number) => {
    await trackEntityView({
      entity_id: entityId,
      user_id: user?.id,
      view_duration: viewDuration,
      interaction_type: 'view'
    });

    if (user) {
      await updateUserInterests(user.id, category, entityType, 0.5);
    }
  };

  // Track entity interaction (like, save, etc.)
  const handleEntityInteraction = async (entityId: string, entityType: string, interactionType: string) => {
    await trackEntityView({
      entity_id: entityId,
      user_id: user?.id,
      interaction_type: interactionType
    });

    if (user) {
      const interactionStrength = interactionType === 'like' ? 2 : interactionType === 'save' ? 3 : 1;
      await updateUserInterests(user.id, category, entityType, interactionStrength);
    }
  };

  return {
    personalizedEntities: personalizedEntities || [],
    trendingEntities: trendingEntities || [],
    hiddenGems: hiddenGems || [],
    newEntities: newEntities || [],
    collections,
    handleEntityView,
    handleEntityInteraction,
    isLoggedIn: !!user
  };
};
