/**
 * Phase 10B — non-interactive Connected Rings for READ-ONLY attribute ratings.
 * Same geometry/colors as the authoring compact rings, but no buttons, no
 * hover, no focus stops: a single labelled image for screen readers.
 */
import React from 'react';
import { getSentimentColor } from '@/utils/ratingColorUtils';

const RING_SIZE = 9;
const STROKE = 2;
const OVERLAP = 6.75;
const STEP = RING_SIZE * 2 - OVERLAP;
const DIAMETER = RING_SIZE * 2;

export interface StaticAttributeRingsProps {
  label: string;
  value: number;
}

const StaticAttributeRings: React.FC<StaticAttributeRingsProps> = ({ label, value }) => {
  const v = Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
  if (!v) return null;
  const color = getSentimentColor(v);
  const width = STEP * 4 + DIAMETER;
  return (
    <div className="flex items-center justify-between gap-3" data-testid="static-attribute-rating">
      <span className="min-w-0 truncate text-sm text-foreground">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        <svg role="img" aria-label={`${label}: ${v} of 5`} width={width} height={DIAMETER} viewBox={`0 0 ${width} ${DIAMETER}`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <circle
              key={n}
              cx={RING_SIZE + (n - 1) * STEP}
              cy={RING_SIZE}
              r={RING_SIZE - STROKE / 2}
              fill="transparent"
              strokeWidth={STROKE}
              style={{
                stroke: n <= v ? color : 'hsl(var(--border))',
                opacity: v < 5 && n > v ? 0.5 : 1,
              }}
            />
          ))}
        </svg>
        <span className="w-7 text-right text-xs tabular-nums text-muted-foreground" aria-hidden="true">
          {v}/5
        </span>
      </div>
    </div>
  );
};

export default StaticAttributeRings;
