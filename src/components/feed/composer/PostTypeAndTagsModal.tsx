import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { POST_TYPE_OPTIONS, type DatabasePostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postType: DatabasePostType;
  setPostType: (next: DatabasePostType) => void;
}

/**
 * Modal for selecting post type.
 * Tags are managed inline via suggested hashtags on the composer surface.
 */
export const PostTypeAndTagsModal: React.FC<PostTypeAndTagsModalProps> = ({
  open,
  onOpenChange,
  postType,
  setPostType,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Post type</DialogTitle>
        </DialogHeader>

        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Choose a type</p>
          <div className="flex flex-wrap gap-1.5">
            {POST_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPostType(postType === option.value ? 'experience' : option.value);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                  postType === option.value
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
