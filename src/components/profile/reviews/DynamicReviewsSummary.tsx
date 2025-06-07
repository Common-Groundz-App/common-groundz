
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Review } from '@/services/reviewService';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DynamicReviewsSummaryProps {
  dynamicReviews: Review[];
}

export const DynamicReviewsSummary = ({ dynamicReviews }: DynamicReviewsSummaryProps) => {
  if (!dynamicReviews.length) return null;

  const avgInitialRating = dynamicReviews.reduce((sum, review) => sum + review.rating, 0) / dynamicReviews.length;
  
  // For now, we'll use the current rating as latest (in future phases, we'll calculate from timeline updates)
  const avgLatestRating = avgInitialRating; // Placeholder - will be enhanced with actual timeline data
  
  const ratingChange = avgLatestRating - avgInitialRating;
  const getTrendIcon = () => {
    if (ratingChange > 0.1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (ratingChange < -0.1) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          Dynamic Reviews Summary
          {getTrendIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Initial Average</div>
            <div className="flex items-center gap-2">
              <ConnectedRingsRating
                value={avgInitialRating}
                variant="badge"
                showValue={false}
                size="md"
                minimal={true}
              />
              <span className="font-semibold">{avgInitialRating.toFixed(1)}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium">Latest Average</div>
            <div className="flex items-center gap-2">
              <ConnectedRingsRating
                value={avgLatestRating}
                variant="badge"
                showValue={false}
                size="md"
                minimal={true}
              />
              <span className="font-semibold">{avgLatestRating.toFixed(1)}</span>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Based on {dynamicReviews.length} review{dynamicReviews.length !== 1 ? 's' : ''} with timeline updates
        </div>
      </CardContent>
    </Card>
  );
};
