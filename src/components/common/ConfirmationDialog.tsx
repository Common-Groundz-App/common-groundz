
import React, { useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
  variant?: 'destructive' | 'warning' | 'default';
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
}

// Helper function to reset pointer-events on body if they're set to none
const resetBodyPointerEvents = () => {
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isLoading = false,
  variant = 'default',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel,
}) => {
  // Clean up pointer-events when dialog closes or component unmounts
  useEffect(() => {
    // When dialog closes, ensure pointer-events are reset
    if (!isOpen) {
      resetBodyPointerEvents();
    }
    
    // Cleanup on unmount
    return () => {
      resetBodyPointerEvents();
    };
  }, [isOpen]);

  // Specifically handle ESC key to ensure dialog closes properly
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape' && !isLoading) {
        event.preventDefault(); // Prevent default ESC behavior
        onClose();
        resetBodyPointerEvents();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, isLoading]);

  // Only render if the dialog is open
  if (!isOpen) return null;

  // Determine button styling based on variant
  const getButtonClassName = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-white';
      default:
        return 'bg-primary hover:bg-primary/90 text-primary-foreground';
    }
  };

  const displayLoadingLabel = loadingLabel || `${confirmLabel}...`;

  return (
    <AlertDialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Only allow closing via the onOpenChange if we're not in a loading state
        if (!open && !isLoading) {
          onClose();
          // Explicitly reset pointer-events when dialog closes
          resetBodyPointerEvents();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={isLoading} 
            onClick={() => {
              resetBodyPointerEvents();
              onClose();
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              resetBodyPointerEvents();
              onConfirm();
            }}
            disabled={isLoading}
            className={cn(getButtonClassName())}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                {displayLoadingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Backwards compatibility wrapper
interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = (props) => (
  <ConfirmationDialog 
    {...props} 
    variant="destructive" 
    confirmLabel="Delete" 
    loadingLabel="Deleting..." 
  />
);

export { ConfirmationDialog, DeleteConfirmationDialog };
export default DeleteConfirmationDialog;
