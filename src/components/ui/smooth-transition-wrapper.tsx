
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SmoothTransitionWrapperProps {
  isLoading: boolean;
  loadingComponent: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  transitionDuration?: string;
}

export const SmoothTransitionWrapper: React.FC<SmoothTransitionWrapperProps> = ({
  isLoading,
  loadingComponent,
  children,
  className,
  transitionDuration = 'duration-300'
}) => {
  const [showContent, setShowContent] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!isLoading && !hasLoaded) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowContent(true);
        setHasLoaded(true);
      }, 100);
      
      return () => clearTimeout(timer);
    } else if (isLoading) {
      setShowContent(false);
    }
  }, [isLoading, hasLoaded]);

  return (
    <div className={cn('relative', className)}>
      {/* Loading State */}
      <div 
        className={cn(
          'transition-opacity ease-in-out',
          transitionDuration,
          isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {loadingComponent}
      </div>
      
      {/* Content State */}
      <div 
        className={cn(
          'transition-all ease-in-out',
          transitionDuration,
          showContent && !isLoading 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-2 pointer-events-none',
          isLoading ? 'absolute inset-0' : ''
        )}
      >
        {children}
      </div>
    </div>
  );
};
