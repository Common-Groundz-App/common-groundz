import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UnifiedEntitySelector } from '@/components/feed/UnifiedEntitySelector';
import type { Entity } from '@/services/recommendation/types';

interface EntitySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntities: Entity[];
  initialQuery: string;
  onEntitiesChange: (entities: Entity[]) => void;
  onMentionInsert: (username: string) => void;
}

/**
 * Modal wrapper around UnifiedEntitySelector. Pure presentation layer —
 * forwards every prop unchanged so the existing entity + mention logic
 * keeps working verbatim (autoFocus, prefilled @ query, max=3, etc.).
 */
export const EntitySelectorModal: React.FC<EntitySelectorModalProps> = ({
  open,
  onOpenChange,
  initialEntities,
  initialQuery,
  onEntitiesChange,
  onMentionInsert,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Tag entities</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <UnifiedEntitySelector
            onEntitiesChange={(next) => {
              // EntityAdapter -> Entity at boundary (same cast pattern used by parent form)
              onEntitiesChange(next as unknown as Entity[]);
              onOpenChange(false);
            }}
            initialEntities={initialEntities as unknown as any}
            initialQuery={initialQuery}
            autoFocusSearch={true}
            maxEntities={3}
            onMentionInsert={(username) => {
              onMentionInsert(username);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
