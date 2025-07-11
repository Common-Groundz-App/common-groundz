
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, RefreshCw, TrendingUp, MessageCircle } from 'lucide-react';

export const TrustSummary = () => {
  return (
    <div className="space-y-6">
      {/* Trust Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Trust Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trust Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Circle Certified</span>
                <span className="text-sm font-bold text-green-600">78%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Repurchase Rate</span>
                <span className="text-sm font-bold text-blue-600">63%</span>
              </div>
              
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Rating Evolution</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  4.7 → 4.2 → 3.9 → 4.3 (trending up)
                </div>
              </div>
            </div>

            {/* Review Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Review Breakdown</h4>
              {[
                { stars: 5, count: 1847, percentage: 65 },
                { stars: 4, count: 568, percentage: 20 },
                { stars: 3, count: 284, percentage: 10 },
                { stars: 2, count: 85, percentage: 3 },
                { stars: 1, count: 63, percentage: 2 }
              ].map((item) => (
                <div key={item.stars} className="flex items-center gap-3">
                  <span className="text-sm w-8">{item.stars}★</span>
                  <Progress value={item.percentage} className="flex-1" />
                  <span className="text-sm text-muted-foreground w-12">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-4 border-t">
            Last Updated: March 15, 2024
          </div>
        </CardContent>
      </Card>

      {/* Ask Community */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Ask the Community</h3>
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="Ask a question about Cosmix..." 
              className="flex-1"
            />
            <Button>Ask</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
