
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Clock, CheckCircle, AlertCircle, Shield, Flag, Users } from 'lucide-react';
import { useAdminDashboard } from '@/hooks/admin/useAdminDashboard';
import { useAdminModeration } from '@/hooks/admin/useAdminModeration';
import { formatRelativeDate } from '@/utils/dateUtils';

export const AdminDashboardSummary = () => {
  const { metrics, isLoading } = useAdminDashboard();
  const { metrics: moderationMetrics, isLoading: moderationLoading } = useAdminModeration();

  if (isLoading || moderationLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Dashboard Overview
          </CardTitle>
          <CardDescription>AI summary generation statistics and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse space-y-4 w-full">
              {[1, 2].map(i => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Dashboard Overview
        </CardTitle>
        <CardDescription>AI summary generation statistics and status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Reviews Metrics */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Dynamic Reviews
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{metrics.totalDynamicReviews}</div>
                <div className="text-xs text-muted-foreground">Total Reviews</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-green-600">{metrics.reviewsWithAISummary}</div>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xs text-muted-foreground">With AI Summary</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics.totalDynamicReviews - metrics.reviewsWithAISummary}
                  </div>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-xs text-muted-foreground">Pending Summary</div>
              </div>
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs">
                  {metrics.totalDynamicReviews > 0 
                    ? `${Math.round((metrics.reviewsWithAISummary / metrics.totalDynamicReviews) * 100)}%`
                    : '0%'
                  } Complete
                </Badge>
                <div className="text-xs text-muted-foreground">Coverage</div>
              </div>
            </div>
          </div>

          {/* Entities Metrics */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Entities with Dynamic Reviews
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{metrics.totalEntitiesWithDynamicReviews}</div>
                <div className="text-xs text-muted-foreground">Total Entities</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-green-600">{metrics.entitiesWithAISummary}</div>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xs text-muted-foreground">With AI Summary</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics.totalEntitiesWithDynamicReviews - metrics.entitiesWithAISummary}
                  </div>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-xs text-muted-foreground">Pending Summary</div>
              </div>
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs">
                  {metrics.totalEntitiesWithDynamicReviews > 0 
                    ? `${Math.round((metrics.entitiesWithAISummary / metrics.totalEntitiesWithDynamicReviews) * 100)}%`
                    : '0%'
                  } Complete
                </Badge>
                <div className="text-xs text-muted-foreground">Coverage</div>
              </div>
            </div>
          </div>

          {/* Moderation Metrics */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Moderation & Quality Control
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-orange-600">{moderationMetrics.pendingFlagsCount}</div>
                  <Flag className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-xs text-muted-foreground">Pending Flags</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-red-600">{moderationMetrics.highPriorityFlagsCount}</div>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-xs text-muted-foreground">High Priority</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-blue-600">{moderationMetrics.pendingDuplicatesCount}</div>
                  <Shield className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-xs text-muted-foreground">Duplicates</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(moderationMetrics.avgUserReputation)}
                  </div>
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xs text-muted-foreground">Avg Reputation</div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{metrics.pendingSummaries} Total Pending</span>
              </div>
              {metrics.lastSummaryGeneration && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Last generated {formatRelativeDate(metrics.lastSummaryGeneration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
