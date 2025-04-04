
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RecommendationSkeletonProps {
  count?: number;
}

const RecommendationSkeleton = ({ count = 3 }: RecommendationSkeletonProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden animate-pulse">
          <div className="h-48 bg-gray-200"></div>
          <CardContent className="p-4">
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-100 rounded mb-3"></div>
            <div className="h-4 bg-gray-100 rounded w-2/3 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RecommendationSkeleton;
