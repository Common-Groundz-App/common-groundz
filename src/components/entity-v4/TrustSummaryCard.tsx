
import React from 'react';
import { Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export const TrustSummaryCard: React.FC = () => {
  // Trust Metrics - TODO: Make this dynamic from real data
  const trustMetrics = {
    circleCertified: 78,
    repurchaseRate: 63,
    ratingBreakdown: {
      5: 45,
      4: 30,
      3: 15,
      2: 7,
      1: 3
    }
  };

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
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Circle Certified</span>
              <span className="text-sm font-semibold text-green-600">{trustMetrics.circleCertified}%</span>
            </div>
            <Progress value={trustMetrics.circleCertified} className="mb-4" />
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Repurchase Rate</span>
              <span className="text-sm font-semibold text-blue-600">{trustMetrics.repurchaseRate}%</span>
            </div>
            <Progress value={trustMetrics.repurchaseRate} className="mb-4" />
          </div>

          <div>
            <h4 className="font-medium mb-3">Rating Breakdown</h4>
            {Object.entries(trustMetrics.ratingBreakdown).reverse().map(([stars, percentage]) => (
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
            <span className="text-sm">Rating Evolution: 4.7 → 4.2 → 3.9 → 4.3</span>
          </div>
          <span className="text-xs text-gray-500">Last Updated: 2 days ago</span>
        </div>
      </CardContent>
    </Card>
  );
};
