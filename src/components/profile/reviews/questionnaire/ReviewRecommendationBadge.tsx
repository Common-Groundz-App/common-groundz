/**
 * Phase 10B — compact badge for the reviewer's explicit recommendation.
 * Independent of the star/rings rating; renders nothing when unanswered.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import type { RecommendationValue } from './readerDetails';

const COPY: Record<RecommendationValue, { label: string; className: string }> = {
  yes: { label: 'Recommends', className: 'border-primary/30 bg-primary/10 text-primary' },
  maybe: { label: 'Maybe recommends', className: 'border-border bg-muted text-muted-foreground' },
  no: { label: "Doesn't recommend", className: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

export interface ReviewRecommendationBadgeProps {
  value: RecommendationValue | null | undefined;
  className?: string;
}

const ReviewRecommendationBadge: React.FC<ReviewRecommendationBadgeProps> = ({ value, className }) => {
  const copy = value ? COPY[value] : undefined;
  if (!copy) return null;
  return (
    <span
      data-testid="recommendation-badge"
      className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', copy.className, className)}
    >
      {copy.label}
    </span>
  );
};

export default ReviewRecommendationBadge;
