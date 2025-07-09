
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RatingData {
  rating: number;
  count: number;
  percentage: number;
}

interface TrendData {
  period: string;
  average: number;
  change: number;
}

interface EntityV3RatingBreakdownProps {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: RatingData[];
  trends?: TrendData[];
  trustScore?: number;
  verifiedPercentage?: number;
}

export const EntityV3RatingBreakdown: React.FC<EntityV3RatingBreakdownProps> = ({
  averageRating,
  totalReviews,
  ratingDistribution,
  trends = [],
  trustScore,
  verifiedPercentage
}) => {
  const renderStars = (rating: number, size = "w-4 h-4") => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`${size} ${
          i < Math.floor(rating) 
            ? 'fill-yellow-400 text-yellow-400' 
            : i < rating
            ? 'fill-yellow-400/50 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-3 h-3 text-green-600" />;
    if (change < 0) return <TrendingDown className="w-3 h-3 text-red-600" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 1.8) return "text-green-600 bg-green-50";
    if (score >= 1.5) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className="space-y-6">
      {/* Overall Rating Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex items-center gap-1 justify-center mb-2">
                {renderStars(averageRating, "w-5 h-5")}
              </div>
              <div className="text-sm text-muted-foreground">
                {totalReviews} review{totalReviews !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {ratingDistribution.map((data) => (
                <div key={data.rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium">{data.rating}</span>
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <Progress 
                    value={data.percentage} 
                    className="flex-1 h-2"
                  />
                  <div className="text-sm text-muted-foreground w-12 text-right">
                    {data.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust and Verification Metrics */}
          <div className="flex gap-4 mt-6 pt-6 border-t">
            {trustScore && (
              <div className="flex items-center gap-2">
                <Badge className={getTrustScoreColor(trustScore)}>
                  Trust Score: {trustScore.toFixed(1)}/2.0
                </Badge>
              </div>
            )}
            
            {verifiedPercentage && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {verifiedPercentage}% Verified Reviews
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rating Trends */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rating Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">{trend.period}</div>
                    <div className="flex items-center gap-1">
                      {renderStars(trend.average)}
                      <span className="text-sm text-muted-foreground ml-2">
                        {trend.average.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getTrendIcon(trend.change)}
                    <span className={`text-sm font-medium ${
                      trend.change > 0 ? 'text-green-600' : 
                      trend.change < 0 ? 'text-red-600' : 
                      'text-gray-400'
                    }`}>
                      {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Review Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((ratingDistribution.filter(r => r.rating >= 4).reduce((sum, r) => sum + r.count, 0) / totalReviews) * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Positive Reviews</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {Math.round((ratingDistribution.reduce((sum, r) => sum + (r.count * r.rating), 0) / totalReviews / 5) * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Satisfaction Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
