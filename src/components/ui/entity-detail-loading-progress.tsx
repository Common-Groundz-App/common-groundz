
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getRandomLoadingMessage, EntityCategory } from '@/utils/loadingMessages';
import { getCanonicalType } from '@/services/entityTypeHelpers';

interface EntityDetailLoadingProgressProps {
  entityName?: string;
  entityType?: string;
  className?: string;
}

export const EntityDetailLoadingProgress = ({ 
  entityName, 
  entityType = 'product',
  className 
}: EntityDetailLoadingProgressProps) => {
  const [currentMessage, setCurrentMessage] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Convert entity type to canonical category for loading messages
    const category = getCanonicalType(entityType) as EntityCategory;
    
    // Set initial message
    const message = getRandomLoadingMessage(category);
    setCurrentMessage(message);

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev; // Stop at 95% to avoid completing before actual load
        return prev + Math.random() * 15;
      });
    }, 300);

    // Optional: Change message every 10 seconds for very long operations
    const messageInterval = setInterval(() => {
      setCurrentMessage(getRandomLoadingMessage(category));
    }, 10000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [entityType]);

  return (
    <div className={cn('flex flex-col items-center gap-8 p-8', className)}>
      {/* Main Spinner */}
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
      </div>
      
      {/* Progress Bar */}
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          {entityName && (
            <h3 className="font-medium text-lg">Loading {entityName}</h3>
          )}
          <div className="flex items-center justify-center">
            <span className="max-w-xs text-center leading-relaxed animate-fade-in text-sm text-muted-foreground px-4">
              {currentMessage}
            </span>
          </div>
        </div>
        
        {/* Animated Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          />
        </div>
        
        {/* Bouncing Dots */}
        <div className="flex justify-center gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
