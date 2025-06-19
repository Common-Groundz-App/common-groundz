
import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

export const FeedItemSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-4 p-6 border rounded-xl', className)}>
    <div className="flex items-center space-x-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
    <Skeleton className="h-48 w-full rounded-lg" />
    <div className="flex items-center space-x-4 pt-2">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
    </div>
  </div>
);

export const ProfileCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-4 p-6 border rounded-xl', className)}>
    <div className="flex items-center space-x-4">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    <div className="flex space-x-4">
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-20" />
    </div>
  </div>
);

export const EntityCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-3 p-4 border rounded-lg', className)}>
    <Skeleton className="h-32 w-full rounded-md" />
    <div className="space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
    <div className="flex justify-between items-center pt-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-6 w-12" />
    </div>
  </div>
);
