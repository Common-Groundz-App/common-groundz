import { cn } from '@/lib/utils';

interface EntityCardSkeletonProps {
  className?: string;
}

/**
 * Loading skeleton for entity cards in chat
 */
export function EntityCardSkeleton({ className }: EntityCardSkeletonProps) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-background/50 animate-pulse",
      className
    )}>
      {/* Image skeleton */}
      <div className="w-12 h-12 rounded-md bg-muted shrink-0" />
      
      {/* Content skeleton */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Title */}
        <div className="h-4 bg-muted rounded w-3/4" />
        {/* Type + Rating */}
        <div className="h-3 bg-muted rounded w-1/2" />
        {/* Description */}
        <div className="h-3 bg-muted rounded w-full" />
      </div>
    </div>
  );
}
