/**
 * Phase 7B — compact, optional Connected Rings input for attribute ratings.
 *
 * Same visual identity as the primary `ConnectedRingsRating` (overlapping
 * rings, shared sentiment colors) but built for optional sub-ratings:
 * - every ring is a real `type="button"` with a 44px hit area;
 * - tapping the selected ring again clears it; a subtle Clear action too;
 * - no celebration / pulse animations, no Escape handling.
 * The primary overall rating component is not touched.
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { getSentimentColor } from '@/utils/ratingColorUtils';

export interface CompactConnectedRingsRatingProps {
  /** Accessible attribute name, e.g. "Taste & flavor". */
  label: string;
  /** 1–5, or undefined when unrated. */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** DOM id prefix (stable per attribute). */
  idPrefix: string;
}

const RING_STEP = 44; // px — also the hit-target width
// Outer diameter slightly exceeds the step so neighbouring rings touch ("connected").
const RING_RADIUS = 20.5;
const STROKE = 3;

const CompactConnectedRingsRating: React.FC<CompactConnectedRingsRatingProps> = ({
  label,
  value,
  onChange,
  idPrefix,
}) => {
  const [hover, setHover] = useState(0);
  const display = hover || value || 0;
  const activeColor = display > 0 ? getSentimentColor(display) : undefined;
  const width = RING_STEP * 5;
  const labelId = `${idPrefix}-label`;

  return (
    <div
      className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      data-testid={`attribute-rating-${idPrefix}`}
    >
      <div className="flex items-baseline justify-between gap-3 sm:min-w-0 sm:flex-1">
        <span id={labelId} className="text-sm font-medium text-foreground">
          {label}
        </span>
        <span
          className="text-xs tabular-nums text-muted-foreground sm:hidden"
          aria-hidden="true"
        >
          {value ? `${value}/5` : 'Not rated'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-labelledby={labelId}
          className="relative shrink-0"
          style={{ width, height: RING_STEP }}
          onMouseLeave={() => setHover(0)}
        >
          <svg
            width={width}
            height={RING_STEP}
            viewBox={`0 0 ${width} ${RING_STEP}`}
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= display;
              return (
                <circle
                  key={n}
                  cx={RING_STEP / 2 + (n - 1) * RING_STEP}
                  cy={RING_STEP / 2}
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  style={{
                    stroke: filled ? activeColor : 'hsl(var(--border))',
                    transition: 'stroke 150ms ease',
                  }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex">
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${label}: ${n} of 5${selected ? ' (selected, tap to clear)' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onChange(selected ? undefined : n)}
                  onMouseEnter={() => setHover(n)}
                  onFocus={() => setHover(0)}
                  className="h-11 w-11 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              );
            })}
          </div>
        </div>

        <span
          className="hidden w-10 text-right text-xs tabular-nums text-muted-foreground sm:inline"
          aria-hidden="true"
        >
          {value ? `${value}/5` : ''}
        </span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`Clear ${label} rating`}
          className={cn(
            'h-11 px-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
            !value && 'invisible',
          )}
          tabIndex={value ? 0 : -1}
          aria-hidden={!value}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default CompactConnectedRingsRating;
