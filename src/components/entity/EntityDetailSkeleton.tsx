
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export const EntityDetailSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Hero Section Skeleton */}
      <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Skeleton */}
            <div className="w-full md:w-1/3 lg:w-1/4">
              <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg">
                <Skeleton className="w-full h-full" />
              </AspectRatio>
            </div>
            
            {/* Details Skeleton */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Rating Bar Skeleton */}
      <div className="bg-card border-y dark:bg-card/50 py-4">
        <div className="container max-w-6xl mx-auto px-4">
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
      
      {/* Content Area Skeleton */}
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Tabs Skeleton */}
            <div className="flex gap-4 mb-6">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
            
            {/* Content Cards Skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex gap-2 mt-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Sidebar Skeleton */}
          <div className="w-full md:w-72 lg:w-80 space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-36" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EntityDetailLoadingProgress = ({ step, total }: { step: number; total: number }) => {
  const steps = [
    'Loading entity data...',
    'Fetching recommendations...',
    'Loading reviews...',
    'Calculating statistics...'
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold">Loading Entity Details</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {steps[step - 1] || 'Processing...'}
              </p>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(step / total) * 100}%` }}
              />
            </div>
            
            {/* Step Indicators */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {step}</span>
              <span>{total} steps</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
