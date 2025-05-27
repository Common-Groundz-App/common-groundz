
import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner = ({ size = 'md', className, text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className={cn(
        'animate-spin rounded-full border-2 border-primary/20 border-t-primary',
        sizeClasses[size]
      )} />
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      )}
    </div>
  );
};

export const EntityCreationLoader = ({ entityName }: { entityName: string }) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-violet-400 animate-spin animation-delay-150" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-medium">Creating entity for {entityName}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce animation-delay-75" />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce animation-delay-150" />
          </div>
          <span>Enriching with metadata...</span>
        </div>
      </div>
    </div>
  );
};
