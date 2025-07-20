
import React from 'react';
import { Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTrustMetrics } from '@/hooks/use-trust-metrics';

interface TrustSummaryCardProps {
  entityId: string;
  userId: string | null;
}

export const TrustSummaryCard: React.FC<TrustSummaryCardProps> = ({ 
  entityId, 
  userId 
}) => {
  const { metrics, isLoading, error } = useTrustMetrics(entityId, userId);

  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            Trust Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            Trust Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {error || 'Unable to load trust metrics'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { 
    circleReviewsPercentage, 
    averageTrustScore, 
    timelineActivityPercentage,
    ratingBreakdown, 
    ratingEvolution, 
    lastUpdated,
    totalReviews 
  } = metrics;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          Trust Summary
          <InfoTooltip 
            content="Trust metrics calculated from real user reviews and engagement data. Circle metrics show data from people you follow."
            side="top"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {/* Circle Reviews Percentage (only show if user is logged in) */}
            {userId && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    Circle Reviews
                    <InfoTooltip 
                      content="Percentage of reviews from people you follow. Higher percentages indicate trusted recommendations from your network."
                      side="top"
                    />
                  </span>
                  <span className="text-sm font-semibold text-brand-orange">
                    {circleReviewsPercentage}%
                  </span>
                </div>
                <Progress value={circleReviewsPercentage} className="mb-4" />
              </>
            )}
            
            {/* Average Trust Score */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                Average Trust Score
                <InfoTooltip 
                  content="Based on reviewer engagement, timeline updates, and verification status. Higher scores indicate more reliable reviews."
                  side="top"
                />
              </span>
              <span className="text-sm font-semibold text-green-600">
                {averageTrustScore}%
              </span>
            </div>
            <Progress value={averageTrustScore} className="mb-4" />

            {/* Timeline Activity */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                Timeline Activity
                <InfoTooltip 
                  content="Percentage of reviews with follow-up updates. Shows how engaged reviewers are with tracking their experiences over time."
                  side="top"
                />
              </span>
              <span className="text-sm font-semibold text-blue-600">
                {timelineActivityPercentage}%
              </span>
            </div>
            <Progress value={timelineActivityPercentage} className="mb-4" />
          </div>

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              Rating Breakdown
              <InfoTooltip 
                content="Distribution of all ratings, using the most recent rating for reviews with timeline updates."
                side="top"
              />
            </h4>
            {Object.entries(ratingBreakdown).reverse().map(([stars, percentage]) => (
              <div key={stars} className="flex items-center gap-3 mb-2">
                <span className="text-sm w-8">{stars}★</span>
                <Progress value={percentage} className="flex-1" />
                <span className="text-sm w-8 text-right">{percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-4" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">
              Rating Evolution: {ratingEvolution.ratings.filter(r => r > 0).join(' → ')}
              <InfoTooltip 
                content="Shows how the average rating has changed over 30-day periods. Based on review creation dates and current ratings."
                side="top"
              />
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Last Updated: {lastUpdated} ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
