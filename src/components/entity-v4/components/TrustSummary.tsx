
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCcw, MessageCircle, TrendingUp } from 'lucide-react';

export const TrustSummary = () => {
  const reviewBreakdown = [
    { stars: 5, count: 1420, percentage: 72 },
    { stars: 4, count: 340, percentage: 17 },
    { stars: 3, count: 142, percentage: 7 },
    { stars: 2, count: 57, percentage: 3 },
    { stars: 1, count: 20, percentage: 1 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Trust Summary Box */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trust Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium">Circle Certified</span>
            </div>
            <span className="text-lg font-bold text-green-600">78%</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Repurchase Rate</span>
            </div>
            <span className="text-lg font-bold text-blue-600">63%</span>
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground">Last Updated 3 days ago</p>
          </div>
        </CardContent>
      </Card>

      {/* Review Breakdown & Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Review Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Review Breakdown */}
          <div className="space-y-2">
            {reviewBreakdown.map((item) => (
              <div key={item.stars} className="flex items-center gap-3">
                <span className="text-sm w-6">{item.stars}★</span>
                <Progress value={item.percentage} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground w-8">{item.count}</span>
              </div>
            ))}
          </div>

          {/* Rating Evolution */}
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Rating Evolution</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>6m ago: 4.7</span>
              <span>3m ago: 4.2</span>
              <span>1m ago: 3.9</span>
              <span className="font-medium text-foreground">Now: 4.3</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ask Community */}
      <Card className="md:col-span-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-brand-orange" />
              <div>
                <p className="font-medium">Have questions about Cosmix?</p>
                <p className="text-sm text-muted-foreground">Ask our community of users</p>
              </div>
            </div>
            <Button variant="outline">Ask Question</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
