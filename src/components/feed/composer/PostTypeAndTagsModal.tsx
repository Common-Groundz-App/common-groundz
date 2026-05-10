import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { POST_TYPE_OPTIONS, getPostTypeColors, type DatabasePostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postType: DatabasePostType;
  setPostType: (next: DatabasePostType) => void;
}

/**
 * Modal for selecting post type. Uses staged selection — the parent's
 * postType is only updated when the user clicks Apply. Cancel / X /
 * overlay close discard the draft.
 */
export const PostTypeAndTagsModal: React.FC<PostTypeAndTagsModalProps> = ({
  open,
  onOpenChange,
  postType,
  setPostType,
}) => {
  const [draftType, setDraftType] = useState<DatabasePostType>(postType);

  // Reset draft to current value every time the modal opens, so a previous
  // un-applied selection doesn't leak into the next session.
  useEffect(() => {
    if (open) setDraftType(postType);
  }, [open, postType]);

  const handleApply = () => {
    setPostType(draftType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Post type</DialogTitle>
        </DialogHeader>

        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Choose a type</p>
          <div className="flex flex-wrap gap-1.5">
            {POST_TYPE_OPTIONS.map((option) => {
              const isSelected = draftType === option.value;
              const colors = getPostTypeColors(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setDraftType(option.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-colors',
                    isSelected
                      ? colors.pill
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={draftType === postType}
            className="bg-brand-orange text-white hover:bg-brand-orange/90"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
