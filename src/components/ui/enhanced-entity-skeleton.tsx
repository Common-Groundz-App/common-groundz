
import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from '@/lib/utils';

interface EnhancedEntitySkeletonProps {
  className?: string;
  showStats?: boolean;
  showTabs?: boolean;
}

export const EnhancedEntitySkeleton: React.FC<EnhancedEntitySkeletonProps> = ({
  className,
  showStats = true,
  showTabs = true
}) => {
  return (
    <div className={cn("min-h-screen flex flex-col", className)}>
      {/* Hero Section with Staggered Animation */}
      <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Skeleton with Pulse Effect */}
            <div className="w-full md:w-1/3 lg:w-1/4 animate-fade-in">
              <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg">
                <Skeleton className="w-full h-full animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted" />
              </AspectRatio>
            </div>
            
            {/* Details Skeleton with Staggered Delays */}
            <div className="flex-1 space-y-4">
              <div className="space-y-3 animate-fade-in animation-delay-150">
                <Skeleton className="h-8 w-3/4 animate-pulse" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 animate-pulse animation-delay-75" />
                  <Skeleton className="h-6 w-20 animate-pulse animation-delay-150" />
                </div>
                <Skeleton className="h-4 w-1/2 animate-pulse animation-delay-225" />
                <Skeleton className="h-16 w-full animate-pulse animation-delay-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats Bar with Shimmer Effect */}
      {showStats && (
        <div className="bg-card border-y dark:bg-card/50 py-4 animate-fade-in animation-delay-300">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32 animate-pulse" />
                  <Skeleton className="h-4 w-48 animate-pulse" />
                </div>
              </div>
              <div className="flex gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-8 animate-pulse" />
                  <Skeleton className="h-4 w-24 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-8 animate-pulse" />
                  <Skeleton className="h-4 w-16 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Content Area with Progressive Loading */}
      <div className="container max-w-6xl mx-auto py-6 px-4 animate-fade-in animation-delay-450">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Tabs Skeleton */}
            {showTabs && (
              <div className="flex gap-4 mb-6">
                <Skeleton className="h-10 w-32 animate-pulse" />
                <Skeleton className="h-10 w-24 animate-pulse animation-delay-75" />
              </div>
            )}
            
            {/* Content Cards with Staggered Animation */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className={cn("animate-fade-in", `animation-delay-${i * 150}`)}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="h-12 w-12 rounded-full flex-shrink-0 animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/4 animate-pulse" />
                        <Skeleton className="h-4 w-full animate-pulse animation-delay-75" />
                        <Skeleton className="h-4 w-3/4 animate-pulse animation-delay-150" />
                        <div className="flex gap-2 mt-2">
                          <Skeleton className="h-8 w-16 animate-pulse animation-delay-225" />
                          <Skeleton className="h-8 w-16 animate-pulse animation-delay-300" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Sidebar Skeleton */}
          <div className="w-full md:w-72 lg:w-80 space-y-4 animate-fade-in animation-delay-600">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full animate-pulse" />
                <Skeleton className="h-10 w-full animate-pulse animation-delay-75" />
                <Skeleton className="h-10 w-full animate-pulse animation-delay-150" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
