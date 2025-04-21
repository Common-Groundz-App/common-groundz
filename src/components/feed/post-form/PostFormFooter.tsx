
import React from 'react';
import { Button } from '@/components/ui/button';

interface PostFormFooterProps {
  isSubmitting: boolean;
  isEditMode: boolean;
  onCancel: () => void;
}

export function PostFormFooter({
  isSubmitting,
  isEditMode,
  onCancel
}: PostFormFooterProps) {
  return (
    <div className="flex justify-end space-x-2 pt-3">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isEditMode ? (isSubmitting ? 'Updating...' : 'Update Post') : (isSubmitting ? 'Publishing...' : 'Publish Post')}
      </Button>
    </div>
  );
}
