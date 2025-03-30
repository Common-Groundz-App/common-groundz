
import React from 'react';
import { cn } from '@/lib/utils';

interface CircleBadgeProps {
  className?: string;
}

export const CircleBadge = ({ className }: CircleBadgeProps) => {
  return (
    <div className={cn(
      "flex items-center justify-center p-1 bg-white rounded-full shadow-md", 
      className
    )}>
      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-brand-orange to-brand-blue flex items-center justify-center text-[10px] font-bold text-white">
        CC
      </div>
    </div>
  );
};
