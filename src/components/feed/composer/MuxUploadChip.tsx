import * as React from 'react';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MuxUiStatus } from '@/hooks/useMuxStatus';

/**
 * Composer-session dismissal memory. Once a given upload_id's "Ready"
 * chip has faded out, we never show it again for that upload in the same
 * SPA session — even if the tile remounts (reorder, scroll virtualization,
 * etc.). Cleared only on hard page reload — desired.
 */
const dismissedReadyChips = new Set<string>();
const MAX_DISMISSED = 64;

function rememberDismissed(uploadId: string) {
  if (dismissedReadyChips.has(uploadId)) return;
  if (dismissedReadyChips.size >= MAX_DISMISSED) {
    // Set preserves insertion order — drop the oldest entry.
    const oldest = dismissedReadyChips.values().next().value;
    if (oldest !== undefined) dismissedReadyChips.delete(oldest);
  }
  dismissedReadyChips.add(uploadId);
}

interface Props {
  uploadId: string;
  status: MuxUiStatus | undefined;
  className?: string;
}

const FADE_MS = 1500;

export function MuxUploadChip({ uploadId, status, className }: Props) {
  const [readyHidden, setReadyHidden] = React.useState(
    () => dismissedReadyChips.has(uploadId),
  );

  React.useEffect(() => {
    if (status !== 'ready') return;
    if (dismissedReadyChips.has(uploadId)) {
      setReadyHidden(true);
      return;
    }
    const t = setTimeout(() => {
      dismissedReadyChips.add(uploadId);
      setReadyHidden(true);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [status, uploadId]);

  if (!status) return null;
  if (status === 'ready' && readyHidden) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'absolute top-2 left-2 z-10 pointer-events-none select-none',
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        'shadow-sm backdrop-blur-sm',
        status === 'processing' && 'bg-background/80 text-foreground',
        status === 'ready' &&
          'bg-background/80 text-foreground transition-opacity duration-700 ' +
            (readyHidden ? 'opacity-0' : 'opacity-100 animate-fade-in'),
        status === 'failed' && 'bg-destructive/90 text-destructive-foreground',
        className,
      )}
      style={
        status === 'ready'
          ? { transitionDelay: `${FADE_MS - 700}ms` }
          : undefined
      }
    >
      {status === 'processing' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing</span>
        </>
      )}
      {status === 'ready' && (
        <>
          <Check className="h-3 w-3" />
          <span>Ready</span>
        </>
      )}
      {status === 'failed' && (
        <>
          <AlertTriangle className="h-3 w-3" />
          <span>Upload failed</span>
        </>
      )}
    </div>
  );
}
