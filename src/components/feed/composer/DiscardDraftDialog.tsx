import React from 'react';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

interface DiscardDraftDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dirty-guard prompt shown when user closes the composer with unsaved input.
 * Wraps the shared ConfirmationDialog for consistent styling/a11y.
 */
export const DiscardDraftDialog: React.FC<DiscardDraftDialogProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  return (
    <ConfirmationDialog
      isOpen={open}
      onClose={onCancel}
      onConfirm={onConfirm}
      title="Discard your draft?"
      description="Your changes will be lost. This can't be undone."
      variant="destructive"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
    />
  );
};
