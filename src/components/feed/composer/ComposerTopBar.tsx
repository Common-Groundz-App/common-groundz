import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ComposerTopBarProps {
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isPostDisabled: boolean;
  isEditMode: boolean;
  submitPulse: boolean;
}

/**
 * Sticky top bar for the composer (mobile + desktop parity).
 * - Left: X (close, with dirty-guard handled by parent)
 * - Right: Post / Update primary CTA
 */
export const ComposerTopBar: React.FC<ComposerTopBarProps> = ({
  onClose,
  onSubmit,
  isSubmitting,
  isPostDisabled,
  isEditMode,
  submitPulse,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Composer actions"
      className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/90 backdrop-blur-md border-b border-border px-3 py-2"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close composer"
        className="rounded-full"
      >
        <X className="h-5 w-5" />
      </Button>

      <Button
        type="button"
        onClick={onSubmit}
        disabled={isPostDisabled}
        className={cn(
          'bg-brand-orange hover:bg-brand-orange/90 text-white rounded-full px-5 h-9 transition-all',
          submitPulse && 'scale-95 opacity-80'
        )}
      >
        {isSubmitting ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" />
            <span>{isEditMode ? 'Updating…' : 'Posting…'}</span>
          </div>
        ) : (
          <span>{isEditMode ? 'Update' : 'Post'}</span>
        )}
      </Button>
    </div>
  );
};
