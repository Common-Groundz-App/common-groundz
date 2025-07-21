import React from 'react';
import { Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { RatingRingIcon } from "@/components/ui/rating-ring-icon";
import { useTrustMetrics } from "@/hooks/useTrustMetrics";
import { getSentimentColor } from "@/utils/ratingColorUtils";

interface TrustSummaryCardProps {
  entityId: string;
  userId?: string | null;
}

export const TrustSummaryCard: React.FC<TrustSummaryCardProps> = ({ 
  entityId, 
  userId 
}) => {
  const { data: trustMetrics, isLoading, error } = useTrustMetrics(entityId, userId);

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                {[5, 4, 3, 2, 1].map(rating => (
                  <div key={rating} className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-4 bg-gray-200 rounded"></div>
                    <Progress 
                      value={Math.floor(Math.random() * 50) + 10} 
                      className="flex-1" 
                      style={{
                        '--progress-foreground': getSentimentColor(rating, true)
                      } as React.CSSProperties}
                    />
                    <div className="w-8 h-4 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            Trust Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load trust metrics</p>
        </CardContent>
      </Card>
    );
  }

  // Format Circle Certified display
  const getCircleCertifiedDisplay = () => {
    if (!userId) return { value: "Sign In", color: "text-muted-foreground" };
    if (trustMetrics?.circleCertified === null) return { value: "No circle data", color: "text-muted-foreground" };
    return { value: `${trustMetrics.circleCertified}%`, color: "text-green-600" };
  };

  // Format Rating Evolution display
  const getRatingEvolutionDisplay = () => {
    if (!trustMetrics?.ratingEvolution || trustMetrics.ratingEvolution.length === 0) {
      return "Not enough data";
    }
    return trustMetrics.ratingEvolution.join(' → ');
  };

  const circleCertifiedDisplay = getCircleCertifiedDisplay();
  const hasRatingData = Object.keys(trustMetrics?.ratingBreakdown || {}).length > 0;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          Trust Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {/* Circle Certified */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Circle Certified</span>
                <InfoTooltip content="Percentage of people you follow who rated this 4 or more circles." />
              </div>
              <span className={`text-sm font-semibold ${circleCertifiedDisplay.color}`}>
                {circleCertifiedDisplay.value}
              </span>
            </div>
            {trustMetrics?.circleCertified !== null && (
              <Progress value={trustMetrics.circleCertified || 0} className="mb-4" />
            )}
            
            {/* Repurchase Rate - Coming Soon */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Repurchase Rate</span>
                <InfoTooltip content="What percentage of people are repurchasing this product or buying from this brand again within a year." />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Coming Soon</span>
            </div>
            <Progress value={0} className="mb-4 opacity-50" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-medium">Rating Breakdown</h4>
            </div>
            {hasRatingData ? (
              Object.entries(trustMetrics?.ratingBreakdown || {})
                .sort(([a], [b]) => parseInt(b) - parseInt(a))
                .map(([stars, percentage]) => (
                  <div key={stars} className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1 w-8">
                      <RatingRingIcon rating={parseInt(stars)} size={14} />
                      <span className="text-sm">{stars}</span>
                    </div>
                    <Progress value={percentage} className="flex-1" />
                    <span className="text-sm w-8 text-right">{percentage}%</span>
                  </div>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">No rating data available</p>
            )}
          </div>
        </div>

        <Separator className="my-4" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <div className="flex items-center gap-2">
              <span className="text-sm">Rating Evolution: {getRatingEvolutionDisplay()}</span>
              <InfoTooltip content="Average rating trend over the last 4 quarters." />
            </div>
          </div>
          <span className="text-xs text-gray-500">Last Updated: 2 days ago</span>
        </div>
      </CardContent>
    </Card>
  );
};
