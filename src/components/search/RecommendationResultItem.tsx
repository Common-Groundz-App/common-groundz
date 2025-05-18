
import React from 'react';
import { Link } from 'react-router-dom';
import { RecommendationSearchResult } from '@/hooks/use-unified-search';
import { Award } from 'lucide-react';

interface RecommendationResultItemProps {
  recommendation: RecommendationSearchResult;
  onClick: () => void;
}

export function RecommendationResultItem({ recommendation, onClick }: RecommendationResultItemProps) {
  return (
    <Link
      to={`/recommendations/${recommendation.id}`}
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-center h-8 w-8 bg-primary/10 rounded-full">
        <Award className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{recommendation.title}</p>
        <div className="flex items-center text-xs text-muted-foreground gap-1">
          <span>{recommendation.category}</span>
          {recommendation.entities && (
            <>
              <span className="mx-1">•</span>
              <span className="truncate">{recommendation.entities.name}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
