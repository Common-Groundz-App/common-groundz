
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export function EntityDetailSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Skeleton */}
      <div className="h-16 bg-background border-b" />
      
      {/* Hero Section Skeleton */}
      <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Skeleton */}
            <div className="w-full md:w-1/3 lg:w-1/4">
              <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg border">
                <Skeleton className="w-full h-full" />
              </AspectRatio>
            </div>
            
            {/* Details Skeleton */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Rating Bar Skeleton */}
      <div className="bg-card border-y py-4">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Skeleton */}
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            {/* Tabs Skeleton */}
            <div className="flex border-b mb-6">
              <Skeleton className="h-10 w-32 mr-4" />
              <Skeleton className="h-10 w-24" />
            </div>
            
            {/* Content Cards Skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-4/5 mb-2" />
                    <Skeleton className="h-4 w-3/5" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Sidebar Skeleton */}
          <div className="w-full md:w-72 lg:w-80 space-y-5">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
