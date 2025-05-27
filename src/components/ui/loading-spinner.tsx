import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getRandomLoadingMessage, EntityCategory } from '@/utils/loadingMessages';

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

export const EntityCreationLoader = ({ entityName, category }: { entityName: string; category?: EntityCategory }) => {
  const [currentMessage, setCurrentMessage] = useState('');

  useEffect(() => {
    // Set initial message and keep it for the entire session
    const message = category 
      ? getRandomLoadingMessage(category)
      : '✨ Creating your personalized experience...';
    
    setCurrentMessage(message);

    // Optional: Change message every 10 seconds for very long operations
    const interval = setInterval(() => {
      if (category) {
        setCurrentMessage(getRandomLoadingMessage(category));
      }
    }, 10000); // Increased from 3 seconds to 10 seconds

    return () => clearInterval(interval);
  }, [category]);

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
      </div>
      <div className="text-center space-y-3">
        <h3 className="font-medium text-lg">Adding {entityName}</h3>
        <div className="flex items-center justify-center">
          <span className="max-w-xs text-center leading-relaxed animate-fade-in text-sm text-muted-foreground px-4">
            {currentMessage}
          </span>
        </div>
      </div>
    </div>
  );
};
