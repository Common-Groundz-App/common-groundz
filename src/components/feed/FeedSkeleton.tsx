
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

const FeedSkeleton = () => {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="overflow-hidden animate-pulse">
          <CardHeader className="p-5 pb-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardHeader>
          
          <CardContent className="p-5">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/3 mb-4" />
            
            <div className="flex space-x-1 mb-4">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-3" />
            </div>
            
            <div className="space-y-2 mb-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-56 w-full rounded-lg" />
          </CardContent>
          
          <CardFooter className="p-4 border-t flex justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-8 w-16" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default FeedSkeleton;
