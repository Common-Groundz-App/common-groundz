
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface CommentsErrorAlertProps {
  error: string | null;
  onRetry: () => void;
}

export const CommentsErrorAlert = ({ error, onRetry }: CommentsErrorAlertProps) => {
  if (!error) return null;
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex justify-between items-center">
        <span>{error}</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRetry}
          className="ml-2"
        >
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
};
