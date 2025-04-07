
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface CommentSkeletonsProps {
  count: number;
}

export const CommentSkeletons = ({ count }: CommentSkeletonsProps) => {
  return (
    <>
      {Array(count).fill(0).map((_, index) => (
        <div key={index} className="flex space-x-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
      ))}
    </>
  );
};
