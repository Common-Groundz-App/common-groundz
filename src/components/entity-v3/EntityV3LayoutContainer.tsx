
import React from 'react';
import { cn } from '@/lib/utils';

interface EntityV3LayoutContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const EntityV3LayoutContainer: React.FC<EntityV3LayoutContainerProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn(
      "entity-v3-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
      className
    )}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
        {children}
      </div>
      
      <style>{`
        .entity-v3-container {
          min-height: 100vh;
        }
        
        @media (max-width: 1024px) {
          .entity-v3-container .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
