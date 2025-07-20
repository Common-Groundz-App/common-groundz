
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export const EntitySkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Skeleton */}
            <div className="w-full md:w-1/3 lg:w-1/4">
              <AspectRatio ratio={4/3}>
                <Skeleton className="w-full h-full rounded-lg" />
              </AspectRatio>
            </div>
            
            {/* Content Skeleton */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
              
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
              
              <Skeleton className="h-16 w-full" />
              
              {/* Actions Skeleton */}
              <div className="flex gap-3 pt-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-9 w-20" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar Skeleton */}
      <div className="bg-white border-b py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="space-y-2">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Trust Summary Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>

            {/* Reviews Section Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tabs Skeleton */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-16" />
              </div>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-10 w-full mb-4" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-4 w-4 mt-1" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
