
import React from 'react';
import { Link } from 'react-router-dom';
import { ReviewSearchResult } from '@/hooks/use-unified-search';
import { Star } from 'lucide-react';

interface ReviewResultItemProps {
  review: ReviewSearchResult;
  onClick: () => void;
}

export function ReviewResultItem({ review, onClick }: ReviewResultItemProps) {
  return (
    <Link
      to={`/review/${review.id}`}
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-center h-8 w-8 bg-primary/10 rounded-full">
        <Star className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{review.title}</p>
        <div className="flex items-center text-xs text-muted-foreground gap-1">
          <div className="flex items-center">
            <Star className="w-3 h-3 fill-primary text-primary mr-0.5" /> 
            <span>{review.rating}</span>
          </div>
          {review.entities && (
            <>
              <span className="mx-1">•</span>
              <span className="truncate">{review.entities.name}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
