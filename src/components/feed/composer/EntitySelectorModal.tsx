import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
 * Premium modal wrapper around UnifiedEntitySelector.
 *
 * Pure presentation layer — forwards every prop unchanged so the existing
 * entity + mention logic keeps working verbatim (autoFocus, prefilled @ query,
 * max=3, etc.). The selector renders in `modal` variant which produces a
 * Reddit-style hero search + flat inline result list.
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
      <DialogContent
        className="max-w-xl p-0 gap-0 sm:rounded-2xl overflow-hidden border-border/60 shadow-2xl"
      >
        <DialogHeader className="px-6 pt-6 pb-2 text-center sm:text-center space-y-1">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Tag entities
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Search for places, products, books, movies or people to tag in your post.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pt-4 pb-5">
          <UnifiedEntitySelector
            variant="modal"
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
