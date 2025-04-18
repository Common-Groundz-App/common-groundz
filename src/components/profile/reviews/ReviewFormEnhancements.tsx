
import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import EntityCreationModal from '@/components/entity/EntityCreationModal';
import { Entity } from '@/services/recommendationService';

interface EntitySelectorProps {
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  entityType: 'movie' | 'book' | 'place' | 'product' | 'food';
}

export const EntitySelector = ({ selectedEntity, onEntitySelect, entityType }: EntitySelectorProps) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">
          {selectedEntity ? 'Selected' : 'Find or create a'} {entityType}:
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1"
        >
          {selectedEntity ? <Search className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {selectedEntity ? 'Change' : 'Select'}
        </Button>
      </div>

      {selectedEntity && (
        <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            {selectedEntity.image_url && (
              <div className="h-16 w-16 flex-shrink-0">
                <img
                  src={selectedEntity.image_url}
                  alt={selectedEntity.name}
                  className="h-full w-full object-cover rounded"
                />
              </div>
            )}
            <div>
              <div className="font-medium">{selectedEntity.name}</div>
              {selectedEntity.venue && (
                <div className="text-xs text-gray-500">{selectedEntity.venue}</div>
              )}
              {selectedEntity.description && (
                <div className="text-xs text-gray-600 line-clamp-2 mt-1">
                  {selectedEntity.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <EntityCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={onEntitySelect}
        entityType={entityType}
      />
    </div>
  );
};
