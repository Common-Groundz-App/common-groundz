
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

interface AISummaryCardProps {
  summary: string;
  className?: string;
}

export const AISummaryCard = ({ summary, className = "" }: AISummaryCardProps) => {
  return (
    <Card className={`bg-gradient-to-r from-orange-50 to-orange-100/80 dark:from-orange-950/20 dark:to-orange-900/30 border-orange-200 dark:border-orange-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Summary
          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300 dark:border-orange-700">
            Timeline Analysis
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
          {summary}
        </p>
      </CardContent>
    </Card>
  );
};
