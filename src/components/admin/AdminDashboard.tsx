
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Building2, 
  Brain, 
  Activity,
  TrendingUp
} from 'lucide-react';
import { fetchAdminAnalytics, type AdminAnalytics } from '@/services/adminService';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await fetchAdminAnalytics();
        setAnalytics(data);
      } catch (error) {
        console.error('Error loading admin analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Unable to load analytics data
          </p>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      title: 'Dynamic Reviews',
      value: analytics.total_reviews,
      description: 'Reviews with timeline data',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      title: 'Active Entities',
      value: analytics.entities_with_dynamic_reviews,
      description: 'Entities with dynamic reviews',
      icon: Building2,
      color: 'text-green-600'
    },
    {
      title: 'AI Summaries',
      value: analytics.reviews_with_ai_summary,
      description: 'Reviews with AI summaries',
      icon: Brain,
      color: 'text-purple-600'
    },
    {
      title: 'Recent Generations',
      value: analytics.recent_ai_generations,
      description: 'AI summaries in last 24h',
      icon: TrendingUp,
      color: 'text-orange-600'
    }
  ];

  const summaryPercentage = analytics.total_reviews > 0 
    ? Math.round((analytics.reviews_with_ai_summary / analytics.total_reviews) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">AI Summary Coverage</span>
              <Badge variant={summaryPercentage > 50 ? "default" : "secondary"}>
                {summaryPercentage}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Generation Status</span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Recent Activity</span>
              <span className="text-sm text-muted-foreground">
                {analytics.recent_ai_generations} generations today
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI Summary Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Reviews with Summaries</span>
                <span className="font-medium">{analytics.reviews_with_ai_summary}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pending Summaries</span>
                <span className="font-medium">
                  {analytics.total_reviews - analytics.reviews_with_ai_summary}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <Badge variant="outline">~95%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
