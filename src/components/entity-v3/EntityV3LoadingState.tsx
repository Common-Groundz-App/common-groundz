
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface EntityV3LoadingStateProps {
  progress?: number;
}

export const EntityV3LoadingState: React.FC<EntityV3LoadingStateProps> = ({ progress = 0 }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 border-b border-border mb-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-6 w-96" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
          {/* Hero Section */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-8 w-80" />
                  <Skeleton className="h-6 w-60" />
                  <Skeleton className="h-20 w-full" />
                  <div className="flex items-center gap-6">
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-12 w-20" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Content Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex space-x-1">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-16 mx-auto" />
                <Skeleton className="h-6 w-32 mx-auto" />
                <Skeleton className="h-4 w-28 mx-auto" />
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Progress Indicator */}
        {progress > 0 && (
          <div className="fixed bottom-4 right-4 w-64 bg-background border rounded-lg p-4 shadow-lg">
            <div className="text-sm font-medium mb-2">Loading Entity Data</div>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">{progress}% complete</div>
          </div>
        )}
      </div>
    </div>
  );
};
