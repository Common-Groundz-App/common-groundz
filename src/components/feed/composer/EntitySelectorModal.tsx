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
import type { DatabasePostType } from '@/components/feed/utils/postUtils';

interface EntitySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntities: Entity[];
  initialQuery: string;
  onEntitiesChange: (entities: Entity[]) => void;
  onMentionInsert: (username: string) => void;
  postType?: DatabasePostType;
}

/**
 * Per-post-type copy. Tagging stays optional in code for ALL types — only
 * the prompt text changes so the user understands the intent.
 */
const TITLE_BY_TYPE: Record<DatabasePostType, string> = {
  experience: 'Tag what this is about',
  review: 'Tag what this is about',
  recommendation: 'Tag what this is about',
  comparison: "Tag what you're comparing",
  question: 'Tag options, if you have any',
  tip: 'Tag an entity if specific',
};

const DESCRIPTION_BY_TYPE: Record<DatabasePostType, string> = {
  experience: 'Search for places, products, books, movies or people to give your experience context.',
  review: 'Search for the place, product, book or movie you’re reviewing.',
  recommendation: 'Search for what you’re recommending so others can find it.',
  comparison: 'Add the things you’re comparing — at least one helps readers follow along.',
  question: 'Add any specific options you’re weighing. For broad topics, use a hashtag instead.',
  tip: 'If your tip is about something specific, tag it. Otherwise just post with hashtags.',
};

export const EntitySelectorModal: React.FC<EntitySelectorModalProps> = ({
  open,
  onOpenChange,
  initialEntities,
  initialQuery,
  onEntitiesChange,
  onMentionInsert,
  postType = 'experience',
}) => {
  const title = TITLE_BY_TYPE[postType] ?? TITLE_BY_TYPE.experience;
  const description = DESCRIPTION_BY_TYPE[postType] ?? DESCRIPTION_BY_TYPE.experience;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-2xl min-w-0 p-0 gap-0 sm:rounded-2xl overflow-hidden border-border/60 shadow-2xl"
      >
        <DialogHeader className="px-6 pt-6 pb-3 text-center sm:text-center space-y-1 min-w-0">
          <DialogTitle className="text-[22px] font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pt-3 pb-4 min-w-0">
          <UnifiedEntitySelector
            variant="modal"
            onEntitiesChange={(next) => {
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
