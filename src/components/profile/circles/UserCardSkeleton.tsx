
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const UserCardSkeleton = () => {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="ml-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </CardContent>
    </Card>
  );
};

export default UserCardSkeleton;
