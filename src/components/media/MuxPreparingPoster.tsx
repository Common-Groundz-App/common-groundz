import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';
import { isMuxErrored, muxPosterUrl } from '@/utils/muxMedia';

interface MuxPreparingPosterProps {
  item: MediaItem;
  className?: string;
  /** Tailwind object-fit class, defaults to cover. */
  objectFit?: 'cover' | 'contain';
  /** Hide the badge (e.g. tiny composer thumbnails). */
  hideBadge?: boolean;
  /** Optional alt override. */
  alt?: string;
}

/**
 * Phase 2A — Renders the Mux poster + a Processing/Error badge when a Mux
 * MediaItem is not yet playable. Never mounts a <video> element.
 *
 * Renderers should call this whenever isMuxPreparing(item) is true, instead
 * of constructing their own <video>. This keeps every video surface safe
 * the moment Phase 2B starts producing Mux items.
 */
export const MuxPreparingPoster: React.FC<MuxPreparingPosterProps> = ({
  item,
  className,
  objectFit = 'cover',
  hideBadge = false,
  alt,
}) => {
  const poster = muxPosterUrl(item);
  const errored = isMuxErrored(item);

  return (
    <div
      className={cn(
        'relative w-full h-full bg-muted overflow-hidden',
        className,
      )}
      data-mux-status={item.mux_status ?? 'preparing'}
      data-testid="mux-preparing-poster"
    >
      {poster ? (
        <img
          src={poster}
          alt={alt ?? item.alt ?? 'Video processing'}
          className={cn(
            'w-full h-full',
            objectFit === 'cover' ? 'object-cover' : 'object-contain',
          )}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-muted" />
      )}

      {!hideBadge && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-2 pointer-events-none">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm',
              errored
                ? 'bg-destructive/85 text-destructive-foreground'
                : 'bg-black/65 text-white',
            )}
          >
            {errored ? (
              <>
                <AlertTriangle className="h-3 w-3" />
                <span>Couldn't process video</span>
              </>
            ) : (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing video…</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MuxPreparingPoster;
