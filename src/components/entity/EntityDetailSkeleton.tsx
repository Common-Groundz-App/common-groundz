
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

export const EntityDetailLoadingProgress = ({ step, total, entityName }: { step: number; total: number; entityName?: string }) => {
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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <OptimisticLoadingProgress 
        steps={loadingSteps}
        currentStep={step}
        entityName={entityName}
      />
    </div>
  );
};
