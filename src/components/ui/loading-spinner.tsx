

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
    // Set initial message
    const updateMessage = () => {
      if (category) {
        setCurrentMessage(getRandomLoadingMessage(category));
      } else {
        setCurrentMessage('✨ Creating your personalized experience...');
      }
    };

    updateMessage();

    // Change message every 3 seconds for engagement
    const interval = setInterval(updateMessage, 3000);

    return () => clearInterval(interval);
  }, [category]);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-medium">Adding {entityName}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce animation-delay-75" />
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce animation-delay-150" />
          </div>
          <span className="max-w-xs text-center leading-relaxed animate-fade-in">
            {currentMessage}
          </span>
        </div>
      </div>
    </div>
  );
};

