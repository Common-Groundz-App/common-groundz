import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Entity } from '@/services/recommendation/types';
import { EntitySuggestionModal } from './EntitySuggestionModal';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';

interface EntitySuggestionButtonProps {
  entity: Entity;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const EntitySuggestionButton: React.FC<EntitySuggestionButtonProps> = ({
  entity,
  variant = "outline",
  size = "sm",
  className = "w-full"
}) => {
  const { requireAuth } = useAuthPrompt();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (!requireAuth({ action: 'suggest_edit', entityName: entity.name, entityId: entity.id, surface: 'entity_sidebar' })) return;

    setIsModalOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
      >
        Suggest an Edit
      </Button>

      <EntitySuggestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entity={entity}
      />
    </>
  );
};