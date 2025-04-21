
import React from 'react';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';
import { EntityTagSelector } from '@/components/feed/EntityTagSelector';
import { Entity } from '@/services/recommendation/types';
import { UseFormSetValue } from 'react-hook-form';

interface PostEntitySectionProps {
  selectedEntity: Entity | null;
  showEntitySelector: boolean;
  setSelectedEntity: (entity: Entity | null) => void;
  setShowEntitySelector: (show: boolean) => void;
  setValue: UseFormSetValue<any>;
}

export function PostEntitySection({
  selectedEntity,
  showEntitySelector,
  setSelectedEntity,
  setShowEntitySelector,
  setValue
}: PostEntitySectionProps) {
  function getEntityTypeLabel(entity: Entity | null): string {
    if (!entity) return "place";
    if ((entity as any).entity_type) return (entity as any).entity_type;
    if ((entity as any).category) return (entity as any).category;
    return "place";
  }

  if (selectedEntity && !showEntitySelector) {
    return (
      <EntityPreviewCard
        entity={selectedEntity}
        type={getEntityTypeLabel(selectedEntity)}
        onChange={() => setShowEntitySelector(true)}
      />
    );
  }

  return (
    <div>
      <EntityTagSelector
        onEntitiesChange={(entities) => {
          setSelectedEntity(entities[0]);
          setShowEntitySelector(false);
          setValue('tagged_entities', entities);
        }}
        initialEntities={selectedEntity ? [selectedEntity] : []}
      />
    </div>
  );
}
