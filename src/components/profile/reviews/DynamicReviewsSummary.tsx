
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Review } from '@/services/reviewService';
import { TrendingUp, TrendingDown, Minus, Clock, Brain } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelativeDate } from '@/utils/dateUtils';

interface DynamicReviewsSummaryProps {
  dynamicReviews: Review[];
  timelineData?: {
    averageInitialRating: number;
    averageLatestRating: number;
    averageUpdateDays: number;
    totalTimelineUpdates: number;
    aiSummary?: string;
    aiSummaryLastGenerated?: string;
    aiSummaryModel?: string;
  };
}

export const DynamicReviewsSummary = ({ 
  dynamicReviews, 
  timelineData 
}: DynamicReviewsSummaryProps) => {
  if (!dynamicReviews.length) return null;

  // Calculate ratings from available data (fallback to current logic if timelineData not provided)
  const avgInitialRating = timelineData?.averageInitialRating || 
    dynamicReviews.reduce((sum, review) => sum + review.rating, 0) / dynamicReviews.length;
  
  const avgLatestRating = timelineData?.averageLatestRating || avgInitialRating;
  
  const ratingChange = avgLatestRating - avgInitialRating;
  
  const getTrendIcon = () => {
    if (ratingChange > 0.1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (ratingChange < -0.1) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendText = () => {
    if (ratingChange > 0.1) return 'improving over time';
    if (ratingChange < -0.1) return 'declining over time';
    return 'stable over time';
  };

  const formatUpdateTiming = () => {
    if (!timelineData?.averageUpdateDays) {
      return "Timeline data being calculated...";
    }
    
    const days = Math.round(timelineData.averageUpdateDays);
    if (days < 7) {
      return `Most users update within ${days} days`;
    } else if (days < 30) {
      const weeks = Math.round(days / 7);
      return `Most users update within ${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else {
      const months = Math.round(days / 30);
      return `Most users update within ${months} month${months !== 1 ? 's' : ''}`;
    }
  };

  const renderAISummary = () => {
    if (timelineData?.aiSummary) {
      return (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50/50 to-transparent dark:from-violet-900/10 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-violet-100 dark:bg-violet-900/30 flex-shrink-0">
                <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm text-violet-900 dark:text-violet-100">
                    AI Long-term Experience Insights
                  </h4>
                  {timelineData.aiSummaryLastGenerated && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
                          {timelineData.aiSummaryModel === 'gemini-1.5-flash' ? 'Gemini' : 'GPT'}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Generated {formatRelativeDate(timelineData.aiSummaryLastGenerated)} using {timelineData.aiSummaryModel}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {timelineData.aiSummary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Show loading/generation state for reviews with timeline updates
    if (dynamicReviews.some(review => review.timeline_count && review.timeline_count > 0)) {
      return (
        <Card className="border-dashed border-2 border-violet-200 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-violet-600 dark:text-violet-400">
              <div className="p-2 rounded-full bg-violet-50 dark:bg-violet-900/20">
                <Brain className="h-4 w-4 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm mb-1">Generating AI Insights</div>
                <div className="text-xs text-muted-foreground">
                  Analyzing long-term experience trends from timeline updates...
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Fallback for when no timeline updates exist yet
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="p-2 rounded-full bg-muted/50">
              <Brain className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm mb-1">AI Insights</div>
              <div className="text-xs">
                Common long-term experience trends will appear here after more timeline updates.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 mb-6">
        {/* AI Summary Card */}
        {renderAISummary()}

        {/* Main Rating Evolution Card */}
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50/50 to-transparent dark:from-violet-900/10 dark:border-violet-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              Rating Evolution
              {getTrendIcon()}
              <span className="text-sm font-normal text-muted-foreground">
                ({getTrendText()})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rating Comparison */}
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Initial Rating */}
              <div className="text-center space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Initial Average
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <ConnectedRingsRating
                          value={avgInitialRating}
                          variant="badge"
                          showValue={false}
                          size="md"
                          minimal={true}
                        />
                        <span className="font-bold text-lg">{avgInitialRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average rating when reviews were first created</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="text-2xl text-muted-foreground">→</div>
              </div>

              {/* Latest Rating */}
              <div className="text-center space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Latest Average
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <ConnectedRingsRating
                          value={avgLatestRating}
                          variant="badge"
                          showValue={false}
                          size="md"
                          minimal={true}
                        />
                        <span className="font-bold text-lg">{avgLatestRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average of most recent ratings from timeline updates</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="text-center text-sm text-muted-foreground border-t pt-3">
              Based on {dynamicReviews.length} review{dynamicReviews.length !== 1 ? 's' : ''} with{' '}
              {timelineData?.totalTimelineUpdates || 'multiple'} timeline updates
            </div>

            {/* Update Timing Insight */}
            <div className="flex items-center justify-center gap-2 text-sm bg-muted/30 rounded-lg p-3">
              <Clock className="h-4 w-4 text-violet-500" />
              <span className="text-muted-foreground">
                {formatUpdateTiming()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};
