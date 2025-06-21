
import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { OptimisticLoadingProgress } from '@/components/ui/optimistic-loading-progress';
import { EnhancedEntitySkeleton } from '@/components/ui/enhanced-entity-skeleton';
import { getRandomLoadingMessage } from '@/utils/loadingMessages';

export const EntityDetailSkeleton = () => {
  return <EnhancedEntitySkeleton showStats={true} showTabs={true} />;
};

export const EntityDetailLoadingProgress = ({ 
  step, 
  total, 
  entityName,
  isOptimisticCreation = false 
}: { 
  step: number; 
  total: number; 
  entityName?: string;
  isOptimisticCreation?: boolean;
}) => {
  const [loadingSteps] = useState([
    '🎯 Curating the perfect experience for you...',
    '✨ Gathering insights and recommendations...',
    '🌟 Building your personalized content feed...',
    '🔍 Discovering hidden gems and details...',
    '💫 Creating connections and finding patterns...',
    '🎨 Crafting a beautiful experience just for you...',
    '🚀 Almost ready to show you something amazing...',
    '🎪 Putting the finishing touches on everything...'
  ]);

  // Enhanced loading steps for new entity creation (internal use only)
  const [creationSteps] = useState([
    '🎯 Setting up your new discovery...',
    '🔍 Enriching with detailed information...',
    '✨ Connecting all the pieces together...',
    '🌟 Finalizing your personalized experience...',
    '🚀 Almost ready to explore...',
    '🎪 Putting the finishing touches...',
    '💫 Creating the perfect experience...',
    '🎨 Ready to discover something amazing...'
  ]);

  // Use different steps based on whether this is optimistic creation
  const stepsToUse = isOptimisticCreation ? creationSteps : loadingSteps;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <OptimisticLoadingProgress 
        steps={stepsToUse}
        currentStep={step}
        entityName={entityName}
      />
    </div>
  );
};

// New component for optimistic entity display while creation is in progress
export const OptimisticEntityDisplay = ({ 
  optimisticEntity, 
  creationProgress = 0 
}: { 
  optimisticEntity: any;
  creationProgress?: number;
}) => {
  const [showSkeleton, setShowSkeleton] = useState(true);

  // Show skeleton initially, then fade to optimistic content
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (showSkeleton) {
    return <EnhancedEntitySkeleton showStats={true} showTabs={true} />;
  }

  return (
    <div className="min-h-screen flex flex-col opacity-70">
      {/* Progress indicator - subtle and non-intrusive */}
      {creationProgress < 100 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div 
            className="h-1 bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${creationProgress}%` }}
          />
        </div>
      )}
      
      {/* Optimistic Entity Content */}
      <div className="relative bg-gradient-to-b from-violet-100/30 to-transparent dark:from-violet-900/10">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Entity Image */}
            <div className="w-full md:w-1/3 lg:w-1/4">
              <AspectRatio ratio={4/3} className="overflow-hidden rounded-lg">
                {optimisticEntity.image_url ? (
                  <img 
                    src={optimisticEntity.image_url} 
                    alt={optimisticEntity.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Skeleton className="w-full h-full" />
                )}
              </AspectRatio>
            </div>
            
            {/* Entity Details */}
            <div className="flex-1 space-y-4">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold">{optimisticEntity.name}</h1>
                {optimisticEntity.venue && (
                  <p className="text-lg text-muted-foreground">{optimisticEntity.venue}</p>
                )}
                {optimisticEntity.description && (
                  <p className="text-base leading-relaxed">{optimisticEntity.description}</p>
                )}
                
                {/* Subtle indicator that content is being enriched */}
                <div className="text-sm text-muted-foreground/70 italic">
                  Gathering additional details...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content Area - Show loading states for tabs/content */}
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="w-full md:w-72 lg:w-80 space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
