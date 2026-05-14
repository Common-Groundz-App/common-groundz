import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export type CompatibilityState = 'checking' | 'compatible' | 'risky';

interface Props {
  state: CompatibilityState;
  note?: string;
  className?: string;
}

/**
 * Soft, non-blocking compatibility indicator for video uploads.
 * Uses semantic tokens — no hardcoded colors.
 */
export function MediaCompatibilityBadge({ state, note, className }: Props) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border';

  if (state === 'checking') {
    return (
      <span className={cn(base, 'bg-muted text-muted-foreground border-border', className)}>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Checking compatibility…
      </span>
    );
  }

  if (state === 'compatible') {
    return (
      <span
        className={cn(
          base,
          'bg-success/10 text-success border-success/20',
          className
        )}
        title={note}
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Compatible video
      </span>
    );
  }

  return (
    <span
      className={cn(
        base,
        'bg-warning/10 text-warning border-warning/20',
        className
      )}
      title={note}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      May not play on all devices
    </span>
  );
}
