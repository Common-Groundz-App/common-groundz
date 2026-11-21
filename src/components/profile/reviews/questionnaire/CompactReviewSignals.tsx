/**
 * Phase 10B Step 3 — compact reader signals for review cards: the reviewer's
 * explicit recommendation and saved repeat-intent answer. Never derived from
 * the rating; renders nothing when both are unanswered. Callers must mount it
 * only inside the revealed (non-spoiler) branch.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import ReviewRecommendationBadge from './ReviewRecommendationBadge';
import { resolveReviewReaderDetails } from './readerDetails';

export interface CompactReviewSignalsProps {
  metadata: unknown;
  category: string | null | undefined;
  className?: string;
}

const CompactReviewSignals: React.FC<CompactReviewSignalsProps> = ({ metadata, category, className }) => {
  const { recommendation, repeatIntent } = resolveReviewReaderDetails(metadata, category);
  if (!recommendation && !repeatIntent) return null;
  return (
    <div data-testid="compact-review-signals" className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <ReviewRecommendationBadge value={recommendation} />
      {repeatIntent && (
        <span
          data-testid="repeat-intent-badge"
          className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
        >
          {repeatIntent.question} {repeatIntent.answer}
        </span>
      )}
    </div>
  );
};

export default CompactReviewSignals;
