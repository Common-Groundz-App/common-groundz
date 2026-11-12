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

// Geometry copied from ConnectedRingsRating's `sm`/`md` configs (same
// stroke/radius ≈ 0.2 and overlap/diameter ≈ 0.37 ratios), sized between them.
const RING_SIZE = 18; // outer radius → 36px diameter
const STROKE = 3.4;
const OVERLAP = 13.5; // ≈37.5% interlocking, same ratio as before
const RING_STEP = RING_SIZE * 2 - OVERLAP; // 22.5px centre-to-centre
const RING_RADIUS = RING_SIZE - STROKE / 2;
const DIAMETER = RING_SIZE * 2;
const HIT_HEIGHT = 44;
const EDGE = (DIAMETER - RING_STEP) / 2; // first/last ring overhang

const CompactConnectedRingsRating: React.FC<CompactConnectedRingsRatingProps> = ({
  label,
  value,
  onChange,
  idPrefix,
}) => {
  const [hover, setHover] = useState(0);
  const display = hover || value || 0;
  const activeColor = display > 0 ? getSentimentColor(display) : undefined;
  const width = RING_STEP * 4 + DIAMETER;
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
          style={{ width, height: HIT_HEIGHT }}
          onPointerLeave={() => setHover(0)}
        >
          <svg
            width={width}
            height={HIT_HEIGHT}
            viewBox={`0 0 ${width} ${HIT_HEIGHT}`}
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= display;
              // Same dimming rule as the primary rings: unfilled rings fade
              // once a value exists (never at 5).
              const dim = value !== undefined && value < 5 && !filled ? 0.5 : 1;
              return (
                <circle
                  key={n}
                  cx={RING_SIZE + (n - 1) * RING_STEP}
                  cy={HIT_HEIGHT / 2}
                  r={RING_RADIUS}
                  fill="transparent"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  style={{
                    stroke: filled
                      ? activeColor
                      : value
                        ? 'hsl(var(--border))'
                        : 'hsl(var(--muted-foreground) / 0.6)',
                    opacity: dim,
                    transition: 'stroke 0.2s ease-out, opacity 0.3s ease-out',
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
                  onClick={() => {
                    setHover(0);
                    onChange(selected ? undefined : n);
                  }}
                  // Touch taps fire synthetic mouse events with no leave; hover only for real mice.
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setHover(n);
                  }}
                  onFocus={() => setHover(0)}
                  // Contiguous, non-overlapping zones: outer zones absorb the ring overhang.
                  style={{ width: n === 1 || n === 5 ? RING_STEP + EDGE : RING_STEP }}
                  className="h-11 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          onClick={() => {
            setHover(0);
            onChange(undefined);
          }}
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
