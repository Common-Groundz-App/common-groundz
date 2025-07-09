
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Heart, 
  Star, 
  Users,
  BarChart3,
  Calendar
} from 'lucide-react';

interface EntityStats {
  views_24h: number;
  views_7d: number;
  views_30d: number;
  likes_24h: number;
  followers: number;
  trending_score: number;
  rating_distribution: {
    [key: number]: number;
  };
  peak_hours: string[];
  popular_days: string[];
  growth_rate: number;
}

interface EntityV3SidebarStatsProps {
  entityId: string;
  stats?: EntityStats;
  isLoading?: boolean;
}

export const EntityV3SidebarStats: React.FC<EntityV3SidebarStatsProps> = ({
  entityId,
  stats,
  isLoading = false
}) => {
  // Mock data for demonstration
  const mockStats: EntityStats = {
    views_24h: 342,
    views_7d: 2150,
    views_30d: 8750,
    likes_24h: 28,
    followers: 156,
    trending_score: 7.8,
    rating_distribution: {
      5: 65,
      4: 20,
      3: 10,
      2: 3,
      1: 2
    },
    peak_hours: ['9-11 AM', '2-4 PM', '7-9 PM'],
    popular_days: ['Saturday', 'Sunday', 'Friday'],
    growth_rate: 12.5
  };

  const displayStats = stats || mockStats;

  const getTrendIcon = (rate: number) => {
    return rate > 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getTrendColor = (rate: number) => {
    return rate > 0 ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* View Stats */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Views & Engagement
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{displayStats.views_24h}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{displayStats.views_7d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Monthly Views</span>
            <div className="flex items-center gap-1">
              <span className="font-medium">{displayStats.views_30d.toLocaleString()}</span>
              {getTrendIcon(displayStats.growth_rate)}
              <span className={`text-xs ${getTrendColor(displayStats.growth_rate)}`}>
                {Math.abs(displayStats.growth_rate)}%
              </span>
            </div>
          </div>
        </div>

        {/* Trending Score */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending Score
          </h4>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Progress value={displayStats.trending_score * 10} className="h-2" />
            </div>
            <Badge variant={displayStats.trending_score > 7 ? 'default' : 'secondary'}>
              {displayStats.trending_score}/10
            </Badge>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Star className="h-4 w-4" />
            Rating Breakdown
          </h4>
          <div className="space-y-2">
            {Object.entries(displayStats.rating_distribution)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([rating, percentage]) => (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 w-12">
                    <span>{rating}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <Progress value={percentage} className="h-2" />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {percentage}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Peak Activity */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Peak Activity
          </h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Popular Times</p>
              <div className="flex flex-wrap gap-1">
                {displayStats.peak_hours.map((hour) => (
                  <Badge key={hour} variant="outline" className="text-xs">
                    {hour}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Popular Days</p>
              <div className="flex flex-wrap gap-1">
                {displayStats.popular_days.map((day) => (
                  <Badge key={day} variant="outline" className="text-xs">
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Social Stats */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Heart className="h-4 w-4 text-red-500" />
            <span>{displayStats.likes_24h} likes today</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-blue-500" />
            <span>{displayStats.followers} followers</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
