
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
      "min-h-screen bg-background",
      "flex flex-col",
      className
    )}>
      <div className="flex-1 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
