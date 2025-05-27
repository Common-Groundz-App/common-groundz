

import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { getRandomLoadingMessage } from '@/utils/loadingMessages';

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
  const [currentMessage, setCurrentMessage] = useState('');

  useEffect(() => {
    // Set engaging messages that rotate
    const updateMessage = () => {
      const generalMessages = [
        '🎯 Curating the perfect experience for you...',
        '✨ Gathering insights and recommendations...',
        '🌟 Building your personalized content feed...',
        '🔍 Discovering hidden gems and details...',
        '💫 Creating connections and finding patterns...',
        '🎨 Crafting a beautiful experience just for you...',
        '🚀 Almost ready to show you something amazing...',
        '🎪 Putting the finishing touches on everything...'
      ];
      
      setCurrentMessage(generalMessages[Math.floor(Math.random() * generalMessages.length)]);
    };

    updateMessage();
    
    // Change message every 2.5 seconds
    const interval = setInterval(updateMessage, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold">Loading Experience</h3>
              <p className="text-sm text-muted-foreground mt-2 animate-fade-in">
                {currentMessage}
              </p>
            </div>
            
            {/* Progress Bar with brand colors */}
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(step / total) * 100}%` }}
              />
            </div>
            
            {/* Simplified progress indicator */}
            <div className="flex justify-center">
              <div className="flex gap-1">
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce animation-delay-75" />
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce animation-delay-150" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

