
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

const FeedLoadingMore = () => {
  return (
    <div className="space-y-6">
      {[1, 2].map((item) => (
        <Card key={item} className="overflow-hidden">
          <CardHeader className="p-4 pb-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20 sm:w-24 mb-2" />
                <Skeleton className="h-3 w-12 sm:w-16" />
              </div>
              <Skeleton className="h-6 w-12 sm:w-16" />
            </div>
          </CardHeader>
          
          <CardContent className="p-4">
            <Skeleton className="h-6 w-full max-w-[75%] mb-2" />
            <Skeleton className="h-4 w-full max-w-[33%] mb-4" />
            <Skeleton className="h-4 w-20 sm:w-24 mb-4" />
            <div className="space-y-2 mb-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-md" />
          </CardContent>
          
          <CardFooter className="p-4 pt-0 flex justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-14 sm:w-16" />
              <Skeleton className="h-8 w-14 sm:w-16" />
            </div>
            <Skeleton className="h-8 w-8 sm:w-10" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default FeedLoadingMore;
